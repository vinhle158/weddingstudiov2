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
  mimo_api_key?: string;
  mimo_api_base_url?: string;
  mimo_model?: string;
  gemini_api_key?: string;
  gemini_api_base_url?: string;
  gemini_model?: string;
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

export interface ConflictLog {
  record_id: string;
  table: string;
  json_updated_at: string | null;
  postgres_updated_at: string | null;
  resolution: 'json_wins' | 'postgres_wins' | 'manual_required';
  resolved_at: string;
}

export interface DeadLetterItem {
  id: string;
  operation: 'create' | 'update' | 'delete' | 'sync';
  table: string;
  payload: any;
  error_message: string;
  failed_at: string;
  retry_count: number;
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
const DEADLETTER_FILE = path.join(process.cwd(), 'db.deadletter.json');
const CONFLICTS_FILE = path.join(process.cwd(), 'db.conflicts.json');

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


  private static logConflict(conflict: ConflictLog) {
    let conflicts: ConflictLog[] = [];
    if (fs.existsSync(CONFLICTS_FILE)) {
      try {
        conflicts = JSON.parse(fs.readFileSync(CONFLICTS_FILE, 'utf-8'));
      } catch (e) {
        conflicts = [];
      }
    }
    conflicts = conflicts.filter(c => !(c.record_id === conflict.record_id && c.table === conflict.table));
    conflicts.push(conflict);
    try {
      const tempFile = CONFLICTS_FILE + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(conflicts, null, 2), 'utf-8');
      fs.renameSync(tempFile, CONFLICTS_FILE);
    } catch (e) {
      fs.writeFileSync(CONFLICTS_FILE, JSON.stringify(conflicts, null, 2), 'utf-8');
    }
  }

  private static logDeadLetter(operation: 'create' | 'update' | 'delete' | 'sync', table: string, payload: any, errorMessage: string) {
    let items: DeadLetterItem[] = [];
    if (fs.existsSync(DEADLETTER_FILE)) {
      try {
        items = JSON.parse(fs.readFileSync(DEADLETTER_FILE, 'utf-8'));
      } catch (e) {
        items = [];
      }
    }
    const newItem: DeadLetterItem = {
      id: 'dl-' + this.uuid(),
      operation,
      table,
      payload,
      error_message: errorMessage,
      failed_at: new Date().toISOString(),
      retry_count: 3
    };
    items.push(newItem);
    
    try {
      const tempFile = DEADLETTER_FILE + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(items, null, 2), 'utf-8');
      fs.renameSync(tempFile, DEADLETTER_FILE);
    } catch (e) {
      fs.writeFileSync(DEADLETTER_FILE, JSON.stringify(items, null, 2), 'utf-8');
    }
    
    console.error(`[CRITICAL DATABASE ERROR] Sync operation failed after all retries. Written to Dead Letter Queue: Table: ${table}, Error: ${errorMessage}`);
  }

  public static getDeadLetterQueue(): DeadLetterItem[] {
    if (fs.existsSync(DEADLETTER_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(DEADLETTER_FILE, 'utf-8'));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  public static getConflicts(): ConflictLog[] {
    if (fs.existsSync(CONFLICTS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(CONFLICTS_FILE, 'utf-8'));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  public static async retryDeadLetterItem(id: string): Promise<boolean> {
    let items = this.getDeadLetterQueue();
    const item = items.find(i => i.id === id);
    if (!item) return false;
    
    try {
      console.log(`[DLQ RETRY] Retrying sync for dead letter item ${id}...`);
      await this.syncToPostgres(item.payload);
      
      items = items.filter(i => i.id !== id);
      try {
        const tempFile = DEADLETTER_FILE + '.tmp';
        fs.writeFileSync(tempFile, JSON.stringify(items, null, 2), 'utf-8');
        fs.renameSync(tempFile, DEADLETTER_FILE);
      } catch (e) {
        fs.writeFileSync(DEADLETTER_FILE, JSON.stringify(items, null, 2), 'utf-8');
      }
      return true;
    } catch (err) {
      console.error(`[DLQ RETRY] Retry failed for dead letter item ${id}:`, err);
      return false;
    }
  }

  private static async reconcileBidirectionalTable<T extends { id: string }>(
    tx: any,
    modelName: string,
    tableName: string,
    memoryRecords: T[],
    timestampField: keyof T | null
  ): Promise<{ memoryUpdated: T[], stats: { matched: number, jsonWins: number, pgWins: number, manual: number, jsonOnly: number, pgOnly: number } }> {
    const model = tx[modelName];
    const dbRecords = await model.findMany();
    
    const updatedMemoryRecords = [...memoryRecords];
    const stats = { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 };
    
    const memoryMap = new Map<string, T>(memoryRecords.map(r => [r.id, r]));
    const dbMap = new Map<string, any>(dbRecords.map((r: any) => [r.id, r]));
    
    // 1. Process records only in JSON (JSON-only) -> Create in Postgres
    for (const [id, mR] of memoryMap.entries()) {
      if (!dbMap.has(id)) {
        console.log(`[RECONCILE] Record ${id} in table ${tableName} only in JSON. Syncing to PostgreSQL.`);
        await model.create({ data: mR });
        stats.jsonOnly++;
      }
    }
    
    // 2. Process records only in Postgres (Postgres-only) -> Pull into JSON/RAM
    for (const [id, dbR] of dbMap.entries()) {
      if (!memoryMap.has(id)) {
        console.log(`[RECONCILE] Record ${id} in table ${tableName} only in PostgreSQL. Pulling to JSON.`);
        updatedMemoryRecords.push(dbR as T);
        stats.pgOnly++;
      }
    }
    
    // 3. Process records present in both -> Compare timestamps / content
    for (const [id, mR] of memoryMap.entries()) {
      const dbR = dbMap.get(id);
      if (dbR) {
        const fieldsToCompare = Object.keys(mR).filter(k => k !== 'id');
        let differs = false;
        for (const key of fieldsToCompare) {
          const val1 = dbR[key];
          const val2 = (mR as any)[key];
          if (typeof val1 === 'object' && val1 !== null) {
            if (JSON.stringify(val1) !== JSON.stringify(val2)) {
              differs = true;
              break;
            }
          } else {
            const isEquivalent = (val1 === val2) || (val1 == null && val2 == null);
            if (!isEquivalent) {
              differs = true;
              break;
            }
          }
        }
        
        if (!differs) {
          stats.matched++;
          continue;
        }
        
        const t1 = timestampField ? dbR[timestampField] : null;
        const t2 = timestampField ? (mR as any)[timestampField] : null;
        
        if (t1 && t2) {
          const timePg = new Date(t1 as any).getTime();
          const timeJson = new Date(t2 as any).getTime();
          
          if (timeJson > timePg) {
            console.log(`[CONFLICT RESOLUTION] JSON wins for ${tableName} record ${id} (${t2} > ${t1}). Updating PostgreSQL.`);
            const updateData: any = {};
            for (const key of fieldsToCompare) {
              updateData[key] = (mR as any)[key];
            }
            await model.update({
              where: { id },
              data: updateData
            });
            stats.jsonWins++;
            this.logConflict({
              record_id: id,
              table: tableName,
              json_updated_at: String(t2),
              postgres_updated_at: String(t1),
              resolution: 'json_wins',
              resolved_at: new Date().toISOString()
            });
          } else if (timePg > timeJson) {
            console.log(`[CONFLICT RESOLUTION] PostgreSQL wins for ${tableName} record ${id} (${t1} > ${t2}). Updating local memory cache.`);
            const idx = updatedMemoryRecords.findIndex(r => r.id === id);
            if (idx !== -1) {
              updatedMemoryRecords[idx] = dbR as T;
            }
            stats.pgWins++;
            this.logConflict({
              record_id: id,
              table: tableName,
              json_updated_at: String(t2),
              postgres_updated_at: String(t1),
              resolution: 'postgres_wins',
              resolved_at: new Date().toISOString()
            });
          } else {
            console.warn(`[CONFLICT WARNING] Equal updatedAt for ${tableName} record ${id} (${t1} == ${t2}). Manual resolution required.`);
            stats.manual++;
            this.logConflict({
              record_id: id,
              table: tableName,
              json_updated_at: String(t2),
              postgres_updated_at: String(t1),
              resolution: 'manual_required',
              resolved_at: new Date().toISOString()
            });
          }
        } else {
          console.warn(`[CONFLICT WARNING] Timestamps missing or unavailable for ${tableName} record ${id}. Manual resolution required.`);
          stats.manual++;
          this.logConflict({
            record_id: id,
            table: tableName,
            json_updated_at: t2 ? String(t2) : null,
            postgres_updated_at: t1 ? String(t1) : null,
            resolution: 'manual_required',
            resolved_at: new Date().toISOString()
          });
        }
      }
    }
    
    return { memoryUpdated: updatedMemoryRecords, stats };
  }

  public static async reconcileStartup(tx: any, localDb: DatabaseSchema): Promise<DatabaseSchema> {
    const reconciledDb = { ...localDb };
    const totalStats = {
      role: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      user: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      customer: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      order: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      orderStatusHistory: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      task: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      taskUpdate: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      objective: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      objectiveKeyResult: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      objectiveProgressUpdate: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      notification: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      chatMessage: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      databaseBackup: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 },
      lead: { matched: 0, jsonWins: 0, pgWins: 0, manual: 0, jsonOnly: 0, pgOnly: 0 }
    };

    console.log('[STARTUP RECONCILIATION] Starting bidirectional content-based đối chiếu...');

    const roleRes = await this.reconcileBidirectionalTable(tx, 'role', 'roles', localDb.roles || [], null);
    reconciledDb.roles = roleRes.memoryUpdated;
    totalStats.role = roleRes.stats;

    const userRes = await this.reconcileBidirectionalTable(tx, 'user', 'users', localDb.users || [], 'created_at');
    reconciledDb.users = userRes.memoryUpdated;
    totalStats.user = userRes.stats;

    const customerRes = await this.reconcileBidirectionalTable(tx, 'customer', 'customers', localDb.customers || [], 'updated_at');
    reconciledDb.customers = customerRes.memoryUpdated;
    totalStats.customer = customerRes.stats;

    const orderRes = await this.reconcileBidirectionalTable(tx, 'order', 'orders', localDb.orders || [], 'updated_at');
    reconciledDb.orders = orderRes.memoryUpdated;
    totalStats.order = orderRes.stats;

    const histRes = await this.reconcileBidirectionalTable(tx, 'orderStatusHistory', 'order_status_history', localDb.order_status_history || [], 'changed_at');
    reconciledDb.order_status_history = histRes.memoryUpdated;
    totalStats.orderStatusHistory = histRes.stats;

    const taskRes = await this.reconcileBidirectionalTable(tx, 'task', 'tasks', localDb.tasks || [], 'updated_at');
    reconciledDb.tasks = taskRes.memoryUpdated;
    totalStats.task = taskRes.stats;

    const updateRes = await this.reconcileBidirectionalTable(tx, 'taskUpdate', 'task_updates', localDb.task_updates || [], 'created_at');
    reconciledDb.task_updates = updateRes.memoryUpdated;
    totalStats.taskUpdate = updateRes.stats;

    const objRes = await this.reconcileBidirectionalTable(tx, 'objective', 'objectives', localDb.objectives || [], 'updated_at');
    reconciledDb.objectives = objRes.memoryUpdated;
    totalStats.objective = objRes.stats;

    const krRes = await this.reconcileBidirectionalTable(tx, 'objectiveKeyResult', 'objective_key_results', localDb.objective_key_results || [], 'updated_at');
    reconciledDb.objective_key_results = krRes.memoryUpdated;
    totalStats.objectiveKeyResult = krRes.stats;

    const progRes = await this.reconcileBidirectionalTable(tx, 'objectiveProgressUpdate', 'objective_progress_updates', localDb.objective_progress_updates || [], 'created_at');
    reconciledDb.objective_progress_updates = progRes.memoryUpdated;
    totalStats.objectiveProgressUpdate = progRes.stats;

    const notifRes = await this.reconcileBidirectionalTable(tx, 'notification', 'notifications', localDb.notifications || [], 'created_at');
    reconciledDb.notifications = notifRes.memoryUpdated;
    totalStats.notification = notifRes.stats;

    const chatRes = await this.reconcileBidirectionalTable(tx, 'chatMessage', 'chat_messages', localDb.chat_messages || [], 'created_at');
    reconciledDb.chat_messages = chatRes.memoryUpdated;
    totalStats.chatMessage = chatRes.stats;

    const backupRes = await this.reconcileBidirectionalTable(tx, 'databaseBackup', 'backups', localDb.backups || [], 'created_at');
    reconciledDb.backups = backupRes.memoryUpdated;
    totalStats.databaseBackup = backupRes.stats;

    const leadRes = await this.reconcileBidirectionalTable(tx, 'lead', 'leads', localDb.leads || [], 'updated_at');
    reconciledDb.leads = leadRes.memoryUpdated;
    totalStats.lead = leadRes.stats;

    console.log('[STARTUP RECONCILIATION SUMMARY]');
    console.table(totalStats);

    return reconciledDb;
  }

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
      last_backup_time: "",
      mimo_api_key: "",
      mimo_api_base_url: "",
      mimo_model: "",
      gemini_api_key: "",
      gemini_api_base_url: "",
      gemini_model: ""
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

  private static async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static async initialize() {
    // 1. Establish memory baseline from db.json first
    const dbFileExists = fs.existsSync(DB_FILE);
    const localDb = this.get();

    // Ensure leads roles and permissions are active
    let needsSave = false;
    
    // 1. Ensure role-admin has leads permissions
    const adminRole = localDb.roles.find(r => r.id === 'role-admin');
    if (adminRole) {
      if (!adminRole.permissions.includes('leads.manage')) {
        adminRole.permissions.push('leads.manage');
        needsSave = true;
      }
      if (!adminRole.permissions.includes('leads.view_all')) {
        adminRole.permissions.push('leads.view_all');
        needsSave = true;
      }
    }

    // 2. Ensure role-manager has leads permissions
    const managerRole = localDb.roles.find(r => r.id === 'role-manager');
    if (managerRole) {
      if (!managerRole.permissions.includes('leads.manage')) {
        managerRole.permissions.push('leads.manage');
        needsSave = true;
      }
      if (!managerRole.permissions.includes('leads.view_all')) {
        managerRole.permissions.push('leads.view_all');
        needsSave = true;
      }
    }

    // 3. Ensure role-sales exists
    let salesRole = localDb.roles.find(r => r.id === 'role-sales');
    if (!salesRole) {
      salesRole = {
        id: 'role-sales',
        name: 'sales',
        display_name: 'Tư vấn & Sales',
        permissions: ['leads.manage', 'tasks.view_own']
      };
      localDb.roles.push(salesRole);
      needsSave = true;
    }

    // 4. Ensure user-sale exists
    let saleUser = localDb.users.find(u => u.id === 'user-sale' || u.email === 'sale@studio.com');
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
      localDb.users.push(saleUser);
      needsSave = true;
    }

    if (needsSave) {
      this.save(localDb);
    }

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
        console.log('PostgreSQL database is empty. Seeding/Syncing from local baseline...');
        await this.syncToPostgres(localDb);
        this.data = localDb;
      } else {
        if (!dbFileExists) {
          console.log('db.json not found. Populating from PostgreSQL...');
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
          this.save(this.data);
        } else {
          console.log('Both local db.json and PostgreSQL found. Performing Startup Recovery Sync...');
          await prisma.$transaction(async (tx) => {
            const reconciled = await this.reconcileStartup(tx, localDb);
            this.data = reconciled;
          });
          this.save(this.data);
        }

        // Migrate passwords if any are plaintext
        const wasMigrated = this.migratePasswords(this.data);
        if (wasMigrated) {
          this.save(this.data);
        }
      }
      console.log('LocalDatabase successfully initialized and loaded from PostgreSQL.');
    } catch (err) {
      console.error('Failed to initialize database from PostgreSQL. Falling back to local db.json:', err);
      this.data = localDb;
    }
  }

  public static save(data: DatabaseSchema) {
    const startTime = performance.now();
    this.data = data;
    const tempFile = DB_FILE + '.tmp';
    try {
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Failed to write backup db.json atomically:', err);
      // Fallback to non-atomic write in case of OS/permission issues
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      } catch (fallbackErr) {
        console.error('Failed to write backup db.json in fallback:', fallbackErr);
      }
    }

    const duration = performance.now() - startTime;
    if (duration > 50) {
      console.warn(`[PERFORMANCE WARNING] LocalDatabase.save execution took ${duration.toFixed(2)}ms (threshold: 50ms). JSON size may be growing too large.`);
    }

    const totalRecords = 
      (data.users?.length || 0) +
      (data.roles?.length || 0) +
      (data.customers?.length || 0) +
      (data.orders?.length || 0) +
      (data.order_status_history?.length || 0) +
      (data.tasks?.length || 0) +
      (data.task_updates?.length || 0) +
      (data.objectives?.length || 0) +
      (data.objective_key_results?.length || 0) +
      (data.objective_progress_updates?.length || 0) +
      (data.notifications?.length || 0) +
      (data.chat_messages?.length || 0) +
      (data.backups?.length || 0) +
      (data.leads?.length || 0);

    if (totalRecords > 5000) {
      console.warn(`[PERFORMANCE WARNING] Total records in LocalDatabase is ${totalRecords}, exceeding threshold of 5000. Consider migrating entirely to PostgreSQL-only mode.`);
    }
    
    // Queue the PostgreSQL sync to prevent concurrent database transaction/overwrite collisions
    this.writeQueue = this.writeQueue
      .then(() => this.syncToPostgres(data))
      .catch(err => {
        console.error('Error in PostgreSQL sync queue:', err);
      });
  }


  private static async reconcileTable<T extends { id: string }>(
    tx: any,
    modelName: string,
    memoryRecords: T[],
    updateFields: (keyof T)[]
  ) {
    const model = tx[modelName];
    const dbRecords = await model.findMany();
    
    // 1. Delete records that are in DB but not in memory anymore
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
        // Create new record
        await model.create({ data: mR });
      } else {
        // Check if any of the updateFields differ
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

  public static async syncToPostgres(data: DatabaseSchema) {
    const maxRetries = 3;
    let delay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await prisma.$transaction(async (tx) => {
          // Reconcile standard tables
          await this.reconcileTable(tx, 'role', data.roles || [], ['name', 'display_name', 'permissions']);
          await this.reconcileTable(tx, 'user', data.users || [], ['full_name', 'email', 'password_hash', 'role_id', 'is_active', 'created_at']);
          await this.reconcileTable(tx, 'customer', data.customers || [], ['full_name', 'phone', 'email', 'address', 'notes', 'created_at', 'updated_at']);
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

          // Reconcile StudioSettings singleton
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
              mimo_api_key: data.studio_settings.mimo_api_key || '',
              mimo_api_base_url: data.studio_settings.mimo_api_base_url || '',
              mimo_model: data.studio_settings.mimo_model || '',
              gemini_api_key: data.studio_settings.gemini_api_key || '',
              gemini_api_base_url: data.studio_settings.gemini_api_base_url || '',
              gemini_model: data.studio_settings.gemini_model || ''
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
        return;
      } catch (err: any) {
        console.error(`PostgreSQL sync attempt ${attempt} failed:`, err);
        if (attempt < maxRetries) {
          console.log(`Retrying sync to PostgreSQL in ${delay}ms...`);
          await this.sleep(delay);
          delay *= 2;
        } else {
          console.error('Critical: PostgreSQL sync failed after all retry attempts. Database is out-of-sync!');
          this.logDeadLetter('sync', 'all', data, err.message || String(err));
        }
      }
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
