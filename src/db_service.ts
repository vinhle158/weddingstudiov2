import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const prisma = new PrismaClient();



// Types matching the schema specified in the Workflow Specification
export interface User {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role_id: string;
  is_active: boolean;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  permissions: string[];
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_code: string;
  customer_id: string;
  status: 'new' | 'confirmed' | 'shooting' | 'editing' | 'ready' | 'delivered' | 'cancelled';
  shoot_date: string; // YYYY-MM-DD
  shoot_time: string | null; // HH:MM
  package_name: string;
  package_price: number;
  deposit_amount: number;
  total_amount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  note: string | null;
  changed_at: string;
}



export interface Task {
  id: string;
  title: string;
  description: string | null;
  order_id: string | null;
  assigned_to: string;
  assigned_by: string;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  due_date: string | null; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  updated_by: string;
  status_changed_to: string | null;
  comment: string;
  created_at: string;
}

export interface Objective {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_by: string; // user id
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ObjectiveKeyResult {
  id: string;
  objective_id: string;
  title: string;
  assigned_department: string; // e.g. "Chụp ảnh", "Hậu kỳ", "Tư vấn & CSKH", "Marketing/Quảng cáo", "Tất cả"
  assigned_to_user_id: string | null; // direct user assignment
  status: 'pending' | 'in_progress' | 'completed';
  progress: number; // 0 to 100
  notes: string | null;
  updated_at: string;
}

export interface ObjectiveProgressUpdate {
  id: string;
  key_result_id: string;
  updated_by: string; // user id
  progress_from: number;
  progress_to: number;
  comment: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  sender_id: string; // sender user id
  receiver_id: string | null; // null means public global announcement, otherwise specific user id
  title: string;
  content: string;
  type: 'general' | 'task_assignment' | 'order_update' | 'system';
  related_id: string | null; // e.g., task_id or order_id
  is_read_by: string[]; // List of user IDs who have read this (especially for general announcements and direct notifications)
  created_at: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string | null; // null means public global group chat, otherwise private to specific user id
  content: string;
  created_at: string;
}

export interface StudioSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  opening_hours: string;
  notes: string;
  backup_schedule: 'daily' | 'weekly' | 'monthly' | 'none';
  last_backup_time: string;
}

export interface DatabaseBackup {
  id: string;
  filename: string;
  created_at: string;
  size_bytes: number;
  trigger_type: 'manual' | 'scheduled';
  status: 'success' | 'failed';
}

export interface LeadFeedback {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface Lead {
  id: string;
  date: string; // YYYY-MM-DD
  customer_name: string;
  phone: string | null;
  source: string;
  interested_packages: {
    beauty: boolean;
    family: boolean;
    wedding: boolean;
    combo: boolean;
    couple: boolean;
  };
  sales_step: number; // 1 to 6
  follow_up_status: {
    follow_1: boolean;
    follow_2: boolean;
    follow_3: boolean;
  };
  status: 'consulting' | 'won' | 'lost';
  revenue: number | null;
  success_reason: string | null;
  failure_reason: string | null;
  assigned_sale_id: string;
  support_needed: string | null;
  notes: string | null;
  admin_feedbacks: LeadFeedback[];
  created_at: string;
  updated_at: string;
}

export interface DatabaseSchema {
  users: User[];
  roles: Role[];
  customers: Customer[];
  orders: Order[];
  order_status_history: OrderStatusHistory[];
  tasks: Task[];
  task_updates: TaskUpdate[];
  objectives?: Objective[];
  objective_key_results?: ObjectiveKeyResult[];
  objective_progress_updates?: ObjectiveProgressUpdate[];
  notifications?: Notification[];
  chat_messages?: ChatMessage[];
  studio_settings?: StudioSettings;
  backups?: DatabaseBackup[];
  leads: Lead[];
}

const DB_FILE = path.join(process.cwd(), 'db.json');

const defaultRoles: Role[] = [
  {
    id: 'role-admin',
    name: 'admin',
    display_name: 'Quản trị hệ thống',
    permissions: [
      'orders.view', 'orders.create', 'orders.edit',
      'tasks.view_own', 'tasks.view_all', 'tasks.assign',
      'customers.view', 'customers.edit',
      'inventory.view', 'inventory.edit',
      'reports.view', 'users.manage'
    ]
  },
  {
    id: 'role-manager',
    name: 'manager',
    display_name: 'Quản lý (hợp đồng, đơn hàng, quản lý khách hàng, trò chuyện, nhận thông báo)',
    permissions: [
      'orders.view', 'orders.create', 'orders.edit',
      'tasks.view_own', 'tasks.view_all', 'tasks.assign',
      'customers.view', 'customers.edit',
      'inventory.view', 'inventory.edit',
      'reports.view'
    ]
  },
  {
    id: 'role-staff',
    name: 'staff',
    display_name: 'Nhân viên (nhận thông tin công việc liên quan đến mình, cập nhật tiến độ, trò chuyện, nhận thông báo)',
    permissions: ['tasks.view_own']
  }
];

const defaultUsers: User[] = [
  {
    id: 'user-admin',
    full_name: 'Viet Hoang',
    email: 'viet@studio.com',
    password_hash: bcrypt.hashSync('123abc456', 10),
    role_id: 'role-admin',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z'
  }
];

const defaultCustomers: Customer[] = [];
const defaultOrders: Order[] = [];
const defaultOrderHistory: OrderStatusHistory[] = [];
const defaultTasks: Task[] = [];
const defaultTaskUpdates: TaskUpdate[] = [];
const defaultObjectives: Objective[] = [];
const defaultObjectiveKeyResults: ObjectiveKeyResult[] = [];
const defaultObjectiveProgressUpdates: ObjectiveProgressUpdate[] = [];
const defaultNotifications: Notification[] = [];
const defaultChatMessages: ChatMessage[] = [];

export class LocalDatabase {
  private static data: DatabaseSchema | null = null;
  private static writeQueue: Promise<void> = Promise.resolve();


  public static get(): DatabaseSchema {
    if (this.data) return this.data;

    const defaultStudioSettings: StudioSettings = {
      name: "The Will Studio",
      phone: "0901 234 567",
      email: "contact@aurabridal.com",
      address: "123 Đường Ba Tháng Hai, Quận 10, TP. Hồ Chí Minh",
      website: "https://aurabridal.vn",
      opening_hours: "08:30 - 21:30",
      notes: "Studio váy cưới cao cấp & dịch vụ chụp ảnh trọn gói chuyên nghiệp.",
      backup_schedule: "weekly",
      last_backup_time: ""
    };

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        
        // Ensure new arrays are initialized
        if (!this.data!.objectives) this.data!.objectives = defaultObjectives;
        if (!this.data!.objective_key_results) this.data!.objective_key_results = defaultObjectiveKeyResults;
        if (!this.data!.objective_progress_updates) this.data!.objective_progress_updates = defaultObjectiveProgressUpdates;
        if (!this.data!.notifications) this.data!.notifications = defaultNotifications;
        if (!this.data!.chat_messages) this.data!.chat_messages = defaultChatMessages;
        if (!this.data!.studio_settings) this.data!.studio_settings = defaultStudioSettings;
        if (!this.data!.backups) this.data!.backups = [];
        if (!this.data!.leads) this.data!.leads = [];
        
        // Migrate passwords if any are plaintext
        const wasMigrated = this.migratePasswords(this.data!);
        if (wasMigrated) {
          this.save(this.data!);
        }

        return this.data!;
      } catch (e) {
        console.error('Error reading DB, re-initializing...', e);
      }
    }

    // Seed default data
    const seed: DatabaseSchema = {
      users: defaultUsers,
      roles: defaultRoles,
      customers: defaultCustomers,
      orders: defaultOrders,
      order_status_history: defaultOrderHistory,
      tasks: defaultTasks,
      task_updates: defaultTaskUpdates,
      objectives: defaultObjectives,
      objective_key_results: defaultObjectiveKeyResults,
      objective_progress_updates: defaultObjectiveProgressUpdates,
      notifications: defaultNotifications,
      chat_messages: defaultChatMessages,
      studio_settings: defaultStudioSettings,
      backups: [],
      leads: []
    };
    this.save(seed);
    this.data = seed;
    return this.data;
  }

  public static async initialize() {
    try {
      console.log('Connecting to PostgreSQL database...');
      const roles = await prisma.role.findMany();
      const users = await prisma.user.findMany();
      const customers = await prisma.customer.findMany();
      const orders = await prisma.order.findMany();
      const orderStatusHistory = await prisma.orderStatusHistory.findMany();
      const tasks = await prisma.task.findMany();
      const taskUpdates = await prisma.taskUpdate.findMany();
      const objectives = await prisma.objective.findMany();
      const objectiveKeyResults = await prisma.objectiveKeyResult.findMany();
      const objectiveProgressUpdates = await prisma.objectiveProgressUpdate.findMany();
      const notifications = await prisma.notification.findMany();
      const chatMessages = await prisma.chatMessage.findMany();
      const studioSettingsList = await prisma.studioSettings.findMany();
      const backups = await prisma.databaseBackup.findMany();
      const leads = await prisma.lead.findMany();

      if (users.length === 0 || roles.length === 0) {
        console.log('PostgreSQL database is empty. Seeding default data...');
        const defaultStudioSettings: StudioSettings = {
          name: "The Will Studio",
          phone: "0901 234 567",
          email: "contact@aurabridal.com",
          address: "123 Đường Ba Tháng Hai, Quận 10, TP. Hồ Chí Minh",
          website: "https://aurabridal.vn",
          opening_hours: "08:30 - 21:30",
          notes: "Studio váy cưới cao cấp & dịch vụ chụp ảnh trọn gói chuyên nghiệp.",
          backup_schedule: "weekly",
          last_backup_time: ""
        };

        const seed: DatabaseSchema = {
          users: defaultUsers,
          roles: defaultRoles,
          customers: defaultCustomers,
          orders: defaultOrders,
          order_status_history: defaultOrderHistory,
          tasks: defaultTasks,
          task_updates: defaultTaskUpdates,
          objectives: defaultObjectives,
          objective_key_results: defaultObjectiveKeyResults,
          objective_progress_updates: defaultObjectiveProgressUpdates,
          notifications: defaultNotifications,
          chat_messages: defaultChatMessages,
          studio_settings: defaultStudioSettings,
          backups: [],
          leads: []
        };

        await this.syncToPostgres(seed);
        this.data = seed;
      } else {
        // Ensure leads roles and permissions are active
        let needsSync = false;
        
        // 1. Ensure role-admin has leads permissions
        const adminRole = roles.find(r => r.id === 'role-admin');
        if (adminRole) {
          if (!adminRole.permissions.includes('leads.manage')) {
            adminRole.permissions.push('leads.manage');
            needsSync = true;
          }
          if (!adminRole.permissions.includes('leads.view_all')) {
            adminRole.permissions.push('leads.view_all');
            needsSync = true;
          }
        }

        // 2. Ensure role-manager has leads permissions
        const managerRole = roles.find(r => r.id === 'role-manager');
        if (managerRole) {
          if (!managerRole.permissions.includes('leads.manage')) {
            managerRole.permissions.push('leads.manage');
            needsSync = true;
          }
          if (!managerRole.permissions.includes('leads.view_all')) {
            managerRole.permissions.push('leads.view_all');
            needsSync = true;
          }
        }

        // 3. Ensure role-sales exists
        let salesRole = roles.find(r => r.id === 'role-sales');
        if (!salesRole) {
          salesRole = {
            id: 'role-sales',
            name: 'sales',
            display_name: 'Tư vấn & Sales',
            permissions: ['leads.manage', 'tasks.view_own']
          };
          roles.push(salesRole);
          needsSync = true;
        }

        // 4. Ensure user-sale exists
        let saleUser = users.find(u => u.id === 'user-sale' || u.email === 'sale@studio.com');
        if (!saleUser) {
          saleUser = {
            id: 'user-sale',
            full_name: 'Nguyễn Thị Sales',
            email: 'sale@studio.com',
            password_hash: bcrypt.hashSync('staff123', 10),
            role_id: 'role-sales',
            is_active: true,
            created_at: '2026-06-01T00:00:00Z'
          };
          users.push(saleUser);
          needsSync = true;
        }

        if (needsSync) {
          console.log('CRM/Sales roles and permissions missing in PostgreSQL. Migrating database...');
          const fullData: DatabaseSchema = {
            users,
            roles,
            customers,
            orders: orders as any,
            order_status_history: orderStatusHistory,
            tasks: tasks as any,
            task_updates: taskUpdates,
            objectives: objectives as any,
            objective_key_results: objectiveKeyResults as any,
            objective_progress_updates: objectiveProgressUpdates,
            notifications: notifications as any,
            chat_messages: chatMessages,
            studio_settings: (studioSettingsList[0] || undefined) as any,
            backups: backups as any,
            leads: leads as any
          };
          await this.syncToPostgres(fullData);
        }

        this.data = {
          users,
          roles,
          customers,
          orders: orders as any,
          order_status_history: orderStatusHistory,
          tasks: tasks as any,
          task_updates: taskUpdates,
          objectives: objectives as any,
          objective_key_results: objectiveKeyResults as any,
          objective_progress_updates: objectiveProgressUpdates,
          notifications: notifications as any,
          chat_messages: chatMessages,
          studio_settings: (studioSettingsList[0] || undefined) as any,
          backups: backups as any,
          leads: leads as any
        };
        
        // Migrate passwords if any are plaintext
        const wasMigrated = this.migratePasswords(this.data);
        if (wasMigrated) {
          this.save(this.data);
        }
      }
      console.log('LocalDatabase successfully initialized and loaded from PostgreSQL.');
    } catch (err) {
      console.error('Failed to initialize database from PostgreSQL:', err);
      this.get();
    }
  }

  public static save(data: DatabaseSchema) {
    this.data = data;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write backup db.json:', err);
    }
    
    // Queue the PostgreSQL sync to prevent concurrent database transaction/overwrite collisions
    this.writeQueue = this.writeQueue
      .then(() => this.syncToPostgres(data))
      .catch(err => {
        console.error('Error in PostgreSQL sync queue:', err);
      });
  }


  public static async syncToPostgres(data: DatabaseSchema) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.deleteMany();
        await tx.role.deleteMany();
        await tx.customer.deleteMany();
        await tx.order.deleteMany();
        await tx.orderStatusHistory.deleteMany();
        await tx.task.deleteMany();
        await tx.taskUpdate.deleteMany();
        await tx.objective.deleteMany();
        await tx.objectiveKeyResult.deleteMany();
        await tx.objectiveProgressUpdate.deleteMany();
        await tx.notification.deleteMany();
        await tx.chatMessage.deleteMany();
        await tx.studioSettings.deleteMany();
        await tx.databaseBackup.deleteMany();
        await tx.lead.deleteMany();

        if (data.roles && data.roles.length > 0) {
          await tx.role.createMany({ data: data.roles });
        }
        if (data.users && data.users.length > 0) {
          await tx.user.createMany({ data: data.users });
        }
        if (data.customers && data.customers.length > 0) {
          await tx.customer.createMany({ data: data.customers });
        }
        if (data.orders && data.orders.length > 0) {
          await tx.order.createMany({ data: data.orders as any });
        }
        if (data.order_status_history && data.order_status_history.length > 0) {
          await tx.orderStatusHistory.createMany({ data: data.order_status_history });
        }
        if (data.tasks && data.tasks.length > 0) {
          await tx.task.createMany({ data: data.tasks as any });
        }
        if (data.task_updates && data.task_updates.length > 0) {
          await tx.taskUpdate.createMany({ data: data.task_updates });
        }
        if (data.objectives && data.objectives.length > 0) {
          await tx.objective.createMany({ data: data.objectives as any });
        }
        if (data.objective_key_results && data.objective_key_results.length > 0) {
          await tx.objectiveKeyResult.createMany({ data: data.objective_key_results as any });
        }
        if (data.objective_progress_updates && data.objective_progress_updates.length > 0) {
          await tx.objectiveProgressUpdate.createMany({ data: data.objective_progress_updates });
        }
        if (data.notifications && data.notifications.length > 0) {
          await tx.notification.createMany({ data: data.notifications as any });
        }
        if (data.chat_messages && data.chat_messages.length > 0) {
          await tx.chatMessage.createMany({ data: data.chat_messages });
        }
        if (data.backups && data.backups.length > 0) {
          await tx.databaseBackup.createMany({ data: data.backups as any });
        }
        if (data.leads && data.leads.length > 0) {
          await tx.lead.createMany({ data: data.leads as any });
        }
        if (data.studio_settings) {
          await tx.studioSettings.create({
            data: {
              id: 'singleton',
              name: data.studio_settings.name,
              phone: data.studio_settings.phone,
              email: data.studio_settings.email,
              address: data.studio_settings.address,
              website: data.studio_settings.website || '',
              opening_hours: data.studio_settings.opening_hours || '',
              notes: data.studio_settings.notes || '',
              backup_schedule: data.studio_settings.backup_schedule || 'weekly',
              last_backup_time: data.studio_settings.last_backup_time || ''
            }
          });
        }
      });
      console.log('PostgreSQL database successfully synchronized.');
    } catch (err) {
      console.error('Error synchronizing database to PostgreSQL:', err);
    }
  }


  // Helpers for password migration
  private static isBcryptHash(str: string): boolean {
    return /^\$2[ayb]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(str);
  }

  public static migratePasswords(data: DatabaseSchema): boolean {
    let modified = false;
    if (data.users) {
      for (const user of data.users) {
        if (user.password_hash && !this.isBcryptHash(user.password_hash)) {
          console.log(`Migrating plaintext password for user: ${user.email}`);
          user.password_hash = bcrypt.hashSync(user.password_hash, 10);
          modified = true;
        }
      }
    }
    return modified;
  }

  // Helper to generate IDs
  public static uuid(): string {
    return crypto.randomUUID();
  }

  // Automatically generate order code ORD-YYYY-XXX
  public static generateOrderCode(): string {
    const db = this.get();
    const currentYear = new Date().getFullYear();
    const prefix = `ORD-${currentYear}-`;
    const yearOrders = db.orders.filter(o => o.order_code.startsWith(prefix));
    
    let maxNum = 0;
    yearOrders.forEach(o => {
      const parts = o.order_code.split('-');
      if (parts.length === 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    const formattedNum = String(nextNum).padStart(3, '0');
    return `${prefix}${formattedNum}`;
  }
}
