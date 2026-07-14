import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { LocalDatabase, User, Customer, Order, OrderStatusHistory, Task, TaskUpdate, Role, Objective, ObjectiveKeyResult, ObjectiveProgressUpdate, Notification, ChatMessage, Lead, LeadFeedback, prisma } from './src/db_service';
import { classifyIntent } from './src/lib/chatbot/nlp';
import { extractEntities } from './src/lib/chatbot/entityExtractor';
import { buildAndExecuteQuery } from './src/lib/chatbot/queryBuilder';
import { renderResponse } from './src/lib/chatbot/responseTemplates';
import { resolveCustomer } from './src/lib/chatbot/fuzzyMatch';

const DEV_JWT_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is missing in production!');
  }
  console.warn('WARNING: JWT_SECRET missing. Using ephemeral dev key; sessions reset on restart.');
  return DEV_JWT_SECRET;
}
const JWT_SECRET = getJwtSecret();

function sanitizeUser(user: User): Omit<User, 'password_hash'>;
function sanitizeUser(user: undefined): undefined;
function sanitizeUser(user: User | undefined): Omit<User, 'password_hash'> | undefined {
  if (!user) return undefined;
  const { password_hash, ...cleanUser } = user;
  return cleanUser;
}

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function parseIsoCalendarDate(value: unknown): CalendarDate | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;

  return { year, month, day };
}

function isValidOptionalCalendarDate(value: unknown): boolean {
  return value === undefined || value === null || value === '' || parseIsoCalendarDate(value) !== null;
}

function normalizeOptionalCalendarDate(value: unknown): string | null {
  return value === undefined || value === null || value === '' ? null : String(value);
}

function getVietnamCalendarDate(now: Date): CalendarDate {
  const parts = vietnamDateFormatter.formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function annualOccurrence(year: number, month: number, day: number): CalendarDate {
  // Quy ước nghiệp vụ: sinh nhật 29/02 được nhắc vào 28/02 trong năm không nhuận.
  if (month === 2 && day === 29 && !isLeapYear(year)) return { year, month, day: 28 };
  return { year, month, day };
}

function calendarDayNumber(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / DAY_IN_MS;
}

function nextAnnualOccurrence(today: CalendarDate, month: number, day: number): { date: CalendarDate; daysUntil: number } {
  let date = annualOccurrence(today.year, month, day);
  let daysUntil = calendarDayNumber(date) - calendarDayNumber(today);
  if (daysUntil < 0) {
    date = annualOccurrence(today.year + 1, month, day);
    daysUntil = calendarDayNumber(date) - calendarDayNumber(today);
  }
  return { date, daysUntil };
}

function formatCalendarDate(date: CalendarDate): string {
  return `${String(date.day).padStart(2, '0')}/${String(date.month).padStart(2, '0')}/${date.year}`;
}

export function buildAnniversaryNotifications(
  customers: Customer[],
  existingNotifications: Notification[],
  reminderDays: number,
  now = new Date(),
): Notification[] {
  const safeReminderDays = Number.isInteger(reminderDays) && reminderDays >= 1 && reminderDays <= 30
    ? reminderDays
    : 7;
  const today = getVietnamCalendarDate(now);
  const existingIds = new Set(existingNotifications.map(notification => notification.related_id).filter(Boolean));
  const generated: Notification[] = [];

  const addNotification = (
    customer: Customer,
    type: 'birthday' | 'wedding',
    sourceDate: CalendarDate,
  ) => {
    const occurrence = nextAnnualOccurrence(today, sourceDate.month, sourceDate.day);
    const years = occurrence.date.year - sourceDate.year;
    if (years <= 0 || occurrence.daysUntil > safeReminderDays) return;

    const reminderId = `anniversary:${type}:${customer.id}:${years}:${occurrence.date.year}`;
    if (existingIds.has(reminderId)) return;
    existingIds.add(reminderId);

    const fbText = customer.facebook_url ? ` | FB: ${customer.facebook_url}` : '';
    const formattedDate = formatCalendarDate(occurrence.date);
    const isWedding = type === 'wedding';
    generated.push({
      id: 'notif-' + crypto.randomUUID(),
      sender_id: 'system',
      receiver_id: null,
      title: isWedding
        ? `[Kỷ niệm] Sắp đến kỷ niệm ${years} năm ngày cưới của khách hàng`
        : '[Sinh nhật] Sắp đến ngày sinh nhật / thôi nôi của khách hàng',
      content: isWedding
        ? `Khách hàng ${customer.full_name} (SĐT: ${customer.phone}${fbText}) có kỷ niệm ${years} năm ngày cưới vào ngày ${formattedDate}. Vui lòng tạo tác vụ chăm sóc cho Sale.`
        : `Khách hàng ${customer.full_name} (SĐT: ${customer.phone}${fbText}) có sinh nhật/kỷ niệm thôi nôi vào ngày ${formattedDate}. Vui lòng tạo tác vụ chăm sóc cho Sale.`,
      type: 'anniversary',
      related_id: reminderId,
      is_read_by: [],
      created_at: now.toISOString(),
    });
  };

  for (const customer of customers) {
    const weddingDate = parseIsoCalendarDate(customer.wedding_date);
    if (weddingDate) addNotification(customer, 'wedding', weddingDate);
    const birthday = parseIsoCalendarDate(customer.birthday);
    if (birthday) addNotification(customer, 'birthday', birthday);
  }

  return generated;
}

export async function scanAndGenerateAnniversaryNotifications(now = new Date()): Promise<number> {
  const db = LocalDatabase.get();
  const generated = buildAnniversaryNotifications(
    db.customers || [],
    db.notifications || [],
    db.studio_settings?.anniversary_reminder_days ?? 7,
    now,
  );
  if (generated.length === 0) return 0;

  db.notifications = [...(db.notifications || []), ...generated];
  LocalDatabase.save(db);
  console.log(`[ANNIVERSARY] Generated ${generated.length} anniversary notification(s).`);
  return generated.length;
}

// Mở rộng Express Request để mang theo người dùng đã xác thực.
interface AuthenticatedRequest extends Request {
  user?: User;
  role?: Role;
}

async function startServer() {
  const app = express();

  // Chỉ tin cậy các dải proxy được cấu hình rõ trong môi trường triển khai.
  // Lưu lượng production đi qua Cloudflare Tunnel và bridge nội bộ của Docker trước khi tới Express.
  const trustProxy = process.env.TRUST_PROXY?.trim();
  if (trustProxy) {
    app.set('trust proxy', trustProxy);
  }

  const httpServer = createHttpServer(app);
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });
  
  // Khởi tạo kết nối database và bộ nhớ đệm.
  await LocalDatabase.initialize();

  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
          }
        }
      : false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '8mb' }));

  // Giới hạn tần suất đăng nhập để giảm nguy cơ dò mật khẩu.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: { error: 'Quá nhiều yêu cầu đăng nhập từ IP này, vui lòng thử lại sau 15 phút' },
    standardHeaders: true,
    legacyHeaders: false,
  });


  // Middleware xác thực.
  const resolveAuthenticatedUser = (token: string): { user: User; role?: Role } => {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; sessionVersion?: number };
    const db = LocalDatabase.get();
    const user = db.users.find(u => u.id === decoded.userId);

    if (!user || !user.is_active) throw new Error('Invalid or inactive user');
    if (decoded.sessionVersion === undefined || decoded.sessionVersion !== (user.session_version || 0)) {
      throw new Error('Session has expired or logged out');
    }

    return { user, role: db.roles.find(r => r.id === user.role_id) };
  };

  const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }
    try {
      const { user, role } = resolveAuthenticatedUser(authHeader.slice('Bearer '.length));
      req.user = user;
      req.role = role;
      next();
    } catch (err) {
      const message = err instanceof Error && err.message === 'Session has expired or logged out'
        ? 'Unauthorized: Session has expired or logged out'
        : 'Unauthorized: Invalid or expired token';
      return res.status(401).json({ error: message });
    }
  };

  io.use((socket, next) => {
    const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
    try {
      const { user } = resolveAuthenticatedUser(token);
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', socket => {
    const userId = socket.data.userId as string;
    socket.join('chat:general');
    socket.join(`chat:user:${userId}`);
  });

  // Middleware kiểm tra permission chuẩn của hệ thống.
  const requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.role) {
        return res.status(403).json({ error: 'Forbidden: No role assigned' });
      }
      if (req.role.permissions.includes(permission) || req.role.permissions.includes('admin') || req.role.id === 'role-admin') {
        return next();
      }
      return res.status(403).json({ error: `Forbidden: Missing permission [${permission}]` });
    };
  };

  type AssistantToolName =
    | 'get_business_overview'
    | 'search_customers'
    | 'search_orders'
    | 'search_tasks'
    | 'search_leads'
    | 'get_schedule_range'
    | 'get_operational_alerts'
    | 'get_staff_workload';

  const assistantTools = [
    {
      type: 'function',
      function: {
        name: 'get_business_overview',
        description: 'Lay tong quan nhanh ve khach hang, don hang, doanh thu, task va lead trong he thong.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_customers',
        description: 'Tim khach hang theo ten, so dien thoai hoac email.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Tu khoa ten, so dien thoai hoac email.' },
            limit: { type: 'number', description: 'So ket qua toi da, mac dinh 5.' }
          },
          required: ['query'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_orders',
        description: 'Tim don hang theo ma don, ten khach, so dien thoai, goi chup hoac trang thai.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Tu khoa tim kiem.' },
            status: { type: 'string', description: 'Trang thai don hang neu co.' },
            limit: { type: 'number', description: 'So ket qua toi da, mac dinh 5.' }
          },
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_tasks',
        description: 'Tim task theo tieu de, trang thai, nguoi duoc giao hoac task qua han.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Tu khoa tim kiem.' },
            status: { type: 'string', description: 'Trang thai task.' },
            overdue_only: { type: 'boolean', description: 'Chi lay task qua han.' },
            limit: { type: 'number', description: 'So ket qua toi da, mac dinh 5.' }
          },
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_leads',
        description: 'Tim lead/tu van theo ten, so dien thoai, nguon hoac trang thai.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Tu khoa tim kiem.' },
            status: { type: 'string', description: 'Trang thai lead.' },
            limit: { type: 'number', description: 'So ket qua toi da, mac dinh 5.' }
          },
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_schedule_range',
        description: 'Xem lich chup/don hang theo khoang ngay, ho tro cau hoi hom nay, ngay mai, tuan nay, thang nay.',
        parameters: {
          type: 'object',
          properties: {
            range: { type: 'string', description: 'today, tomorrow, this_week, next_week, this_month hoac custom.' },
            start_date: { type: 'string', description: 'Ngay bat dau YYYY-MM-DD neu custom.' },
            end_date: { type: 'string', description: 'Ngay ket thuc YYYY-MM-DD neu custom.' },
            limit: { type: 'number', description: 'So ket qua toi da, mac dinh 8.' }
          },
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_operational_alerts',
        description: 'Tim canh bao van hanh: task tre, don sap chup thieu task, don chua coc, lead lau chua follow.',
        parameters: {
          type: 'object',
          properties: {
            days_ahead: { type: 'number', description: 'So ngay sap toi de kiem tra lich chup, mac dinh 7.' },
            limit: { type: 'number', description: 'So canh bao toi da moi nhom, mac dinh 5.' }
          },
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_staff_workload',
        description: 'Thong ke khoi luong cong viec theo nhan su: task dang lam, task tre, lich gan voi don hang.',
        parameters: {
          type: 'object',
          properties: {
            range: { type: 'string', description: 'today, this_week, next_week, this_month hoac all.' },
            limit: { type: 'number', description: 'So nhan su toi da, mac dinh 8.' }
          },
          additionalProperties: false
        }
      }
    }
  ];

  const clampLimit = (value: unknown, fallback = 5) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.trunc(parsed), 1), 8);
  };

  const normalizeSearch = (value: unknown) => String(value || '').trim().toLowerCase();

  const formatVndFromThousands = (value: unknown) => {
    const parsed = Number(value) || 0;
    return `${(parsed * 1000).toLocaleString('vi-VN')} đ`;
  };

  const toDateKey = (date: Date) => date.toISOString().split('T')[0];

  const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const getDateRange = (range?: string, startDate?: string, endDate?: string) => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const rangeKey = normalizeSearch(range);

    if (startDate && endDate) {
      return { start: startDate, end: endDate, label: 'khoảng ngày đã chọn' };
    }
    if (rangeKey === 'tomorrow') {
      const tomorrow = addDays(todayDate, 1);
      return { start: toDateKey(tomorrow), end: toDateKey(tomorrow), label: 'ngày mai' };
    }
    if (rangeKey === 'next_week') {
      const start = addDays(todayDate, 7 - todayDate.getDay() + 1);
      const end = addDays(start, 6);
      return { start: toDateKey(start), end: toDateKey(end), label: 'tuần sau' };
    }
    if (rangeKey === 'this_week') {
      const mondayOffset = todayDate.getDay() === 0 ? -6 : 1 - todayDate.getDay();
      const start = addDays(todayDate, mondayOffset);
      const end = addDays(start, 6);
      return { start: toDateKey(start), end: toDateKey(end), label: 'tuần này' };
    }
    if (rangeKey === 'this_month') {
      const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
      const end = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
      return { start: toDateKey(start), end: toDateKey(end), label: 'tháng này' };
    }

    return { start: toDateKey(todayDate), end: toDateKey(todayDate), label: 'hôm nay' };
  };

  const runAssistantTool = (name: AssistantToolName, args: Record<string, any>) => {
    const db = LocalDatabase.get();
    const limit = clampLimit(args.limit);
    const query = normalizeSearch(args.query);
    const today = new Date().toISOString().split('T')[0];

    if (name === 'get_business_overview') {
      const activeOrders = db.orders.filter(o => o.status !== 'cancelled' && o.status !== 'delivered');
      const overdueTasks = db.tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today);
      const openLeads = (db.leads || []).filter(l => l.status === 'consulting');
      const revenue = db.orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
      return {
        customers: db.customers.length,
        orders: db.orders.length,
        active_orders: activeOrders.length,
        total_order_value: revenue,
        pending_tasks: db.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
        overdue_tasks: overdueTasks.length,
        active_leads: openLeads.length,
        generated_at: new Date().toISOString()
      };
    }

    if (name === 'search_customers') {
      return db.customers
        .filter(c => !query || [c.full_name, c.phone, c.email].some(v => normalizeSearch(v).includes(query)))
        .slice(0, limit)
        .map(c => {
          const orders = db.orders.filter(o => o.customer_id === c.id);
          return {
            id: c.id,
            full_name: c.full_name,
            phone: c.phone,
            email: c.email,
            notes: c.notes,
            orders_count: orders.length,
            latest_order: orders.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null
          };
        });
    }

    if (name === 'search_orders') {
      const status = normalizeSearch(args.status);
      return db.orders
        .map(o => {
          const customer = db.customers.find(c => c.id === o.customer_id);
          return {
            ...o,
            customer_name: customer?.full_name || 'Unknown',
            customer_phone: customer?.phone || null
          };
        })
        .filter(o => !status || o.status === status)
        .filter(o => !query || [
          o.order_code,
          o.package_name,
          o.status,
          o.customer_name,
          o.customer_phone
        ].some(v => normalizeSearch(v).includes(query)))
        .slice(0, limit)
        .map(o => ({
          id: o.id,
          order_code: o.order_code,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          status: o.status,
          shoot_date: o.shoot_date,
          package_name: o.package_name,
          total_amount: o.total_amount,
          deposit_amount: o.deposit_amount,
          notes: o.notes
        }));
    }

    if (name === 'search_tasks') {
      const status = normalizeSearch(args.status);
      return db.tasks
        .map(t => {
          const assignee = db.users.find(u => u.id === t.assigned_to);
          const order = db.orders.find(o => o.id === t.order_id);
          return {
            ...t,
            assigned_to_name: assignee?.full_name || 'N/A',
            order_code: order?.order_code || null
          };
        })
        .filter(t => !status || t.status === status)
        .filter(t => !args.overdue_only || (t.status !== 'done' && !!t.due_date && t.due_date < today))
        .filter(t => !query || [
          t.title,
          t.description,
          t.status,
          t.priority,
          t.assigned_to_name,
          t.order_code
        ].some(v => normalizeSearch(v).includes(query)))
        .slice(0, limit)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          assigned_to_name: t.assigned_to_name,
          order_code: t.order_code
        }));
    }

    if (name === 'search_leads') {
      const status = normalizeSearch(args.status);
      return (db.leads || [])
        .map(l => {
          const assignee = db.users.find(u => u.id === l.assigned_sale_id);
          return {
            ...l,
            assigned_sale_name: assignee?.full_name || 'N/A'
          };
        })
        .filter(l => !status || l.status === status)
        .filter(l => !query || [
          l.customer_name,
          l.phone,
          l.source,
          l.status,
          l.assigned_sale_name
        ].some(v => normalizeSearch(v).includes(query)))
        .slice(0, limit)
        .map(l => ({
          id: l.id,
          customer_name: l.customer_name,
          phone: l.phone,
          source: l.source,
          sales_step: l.sales_step,
          status: l.status,
          revenue: l.revenue,
          assigned_sale_name: l.assigned_sale_name,
          support_needed: l.support_needed
        }));
    }

    if (name === 'get_schedule_range') {
      const range = getDateRange(args.range, args.start_date, args.end_date);
      return {
        range,
        schedules: db.orders
          .filter(o => o.shoot_date >= range.start && o.shoot_date <= range.end)
          .sort((a, b) => `${a.shoot_date} ${a.shoot_time || ''}`.localeCompare(`${b.shoot_date} ${b.shoot_time || ''}`))
          .slice(0, limit)
          .map(o => {
            const customer = db.customers.find(c => c.id === o.customer_id);
            const tasks = db.tasks.filter(t => t.order_id === o.id);
            return {
              id: o.id,
              order_code: o.order_code,
              customer_name: customer?.full_name || 'Unknown',
              customer_phone: customer?.phone || null,
              shoot_date: o.shoot_date,
              shoot_time: o.shoot_time,
              status: o.status,
              package_name: o.package_name,
              assigned_staff: tasks.map(t => {
                const user = db.users.find(u => u.id === t.assigned_to);
                return {
                  task_title: t.title,
                  task_status: t.status,
                  staff_name: user?.full_name || 'N/A'
                };
              })
            };
          })
      };
    }

    if (name === 'get_operational_alerts') {
      const daysAhead = clampLimit(args.days_ahead, 7);
      const alertLimit = clampLimit(args.limit);
      const rangeEnd = toDateKey(addDays(new Date(), daysAhead));
      const activeOrders = db.orders.filter(o => o.status !== 'cancelled' && o.status !== 'delivered');
      const upcomingOrders = activeOrders.filter(o => o.shoot_date >= today && o.shoot_date <= rangeEnd);

      return {
        checked_until: rangeEnd,
        overdue_tasks: db.tasks
          .filter(t => t.status !== 'done' && t.status !== 'cancelled' && !!t.due_date && t.due_date < today)
          .slice(0, alertLimit)
          .map(t => {
            const user = db.users.find(u => u.id === t.assigned_to);
            return {
              type: 'overdue_task',
              title: t.title,
              due_date: t.due_date,
              assigned_to_name: user?.full_name || 'N/A',
              priority: t.priority
            };
          }),
        upcoming_orders_missing_tasks: upcomingOrders
          .filter(o => db.tasks.filter(t => t.order_id === o.id).length === 0)
          .slice(0, alertLimit)
          .map(o => {
            const customer = db.customers.find(c => c.id === o.customer_id);
            return {
              type: 'missing_assignment',
              order_code: o.order_code,
              customer_name: customer?.full_name || 'Unknown',
              shoot_date: o.shoot_date,
              shoot_time: o.shoot_time,
              note: 'Đơn sắp chụp nhưng chưa có task phân công.'
            };
          }),
        orders_missing_deposit: activeOrders
          .filter(o => Number(o.deposit_amount || 0) <= 0 && Number(o.total_amount || 0) > 0)
          .slice(0, alertLimit)
          .map(o => {
            const customer = db.customers.find(c => c.id === o.customer_id);
            return {
              type: 'missing_deposit',
              order_code: o.order_code,
              customer_name: customer?.full_name || 'Unknown',
              total_amount: o.total_amount,
              note: 'Đơn có giá trị nhưng chưa ghi nhận đặt cọc.'
            };
          }),
        active_leads_to_follow: (db.leads || [])
          .filter(l => l.status === 'consulting')
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
          .slice(0, alertLimit)
          .map(l => {
            const user = db.users.find(u => u.id === l.assigned_sale_id);
            return {
              type: 'active_lead',
              customer_name: l.customer_name,
              phone: l.phone,
              source: l.source,
              sales_step: l.sales_step,
              assigned_sale_name: user?.full_name || 'N/A',
              updated_at: l.updated_at
            };
          })
      };
    }

    if (name === 'get_staff_workload') {
      const rangeKey = normalizeSearch(args.range);
      const range = rangeKey && rangeKey !== 'all' ? getDateRange(rangeKey) : null;
      return db.users
        .filter(u => u.is_active)
        .map(user => {
          const userTasks = db.tasks.filter(t => t.assigned_to === user.id);
          const scopedTasks = range
            ? userTasks.filter(t => !t.due_date || (t.due_date >= range.start && t.due_date <= range.end))
            : userTasks;
          const relatedOrderIds = new Set(scopedTasks.map(t => t.order_id).filter(Boolean));
          return {
            user_id: user.id,
            full_name: user.full_name,
            role_id: user.role_id,
            total_tasks: scopedTasks.length,
            pending_tasks: scopedTasks.filter(t => t.status === 'pending').length,
            in_progress_tasks: scopedTasks.filter(t => t.status === 'in_progress').length,
            overdue_tasks: scopedTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && !!t.due_date && t.due_date < today).length,
            linked_orders: relatedOrderIds.size,
            next_due_task: scopedTasks
              .filter(t => t.status !== 'done' && t.due_date)
              .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0] || null
          };
        })
        .sort((a, b) => (b.overdue_tasks - a.overdue_tasks) || (b.in_progress_tasks - a.in_progress_tasks) || (b.pending_tasks - a.pending_tasks))
        .slice(0, limit);
    }

    return { error: 'Unknown tool' };
  };

  const containsRawToolMarkup = (value: unknown) => {
    const text = String(value || '').toLowerCase();
    return text.includes('<tool_call') || text.includes('<function=') || text.includes('</tool_call>') || text.includes('function_call');
  };

  const inferAssistantToolFromQuestion = (question: string): { name: AssistantToolName; args: Record<string, any> } => {
    const normalized = normalizeSearch(question);
    
    // 1. Nhận diện số điện thoại có ít nhất sáu chữ số.
    const cleanPhone = normalized.replace(/[^\d]/g, '');
    if (cleanPhone.length >= 6) {
      return { name: 'search_customers', args: { query: cleanPhone, limit: 5 } };
    }
    
    // 2. Nhận diện mã đơn như OD123 hoặc ORD-456.
    const orderCodeMatch = normalized.match(/(od|ord)\s*\d+/i);
    if (orderCodeMatch) {
      return { name: 'search_orders', args: { query: orderCodeMatch[0].toUpperCase(), limit: 5 } };
    }

    // 3. Nhận diện ngày cụ thể như 15/7 hoặc 15-07-2026.
    const dateMatch = normalized.match(/(\d{1,2})[\/\-](\d{1,2})([\/\-](\d{4}))?/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      const year = dateMatch[4] ? parseInt(dateMatch[4]) : new Date().getFullYear();
      const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { name: 'get_schedule_range', args: { range: 'custom', start_date: formattedDate, end_date: formattedDate, limit: 10 } };
    }

    const range =
      normalized.includes('ngày mai') || normalized.includes('ngay mai') ? 'tomorrow' :
      normalized.includes('tuần sau') || normalized.includes('tuan sau') ? 'next_week' :
      normalized.includes('tuần này') || normalized.includes('tuan nay') ? 'this_week' :
      normalized.includes('tháng này') || normalized.includes('thang nay') ? 'this_month' :
      'today';

    if (normalized.includes('ai bận') || normalized.includes('ai ban') || normalized.includes('rảnh') || normalized.includes('ranh') || normalized.includes('workload') || normalized.includes('khối lượng') || normalized.includes('khoi luong') || normalized.includes('nhân sự') || normalized.includes('nhan su')) {
      return { name: 'get_staff_workload', args: { range: normalized.includes('tất cả') || normalized.includes('tat ca') ? 'all' : range, limit: 8 } };
    }
    if (normalized.includes('cảnh báo') || normalized.includes('canh bao') || normalized.includes('bất thường') || normalized.includes('bat thuong') || normalized.includes('thiếu') || normalized.includes('thieu') || normalized.includes('chưa cọc') || normalized.includes('chua coc') || normalized.includes('chưa phân công') || normalized.includes('chua phan cong')) {
      return { name: 'get_operational_alerts', args: { days_ahead: 7, limit: 5 } };
    }
    if (normalized.includes('lịch') || normalized.includes('lich') || normalized.includes('sắp tới') || normalized.includes('sap toi') || normalized.includes('tuần') || normalized.includes('tuan') || normalized.includes('tháng') || normalized.includes('thang')) {
      return { name: 'get_schedule_range', args: { range, limit: 8 } };
    }
    if (normalized.includes('trễ') || normalized.includes('tre') || normalized.includes('quá hạn') || normalized.includes('qua han') || normalized.includes('công việc') || normalized.includes('task')) {
      const isGeneralList = ['danh sách', 'danh sach', 'nào', 'nao', 'ai', 'tất cả', 'tat ca', 'những', 'nhung', 'hôm nay', 'hom nay', 'ngày mai', 'ngay mai'].some(w => normalized.includes(w));
      const queryVal = isGeneralList ? '' : question;
      return { name: 'search_tasks', args: { query: queryVal, overdue_only: normalized.includes('trễ') || normalized.includes('tre') || normalized.includes('quá hạn') || normalized.includes('qua han'), limit: 5 } };
    }
    if (normalized.includes('lead') || normalized.includes('tư vấn') || normalized.includes('tu van') || normalized.includes('chăm sóc') || normalized.includes('cham soc')) {
      const isGeneralList = ['danh sách', 'danh sach', 'nào', 'nao', 'ai', 'tất cả', 'tat ca', 'những', 'nhung', 'cần', 'can'].some(w => normalized.includes(w));
      const queryVal = isGeneralList ? '' : question;
      return { name: 'search_leads', args: { query: queryVal, status: 'consulting', limit: 5 } };
    }
    if (normalized.includes('khách') || normalized.includes('khach') || normalized.includes('số điện thoại') || normalized.includes('so dien thoai')) {
      const isGeneralList = ['danh sách', 'danh sach', 'nào', 'nao', 'ai', 'tất cả', 'tat ca', 'những', 'nhung'].some(w => normalized.includes(w));
      const queryVal = isGeneralList ? '' : question;
      return { name: 'search_customers', args: { query: queryVal, limit: 5 } };
    }
    if (normalized.includes('đơn') || normalized.includes('don') || normalized.includes('hợp đồng') || normalized.includes('hop dong') || normalized.includes('lịch chụp') || normalized.includes('lich chup') || normalized.includes('chụp') || normalized.includes('chup')) {
      const isGeneralList = ['danh sách', 'danh sach', 'nào', 'nao', 'ai', 'tất cả', 'tat ca', 'những', 'nhung', 'hôm nay', 'hom nay', 'ngày mai', 'ngay mai'].some(w => normalized.includes(w));
      const queryVal = isGeneralList ? '' : question;
      return { name: 'search_orders', args: { query: queryVal, limit: 5 } };
    }
    
    // Phương án mặc định khi câu hỏi không khớp intent cụ thể.
    const isGreeting = ['chào', 'chao', 'hello', 'hi', 'xin chao', 'bắt đầu', 'bat dau'].some(w => normalized.includes(w));
    if (normalized && normalized.length > 2 && !isGreeting) {
      return { name: 'search_customers', args: { query: question, limit: 5 } };
    }
    
    return { name: 'get_business_overview', args: {} };
  };

  const translateStatus = (status: string): string => {
    const map: Record<string, string> = {
      new: 'Đơn mới',
      confirmed: 'Đã xác nhận',
      shooting: 'Đang chụp',
      editing: 'Đang hậu kỳ',
      ready: 'Sẵn sàng',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
      pending: 'Chờ thực hiện',
      in_progress: 'Đang làm',
      done: 'Đã xong',
      consulting: 'Đang tư vấn',
      won: 'Thành công',
      lost: 'Thất bại',
      low: 'Thấp',
      normal: 'Trung bình',
      high: 'Cao'
    };
    return map[status.toLowerCase()] || status;
  };

  const formatOfflineAnswer = (name: AssistantToolName, result: any, args: any): string => {
    let output = '';
    
    if (name === 'get_business_overview') {
      output += `Chào bạn! Dưới đây là thông tin hoạt động tổng quan của studio:\n\n`;
      output += `• **Khách hàng:** Tổng số **${result.customers}** khách hàng đã đăng ký.\n`;
      output += `• **Đơn hàng:** Có **${result.orders}** đơn hàng (trong đó đang xử lý **${result.active_orders}** đơn).\n`;
      output += `• **Doanh thu:** Tổng doanh thu đạt **${formatVndFromThousands(result.total_order_value)}**.\n`;
      output += `• **Công việc:** Có **${result.pending_tasks}** việc cần làm (trong đó **${result.overdue_tasks}** việc đã quá hạn).\n`;
      output += `• **Lead tư vấn:** Hiện có **${result.active_leads}** khách hàng tiềm năng đang được chăm sóc.`;
      return output;
    }
    
    if (name === 'get_schedule_range') {
      const schedules = result.schedules || [];
      if (schedules.length === 0) return `Không có lịch chụp nào trong khoảng thời gian từ ${result.range?.start} đến ${result.range?.end}.`;
      output += `Dưới đây là danh sách lịch chụp từ ngày ${result.range?.start} đến ${result.range?.end}:\n\n`;
      schedules.forEach((s: any) => {
        output += `• **[${s.order_code}]** KH: **${s.customer_name}** - Gói: **"${s.package_name}"** lúc **${s.shoot_time || '08:30'}** ngày **${s.shoot_date}** (Trạng thái: **${translateStatus(s.status)}**)\n`;
      });
      return output;
    }
    
    if (name === 'get_operational_alerts') {
      const overdue = result.overdue_tasks || [];
      const missingTasks = result.upcoming_orders_missing_tasks || [];
      const missingDeposit = result.orders_missing_deposit || [];
      
      if (overdue.length === 0 && missingTasks.length === 0 && missingDeposit.length === 0) {
        return 'Tôi đã kiểm tra hệ thống và hiện tại không có cảnh báo vận hành nào bất thường.';
      }
      
      output += 'Dưới đây là một số điểm cần lưu ý về mặt vận hành:\n\n';
      if (overdue.length > 0) {
        output += `⚠️ **Công việc quá hạn:**\n`;
        overdue.forEach((t: any) => {
          output += `  - **"${t.title}"** (Hạn: **${t.due_date}**, Người làm: **${t.assigned_to_name}**)\n`;
        });
      }
      if (missingTasks.length > 0) {
        output += `\n⚠️ **Đơn sắp chụp chưa phân công công việc:**\n`;
        missingTasks.forEach((o: any) => {
          output += `  - Đơn **[${o.order_code}]** KH: **${o.customer_name}** chụp lúc **${o.shoot_date} ${o.shoot_time || ''}**\n`;
        });
      }
      if (missingDeposit.length > 0) {
        output += `\n⚠️ **Hợp đồng chưa đặt cọc:**\n`;
        missingDeposit.forEach((o: any) => {
          output += `  - Đơn **[${o.order_code}]** KH: **${o.customer_name}** (Tổng: **${formatVndFromThousands(o.total_amount)}**)\n`;
        });
      }
      return output;
    }
    
    if (name === 'get_staff_workload') {
      if (!Array.isArray(result) || result.length === 0) return 'Không tìm thấy dữ liệu khối lượng công việc của nhân viên.';
      output += `Dưới đây là thống kê khối lượng công việc hiện tại của đội ngũ nhân viên:\n\n`;
      result.forEach((w: any) => {
        output += `• **${w.full_name}**: Đang phụ trách **${w.pending_tasks}** việc chưa hoàn thành (quá hạn: **${w.overdue_tasks}**)\n`;
      });
      return output;
    }
    
    if (name === 'search_leads') {
      if (!Array.isArray(result) || result.length === 0) return 'Không tìm thấy lead nào phù hợp.';
      output += `Dưới đây là danh sách khách hàng tiềm năng (Lead) đang tư vấn:\n\n`;
      result.forEach((l: any) => {
        output += `• KH: **${l.customer_name}** - SĐT: **${l.phone || 'N/A'}** - Nguồn: **${l.source}**\n`;
        output += `  - Bước bán hàng: **${l.sales_step}/6** - Trạng thái: **${translateStatus(l.status)}** (Người phụ trách: **${l.assigned_sale_name}**)\n`;
        if (l.notes) {
          output += `  - Ghi chú: *${l.notes}*\n`;
        }
      });
      return output;
    }

    if (name === 'search_tasks') {
      if (!Array.isArray(result) || result.length === 0) return 'Không tìm thấy công việc nào phù hợp.';
      output += `Tìm thấy các công việc phù hợp với yêu cầu của bạn:\n\n`;
      result.forEach((t: any) => {
        output += `• [**${translateStatus(t.status)}**] **"${t.title}"** (Độ ưu tiên: **${translateStatus(t.priority)}**, Hạn: **${t.due_date || 'Không giới hạn'}**, Giao cho: **${t.assigned_to_name}**)\n`;
      });
      return output;
    }

    if (name === 'search_orders') {
      if (!Array.isArray(result) || result.length === 0) return 'Không tìm thấy đơn hàng nào phù hợp.';
      output += `Tìm thấy các đơn hàng/hợp đồng phù hợp:\n\n`;
      result.forEach((o: any) => {
        output += `• Hợp đồng **[${o.order_code}]** - KH: **${o.customer_name}** - Trạng thái: **${translateStatus(o.status)}** - Gói: **"${o.package_name}"** - Ngày chụp: **${o.shoot_date}**\n`;
      });
      return output;
    }

    if (name === 'search_customers') {
      if (!Array.isArray(result) || result.length === 0) {
        // Tìm kiếm dự phòng trên nhiều chỉ mục.
        const db = LocalDatabase.get();
        const query = normalizeSearch(args?.query || '');

        // 1. Ưu tiên tìm lead trong CRM.
        const leads = (db.leads || [])
          .map(l => {
            const assignee = db.users.find(u => u.id === l.assigned_sale_id);
            return {
              ...l,
              assigned_sale_name: assignee?.full_name || 'N/A'
            };
          })
          .filter(l => !query || [
            l.customer_name,
            l.phone || '',
            l.source,
            l.status,
            l.assigned_sale_name
          ].some(v => normalizeSearch(v).includes(query)))
          .slice(0, 5);

        if (leads.length > 0) {
          output += `Không tìm thấy khách hàng chính thức với từ khóa "${args?.query || ''}", nhưng tìm thấy thông tin trong mục CRM / Tư vấn (Leads):\n\n`;
          leads.forEach((l: any) => {
            output += `• KH: **${l.customer_name}** - SĐT: **${l.phone || 'N/A'}** - Nguồn: **${l.source}**\n`;
            output += `  - Bước bán hàng: **${l.sales_step}/6** - Trạng thái: **${translateStatus(l.status)}** (Người chăm sóc: **${l.assigned_sale_name}**)\n`;
            if (l.notes) {
              output += `  - Ghi chú: *${l.notes}*\n`;
            }
          });
          return output;
        }
        
        // 2. Tìm đơn hàng.
        const orders = db.orders
          .map(o => {
            const customer = db.customers.find(c => c.id === o.customer_id);
            return {
              ...o,
              customer_name: customer?.full_name || 'Unknown',
              customer_phone: customer?.phone || null
            };
          })
          .filter(o => !query || [
            o.order_code,
            o.package_name,
            o.status,
            o.customer_name,
            o.customer_phone
          ].some(v => normalizeSearch(v).includes(query)))
          .slice(0, 5);
          
        if (orders.length > 0) {
          output += `Không tìm thấy khách hàng trực tiếp với từ khóa "${args?.query || ''}", nhưng tìm thấy các hợp đồng liên quan:\n\n`;
          orders.forEach((o: any) => {
            output += `• Hợp đồng **[${o.order_code}]** - KH: **${o.customer_name}** - Trạng thái: **${translateStatus(o.status)}** - Gói: **"${o.package_name}"** - Ngày chụp: **${o.shoot_date}**\n`;
          });
          return output;
        }

        // 3. Tìm công việc.
        const tasks = db.tasks
          .map(t => {
            const assignee = db.users.find(u => u.id === t.assigned_to);
            const order = db.orders.find(o => o.id === t.order_id);
            return {
              ...t,
              assigned_to_name: assignee?.full_name || 'N/A',
              order_code: order?.order_code || null
            };
          })
          .filter(t => !query || [
            t.title,
            t.description,
            t.status,
            t.priority,
            t.assigned_to_name,
            t.order_code
          ].some(v => normalizeSearch(v).includes(query)))
          .slice(0, 5);
          
        if (tasks.length > 0) {
          output += `Không tìm thấy khách hàng, nhưng tìm thấy các công việc liên quan đến "${args?.query || ''}":\n\n`;
          tasks.forEach((t: any) => {
            output += `• [**${translateStatus(t.status)}**] **"${t.title}"** (Người làm: **${t.assigned_to_name}**, Hạn: **${t.due_date || 'Không có'}**)\n`;
          });
          return output;
        }

        return `Không tìm thấy khách hàng, đơn hàng, lead hay công việc nào khớp với từ khóa "${args?.query || ''}".`;
      }
      
      output += `Tìm thấy thông tin khách hàng phù hợp:\n\n`;
      result.forEach((c: any) => {
        output += `• KH: **${c.full_name}** - SĐT: **${c.phone || 'N/A'}** - Email: **${c.email || 'N/A'}**\n`;
        if (c.orders_count > 0) {
          output += `  - Có **${c.orders_count}** đơn hàng. Đơn mới nhất: **[${c.latest_order?.order_code}]** Gói: **"${c.latest_order?.package_name}"** (**${translateStatus(c.latest_order?.status)}**)\n`;
        }
      });
      return output;
    }
    
    const compactResult = Array.isArray(result) ? result.slice(0, 5) : result;
    return `Đã kiểm tra hệ thống. Kết quả: ${JSON.stringify(compactResult).slice(0, 700)}`;
  };



  // Endpoint chatbot dựa trên bộ quy tắc xác định.
  interface ChatbotSessionContext {
    intent?: any;
    entities?: any;
    pendingClarification?: {
      type: 'customer';
      rawCustomerName: string;
      options: any[];
    };
    lastActivity?: number;
  }

  const chatbotSessions = new Map<string, ChatbotSessionContext>();

  // Dọn phiên chatbot cũ hơn 30 phút theo chu kỳ.
  const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of chatbotSessions.entries()) {
      if (session.lastActivity && now - session.lastActivity > SESSION_TTL) {
        chatbotSessions.delete(sid);
      }
    }
  }, 5 * 60 * 1000);
  cleanupInterval.unref(); // Prevent blocking Node.js from exiting in tests/compiles

  app.post('/api/chatbot', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user?.email?.toLowerCase() !== 'viet@studio.com') {
      return res.status(403).json({ reply: 'Chatbot tra cứu chỉ được cấp quyền cho tài khoản viet@studio.com.' });
    }

    const message = String(req.body?.message || '').trim();
    const sessionId = String(req.body?.sessionId || 'default-session');

    if (!message) {
      return res.status(400).json({ reply: 'Bạn vui lòng nhập câu hỏi.' });
    }

    try {
      let session = chatbotSessions.get(sessionId);
      if (!session) {
        session = {};
        chatbotSessions.set(sessionId, session);
      }
      session.lastActivity = Date.now();

      // 1. Kiểm tra yêu cầu làm rõ khách hàng đang chờ xử lý.
      if (session.pendingClarification && session.intent && session.entities) {
        const options = session.pendingClarification.options;
        const numChoice = parseInt(message, 10);
        let selectedCustomer: any = null;

        if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= options.length) {
          selectedCustomer = options[numChoice - 1];
        } else {
          // Thử so khớp gần đúng câu trả lời với các lựa chọn hiện có.
          const match = options.find((o: any) => 
            o.full_name.toLowerCase().includes(message.toLowerCase()) || 
            message.toLowerCase().includes(o.full_name.toLowerCase())
          );
          if (match) {
            selectedCustomer = match;
          }
        }

        if (selectedCustomer) {
          // Đã làm rõ thành công: cập nhật thực thể rồi thực thi truy vấn.
          session.entities.customerName = selectedCustomer.full_name;
          const intent = session.intent;
          const entities = session.entities;
          
          // Xóa trạng thái đang chờ người dùng làm rõ.
          delete session.pendingClarification;
          
          const data = await buildAndExecuteQuery(intent, entities);
          const reply = renderResponse(intent, data);
          return res.json({ reply, intent, data, sessionId });
        } else {
          // Nếu không khớp lựa chọn cũ, thử coi nội dung là tên khách hàng mới.
          const resolveRes = await resolveCustomer(message);
          if (!resolveRes.needsClarification && resolveRes.customer) {
            session.entities.customerName = resolveRes.customer.full_name;
            const intent = session.intent;
            const entities = session.entities;
            
            delete session.pendingClarification;
            
            const data = await buildAndExecuteQuery(intent, entities);
            const reply = renderResponse(intent, data);
            return res.json({ reply, intent, data, sessionId });
          } else if (resolveRes.needsClarification && resolveRes.options) {
            session.pendingClarification = {
              type: 'customer',
              rawCustomerName: message,
              options: resolveRes.options
            };
            return res.json({
              reply: resolveRes.clarificationQuestion,
              intent: session.intent,
              needsClarification: true,
              sessionId
            });
          } else {
            return res.json({
              reply: `Lựa chọn không hợp lệ. Bạn vui lòng chọn từ 1 đến ${options.length} hoặc nhập lại tên chính xác:`,
              intent: session.intent,
              needsClarification: true,
              sessionId
            });
          }
        }
      }

      // 2. Luồng thông thường: phân loại intent.
      let { intent, score } = await classifyIntent(message);

      // Ưu tiên nhận diện lại tên khách hàng theo quy tắc P2-2, cách A.
      const lowerMsg = message.toLowerCase().trim();
      const CONTRACT_KEYWORDS = ['hợp đồng', 'hop dong', 'đơn hàng', 'don hang', 'trạng thái', 'trang thai', 'tình hình', 'tinh hinh'];
      const containsContractKeyword = CONTRACT_KEYWORDS.some(kw => lowerMsg.includes(kw));

      const STATS_KEYWORDS = [
        'doanh số', 'doanh thu', 'doanhso', 'doanhthu',
        'thống kê', 'thong ke', 'báo cáo', 'bao cao',
        'thu nhập', 'thu nhap', 'tổng thu', 'tong thu'
      ];
      const containsStatsKeyword = STATS_KEYWORDS.some(kw => lowerMsg.includes(kw));
      const wordsCount = message.trim().split(/\s+/).length;
      const isShortMessage = wordsCount <= 5;

      if (isShortMessage || intent === 'thong_ke_doanh_so' || intent === 'unknown' || score < 0.6) {
        const resolveRes = await resolveCustomer(message);
        const hasCustomerMatch = resolveRes.customer || (resolveRes.needsClarification && resolveRes.options && resolveRes.options.length > 0);
        
        if (hasCustomerMatch) {
          if (containsStatsKeyword) {
            // Giữ nguyên intent thống kê đã nhận diện.
          } else {
            intent = containsContractKeyword ? 'CONTRACT_STATUS' : 'CUSTOMER_LIST';
            score = 1.0; // Force classification success
          }
        }
      }

      if (intent === 'unknown' || score < 0.6) {
        return res.json({
          reply: 'Xin lỗi, tôi chưa hiểu rõ câu hỏi. Bạn có thể hỏi về doanh số, hồ sơ khách hàng, hoặc trạng thái hợp đồng nhé.',
          intent: 'unknown',
          sessionId
        });
      }

      // 3. Trích xuất thực thể.
      const rawEntities = await extractEntities(message, intent as any);

      // 4. Xử lý kết quả làm rõ cho truy vấn khách hàng.
      if (intent === 'CUSTOMER_LIST' || intent === 'CONTRACT_STATUS') {
        if (!rawEntities.customerName) {
          session.intent = intent;
          session.entities = rawEntities;
          session.pendingClarification = {
            type: 'customer',
            rawCustomerName: '',
            options: []
          };
          
          return res.json({
            reply: intent === 'CUSTOMER_LIST' 
              ? 'Bạn muốn tra cứu thông tin của khách hàng nào ạ?' 
              : 'Bạn muốn kiểm tra trạng thái hợp đồng của khách hàng nào ạ?',
            intent,
            needsClarification: true,
            sessionId
          });
        }

        const resolveRes = await resolveCustomer(rawEntities.customerName);
        if (resolveRes.needsClarification) {
          session.intent = intent;
          session.entities = rawEntities;
          session.pendingClarification = {
            type: 'customer',
            rawCustomerName: rawEntities.customerName,
            options: resolveRes.options || []
          };

          return res.json({
            reply: resolveRes.clarificationQuestion,
            intent,
            needsClarification: true,
            sessionId
          });
        }
        
        // Đã tìm thấy đúng một kết quả.
        rawEntities.customerName = resolveRes.customer!.full_name;
      }

      // 5. Thực thi truy vấn.
      const data = await buildAndExecuteQuery(intent as any, rawEntities);
      const reply = renderResponse(intent as any, data);

      return res.json({ reply, intent, data, sessionId });
    } catch (error) {
      console.error('[chatbot] error:', error);
      return res.status(500).json({ reply: 'Đã có lỗi xảy ra ở hệ thống chatbot, vui lòng thử lại sau.' });
    }
  });

  // Các endpoint xác thực.
  app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const db = LocalDatabase.get();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa' });
    }

    const role = db.roles.find(r => r.id === user.role_id);
    const token = jwt.sign(
      { userId: user.id, email: user.email, sessionVersion: user.session_version || 0 },
      JWT_SECRET,
      { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '24h' }
    );

    res.json({
      user: sanitizeUser(user),
      role,
      token
    });
  });

  app.post('/api/auth/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userIndex = db.users.findIndex(u => u.id === req.user!.id);
    if (userIndex !== -1) {
      db.users[userIndex].session_version = (db.users[userIndex].session_version || 0) + 1;
      LocalDatabase.save(db);
    }
    res.json({ success: true, message: 'Đăng xuất thành công' });
  });

  app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      user: sanitizeUser(req.user!),
      role: req.role
    });
  });

  app.get('/healthz', (req: Request, res: Response) => {
    res.json({ status: 'OK' });
  });

  app.get('/api/system/status', authenticate, requirePermission('users.manage'), async (req: AuthenticatedRequest, res: Response) => {
    const startTime = Date.now();
    let dbStatus = 'online';
    let dbLatency = 0;
    try {
      // Chạy truy vấn nhẹ để kiểm tra kết nối PostgreSQL.
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - startTime;
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Database health check failed:', err);
      }
      dbStatus = 'offline';
    }

    if (process.env.NODE_ENV === 'production') {
      return res.json({
        backend: 'online',
        database: dbStatus
      });
    }

    res.json({
      backend: 'online',
      database: dbStatus,
      db_latency_ms: dbLatency,
      platform: process.platform,
      node_version: process.version,
      uptime: Math.round(process.uptime()),
      memory: {
        free: Math.round(os.freemem() / (1024 * 1024)),
        total: Math.round(os.totalmem() / (1024 * 1024))
      }
    });
  });

  // Các endpoint tài khoản và vai trò.
  app.get('/api/users', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const usersWithRoles = db.users.map(u => {
      const r = db.roles.find(role => role.id === u.role_id);
      return {
        ...sanitizeUser(u),
        role_name: r ? r.display_name : 'No role'
      };
    });

    if (req.query.page || req.query.limit) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const total = usersWithRoles.length;
      const items = usersWithRoles.slice(skip, skip + limit);
      return res.json({
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    res.json(usersWithRoles);
  });

  app.post('/api/users', authenticate, requirePermission('users.manage'), async (req: AuthenticatedRequest, res: Response) => {
    const { full_name, email, password, role_id } = req.body;
    if (!full_name || !email || !password || !role_id) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Định dạng email không hợp lệ' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Mật khẩu phải có độ dài tối thiểu 8 ký tự' });
    }

    // Hoàn tất hash trước khi đọc state database để tránh ghi đè do tranh chấp đồng thời.
    const hashedPassword = await bcrypt.hash(password, 10);

    const db = LocalDatabase.get();
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ error: 'Email này đã được sử dụng' });
    }

    const newUser: User = {
      id: 'user-' + LocalDatabase.uuid(),
      full_name,
      email,
      password_hash: hashedPassword,
      role_id,
      is_active: true,
      created_at: new Date().toISOString(),
      session_version: 0
    };

    db.users.push(newUser);
    LocalDatabase.save(db);

    res.status(201).json(sanitizeUser(newUser));
  });

  app.put('/api/users/:id', authenticate, requirePermission('users.manage'), async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { full_name, email, password, role_id, is_active } = req.body;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Định dạng email không hợp lệ' });
    }

    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Mật khẩu phải có độ dài tối thiểu 8 ký tự' });
    }

    // Hoàn tất hash trước khi đọc state database để tránh ghi đè do tranh chấp đồng thời.
    let hashedPassword = undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const db = LocalDatabase.get();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    if (email && email.toLowerCase() !== db.users[idx].email.toLowerCase()) {
      if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ error: 'Email này đã được sử dụng' });
      }
      db.users[idx].email = email;
    }

    if (full_name) db.users[idx].full_name = full_name;
    if (hashedPassword) {
      db.users[idx].password_hash = hashedPassword;
      db.users[idx].session_version = (db.users[idx].session_version || 0) + 1;
    }
    if (role_id) db.users[idx].role_id = role_id;
    if (is_active !== undefined) {
      db.users[idx].is_active = is_active;
      if (!is_active) {
        db.users[idx].session_version = (db.users[idx].session_version || 0) + 1;
      }
    }

    LocalDatabase.save(db);
    res.json(sanitizeUser(db.users[idx]));
  });

  app.delete('/api/users/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    // Vô hiệu hóa tài khoản thay vì xóa cứng.
    db.users[idx].is_active = false;
    db.users[idx].session_version = (db.users[idx].session_version || 0) + 1;
    LocalDatabase.save(db);
    res.json({ success: true, message: 'Đã vô hiệu hóa tài khoản thành công', user: sanitizeUser(db.users[idx]) });
  });

  app.get('/api/roles', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    res.json(db.roles);
  });

  app.post('/api/roles', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { name, display_name, permissions } = req.body;
    if (!name || !display_name || !permissions) {
      return res.status(400).json({ error: 'Thiếu thông tin tạo role' });
    }

    const db = LocalDatabase.get();
    if (db.roles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: 'Tên vai trò này đã tồn tại' });
    }

    const newRole: Role = {
      id: 'role-' + LocalDatabase.uuid(),
      name,
      display_name,
      permissions
    };

    db.roles.push(newRole);
    LocalDatabase.save(db);
    res.status(201).json(newRole);
  });

  app.put('/api/roles/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { display_name, permissions } = req.body;

    if (id === 'role-admin') {
      return res.status(400).json({ error: 'Không thể chỉnh sửa vai trò quản trị tối cao' });
    }

    const db = LocalDatabase.get();
    const idx = db.roles.findIndex(r => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy vai trò' });
    }

    if (display_name) db.roles[idx].display_name = display_name;
    if (permissions) db.roles[idx].permissions = permissions;

    LocalDatabase.save(db);
    res.json(db.roles[idx]);
  });

  app.delete('/api/roles/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (id === 'role-admin') {
      return res.status(400).json({ error: 'Không thể xóa vai trò quản trị tối cao của hệ thống' });
    }

    const db = LocalDatabase.get();
    const idx = db.roles.findIndex(r => r.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy vai trò' });
    }

    // Không cho xóa role đang được tài khoản hoạt động sử dụng.
    const hasUsers = db.users.some(u => u.role_id === id && u.is_active);
    if (hasUsers) {
      return res.status(400).json({ error: 'Không thể xóa vai trò này vì đang có nhân sự sử dụng' });
    }

    db.roles.splice(idx, 1);
    LocalDatabase.save(db);
    res.json({ success: true, message: 'Đã xóa vai trò thành công' });
  });




  // Các endpoint khách hàng.
  app.get('/api/customers', authenticate, requirePermission('customers.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const query = (req.query.q as string || '').toLowerCase();
    
    let result = db.customers;
    if (query) {
      result = db.customers.filter(c => 
        c.full_name.toLowerCase().includes(query) || 
        c.phone.includes(query) || 
        (c.email && c.email.toLowerCase().includes(query))
      );
    }

    if (req.query.page || req.query.limit) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const total = result.length;
      const items = result.slice(skip, skip + limit);
      return res.json({
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    res.json(result);
  });
  app.post('/api/customers', authenticate, requirePermission('customers.edit'), (req: AuthenticatedRequest, res: Response) => {
    const { full_name, phone, email, address, notes, birthday, wedding_date, facebook_url } = req.body;
    if (!full_name || !phone) {
      return res.status(400).json({ error: 'Thiếu họ tên hoặc số điện thoại' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Định dạng email không hợp lệ' });
    }
    if (!isValidOptionalCalendarDate(birthday) || !isValidOptionalCalendarDate(wedding_date)) {
      return res.status(400).json({ error: 'Ngày sinh hoặc ngày kỷ niệm không hợp lệ' });
    }

    const db = LocalDatabase.get();
    const newCust: Customer = {
      id: 'cust-' + LocalDatabase.uuid(),
      full_name,
      phone,
      email: email || null,
      address: address || null,
      notes: notes || null,
      birthday: normalizeOptionalCalendarDate(birthday),
      wedding_date: normalizeOptionalCalendarDate(wedding_date),
      facebook_url: facebook_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.customers.push(newCust);
    LocalDatabase.save(db);
    res.status(201).json(newCust);
  });

  app.get('/api/customers/:id', authenticate, requirePermission('customers.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const customer = db.customers.find(c => c.id === req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }
    res.json(customer);
  });

  app.put('/api/customers/:id', authenticate, requirePermission('customers.edit'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { full_name, phone, email, address, notes, birthday, wedding_date, facebook_url } = req.body;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Định dạng email không hợp lệ' });
    }
    if (!isValidOptionalCalendarDate(birthday) || !isValidOptionalCalendarDate(wedding_date)) {
      return res.status(400).json({ error: 'Ngày sinh hoặc ngày kỷ niệm không hợp lệ' });
    }

    const db = LocalDatabase.get();
    const idx = db.customers.findIndex(c => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    if (full_name) db.customers[idx].full_name = full_name;
    if (phone) db.customers[idx].phone = phone;
    if (email !== undefined) db.customers[idx].email = email;
    if (address !== undefined) db.customers[idx].address = address;
    if (notes !== undefined) db.customers[idx].notes = notes;
    if (birthday !== undefined) db.customers[idx].birthday = normalizeOptionalCalendarDate(birthday);
    if (wedding_date !== undefined) db.customers[idx].wedding_date = normalizeOptionalCalendarDate(wedding_date);
    if (facebook_url !== undefined) db.customers[idx].facebook_url = facebook_url;
    db.customers[idx].updated_at = new Date().toISOString();

    LocalDatabase.save(db);
    res.json(db.customers[idx]);
  });

  app.get('/api/customers/:id/orders', authenticate, requirePermission('orders.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const customerOrders = db.orders.filter(o => o.customer_id === req.params.id);
    res.json(customerOrders);
  });


  // Các endpoint đơn hàng.
  app.get('/api/orders', authenticate, requirePermission('orders.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const { status, date, assigned_staff } = req.query;

    let result = db.orders.map(o => {
      const customer = db.customers.find(c => c.id === o.customer_id);
      return {
        ...o,
        customer_name: customer ? customer.full_name : 'Unknown',
        customer_phone: customer ? customer.phone : 'N/A'
      };
    });

    if (status) {
      result = result.filter(o => o.status === status);
    }

    if (date) {
      result = result.filter(o => o.shoot_date === date);
    }

    if (assigned_staff) {
      // Tìm các đơn có công việc được giao cho nhân sự này.
      const matchingOrderIds = db.tasks
        .filter(t => t.assigned_to === assigned_staff && t.order_id)
        .map(t => t.order_id);
      result = result.filter(o => matchingOrderIds.includes(o.id));
    }

    if (req.query.page || req.query.limit) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const total = result.length;
      const items = result.slice(skip, skip + limit);
      return res.json({
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    res.json(result);
  });

  app.post('/api/orders', authenticate, requirePermission('orders.create'), (req: AuthenticatedRequest, res: Response) => {
    const { customer_id, shoot_date, shoot_time, package_name, package_price, deposit_amount, total_amount, notes } = req.body;
    if (!customer_id || !shoot_date || !package_name) {
      return res.status(400).json({ error: 'Thiếu thông tin tạo đơn hàng' });
    }

    const db = LocalDatabase.get();
    const customerExists = db.customers.some(c => c.id === customer_id);
    if (!customerExists) {
      return res.status(400).json({ error: 'Khách hàng không tồn tại' });
    }

    const newOrder: Order = {
      id: 'order-' + LocalDatabase.uuid(),
      order_code: LocalDatabase.generateOrderCode(),
      customer_id,
      status: 'new',
      shoot_date,
      shoot_time: shoot_time || null,
      package_name,
      package_price: Number(package_price) || 0,
      deposit_amount: Number(deposit_amount) || 0,
      total_amount: Number(total_amount) || Number(package_price) || 0,
      notes: notes || null,
      created_by: req.user!.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.orders.push(newOrder);

    // Ghi lịch sử trạng thái đầu tiên.
    const history: OrderStatusHistory = {
      id: 'hist-' + LocalDatabase.uuid(),
      order_id: newOrder.id,
      from_status: '',
      to_status: 'new',
      changed_by: req.user!.id,
      note: 'Khởi tạo đơn hàng mới',
      changed_at: new Date().toISOString()
    };
    db.order_status_history.push(history);

    LocalDatabase.save(db);
    res.status(201).json(newOrder);
  });

  app.get('/api/orders/:id', authenticate, requirePermission('orders.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const order = db.orders.find(o => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    const customer = db.customers.find(c => c.id === order.customer_id);
    const creator = db.users.find(u => u.id === order.created_by);
    const tasks = db.tasks.filter(t => t.order_id === order.id).map(t => {
      const staff = db.users.find(u => u.id === t.assigned_to);
      return {
        ...t,
        assigned_to_name: staff ? staff.full_name : 'N/A'
      };
    });
    const history = db.order_status_history.filter(h => h.order_id === order.id).map(h => {
      const changer = db.users.find(u => u.id === h.changed_by);
      return {
        ...h,
        changed_by_name: changer ? changer.full_name : 'Hệ thống'
      };
    }).sort((a,b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

    res.json({
      ...order,
      customer,
      created_by_name: creator ? creator.full_name : 'Ẩn danh',
      tasks,
      history
    });
  });

  app.put('/api/orders/:id', authenticate, requirePermission('orders.edit'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { shoot_date, shoot_time, package_name, package_price, deposit_amount, total_amount, notes } = req.body;

    const db = LocalDatabase.get();
    const idx = db.orders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (shoot_date) db.orders[idx].shoot_date = shoot_date;
    if (shoot_time !== undefined) db.orders[idx].shoot_time = shoot_time;
    if (package_name) db.orders[idx].package_name = package_name;
    if (package_price !== undefined) db.orders[idx].package_price = Number(package_price) || 0;
    if (deposit_amount !== undefined) db.orders[idx].deposit_amount = Number(deposit_amount) || 0;
    if (total_amount !== undefined) db.orders[idx].total_amount = Number(total_amount) || 0;
    if (notes !== undefined) db.orders[idx].notes = notes;
    db.orders[idx].updated_at = new Date().toISOString();

    LocalDatabase.save(db);
    res.json(db.orders[idx]);
  });

  app.post('/api/orders/:id/status', authenticate, requirePermission('orders.edit'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Vui lòng cung cấp trạng thái mới' });
    }

    const db = LocalDatabase.get();
    const idx = db.orders.findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    const oldStatus = db.orders[idx].status;

    // Chỉ admin mới được chuyển trạng thái đơn theo chiều lùi.
    const statusOrder = ['new', 'confirmed', 'shooting', 'editing', 'ready', 'delivered', 'cancelled'];
    const oldIdx = statusOrder.indexOf(oldStatus);
    const newIdx = statusOrder.indexOf(status);

    if (newIdx === -1) {
      return res.status(400).json({
        error: 'Trạng thái đơn hàng không hợp lệ',
        allowedStatuses: statusOrder
      });
    }

    if (newIdx < oldIdx && req.role?.id !== 'role-admin' && status !== 'cancelled') {
      return res.status(400).json({ 
        error: 'Chỉ Quản trị viên (Admin) mới có quyền đổi trạng thái đơn hàng quay ngược lại!' 
      });
    }

    // Cập nhật trạng thái đơn.
    db.orders[idx].status = status;
    db.orders[idx].updated_at = new Date().toISOString();

    // Ghi lịch sử thay đổi trạng thái.
    const history: OrderStatusHistory = {
      id: 'hist-' + LocalDatabase.uuid(),
      order_id: id,
      from_status: oldStatus,
      to_status: status,
      changed_by: req.user!.id,
      note: note || `Đổi trạng thái từ ${oldStatus} sang ${status}`,
      changed_at: new Date().toISOString()
    };
    db.order_status_history.push(history);

    LocalDatabase.save(db);
    res.json({ success: true, order: db.orders[idx], history });
  });

  app.get('/api/orders/:id/tasks', authenticate, requirePermission('orders.view'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const tasks = db.tasks.filter(t => t.order_id === req.params.id).map(t => {
      const staff = db.users.find(u => u.id === t.assigned_to);
      return {
        ...t,
        assigned_to_name: staff ? staff.full_name : 'N/A'
      };
    });
    res.json(tasks);
  });




  // Các endpoint công việc.
  app.get('/api/tasks', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const { assigned_to, status, order_id, date } = req.query;

    let result = db.tasks.map(t => {
      const staff = db.users.find(u => u.id === t.assigned_to);
      const manager = db.users.find(u => u.id === t.assigned_by);
      const order = db.orders.find(o => o.id === t.order_id);
      const customer = order ? db.customers.find(c => c.id === order.customer_id) : null;
      return {
        ...t,
        assigned_to_name: staff ? staff.full_name : 'No one',
        assigned_by_name: manager ? manager.full_name : 'System',
        order_code: order ? order.order_code : null,
        customer_name: customer ? customer.full_name : null,
        customer_phone: customer ? customer.phone : null
      };
    });

    // Nhân viên chỉ được xem công việc được giao cho chính mình.
    if (req.role?.id === 'role-staff' || req.role?.id === 'role-photographer' || req.role?.id === 'role-editor' || (req.role?.permissions.includes('tasks.view_own') && !req.role?.permissions.includes('tasks.view_all'))) {
      result = result.filter(t => t.assigned_to === req.user?.id);
    } else if (assigned_to) {
      result = result.filter(t => t.assigned_to === assigned_to);
    }

    if (status) {
      result = result.filter(t => t.status === status);
    }

    if (order_id) {
      result = result.filter(t => t.order_id === order_id);
    }

    if (date) {
      result = result.filter(t => t.due_date === date);
    }

    if (req.query.page || req.query.limit) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const total = result.length;
      const items = result.slice(skip, skip + limit);
      return res.json({
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    res.json(result);
  });

  app.post('/api/tasks', authenticate, requirePermission('tasks.assign'), (req: AuthenticatedRequest, res: Response) => {
    const { title, description, order_id, assigned_to, priority, due_date } = req.body;
    if (!title || !assigned_to) {
      return res.status(400).json({ error: 'Thiếu tên công việc hoặc nhân viên thực hiện' });
    }

    const db = LocalDatabase.get();
    const staffExists = db.users.some(u => u.id === assigned_to);
    if (!staffExists) {
      return res.status(400).json({ error: 'Nhân viên được giao không tồn tại' });
    }

    const newTask: Task = {
      id: 'task-' + LocalDatabase.uuid(),
      title,
      description: description || null,
      order_id: order_id || null,
      assigned_to,
      assigned_by: req.user!.id,
      status: 'pending',
      priority: priority || 'normal',
      due_date: due_date || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.tasks.push(newTask);

    // Ghi lịch sử cập nhật đầu tiên.
    const update: TaskUpdate = {
      id: 'up-' + LocalDatabase.uuid(),
      task_id: newTask.id,
      updated_by: req.user!.id,
      status_changed_to: 'pending',
      comment: 'Tạo công việc và giao cho nhân viên',
      created_at: new Date().toISOString()
    };
    db.task_updates.push(update);

    if (!db.notifications) db.notifications = [];
    db.notifications.push({
      id: 'notif-' + LocalDatabase.uuid(),
      sender_id: req.user!.id,
      receiver_id: assigned_to,
      title: 'Công việc mới được giao',
      content: `Bạn được giao nhiệm vụ mới: "${title}". Hạn chót: ${due_date || 'Không có'}.`,
      type: 'task_assignment',
      related_id: newTask.id,
      is_read_by: [],
      created_at: new Date().toISOString()
    });

    LocalDatabase.save(db);
    res.status(201).json(newTask);
  });

  app.get('/api/tasks/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const task = db.tasks.find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' });
    }

    // Nhân viên không được xem chi tiết công việc của người khác.
    if (req.role?.id !== 'role-admin' && req.role?.id !== 'role-manager' && task.assigned_to !== req.user?.id) {
      return res.status(403).json({ error: 'Không có quyền truy cập công việc của người khác' });
    }

    const staff = db.users.find(u => u.id === task.assigned_to);
    const creator = db.users.find(u => u.id === task.assigned_by);
    const order = db.orders.find(o => o.id === task.order_id);
    const customer = order ? db.customers.find(c => c.id === order.customer_id) : null;
    const updates = db.task_updates
      .filter(u => u.task_id === task.id)
      .map(u => {
        const updater = db.users.find(usr => usr.id === u.updated_by);
        return {
          ...u,
          updated_by_name: updater ? updater.full_name : 'Ẩn danh'
        };
      })
      .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({
      ...task,
      assigned_to_name: staff ? staff.full_name : 'N/A',
      assigned_by_name: creator ? creator.full_name : 'N/A',
      order,
      customer,
      updates
    });
  });

  app.put('/api/tasks/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { title, description, assigned_to, status, priority, due_date } = req.body;

    if (status) {
      if (!['pending', 'in_progress', 'done', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Trạng thái công việc không hợp lệ' });
      }
    }

    const db = LocalDatabase.get();
    const idx = db.tasks.findIndex(t => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' });
    }

    const task = db.tasks[idx];

    // Nhân viên chỉ được cập nhật trạng thái; admin và manager được sửa toàn bộ công việc.
    const isManager = req.role?.id === 'role-admin' || req.role?.id === 'role-manager' || req.role?.permissions.includes('tasks.assign');

    if (!isManager && task.assigned_to !== req.user?.id) {
      return res.status(403).json({ error: 'Không có quyền sửa công việc của người khác' });
    }

    const oldStatus = task.status;

    if (isManager) {
      if (title) task.title = title;
      if (description !== undefined) task.description = description;
      if (assigned_to) task.assigned_to = assigned_to;
      if (priority) task.priority = priority;
      if (due_date !== undefined) task.due_date = due_date;
    }

    let statusLogged = false;
    if (status && status !== oldStatus) {
      task.status = status;
      statusLogged = true;

      // Ghi lịch sử đổi trạng thái.
      const update: TaskUpdate = {
        id: 'up-' + LocalDatabase.uuid(),
        task_id: id,
        updated_by: req.user!.id,
        status_changed_to: status,
        comment: `Thay đổi trạng thái công việc từ "${oldStatus}" sang "${status}"`,
        created_at: new Date().toISOString()
      };
      db.task_updates.push(update);
    }

    task.updated_at = new Date().toISOString();
    
    if (status && status !== oldStatus) {
      if (!db.notifications) db.notifications = [];
      const receiver = req.user!.id === task.assigned_to ? task.assigned_by : task.assigned_to;
      db.notifications.push({
        id: 'notif-' + LocalDatabase.uuid(),
        sender_id: req.user!.id,
        receiver_id: receiver,
        title: 'Trạng thái công việc thay đổi',
        content: `Công việc "${task.title}" đã chuyển từ "${oldStatus}" sang "${status}".`,
        type: 'task_assignment',
        related_id: task.id,
        is_read_by: [],
        created_at: new Date().toISOString()
      });
    }

    LocalDatabase.save(db);

    res.json(task);
  });

  app.post('/api/tasks/:id/updates', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status_changed_to, comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Vui lòng cung cấp nội dung ghi chú cập nhật' });
    }

    if (status_changed_to) {
      if (!['pending', 'in_progress', 'done', 'cancelled'].includes(status_changed_to)) {
        return res.status(400).json({ error: 'Trạng thái công việc không hợp lệ' });
      }
    }

    const db = LocalDatabase.get();
    const idx = db.tasks.findIndex(t => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy công việc' });
    }

    const task = db.tasks[idx];

    if (task.assigned_to !== req.user?.id && req.role?.id !== 'role-admin' && req.role?.id !== 'role-manager') {
      return res.status(403).json({ error: 'Bạn không được phân công thực hiện công việc này' });
    }

    const oldStatus = task.status;

    if (status_changed_to && status_changed_to !== oldStatus) {
      task.status = status_changed_to;
      task.updated_at = new Date().toISOString();
    }

    const update: TaskUpdate = {
      id: 'up-' + LocalDatabase.uuid(),
      task_id: id,
      updated_by: req.user!.id,
      status_changed_to: status_changed_to || null,
      comment,
      created_at: new Date().toISOString()
    };

    db.task_updates.push(update);

    if (!db.notifications) db.notifications = [];
    const receiver = req.user!.id === task.assigned_to ? task.assigned_by : task.assigned_to;
    db.notifications.push({
      id: 'notif-' + LocalDatabase.uuid(),
      sender_id: req.user!.id,
      receiver_id: receiver,
      title: status_changed_to && status_changed_to !== oldStatus ? 'Trạng thái công việc thay đổi' : 'Cập nhật tiến độ công việc',
      content: status_changed_to && status_changed_to !== oldStatus 
        ? `Công việc "${task.title}" đổi sang "${status_changed_to}" với ghi chú: "${comment}"`
        : `Ghi chú mới cho công việc "${task.title}": "${comment}"`,
      type: 'task_assignment',
      related_id: task.id,
      is_read_by: [],
      created_at: new Date().toISOString()
    });

    LocalDatabase.save(db);

    res.status(201).json(update);
  });

  app.get('/api/tasks/:id/updates', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const updates = db.task_updates
      .filter(u => u.task_id === req.params.id)
      .map(u => {
        const user = db.users.find(usr => usr.id === u.updated_by);
        return {
          ...u,
          updated_by_name: user ? user.full_name : 'N/A'
        };
      })
      .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(updates);
  });





  // Các endpoint dashboard.
  app.get('/api/dashboard/summary', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    
    // Thống kê đơn hàng theo trạng thái.
    const orderStatuses: Record<string, number> = {
      new: 0, confirmed: 0, shooting: 0, editing: 0, ready: 0, delivered: 0, cancelled: 0
    };
    db.orders.forEach(o => {
      if (orderStatuses[o.status] !== undefined) {
        orderStatuses[o.status]++;
      }
    });

    // Thống kê số lượng công việc.
    const totalTasks = db.tasks.length;
    const doneTasks = db.tasks.filter(t => t.status === 'done').length;

    // Đếm công việc đã quá hạn.
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueTasksCount = db.tasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'cancelled' && 
      t.due_date && 
      t.due_date < todayStr
    ).length;

    res.json({
      orders: {
        total: db.orders.length,
        by_status: orderStatuses
      },
      tasks: {
        total: totalTasks,
        done: doneTasks,
        overdue: overdueTasksCount
      }
    });
  });

  app.get('/api/dashboard/upcoming-shoots', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const today = new Date();
    const next7Days = new Date();
    next7Days.setDate(today.getDate() + 7);

    const todayStr = today.toISOString().split('T')[0];
    const next7DaysStr = next7Days.toISOString().split('T')[0];

    const upcoming = db.orders
      .filter(o => o.status !== 'cancelled' && o.shoot_date >= todayStr && o.shoot_date <= next7DaysStr)
      .map(o => {
        const cust = db.customers.find(c => c.id === o.customer_id);
        return {
          id: o.id,
          order_code: o.order_code,
          customer_name: cust ? cust.full_name : 'No Name',
          customer_phone: cust ? cust.phone : 'N/A',
          shoot_date: o.shoot_date,
          shoot_time: o.shoot_time,
          package_name: o.package_name,
          status: o.status
        };
      })
      .sort((a,b) => a.shoot_date.localeCompare(b.shoot_date) || (a.shoot_time || '').localeCompare(b.shoot_time || ''));

    res.json(upcoming);
  });

  app.get('/api/dashboard/overdue-tasks', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const todayStr = new Date().toISOString().split('T')[0];

    const overdue = db.tasks
      .filter(t => t.status !== 'done' && t.status !== 'cancelled' && t.due_date && t.due_date < todayStr)
      .map(t => {
        const staff = db.users.find(u => u.id === t.assigned_to);
        const order = db.orders.find(o => o.id === t.order_id);
        return {
          id: t.id,
          title: t.title,
          priority: t.priority,
          due_date: t.due_date,
          assigned_to_name: staff ? staff.full_name : 'N/A',
          order_code: order ? order.order_code : null,
          status: t.status
        };
      })
      .sort((a,b) => (a.due_date || '').localeCompare(b.due_date || ''));

    res.json(overdue);
  });



  // Các endpoint mục tiêu và kết quả then chốt.
  app.get('/api/objectives', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được xem mục tiêu' });
    }

    const db = LocalDatabase.get();
    
    const objectives = db.objectives || [];
    const krs = db.objective_key_results || [];

    const result = objectives.map(obj => {
      const creator = db.users.find(u => u.id === obj.created_by);
      const objKrs = krs.filter(k => k.objective_id === obj.id);
      
      // Tính tiến độ trung bình.
      let averageProgress = 0;
      if (objKrs.length > 0) {
        const sum = objKrs.reduce((acc, k) => acc + k.progress, 0);
        averageProgress = Math.round(sum / objKrs.length);
      }

      return {
        ...obj,
        created_by_name: creator ? creator.full_name : 'Quản trị viên',
        key_results: objKrs,
        progress: averageProgress
      };
    });

    res.json(result);
  });

  app.post('/api/objectives', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được tạo mục tiêu' });
    }

    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Thiếu tên mục tiêu' });
    }

    const db = LocalDatabase.get();
    if (!db.objectives) db.objectives = [];

    const newObj: Objective = {
      id: 'obj-' + LocalDatabase.uuid(),
      title,
      description: description || null,
      status: 'active',
      created_by: req.user!.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null
    };

    db.objectives.push(newObj);
    LocalDatabase.save(db);

    res.status(201).json(newObj);
  });

  app.put('/api/objectives/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được chỉnh sửa mục tiêu' });
    }

    const { id } = req.params;
    const { title, description, status } = req.body;

    const db = LocalDatabase.get();
    const idx = (db.objectives || []).findIndex(o => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy mục tiêu' });
    }

    const obj = db.objectives![idx];
    if (title !== undefined) obj.title = title;
    if (description !== undefined) obj.description = description;
    
    if (status !== undefined && ['active', 'completed', 'cancelled'].includes(status)) {
      if (status === 'completed' && obj.status !== 'completed') {
        obj.completed_at = new Date().toISOString();
      } else if (status === 'active') {
        obj.completed_at = null;
      }
      obj.status = status as 'active' | 'completed' | 'cancelled';
    }

    obj.updated_at = new Date().toISOString();
    LocalDatabase.save(db);

    res.json(obj);
  });

  app.post('/api/objectives/:id/key-results', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được thêm đầu việc' });
    }

    const { id } = req.params;
    const { title, assigned_department, assigned_to_user_id, notes } = req.body;

    if (!title || !assigned_department) {
      return res.status(400).json({ error: 'Thiếu tên đầu việc hoặc bộ phận được giao' });
    }

    const db = LocalDatabase.get();
    const objExists = (db.objectives || []).some(o => o.id === id);
    if (!objExists) {
      return res.status(404).json({ error: 'Mục tiêu không tồn tại' });
    }

    if (!db.objective_key_results) db.objective_key_results = [];

    const newKr: ObjectiveKeyResult = {
      id: 'kr-' + LocalDatabase.uuid(),
      objective_id: id,
      title,
      assigned_department,
      assigned_to_user_id: assigned_to_user_id || null,
      status: 'active',
      progress: 0,
      notes: notes || null,
      updated_at: new Date().toISOString()
    };

    db.objective_key_results.push(newKr);
    
    const parentIdx = db.objectives!.findIndex(o => o.id === id);
    if (parentIdx !== -1) {
      db.objectives![parentIdx].updated_at = new Date().toISOString();
    }

    LocalDatabase.save(db);
    res.status(201).json(newKr);
  });

  app.post('/api/key-results/:id/progress', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { progress, comment } = req.body;

    if (progress === undefined || isNaN(Number(progress)) || Number(progress) < 0 || Number(progress) > 100) {
      return res.status(400).json({ error: 'Tiến độ phải là số từ 0 đến 100' });
    }

    const db = LocalDatabase.get();
    const krIdx = (db.objective_key_results || []).findIndex(k => k.id === id);
    if (krIdx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đầu việc của mục tiêu' });
    }

    const kr = db.objective_key_results![krIdx];
    const prevProgress = kr.progress;
    const nextProgress = Number(progress);

    kr.progress = nextProgress;
    if (nextProgress === 0) {
      kr.status = 'active';
    } else if (nextProgress === 100) {
      kr.status = 'completed';
    } else {
      kr.status = 'active';
    }
    kr.updated_at = new Date().toISOString();

    if (!db.objective_progress_updates) db.objective_progress_updates = [];
    const newLog: ObjectiveProgressUpdate = {
      id: 'kr-up-' + LocalDatabase.uuid(),
      key_result_id: id,
      updated_by: req.user!.id,
      progress_from: prevProgress,
      progress_to: nextProgress,
      comment: comment || null,
      created_at: new Date().toISOString()
    };
    db.objective_progress_updates.push(newLog);

    const parentIdx = (db.objectives || []).findIndex(o => o.id === kr.objective_id);
    if (parentIdx !== -1) {
      const parentObj = db.objectives![parentIdx];
      parentObj.updated_at = new Date().toISOString();

      const sisterKrs = db.objective_key_results!.filter(k => k.objective_id === parentObj.id);
      const allCompleted = sisterKrs.length > 0 && sisterKrs.every(k => k.progress === 100);
      
      if (allCompleted && parentObj.status === 'active') {
        parentObj.status = 'completed';
        parentObj.completed_at = new Date().toISOString();
      }
    }

    LocalDatabase.save(db);
    res.json({ key_result: kr, update_log: newLog });
  });

  app.post('/api/key-results/:id/push', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới được gửi yêu cầu đôn đốc' });
    }

    const { id } = req.params;
    const { action_type, comment } = req.body; // action_type: 'urge' | 'request_update'

    const db = LocalDatabase.get();
    const krIdx = (db.objective_key_results || []).findIndex(k => k.id === id);
    if (krIdx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy đầu việc của mục tiêu' });
    }

    const kr = db.objective_key_results![krIdx];
    const objective = (db.objectives || []).find(o => o.id === kr.objective_id);
    const objectiveTitle = objective ? objective.title : 'mục tiêu lớn';

    // 1. Ghi nội dung đôn đốc vào lịch sử tiến độ mục tiêu.
    const logComment = comment || (action_type === 'request_update' 
      ? `[Yêu cầu cập nhật] Quản lý yêu cầu báo cáo tiến độ công việc.` 
      : `[Đôn đốc tiến độ] Quản lý thúc giục đẩy nhanh tiến độ thực hiện.`);

    if (!db.objective_progress_updates) db.objective_progress_updates = [];
    const newLog: ObjectiveProgressUpdate = {
      id: 'kr-up-' + LocalDatabase.uuid(),
      key_result_id: id,
      updated_by: req.user!.id,
      progress_from: kr.progress,
      progress_to: kr.progress,
      comment: logComment,
      created_at: new Date().toISOString()
    };
    db.objective_progress_updates.push(newLog);

    // 2. Tạo thông báo hệ thống riêng cho nhân sự được giao việc.
    if (kr.assigned_to_user_id) {
      if (!db.notifications) db.notifications = [];
      db.notifications.push({
        id: 'notif-' + LocalDatabase.uuid(),
        sender_id: req.user!.id,
        receiver_id: kr.assigned_to_user_id,
        title: action_type === 'request_update' ? 'Yêu cầu báo cáo tiến độ' : 'Thúc giục tiến độ công việc',
        content: comment || `Quản lý ${req.user!.full_name} yêu cầu cập nhật tiến độ cho công việc "${kr.title}" thuộc mục tiêu "${objectiveTitle}".`,
        type: 'task_assignment',
        related_id: kr.id,
        is_read_by: [],
        created_at: new Date().toISOString()
      });
    }

    LocalDatabase.save(db);
    res.json({ success: true, key_result: kr, update_log: newLog });
  });

  app.get('/api/key-results/:id/updates', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    const updates = (db.objective_progress_updates || []).filter(up => up.key_result_id === id);
    
    const result = updates.map(up => {
      const user = db.users.find(u => u.id === up.updated_by);
      return {
        ...up,
        updated_by_name: user ? user.full_name : 'Nhân viên'
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json(result);
  });

  app.get('/api/objectives/:id/report', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    
    const objective = (db.objectives || []).find(o => o.id === id);
    if (!objective) {
      return res.status(404).json({ error: 'Mục tiêu không tồn tại' });
    }

    const krs = (db.objective_key_results || []).filter(k => k.objective_id === id);
    const krIds = krs.map(k => k.id);
    const updates = (db.objective_progress_updates || []).filter(up => krIds.includes(up.key_result_id));

    const involvedUserIds = new Set<string>();
    krs.forEach(k => {
      if (k.assigned_to_user_id) involvedUserIds.add(k.assigned_to_user_id);
    });
    updates.forEach(up => {
      involvedUserIds.add(up.updated_by);
    });

    const involvedUsers = Array.from(involvedUserIds).map(uid => {
      const u = db.users.find(user => user.id === uid);
      return {
        id: uid,
        full_name: u ? u.full_name : 'N/A',
        email: u ? u.email : 'N/A'
      };
    });

    const timeline = updates.map(up => {
      const user = db.users.find(u => u.id === up.updated_by);
      const kr = krs.find(k => k.id === up.key_result_id);
      return {
        id: up.id,
        key_result_title: kr ? kr.title : 'Đầu việc',
        updated_by_name: user ? user.full_name : 'Nhân viên',
        progress_from: up.progress_from,
        progress_to: up.progress_to,
        comment: up.comment,
        created_at: up.created_at
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json({
      objective,
      key_results: krs,
      involved_users: involvedUsers,
      timeline
    });
  });

  // Các endpoint thông báo.
  app.get('/api/notifications', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    
    // Trả thông báo riêng của người dùng và thông báo chung có receiver_id bằng null.
    const list = (db.notifications || []).filter(n => n.receiver_id === null || n.receiver_id === userId);
    
    const result = list.map(n => {
      const sender = db.users.find(u => u.id === n.sender_id);
      return {
        ...n,
        sender_name: sender ? sender.full_name : 'Hệ thống',
        is_read: n.is_read_by.includes(userId)
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json(result);
  });

  app.post('/api/notifications', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const isManagerOrAdmin = req.role?.id === 'role-admin' || req.role?.id === 'role-manager';
    if (!isManagerOrAdmin) {
      return res.status(403).json({ error: 'Chỉ quản lý hoặc admin mới có quyền tạo thông báo chung' });
    }

    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung thông báo' });
    }

    const db = LocalDatabase.get();
    if (!db.notifications) db.notifications = [];

    const newNotif: Notification = {
      id: 'notif-' + LocalDatabase.uuid(),
      sender_id: req.user!.id,
      receiver_id: null, // Global announcement
      title,
      content,
      type: 'general',
      related_id: null,
      is_read_by: [],
      created_at: new Date().toISOString()
    };

    db.notifications.push(newNotif);
    LocalDatabase.save(db);

    res.status(201).json(newNotif);
  });

  app.post('/api/notifications/read-all', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    
    if (db.notifications) {
      db.notifications.forEach(n => {
        if ((n.receiver_id === null || n.receiver_id === userId) && !n.is_read_by.includes(userId)) {
          n.is_read_by.push(userId);
        }
      });
      LocalDatabase.save(db);
    }

    res.json({ success: true });
  });

  app.post('/api/notifications/:id/read', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    const { id } = req.params;

    const notif = (db.notifications || []).find(n => n.id === id);
    if (!notif) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo' });
    }

    if (notif.receiver_id !== null && notif.receiver_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền đọc thông báo này' });
    }

    if (!notif.is_read_by.includes(userId)) {
      notif.is_read_by.push(userId);
      LocalDatabase.save(db);
    }

    res.json({ success: true });
  });

  // Các endpoint trò chuyện nội bộ.
  const canStartPrivateChat = (requestingUser: User, targetUser: User) => {
    if (!targetUser.is_active || requestingUser.id === targetUser.id) return false;
    const requesterRole = LocalDatabase.get().roles.find(role => role.id === requestingUser.role_id)?.name;
    return requesterRole === 'admin' || requesterRole === 'manager'
      || targetUser.role_id === 'role-admin'
      || targetUser.role_id === 'role-manager';
  };

  const chatConversationKey = (targetUserId: string | null) => targetUserId ? `dm:${targetUserId}` : 'general';
  const chatUploadsDir = path.resolve(process.cwd(), 'chat_uploads');
  const canAccessTask = (user: User, role: Role | undefined, task: Task) => {
    if (role?.permissions.includes('tasks.view_all') || role?.permissions.includes('admin') || role?.id === 'role-admin') return true;
    return task.assigned_to === user.id;
  };

  const resolveChatReference = (user: User, role: Role | undefined, referenceType: unknown, referenceId: unknown) => {
    if (!referenceType || !referenceId) return null;
    const db = LocalDatabase.get();
    if (referenceType === 'task') {
      const task = db.tasks.find(item => item.id === referenceId);
      if (!task || !canAccessTask(user, role, task)) return null;
      return { type: 'task' as const, id: task.id, label: `${task.title}${task.order_id ? ` · ${db.orders.find(order => order.id === task.order_id)?.order_code || task.order_id}` : ''}` };
    }
    if (referenceType === 'customer') {
      const canViewCustomers = role?.permissions.includes('customers.view') || role?.permissions.includes('admin') || role?.id === 'role-admin';
      const customer = canViewCustomers ? db.customers.find(item => item.id === referenceId) : undefined;
      if (!customer) return null;
      return { type: 'customer' as const, id: customer.id, label: `${customer.full_name} · ${customer.phone}` };
    }
    return null;
  };

  app.get('/api/chat/references', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const query = String(req.query.q || '').trim().toLocaleLowerCase('vi-VN');
    if (query.length < 2) return res.json([]);
    const db = LocalDatabase.get();
    const results: Array<{ type: 'task' | 'customer'; id: string; label: string; subtitle: string }> = [];

    for (const task of db.tasks) {
      const order = db.orders.find(item => item.id === task.order_id);
      const haystack = `${task.id} ${task.title} ${order?.order_code || ''}`.toLocaleLowerCase('vi-VN');
      if (results.length < 6 && haystack.includes(query) && canAccessTask(req.user!, req.role, task)) {
        results.push({ type: 'task', id: task.id, label: task.title, subtitle: order?.order_code || task.id });
      }
    }

    const canViewCustomers = req.role?.permissions.includes('customers.view') || req.role?.permissions.includes('admin') || req.role?.id === 'role-admin';
    if (canViewCustomers) {
      for (const customer of db.customers) {
        const haystack = `${customer.id} ${customer.full_name} ${customer.phone}`.toLocaleLowerCase('vi-VN');
        if (results.length < 12 && haystack.includes(query)) {
          results.push({ type: 'customer', id: customer.id, label: customer.full_name, subtitle: customer.phone });
        }
      }
    }
    res.json(results);
  });

  app.post('/api/chat/attachments', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { data_url, name } = req.body;
    const match = typeof data_url === 'string' ? data_url.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
    if (!match) return res.status(400).json({ error: 'Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP' });
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Ảnh phải nhỏ hơn 5 MB' });
    }
    fs.mkdirSync(chatUploadsDir, { recursive: true });
    const extension = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${crypto.randomUUID()}.${extension}`;
    fs.writeFileSync(path.join(chatUploadsDir, filename), bytes, { flag: 'wx' });
    res.status(201).json({ filename, name: String(name || `anh-chup.${extension}`).slice(0, 120), mime: match[1] });
  });

  app.get('/api/chat/attachments/:filename', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const filename = req.params.filename;
    if (!/^[a-f0-9-]+\.(?:png|jpg|webp)$/.test(filename)) return res.status(400).json({ error: 'Tên ảnh không hợp lệ' });
    const message = (LocalDatabase.get().chat_messages || []).find(item => item.attachment_filename === filename);
    if (!message || (message.receiver_id !== null && message.sender_id !== req.user!.id && message.receiver_id !== req.user!.id)) {
      return res.status(404).json({ error: 'Không tìm thấy ảnh' });
    }
    const filePath = path.join(chatUploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Không tìm thấy ảnh' });
    res.type(message.attachment_mime || 'application/octet-stream').sendFile(filePath);
  });

  app.get('/api/chat/contacts', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const contacts = db.users
      .filter(user => canStartPrivateChat(req.user!, user))
      .map(user => {
        const role = db.roles.find(item => item.id === user.role_id);
        return {
          id: user.id,
          full_name: user.full_name,
          role_id: user.role_id,
          role_name: role?.name || '',
          role_display_name: role?.display_name || 'Nhân viên',
          is_active: user.is_active,
        };
      });
    res.json(contacts);
  });

  app.get('/api/chat/mentionable-users', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    res.json(db.users.filter(user => user.is_active && user.id !== req.user!.id).map(user => {
      const role = db.roles.find(item => item.id === user.role_id);
      return {
        id: user.id,
        full_name: user.full_name,
        role_id: user.role_id,
        role_name: role?.name || '',
        role_display_name: role?.display_name || 'Nhân viên',
        is_active: true,
      };
    }));
  });

  app.get('/api/chat/unread', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    const readStates = db.chat_read_states || [];
    const lastReadFor = (key: string) => readStates.find(state => state.user_id === userId && state.conversation_key === key)?.last_read_at || '';
    const direct: Record<string, number> = {};
    let general = 0;

    for (const message of db.chat_messages || []) {
      if (message.sender_id === userId) continue;
      if (message.receiver_id === null) {
        if (message.created_at > lastReadFor('general')) general += 1;
      } else if (message.receiver_id === userId) {
        const key = chatConversationKey(message.sender_id);
        if (message.created_at > lastReadFor(key)) {
          direct[message.sender_id] = (direct[message.sender_id] || 0) + 1;
        }
      }
    }

    res.json({ general, direct, total: general + Object.values(direct).reduce((sum, count) => sum + count, 0) });
  });

  app.post('/api/chat/read', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    const targetUserId = req.body.receiver_id === 'null' || !req.body.receiver_id ? null : String(req.body.receiver_id);
    if (targetUserId) {
      const target = db.users.find(user => user.id === targetUserId);
      if (!target || !canStartPrivateChat(req.user!, target)) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập cuộc trò chuyện này' });
      }
    }

    if (!db.chat_read_states) db.chat_read_states = [];
    const conversationKey = chatConversationKey(targetUserId);
    const now = new Date().toISOString();
    const existing = db.chat_read_states.find(state => state.user_id === userId && state.conversation_key === conversationKey);
    if (existing) {
      existing.last_read_at = now;
    } else {
      db.chat_read_states.push({
        id: `chat-read-${LocalDatabase.uuid()}`,
        user_id: userId,
        conversation_key: conversationKey,
        last_read_at: now,
      });
    }
    LocalDatabase.save(db);
    res.json({ success: true, conversation_key: conversationKey, last_read_at: now });
  });

  app.get('/api/chat/dashboard-messages', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    const messages = db.chat_messages || [];

    // Lấy tin kênh chung hoặc tin nhắn gửi trực tiếp cho người dùng hiện tại.
    const receivedMessages = messages.filter(m => m.receiver_id === null || m.receiver_id === userId);

    // Sắp xếp tin mới nhất lên trước.
    const sorted = [...receivedMessages].sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Chỉ lấy 10 tin gần nhất cho dashboard.
    const slice = sorted.slice(0, 10);

    const result = slice.map(m => {
      const sender = db.users.find(u => u.id === m.sender_id);
      return {
        ...m,
        sender_name: sender ? sender.full_name : 'Nhân viên',
        sender_role_id: sender ? sender.role_id : '',
        sender_role_name: sender ? db.roles.find(r => r.id === sender.role_id)?.name : 'staff'
      };
    });

    res.json(result);
  });

  app.get('/api/chat/messages', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const userId = req.user!.id;
    const targetUserId = req.query.receiver_id === 'null' || !req.query.receiver_id ? null : req.query.receiver_id as string;

    if (targetUserId) {
      const target = db.users.find(user => user.id === targetUserId);
      if (!target || !canStartPrivateChat(req.user!, target)) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập cuộc trò chuyện này' });
      }
    }

    const messages = db.chat_messages || [];

    let filtered = [];
    if (targetUserId === null) {
      // Lịch sử kênh chung.
      filtered = messages.filter(m => m.receiver_id === null);
    } else {
      // Lịch sử tin nhắn riêng giữa hai người dùng.
      filtered = messages.filter(m => 
        (m.sender_id === userId && m.receiver_id === targetUserId) ||
        (m.sender_id === targetUserId && m.receiver_id === userId)
      );
    }

    const result = filtered.map(m => {
      const sender = db.users.find(u => u.id === m.sender_id);
      return {
        ...m,
        sender_name: sender ? sender.full_name : 'Nhân viên',
        sender_role_id: sender ? sender.role_id : ''
      };
    }).sort((a, b) => a.created_at.localeCompare(b.created_at)); // Chronological order for chat history

    res.json(result);
  });

  app.post('/api/chat/messages', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const { receiver_id, content, attachment_filename, attachment_name, attachment_mime, reference_type, reference_id, mentioned_user_ids } = req.body;
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    if (!normalizedContent && !attachment_filename && !reference_id) {
      return res.status(400).json({ error: 'Tin nhắn cần có nội dung, ảnh hoặc tham chiếu' });
    }

    const targetUserId = receiver_id === 'null' || !receiver_id ? null : receiver_id as string;

    const db = LocalDatabase.get();
    if (targetUserId) {
      const target = db.users.find(user => user.id === targetUserId);
      if (!target || !canStartPrivateChat(req.user!, target)) {
        return res.status(403).json({ error: 'Bạn không có quyền gửi tin nhắn cho người này' });
      }
    }
    if (!db.chat_messages) db.chat_messages = [];
    const attachmentIsValid = typeof attachment_filename === 'string'
      && /^[a-f0-9-]+\.(?:png|jpg|webp)$/.test(attachment_filename)
      && fs.existsSync(path.join(chatUploadsDir, attachment_filename));
    if (attachment_filename && !attachmentIsValid) return res.status(400).json({ error: 'Ảnh đính kèm không hợp lệ' });
    const reference = resolveChatReference(req.user!, req.role, reference_type, reference_id);
    if (reference_id && !reference) return res.status(403).json({ error: 'Bạn không có quyền gắn hồ sơ này' });
    const allowedMentionIds = new Set(targetUserId ? [targetUserId] : db.users.filter(user => user.is_active && user.id !== req.user!.id).map(user => user.id));
    const mentions = Array.isArray(mentioned_user_ids)
      ? [...new Set(mentioned_user_ids.filter((id): id is string => typeof id === 'string' && allowedMentionIds.has(id)))].slice(0, 20)
      : [];

    const newMsg: ChatMessage = {
      id: 'msg-' + LocalDatabase.uuid(),
      sender_id: req.user!.id,
      receiver_id: targetUserId,
      content: normalizedContent,
      attachment_filename: attachmentIsValid ? attachment_filename : null,
      attachment_name: attachmentIsValid ? String(attachment_name || 'Ảnh chụp').slice(0, 120) : null,
      attachment_mime: attachmentIsValid ? String(attachment_mime || 'image/png') : null,
      reference_type: reference?.type || null,
      reference_id: reference?.id || null,
      reference_label: reference?.label || null,
      mentioned_user_ids: mentions,
      created_at: new Date().toISOString()
    };

    db.chat_messages.push(newMsg);
    LocalDatabase.save(db);

    const sender = db.users.find(u => u.id === req.user!.id);
    const responseMessage = {
      ...newMsg,
      sender_name: sender ? sender.full_name : 'Nhân viên',
      sender_role_id: sender ? sender.role_id : ''
    };

    if (targetUserId === null) {
      io.to('chat:general').emit('chat:message', responseMessage);
    } else {
      io.to(`chat:user:${req.user!.id}`).to(`chat:user:${targetUserId}`).emit('chat:message', responseMessage);
    }

    res.status(201).json(responseMessage);
  });

  function maskApiKey(key: string | undefined | null): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return `${key.substring(0, 3)}...${key.substring(key.length - 4)}`;
  }

  // Các endpoint cấu hình Studio.
  app.get('/api/studio/settings', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    res.json(db.studio_settings || {});
  });

  app.put('/api/studio/settings', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const { 
      name, phone, email, address, website, opening_hours, notes, backup_schedule, anniversary_reminder_days
    } = req.body;

    if (!name || !phone || !email || !address) {
      return res.status(400).json({ error: 'Các trường Tên, Số điện thoại, Email và Địa chỉ không được để trống' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Định dạng email không hợp lệ' });
    }

    const parsedReminderDays = anniversary_reminder_days === undefined
      ? 7
      : Number(anniversary_reminder_days);
    if (!Number.isInteger(parsedReminderDays) || parsedReminderDays < 1 || parsedReminderDays > 30) {
      return res.status(400).json({ error: 'Số ngày nhắc kỷ niệm phải là số nguyên từ 1 đến 30' });
    }

    db.studio_settings = {
      name,
      phone,
      email,
      address,
      website: website || '',
      opening_hours: opening_hours || '',
      notes: notes || '',
      backup_schedule: backup_schedule || 'weekly',
      last_backup_time: db.studio_settings?.last_backup_time || '',
      anniversary_reminder_days: parsedReminderDays
    };

    LocalDatabase.save(db);
    res.json(db.studio_settings);
  });

  // Lấy trạng thái đồng bộ database, xung đột và hàng đợi lỗi.
  app.get('/api/admin/sync-status', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const queue = LocalDatabase.getDeadLetterQueue();
    const conflicts = LocalDatabase.getConflicts();
    
    // Loại payload để phản hồi gọn và tránh lộ dữ liệu không cần thiết.
    const cleanQueue = queue.map(({ payload, ...item }) => item);
    
    res.json({
      pending_sync_failures_count: cleanQueue.length,
      dead_letter_queue: cleanQueue,
      conflicts_count: conflicts.length,
      conflicts: conflicts
    });
  });

  // Thử lại thủ công một mục đồng bộ lỗi trong hàng đợi.
  app.post('/api/admin/sync-retry/:id', authenticate, requirePermission('users.manage'), async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const success = await LocalDatabase.retryDeadLetterItem(id);
    if (success) {
      res.json({ success: true, message: 'Đã đồng bộ thử lại thành công sang PostgreSQL!' });
    } else {
      res.status(500).json({ error: 'Đồng bộ lại thất bại. Vui lòng khắc phục lỗi kết nối hoặc dữ liệu trước.' });
    }
  });

  // Làm sạch dữ liệu trước khi export hoặc tạo backup JSON cục bộ.
  function sanitizeDbForExportOrBackup(db: any) {
    if (!db) return db;
    const cloned = JSON.parse(JSON.stringify(db));
    if (Array.isArray(cloned.users)) {
      cloned.users = cloned.users.map((u: any) => {
        const { password_hash, ...cleanUser } = u;
        return cleanUser;
      });
    }
    if (cloned.studio_settings) {
      delete cloned.studio_settings.mimo_api_key;
      delete cloned.studio_settings.mimo_api_base_url;
      delete cloned.studio_settings.mimo_model;
      delete cloned.studio_settings.gemini_api_key;
      delete cloned.studio_settings.gemini_api_base_url;
      delete cloned.studio_settings.gemini_model;
    }
    return cloned;
  }

  // Kiểm tra và hợp nhất cấu trúc dữ liệu được import.
  function validateAndMergeDbImport(importedDb: any, currentDb: any): { error?: string; cleanDb?: any } {
    if (!importedDb || typeof importedDb !== 'object') {
      return { error: 'Dữ liệu không hợp lệ.' };
    }
    if (!Array.isArray(importedDb.users)) {
      return { error: 'Thiếu danh sách người dùng (users).' };
    }
    if (!Array.isArray(importedDb.roles)) {
      return { error: 'Thiếu danh sách vai trò (roles).' };
    }

    for (const r of importedDb.roles) {
      if (!r.id || !r.name || !r.display_name) {
        return { error: `Vai trò không hợp lệ: thiếu thông tin bắt buộc.` };
      }
      if (!Array.isArray(r.permissions)) {
        return { error: `Quyền hạn (permissions) của vai trò ${r.name} phải là một mảng.` };
      }
    }

    for (const u of importedDb.users) {
      if (!u.id || !u.email || !u.role_id || u.is_active === undefined) {
        return { error: `Người dùng không hợp lệ: thiếu thông tin bắt buộc (id, email, role_id, is_active).` };
      }
      if (u.password_hash) {
        if (!/^\$2[ayb]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(u.password_hash)) {
          return { error: `Mật khẩu của người dùng ${u.email} không hợp lệ (không phải là bcrypt hash).` };
        }
      }
    }

    const cloned = JSON.parse(JSON.stringify(importedDb));

    for (const u of cloned.users) {
      if (!u.password_hash) {
        const existingUser = currentDb.users.find((curU: any) => curU.id === u.id || curU.email.toLowerCase() === u.email.toLowerCase());
        if (existingUser && existingUser.password_hash) {
          u.password_hash = existingUser.password_hash;
        } else {
          const randomPass = crypto.randomBytes(16).toString('hex');
          u.password_hash = bcrypt.hashSync(randomPass, 10);
        }
      }
      if (u.session_version === undefined) {
        u.session_version = 0;
      }
    }

    // Luôn loại cấu hình LLM cũ khỏi dữ liệu import.
    if (cloned.studio_settings) {
      delete cloned.studio_settings.mimo_api_key;
      delete cloned.studio_settings.mimo_api_base_url;
      delete cloned.studio_settings.mimo_model;
      delete cloned.studio_settings.gemini_api_key;
      delete cloned.studio_settings.gemini_api_base_url;
      delete cloned.studio_settings.gemini_model;
    } else {
      cloned.studio_settings = currentDb.studio_settings;
    }

    return { cleanDb: cloned };
  }

  // Các endpoint quản lý database và backup JSON nội bộ.
  // Export dữ liệu thành file JSON tải về từ giao diện quản trị.
  app.get('/api/database/export', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const exportDb = sanitizeDbForExportOrBackup(db);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=aura_bridal_database.json');
    res.send(JSON.stringify(exportDb, null, 2));
  });

  // Import hoặc khôi phục dữ liệu từ file JSON được tải lên.
  app.post('/api/database/import', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const importedDb = req.body;
    const currentDb = LocalDatabase.get();
    
    const { error, cleanDb } = validateAndMergeDbImport(importedDb, currentDb);
    if (error) {
      return res.status(400).json({ error });
    }

    cleanDb.backups = currentDb.backups || [];

    LocalDatabase.save(cleanDb);
    res.json({ success: true, message: 'Nhập dữ liệu thành công!' });
  });

  // Liệt kê lịch sử backup JSON trong ứng dụng.
  app.get('/api/database/backups', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    res.json(db.backups || []);
  });

  // Tạo backup JSON thủ công hoặc theo lịch nội bộ.
  app.post('/api/database/backups/create', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const { trigger_type } = req.body;

    try {
      const backupsDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const backupId = 'bak-' + LocalDatabase.uuid();
      const filename = `backup_${Date.now()}_${backupId}.json`;
      const backupPath = path.join(backupsDir, filename);
      
      const sanitized = sanitizeDbForExportOrBackup(db);
      fs.writeFileSync(backupPath, JSON.stringify(sanitized, null, 2), 'utf-8');
      const stats = fs.statSync(backupPath);

      const newBackup = {
        id: backupId,
        filename,
        created_at: new Date().toISOString(),
        size_bytes: stats.size,
        trigger_type: trigger_type || 'manual',
        status: 'success' as const
      };

      if (!db.backups) db.backups = [];
      db.backups.push(newBackup);

      if (db.studio_settings) {
        db.studio_settings.last_backup_time = newBackup.created_at;
      }

      LocalDatabase.save(db);
      res.status(201).json(newBackup);
    } catch (err: any) {
      console.error('Backup creation error:', err);
      res.status(500).json({ error: `Không thể tạo bản sao lưu: ${err.message}` });
    }
  });

  function resolveSafeBackupPath(backupsDir: string, filename: string): string {
    if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes('..')) {
      throw new Error('Tên file backup không hợp lệ');
    }
    const resolved = path.resolve(backupsDir, filename);
    const root = path.resolve(backupsDir);
    if (!resolved.startsWith(root + path.sep)) {
      throw new Error('Đường dẫn backup không hợp lệ');
    }
    return resolved;
  }

  // Khôi phục dữ liệu từ một mã backup cụ thể.
  app.post('/api/database/backups/restore/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    const backup = db.backups?.find(b => b.id === id);

    if (!backup) {
      return res.status(404).json({ error: 'Không tìm thấy bản sao lưu được chọn' });
    }

    try {
      const backupsDir = path.join(process.cwd(), 'backups');
      const backupPath = resolveSafeBackupPath(backupsDir, backup.filename);

      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'File backup vật lý đã bị xóa hoặc không tìm thấy trên ổ đĩa' });
      }

      const backupRaw = fs.readFileSync(backupPath, 'utf-8');
      const backupData = JSON.parse(backupRaw);

      const { error, cleanDb } = validateAndMergeDbImport(backupData, db);
      if (error) {
        return res.status(400).json({ error });
      }

      cleanDb.backups = db.backups || [];
      LocalDatabase.save(cleanDb);

      res.json({ success: true, message: 'Khôi phục cơ sở dữ liệu thành công!' });
    } catch (err: any) {
      console.error('Restore error:', err);
      res.status(500).json({ error: `Lỗi khôi phục: ${err.message}` });
    }
  });

  // Xóa một backup JSON cụ thể.
  app.delete('/api/database/backups/:id', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = LocalDatabase.get();
    const backupIndex = db.backups?.findIndex(b => b.id === id) ?? -1;

    if (backupIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy bản sao lưu này' });
    }

    const backup = db.backups![backupIndex];
    try {
      const backupsDir = path.join(process.cwd(), 'backups');
      const backupPath = resolveSafeBackupPath(backupsDir, backup.filename);

      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch (err: any) {
      console.error('Failed to delete physical backup file:', err);
      return res.status(400).json({ error: `Không thể xóa file backup: ${err.message}` });
    }

    db.backups!.splice(backupIndex, 1);
    LocalDatabase.save(db);
    res.json({ success: true, message: 'Đã xóa bản sao lưu thành công' });
  });

  // Các endpoint khách hàng tiềm năng trong CRM.
  app.get('/api/leads', authenticate, (req: AuthenticatedRequest, res: Response) => {
    const hasViewAll = req.role?.permissions.includes('leads.view_all') || req.role?.permissions.includes('admin') || req.role?.id === 'role-admin';
    const hasManage = req.role?.permissions.includes('leads.manage');
    
    if (!hasViewAll && !hasManage) {
      return res.status(403).json({ error: 'Forbidden: Missing permission to view leads' });
    }

    const db = LocalDatabase.get();
    let result = db.leads || [];

    // Nhân viên sale không có quyền view_all chỉ thấy lead được giao cho mình.
    if (!hasViewAll && req.user) {
      result = result.filter(l => l.assigned_sale_id === req.user?.id);
    }

    if (req.query.page || req.query.limit) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const total = result.length;
      const items = result.slice(skip, skip + limit);
      return res.json({
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    res.json(result);
  });

  app.post('/api/leads', authenticate, requirePermission('leads.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { customer_name, phone, source, interested_packages, sales_step, notes, support_needed } = req.body;
    if (!customer_name || !source) {
      return res.status(400).json({ error: 'Thiếu tên khách hàng hoặc nguồn tiếp cận' });
    }

    if (sales_step !== undefined) {
      const step = parseInt(sales_step, 10);
      if (isNaN(step) || !isFinite(step) || step < 1 || step > 6) {
        return res.status(400).json({ error: 'Bước bán hàng (sales_step) phải từ 1 đến 6' });
      }
    }

    const db = LocalDatabase.get();
    const newLead: Lead = {
      id: 'lead-' + LocalDatabase.uuid(),
      date: new Date().toISOString().split('T')[0],
      customer_name,
      phone: phone || null,
      source,
      interested_packages: {
        beauty: !!interested_packages?.beauty,
        family: !!interested_packages?.family,
        wedding: !!interested_packages?.wedding,
        combo: !!interested_packages?.combo,
        couple: !!interested_packages?.couple
      },
      sales_step: sales_step || 1,
      follow_up_status: {
        follow_1: false,
        follow_2: false,
        follow_3: false
      },
      status: 'consulting',
      revenue: null,
      success_reason: null,
      failure_reason: null,
      assigned_sale_id: req.user!.id,
      support_needed: support_needed || null,
      notes: notes || null,
      admin_feedbacks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!db.leads) db.leads = [];
    db.leads.push(newLead);
    LocalDatabase.save(db);

    res.status(201).json(newLead);
  });

  app.put('/api/leads/:id', authenticate, requirePermission('leads.manage'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { 
      customer_name, phone, source, interested_packages, 
      sales_step, follow_up_status, status, revenue, 
      success_reason, failure_reason, notes, support_needed 
    } = req.body;

    const db = LocalDatabase.get();
    if (!db.leads) db.leads = [];
    const idx = db.leads.findIndex(l => l.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tư vấn' });
    }

    // Người chỉ có quyền leads.manage phải là người được giao lead này.
    const hasViewAll = req.role?.permissions.includes('leads.view_all') || req.role?.permissions.includes('admin') || req.role?.id === 'role-admin';
    if (!hasViewAll && db.leads[idx].assigned_sale_id !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden: Bạn không có quyền chỉnh sửa thông tin tư vấn này' });
    }

    const prevStatus = db.leads[idx].status;
    let linkedCustomerId: string | undefined;
    let customerPrefill: {
      full_name: string;
      phone: string | null;
      notes: string | null;
    } | undefined;
    let suggestedOrder: {
      package_name: string;
      package_price: number;
      total_amount: number;
      notes: string | null;
    } | undefined;

    if (customer_name !== undefined) db.leads[idx].customer_name = customer_name;
    if (phone !== undefined) db.leads[idx].phone = phone;
    if (source !== undefined) db.leads[idx].source = source;
    if (interested_packages !== undefined) {
      db.leads[idx].interested_packages = {
        beauty: !!interested_packages.beauty,
        family: !!interested_packages.family,
        wedding: !!interested_packages.wedding,
        combo: !!interested_packages.combo,
        couple: !!interested_packages.couple
      };
    }

    if (sales_step !== undefined) {
      const step = parseInt(sales_step, 10);
      if (isNaN(step) || !isFinite(step) || step < 1 || step > 6) {
        return res.status(400).json({ error: 'Bước bán hàng (sales_step) phải từ 1 đến 6' });
      }
      db.leads[idx].sales_step = step;
    }

    if (follow_up_status !== undefined) {
      db.leads[idx].follow_up_status = {
        follow_1: !!follow_up_status.follow_1,
        follow_2: !!follow_up_status.follow_2,
        follow_3: !!follow_up_status.follow_3
      };
    }

    if (status !== undefined) {
      if (!['consulting', 'won', 'lost'].includes(status)) {
        return res.status(400).json({ error: 'Trạng thái lead không hợp lệ' });
      }
      db.leads[idx].status = status;
    }

    if (revenue !== undefined) {
      if (revenue === null) {
        db.leads[idx].revenue = null;
      } else {
        const val = parseFloat(revenue);
        if (isNaN(val) || !isFinite(val)) {
          return res.status(400).json({ error: 'Doanh thu (revenue) không hợp lệ' });
        }
        db.leads[idx].revenue = val;
      }
    }

    if (success_reason !== undefined) db.leads[idx].success_reason = success_reason;
    if (failure_reason !== undefined) db.leads[idx].failure_reason = failure_reason;
    if (notes !== undefined) db.leads[idx].notes = notes;
    if (support_needed !== undefined) db.leads[idx].support_needed = support_needed;
    
    db.leads[idx].updated_at = new Date().toISOString();

    if (status === 'won' && prevStatus !== 'won') {
      const lead = db.leads[idx];
      const existingCust = db.customers.find(c => c.phone === lead.phone && lead.phone);
      if (existingCust) {
        linkedCustomerId = existingCust.id;
        existingCust.full_name = lead.customer_name || existingCust.full_name;
        if (lead.notes && !existingCust.notes) existingCust.notes = lead.notes;
        existingCust.updated_at = new Date().toISOString();
      } else {
        customerPrefill = {
          full_name: lead.customer_name,
          notes: lead.notes || 'Khách hàng tự động tạo từ tư vấn CRM.',
          phone: lead.phone
        };
      }

      let packageName = 'Gói Chụp Ảnh';
      if (lead.interested_packages.wedding) packageName = 'Gói Album cưới Wedding';
      else if (lead.interested_packages.family) packageName = 'Gói chụp ảnh gia đình Family';
      else if (lead.interested_packages.beauty) packageName = 'Gói chân dung nghệ thuật Beauty';
      else if (lead.interested_packages.combo) packageName = 'Gói chụp trọn gói Combo';
      else if (lead.interested_packages.couple) packageName = 'Gói chụp ảnh đôi Couple';

      suggestedOrder = {
        package_name: packageName,
        package_price: lead.revenue || 0,
        total_amount: lead.revenue || 0,
        notes: lead.notes || 'Đơn hàng tự động khởi tạo từ tư vấn CRM.',
      };

      const notifId = 'notif-' + LocalDatabase.uuid();
      if (!db.notifications) db.notifications = [];
      db.notifications.push({
        id: notifId,
        sender_id: req.user!.id,
        receiver_id: null,
        title: 'Lead đã chốt thành công',
        content: `Khách hàng ${lead.customer_name} đã chốt thành công qua CRM. Vui lòng hoàn tất form hợp đồng và bổ sung Facebook/ngày kỷ niệm để chăm sóc sau này.`,
        type: 'order_update',
        related_id: linkedCustomerId || id,
        is_read_by: [],
        created_at: new Date().toISOString()
      });
    }

    LocalDatabase.save(db);
    
    // Giữ cấu trúc phản hồi tương thích ngược và bổ sung các trường động.
    const updatedLeadWithMetaData = {
      ...db.leads[idx],
      new_order_id: undefined,
      new_customer_id: linkedCustomerId,
      customer_prefill: customerPrefill,
      order_prefill: suggestedOrder
    };
    res.json(updatedLeadWithMetaData);
  });

  app.post('/api/leads/:id/feedback', authenticate, requirePermission('leads.view_all'), (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
    }

    const db = LocalDatabase.get();
    if (!db.leads) db.leads = [];
    const idx = db.leads.findIndex(l => l.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tư vấn' });
    }

    const feedback: LeadFeedback = {
      id: 'fb-' + LocalDatabase.uuid(),
      user_id: req.user!.id,
      user_name: req.user!.full_name,
      author: req.user!.full_name,
      content,
      created_at: new Date().toISOString()
    };

    db.leads[idx].admin_feedbacks.push(feedback);
    db.leads[idx].updated_at = new Date().toISOString();

    const assignedSaleId = db.leads[idx].assigned_sale_id;
    if (assignedSaleId !== req.user!.id) {
      if (!db.notifications) db.notifications = [];
      db.notifications.push({
        id: 'notif-' + LocalDatabase.uuid(),
        sender_id: req.user!.id,
        receiver_id: assignedSaleId,
        title: 'Phản hồi mới từ Quản trị viên',
        content: `Quản trị viên đã phản hồi trên khách hàng ${db.leads[idx].customer_name}: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}"`,
        type: 'general',
        related_id: id,
        is_read_by: [],
        created_at: new Date().toISOString()
      });
    }

    LocalDatabase.save(db);
    res.status(201).json(feedback);
  });

  app.get('/api/leads/analytics', authenticate, requirePermission('leads.view_all'), (req: AuthenticatedRequest, res: Response) => {
    const db = LocalDatabase.get();
    const leads = db.leads || [];

    const totalLeads = leads.length;
    const wonLeads = leads.filter(l => l.status === 'won').length;
    const lostLeads = leads.filter(l => l.status === 'lost').length;
    const activeLeads = totalLeads - wonLeads - lostLeads;

    const totalRevenue = leads.reduce((sum, l) => sum + (l.revenue || 0), 0);

    const sources: { [key: string]: number } = {};
    leads.forEach(l => {
      sources[l.source] = (sources[l.source] || 0) + 1;
    });

    const packages = {
      beauty: leads.filter(l => l.interested_packages.beauty).length,
      family: leads.filter(l => l.interested_packages.family).length,
      wedding: leads.filter(l => l.interested_packages.wedding).length,
      combo: leads.filter(l => l.interested_packages.combo).length,
      couple: leads.filter(l => l.interested_packages.couple).length
    };

    const failureReasons: { [key: string]: number } = {};
    leads.filter(l => l.failure_reason).forEach(l => {
      const r = l.failure_reason!;
      failureReasons[r] = (failureReasons[r] || 0) + 1;
    });

    const steps: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    leads.filter(l => l.status === 'consulting').forEach(l => {
      steps[l.sales_step] = (steps[l.sales_step] || 0) + 1;
    });

    res.json({
      summary: {
        totalLeads,
        wonLeads,
        lostLeads,
        activeLeads,
        totalRevenue,
        conversionRate: totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0
      },
      sources,
      packages,
      failureReasons,
      steps
    });
  });

  app.post('/api/demo/cleanup', authenticate, requirePermission('users.manage'), (req: AuthenticatedRequest, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Chức năng này không khả dụng trên môi trường production.' });
    }

    const db = LocalDatabase.get();
    
    // Dọn lead mẫu "Nguyễn Hoàng Nam".
    if (db.leads) {
      db.leads = db.leads.filter(l => l.customer_name !== 'Nguyễn Hoàng Nam');
    }
    
    // Dọn tin nhắn demo do người dùng hiện tại tạo.
    if (db.chat_messages) {
      db.chat_messages = db.chat_messages.filter(m => 
        !(m.sender_id === req.user!.id && m.content.includes('Chào cả nhà, chúc studio mình tuần mới'))
      );
    }
    
    LocalDatabase.save(db);
    res.json({ success: true, message: 'Dữ liệu demo đã được dọn dẹp sạch sẽ!' });
  });

  // Phục vụ Vite ở môi trường phát triển hoặc static build ở production.
  if (process.env.NODE_ENV === 'test') {
    // Chế độ test chỉ chạy API, không gắn Vite middleware hoặc static catch-all.
  } else if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Bộ lập lịch nhắc sinh nhật và kỷ niệm.
  if (process.env.NODE_ENV !== 'test') {
    setTimeout(() => {
      console.log('[ANNIVERSARY] Initial scanning starting...');
      scanAndGenerateAnniversaryNotifications().catch(err => {
        console.error('[ANNIVERSARY] Scan error:', err);
      });
    }, 5000);

    setInterval(() => {
      console.log('[ANNIVERSARY] Running periodic scan...');
      scanAndGenerateAnniversaryNotifications().catch(err => {
        console.error('[ANNIVERSARY] Periodic scan error:', err);
      });
    }, 12 * 60 * 60 * 1000);
  }

  const host = process.env.HOST || (fs.existsSync('/.dockerenv') ? '0.0.0.0' : '127.0.0.1');
  const server = httpServer.listen(PORT as number, host, () => {
    console.log(`Server running on port ${PORT} (bound to ${host})`);
  });
  return { app, server, io };
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
  });
}

export { startServer };
