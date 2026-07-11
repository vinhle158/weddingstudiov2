import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const prisma = new PrismaClient();

// Types matching the schema
export interface User {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role_id: string;
  is_active: boolean;
  created_at: string;
  session_version: number;
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
  birthday?: string | null;
  wedding_date?: string | null;
  facebook_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_code: string;
  customer_id: string;
  status: 'new' | 'confirmed' | 'shooting' | 'editing' | 'ready' | 'delivered' | 'cancelled';
  shoot_date: string;
  shoot_time: string | null;
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

export interface DressInventory {
  id: string;
  code: string;
  name: string;
  category: string;
  size: string;
  color: string;
  status: 'available' | 'rented' | 'maintenance' | 'retired';
  image_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface DressRental {
  id: string;
  dress_id: string;
  order_id: string;
  rented_date: string;
  return_date: string;
  returned_at: string | null;
  rental_fee: number;
  status: 'active' | 'returned' | 'overdue';
  notes: string | null;
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
  due_date: string | null;
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
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ObjectiveKeyResult {
  id: string;
  objective_id: string;
  title: string;
  assigned_department: string;
  assigned_to_user_id: string | null;
  status: 'active' | 'completed' | 'failed';
  progress: number;
  notes: string | null;
  updated_at: string;
}

export interface ObjectiveProgressUpdate {
  id: string;
  key_result_id: string;
  updated_by: string;
  progress_from: number;
  progress_to: number;
  comment: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  title: string;
  content: string;
  type: string;
  related_id: string | null;
  is_read_by: string[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string | null;
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
  backup_schedule: 'daily' | 'weekly' | 'monthly';
  last_backup_time: string;
  anniversary_reminder_days: number;
}

export interface DatabaseBackup {
  id: string;
  filename: string;
  created_at: string;
  size_bytes: number;
  trigger_type: 'manual' | 'auto';
  status: 'success' | 'failed';
}

export interface LeadFeedback {
  id?: string;
  user_id?: string;
  user_name?: string;
  content: string;
  author: string;
  created_at: string;
}

export interface Lead {
  id: string;
  date: string;
  customer_name: string;
  phone: string | null;
  source: string;
  interested_packages: any;
  sales_step: number;
  follow_up_status: any;
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
      'reports.view', 'users.manage', 'leads.manage', 'leads.view_all'
    ]
  },
  {
    id: 'role-manager',
    name: 'manager',
    display_name: 'Quản lý vận hành',
    permissions: [
      'orders.view', 'orders.create', 'orders.edit',
      'tasks.view_own', 'tasks.view_all', 'tasks.assign',
      'customers.view', 'customers.edit',
      'inventory.view', 'inventory.edit',
      'reports.view', 'leads.manage', 'leads.view_all'
    ]
  },
  {
    id: 'role-staff',
    name: 'staff',
    display_name: 'Nhân viên lễ tân',
    permissions: ['tasks.view_own']
  },
  {
    id: 'role-sales',
    name: 'sales',
    display_name: 'Tư vấn & Sales',
    permissions: ['leads.manage', 'tasks.view_own', 'customers.view', 'customers.edit', 'orders.view', 'orders.create', 'orders.edit']
  }
];

const getSeedPassword = (envName: string) => {
  const value = process.env[envName];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${envName} is required for first-run production seed`);
  }
  const randomPass = crypto.randomBytes(16).toString('hex');
  console.log(`[SEED] Generated ephemeral password for ${envName}: ${randomPass} (Use only for dev, please change after logging in)`);
  return randomPass;
};

const defaultUsersFunc = (): User[] => [
  {
    id: 'user-admin',
    full_name: 'Viet Hoang',
    email: 'viet@studio.com',
    password_hash: bcrypt.hashSync(getSeedPassword('SEED_ADMIN_PASSWORD'), 10),
    role_id: 'role-admin',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    session_version: 0
  },
  {
    id: 'user-sale',
    full_name: 'Nguyễn Thị Sales',
    email: 'sale@studio.com',
    password_hash: bcrypt.hashSync(getSeedPassword('SEED_SALES_PASSWORD'), 10),
    role_id: 'role-sales',
    is_active: true,
    created_at: '2026-06-01T00:00:00Z',
    session_version: 0
  }
];

export class LocalDatabase {
  private static data: DatabaseSchema | null = null;
  private static writeQueue: Promise<void> = Promise.resolve();

  public static async initialize() {
    try {
      console.log('Connecting to PostgreSQL database (PostgreSQL-only Active Cache mode)...');
      await prisma.$queryRaw`SELECT 1`;

      // Seed roles if empty
      const roleCount = await prisma.role.count();
      if (roleCount === 0) {
        console.log('Seeding default roles to PostgreSQL...');
        for (const role of defaultRoles) {
          await prisma.role.create({ data: role });
        }
      } else {
        // Sync permissions for existing default roles (in case code added new permissions)
        for (const role of defaultRoles) {
          const existing = await prisma.role.findUnique({ where: { id: role.id } });
          if (existing) {
            const existingPerms: string[] = existing.permissions as string[];
            const newPerms = role.permissions.filter((p: string) => !existingPerms.includes(p));
            if (newPerms.length > 0) {
              const merged = [...existingPerms, ...newPerms];
              await prisma.role.update({ where: { id: role.id }, data: { permissions: merged } });
              console.log(`[SYNC] Updated role ${role.id} with new permissions: ${newPerms.join(', ')}`);
            }
          }
        }
      }

      // Seed users if empty
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        console.log('Seeding default users to PostgreSQL...');
        const usersToSeed = defaultUsersFunc();
        for (const user of usersToSeed) {
          await prisma.user.create({ data: user });
        }
      }

      // Load all records from PostgreSQL into memory cache
      console.log('Loading database records from PostgreSQL into active memory cache...');
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
      const backups = await prisma.databaseBackup.findMany();
      const leads = await prisma.lead.findMany();
      const studioSettingsList = await prisma.studioSettings.findMany();

      const defaultStudioSettings: StudioSettings = {
        name: "The Will Studio",
        phone: "0901 234 567",
        email: "contact@aurabridal.com",
        address: "123 Đường Ba Tháng Hai, Quận 10, TP. Hồ Chí Minh",
        website: "https://aurabridal.vn",
        opening_hours: "08:30 - 21:30",
        notes: "Studio váy cưới cao cấp & dịch vụ chụp ảnh trọn gói chuyên nghiệp.",
        backup_schedule: "weekly",
        last_backup_time: "",
        anniversary_reminder_days: 7
      };

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
        studio_settings: (studioSettingsList[0] || defaultStudioSettings) as any,
        backups: backups as any,
        leads: leads as any
      };

      console.log('PostgreSQL Active Cache successfully initialized.');
    } catch (err) {
      console.error('Critical Error: Failed to connect or initialize PostgreSQL database:', err);
      throw err;
    }
  }

  public static get(): DatabaseSchema {
    if (!this.data) {
      throw new Error("LocalDatabase is not initialized. Call initialize() first.");
    }
    return this.data;
  }

  public static save(data: DatabaseSchema) {
    this.data = data;
    
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Queue the PostgreSQL sync to prevent concurrent database transaction/overwrite collisions
    this.writeQueue = this.writeQueue
      .then(() => this.syncToPostgres(data))
      .catch(err => {
        console.error('Error in PostgreSQL sync queue:', err);
      });
  }

  private static async syncToPostgres(data: DatabaseSchema) {
    try {
      await prisma.$transaction(async (tx) => {
        // Sync tables
        await this.reconcileTable(tx, 'role', data.roles || [], ['name', 'display_name', 'permissions']);
        await this.reconcileTable(tx, 'user', data.users || [], ['full_name', 'email', 'password_hash', 'role_id', 'is_active', 'created_at', 'session_version']);
        await this.reconcileTable(tx, 'customer', data.customers || [], ['full_name', 'phone', 'email', 'address', 'notes', 'birthday', 'wedding_date', 'facebook_url', 'created_at', 'updated_at']);
        await this.reconcileTable(tx, 'order', data.orders || [], ['order_code', 'customer_id', 'status', 'shoot_date', 'shoot_time', 'package_name', 'package_price', 'deposit_amount', 'total_amount', 'notes', 'created_by', 'created_at', 'updated_at']);
        await this.reconcileTable(tx, 'orderStatusHistory', data.order_status_history || [], ['order_id', 'from_status', 'to_status', 'changed_by', 'note', 'changed_at']);
        await this.reconcileTable(tx, 'task', data.tasks || [], ['title', 'description', 'order_id', 'assigned_to', 'assigned_by', 'status', 'priority', 'due_date', 'created_at', 'updated_at']);
        await this.reconcileTable(tx, 'taskUpdate', data.task_updates || [], ['task_id', 'updated_by', 'status_changed_to', 'comment', 'created_at']);
        await this.reconcileTable(tx, 'objective', data.objectives || [], ['title', 'description', 'status', 'created_by', 'created_at', 'updated_at', 'completed_at']);
        await this.reconcileTable(tx, 'objectiveKeyResult', data.objective_key_results || [], ['objective_id', 'title', 'assigned_department', 'assigned_to_user_id', 'status', 'progress', 'notes', 'updated_at']);
        await this.reconcileTable(tx, 'objectiveProgressUpdate', data.objective_progress_updates || [], ['key_result_id', 'updated_by', 'progress_from', 'progress_to', 'comment', 'created_at']);
        await this.reconcileTable(tx, 'notification', data.notifications || [], ['sender_id', 'receiver_id', 'title', 'content', 'type', 'related_id', 'is_read_by', 'created_at']);
        await this.reconcileTable(tx, 'chatMessage', data.chat_messages || [], ['sender_id', 'receiver_id', 'content', 'created_at']);
        await this.reconcileTable(tx, 'databaseBackup', data.backups || [], ['filename', 'created_at', 'size_bytes', 'trigger_type', 'status']);
        await this.reconcileTable(tx, 'lead', data.leads || [], ['date', 'customer_name', 'phone', 'source', 'interested_packages', 'sales_step', 'follow_up_status', 'status', 'revenue', 'success_reason', 'failure_reason', 'assigned_sale_id', 'support_needed', 'notes', 'admin_feedbacks', 'created_at', 'updated_at']);

        // Sync StudioSettings singleton
        if (data.studio_settings) {
          const dbSettings = await tx.studioSettings.findUnique({
            where: { id: 'singleton' }
          });
          
          const sData = {
            name: data.studio_settings.name,
            phone: data.studio_settings.phone,
            email: data.studio_settings.email,
            address: data.studio_settings.address,
            website: data.studio_settings.website || '',
            opening_hours: data.studio_settings.opening_hours || '',
            notes: data.studio_settings.notes || '',
            backup_schedule: data.studio_settings.backup_schedule || 'weekly',
            last_backup_time: data.studio_settings.last_backup_time || '',
            anniversary_reminder_days: data.studio_settings.anniversary_reminder_days || 7
          };
          
          if (!dbSettings) {
            await tx.studioSettings.create({
              data: { id: 'singleton', ...sData }
            });
          } else {
            let changed = false;
            for (const key of Object.keys(sData) as (keyof typeof sData)[]) {
              const val1 = dbSettings[key];
              const val2 = sData[key];
              const isEquivalent = (val1 === val2) || (val1 == null && val2 == null);
              if (!isEquivalent) {
                changed = true;
                break;
              }
            }
            if (changed) {
              await tx.studioSettings.update({
                where: { id: 'singleton' },
                data: sData
              });
            }
          }
        }
      });
      console.log('PostgreSQL database successfully synchronized.');
    } catch (err) {
      console.error('PostgreSQL background sync failed:', err);
    }
  }

  private static async reconcileTable<T extends { id: string }>(
    tx: any,
    modelName: string,
    memoryRecords: T[],
    updateFields: (keyof T)[]
  ) {
    const model = tx[modelName];
    const dbRecords = await model.findMany();
    
    // 1. Delete records in DB but not in memory
    const memoryIds = new Set(memoryRecords.map(r => r.id));
    const idsToDelete = dbRecords
      .filter((dbR: any) => !memoryIds.has(dbR.id))
      .map((dbR: any) => dbR.id);
      
    if (idsToDelete.length > 0) {
      await model.deleteMany({
        where: { id: { in: idsToDelete } }
      });
    }
    
    // 2. Create or Update
    for (const mR of memoryRecords) {
      const dbR = dbRecords.find((r: any) => r.id === mR.id);
      if (!dbR) {
        await model.create({ data: mR });
      } else {
        let changed = false;
        const updateData: any = {};
        
        for (const field of updateFields) {
          const val1 = dbR[field];
          const val2 = mR[field];
          
          if (typeof val1 === 'object' && val1 !== null) {
            if (JSON.stringify(val1) !== JSON.stringify(val2)) {
              changed = true;
              updateData[field] = val2;
            }
          } else {
            const isEquivalent = (val1 === val2) || (val1 == null && val2 == null);
            if (!isEquivalent) {
              changed = true;
              updateData[field] = val2;
            }
          }
        }
        
        if (changed) {
          await model.update({
            where: { id: mR.id },
            data: updateData
          });
        }
      }
    }
  }

  public static uuid(): string {
    return crypto.randomUUID();
  }

  public static generateOrderCode(): string {
    if (!this.data) return `ORD-${new Date().getFullYear()}-001`;
    const currentYear = new Date().getFullYear();
    const prefix = `ORD-${currentYear}-`;
    const yearOrders = (this.data.orders || []).filter(o => o.order_code.startsWith(prefix));
    
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

  // Backwards compatibility stubs for DB management
  public static getDeadLetterQueue() { return []; }
  public static getConflicts() { return []; }
  public static async retryDeadLetterItem(id: string) { return true; }
}
