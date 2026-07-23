process.env.NODE_ENV = 'test';
process.env.PORT = '3011';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.TRUST_PROXY = 'loopback, linklocal, uniquelocal';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { io as createSocketClient } from 'socket.io-client';
import fs from 'node:fs';
import path from 'node:path';

let LocalDatabase: any;
let serverInstance: any;
let appInstance: any;

// Seed mock database state
const mockDb = {
  roles: [
    {
      id: 'role-admin',
      name: 'admin',
      display_name: 'Quản trị viên',
      permissions: ['admin', 'users.manage', 'leads.view_all', 'leads.manage', 'orders.view', 'orders.create', 'orders.edit']
    },
    {
      id: 'role-sales',
      name: 'sales',
      display_name: 'Sales',
      permissions: ['leads.manage']
    },
    {
      id: 'role-staff',
      name: 'staff',
      display_name: 'Staff',
      permissions: []
    }
  ],
  users: [
    {
      id: 'user-admin',
      full_name: 'Viet Hoang',
      email: 'viet@studio.com',
      password_hash: bcrypt.hashSync('AdminTest@2026!', 10),
      role_id: 'role-admin',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      session_version: 0
    },
    {
      id: 'user-sale-1',
      full_name: 'Sale User 1',
      email: 'sale1@studio.com',
      password_hash: bcrypt.hashSync('SalesTest@2026!', 10),
      role_id: 'role-sales',
      is_active: true,
      created_at: '2026-06-01T00:00:00Z',
      session_version: 0
    },
    {
      id: 'user-sale-2',
      full_name: 'Sale User 2',
      email: 'sale2@studio.com',
      password_hash: bcrypt.hashSync('SalesTest@2026!', 10),
      role_id: 'role-sales',
      is_active: true,
      created_at: '2026-06-01T00:00:00Z',
      session_version: 0
    }
  ],
  customers: [],
  orders: [],
  service_packages: [],
  order_payments: [],
  order_status_history: [],
  tasks: [],
  task_updates: [],
  objectives: [],
  objective_key_results: [],
  objective_progress_updates: [],
  notifications: [],
  chat_messages: [],
  chat_read_states: [],
  studio_settings: {
    name: "The Will Studio",
    phone: "0901 234 567",
    email: "contact@aurabridal.com",
    address: "123 Đường Ba Tháng Hai, Quận 10",
    website: "https://aurabridal.vn",
    opening_hours: "08:30 - 21:30",
    notes: "Notes",
    backup_schedule: "weekly" as const,
    last_backup_time: ""
  },
  backups: [],
  leads: [
    {
      id: 'lead-1',
      date: '2026-07-10',
      customer_name: 'Customer A',
      phone: '0901234567',
      source: 'Facebook',
      interested_packages: { beauty: true, family: false, wedding: false, combo: false, couple: false },
      sales_step: 1,
      follow_up_status: { follow_1: false, follow_2: false, follow_3: false },
      status: 'consulting',
      revenue: null,
      success_reason: null,
      failure_reason: null,
      assigned_sale_id: 'user-sale-1',
      support_needed: null,
      notes: null,
      admin_feedbacks: [],
      created_at: '2026-07-10T00:00:00Z',
      updated_at: '2026-07-10T00:00:00Z'
    }
  ]
};

before(async () => {
  // Dynamically import db_service to make sure process.env.NODE_ENV is set first
  const dbModule = await import('../src/db_service');
  LocalDatabase = dbModule.LocalDatabase;

  // Mock LocalDatabase.initialize to avoid connecting to PostgreSQL
  LocalDatabase.initialize = async () => {
    console.log('Mocked LocalDatabase.initialize() called');
  };

  LocalDatabase.save(mockDb as any);

  // Dynamically import server to start it
  const { startServer } = await import('../server');
  const res = await startServer();
  appInstance = res.app;
  serverInstance = res.server;
});

after(async () => {
  if (serverInstance) {
    await new Promise<void>((resolve, reject) => {
      serverInstance.close((err?: Error) => err ? reject(err) : resolve());
    });
  }
  const { prisma } = await import('../src/db_service');
  await prisma.$disconnect();
});

const BASE_URL = 'http://127.0.0.1:3011';

// Helper to generate JWT token for testing
function generateToken(userId: string, email: string, sessionVersion = 0) {
  return jwt.sign(
    { userId, email, sessionVersion },
    'test-jwt-secret-key',
    { expiresIn: '1h' }
  );
}

describe('Studio V2 Security Hardening Regression Tests', () => {

  test('0. trust proxy accepts private proxies but rejects public proxy hops', () => {
    const trustProxy = appInstance.get('trust proxy fn');

    assert.strictEqual(trustProxy('127.0.0.1', 0), true);
    assert.strictEqual(trustProxy('172.18.0.1', 0), true);
    assert.strictEqual(trustProxy('8.8.8.8', 0), false);
  });

  test('1. authenticate middleware fails if session version is mismatched', async () => {
    const token = generateToken('user-sale-1', 'sale1@studio.com', 0);
    
    const db = LocalDatabase.get();
    const saleUser = db.users.find((u: any) => u.id === 'user-sale-1')!;
    saleUser.session_version = 1;
    LocalDatabase.save(db);

    const res = await fetch(`${BASE_URL}/api/leads`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json() as any;
    assert.match(data.error, /Session has expired/);

    saleUser.session_version = 0;
    LocalDatabase.save(db);
  });

  test('2. GET /api/users requires users.manage permission', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const salesToken = generateToken('user-sale-1', 'sale1@studio.com', 0);

    const salesRes = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        Authorization: `Bearer ${salesToken}`
      }
    });
    assert.strictEqual(salesRes.status, 403);

    const adminRes = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(adminRes.status, 200);
    const users = await adminRes.json() as any[];
    
    for (const u of users) {
      assert.strictEqual(u.password_hash, undefined);
    }
  });

  test('3. Login and user endpoints sanitize user output', async () => {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viet@studio.com', password: 'AdminTest@2026!' })
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json() as any;
    assert.strictEqual(loginData.user.password_hash, undefined);

    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json() as any;
    assert.strictEqual(meData.user.password_hash, undefined);
  });

  test('4. GET /api/studio/settings does not return mimo_api_key or gemini_api_key', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const res = await fetch(`${BASE_URL}/api/studio/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const settings = await res.json() as any;
    
    assert.strictEqual(settings.mimo_api_key, undefined);
    assert.strictEqual(settings.gemini_api_key, undefined);
    assert.strictEqual(settings.mimo_api_key_configured, undefined);
    assert.strictEqual(settings.gemini_api_key_configured, undefined);
  });

  test('5. GET /api/database/export sanitizes API keys and password_hash', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const res = await fetch(`${BASE_URL}/api/database/export`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const dbExport = await res.json() as any;
    
    for (const u of dbExport.users) {
      assert.strictEqual(u.password_hash, undefined);
    }
    assert.strictEqual(dbExport.studio_settings.mimo_api_key, undefined);
    assert.strictEqual(dbExport.studio_settings.gemini_api_key, undefined);
  });

  test('6. POST /api/database/import rejects plain text passwords and strips legacy LLM keys', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    
    const badImportDb = {
      roles: mockDb.roles,
      users: [
        {
          id: 'user-bad',
          full_name: 'Bad User',
          email: 'bad@studio.com',
          password_hash: 'plaintext123',
          role_id: 'role-sales',
          is_active: true
        }
      ]
    };

    const res = await fetch(`${BASE_URL}/api/database/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(badImportDb)
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json() as any;
    assert.match(data.error, /không hợp lệ/);

    const legacyImportDb = {
      roles: mockDb.roles,
      users: [
        {
          id: 'user-imported-1',
          full_name: 'Imported User',
          email: 'imported@studio.com',
          password_hash: bcrypt.hashSync('hashedPassword123', 10),
          role_id: 'role-sales',
          is_active: true
        }
      ],
      studio_settings: {
        name: "Imported Studio",
        phone: "0123456789",
        email: "imported@studio.com",
        address: "Imported Address",
        website: "https://imported.vn",
        opening_hours: "09:00 - 21:00",
        notes: "Imported Notes",
        backup_schedule: "weekly",
        last_backup_time: "",
        mimo_api_key: "legacy-imported-mimo-key",
        gemini_api_key: "legacy-imported-gemini-key"
      }
    };

    const importRes = await fetch(`${BASE_URL}/api/database/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(legacyImportDb)
    });

    assert.strictEqual(importRes.status, 200);
    
    const currentDb = LocalDatabase.get();
    assert.strictEqual((currentDb.studio_settings as any).mimo_api_key, undefined);
    assert.strictEqual((currentDb.studio_settings as any).gemini_api_key, undefined);

    LocalDatabase.save(mockDb as any);
  });

  test('7. sales user cannot edit leads assigned to others', async () => {
    const sale2Token = generateToken('user-sale-2', 'sale2@studio.com', 0);

    const res = await fetch(`${BASE_URL}/api/leads/lead-1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sale2Token}`
      },
      body: JSON.stringify({ notes: 'Updated notes by sale 2' })
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json() as any;
    assert.match(data.error, /Bạn không có quyền chỉnh sửa/);
  });

  test('8. winning a lead returns customer/order prefill without auto-creating customer or order', async () => {
    const sale1Token = generateToken('user-sale-1', 'sale1@studio.com', 0);
    const db = LocalDatabase.get();
    db.customers = [];
    db.orders = [];
    db.order_status_history = [];
    db.notifications = [];
    db.leads = [
      {
        id: 'lead-1',
        date: '2026-07-10',
        customer_name: 'Customer A',
        phone: '0901234567',
        source: 'Facebook',
        interested_packages: { beauty: true, family: false, wedding: false, combo: false, couple: false },
        sales_step: 4,
        follow_up_status: { follow_1: true, follow_2: false, follow_3: false },
        status: 'consulting',
        revenue: null,
        success_reason: null,
        failure_reason: null,
        assigned_sale_id: 'user-sale-1',
        support_needed: null,
        notes: 'Khách thích concept beauty',
        admin_feedbacks: [],
        created_at: '2026-07-10T00:00:00Z',
        updated_at: '2026-07-10T00:00:00Z'
      }
    ];
    LocalDatabase.save(db);

    const res = await fetch(`${BASE_URL}/api/leads/lead-1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sale1Token}`
      },
      body: JSON.stringify({
        status: 'won',
        revenue: 12000,
        success_reason: 'Khách đồng ý chốt gói beauty'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.strictEqual(data.new_customer_id, undefined);
    assert.strictEqual(data.customer_prefill.full_name, 'Customer A');
    assert.strictEqual(data.customer_prefill.phone, '0901234567');
    assert.strictEqual(data.new_order_id, undefined);
    assert.strictEqual(data.order_prefill.package_name, 'Gói chân dung nghệ thuật Beauty');
    assert.strictEqual(data.order_prefill.package_price, 12000);

    const afterDb = LocalDatabase.get();
    assert.strictEqual(afterDb.customers.length, 0);
    assert.strictEqual(afterDb.orders.length, 0);
    assert.strictEqual(afterDb.order_status_history.length, 0);

    LocalDatabase.save(mockDb as any);
  });

  test('orders can be created without a shoot date and scheduled later', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const db = LocalDatabase.get();
    db.customers = [{
      id: 'customer-unscheduled',
      full_name: 'Khách chưa chốt lịch',
      phone: '0909999999',
      email: null,
      address: null,
      notes: null,
      birthday: null,
      wedding_date: null,
      facebook_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];
    db.orders = [];
    db.order_status_history = [];
    LocalDatabase.save(db);

    const createRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        customer_id: 'customer-unscheduled',
        shoot_date: '',
        shoot_time: null,
        package_name: 'Gói cưới chưa chốt lịch',
        package_price: 12000,
        deposit_amount: 3000,
        total_amount: 12000
      })
    });

    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json() as any;
    assert.strictEqual(created.shoot_date, '');
    assert.strictEqual(created.shoot_time, null);

    const unscheduledRes = await fetch(`${BASE_URL}/api/orders?status=unscheduled`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(unscheduledRes.status, 200);
    const unscheduledOrders = await unscheduledRes.json() as any[];
    assert.ok(unscheduledOrders.some(order => order.id === created.id));

    const updateRes = await fetch(`${BASE_URL}/api/orders/${created.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ shoot_date: '2026-08-20', shoot_time: '09:00' })
    });

    assert.strictEqual(updateRes.status, 200);
    const updated = await updateRes.json() as any;
    assert.strictEqual(updated.shoot_date, '2026-08-20');
    assert.strictEqual(updated.shoot_time, '09:00');

    const afterSchedulingRes = await fetch(`${BASE_URL}/api/orders?status=unscheduled`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(afterSchedulingRes.status, 200);
    const afterSchedulingOrders = await afterSchedulingRes.json() as any[];
    assert.ok(afterSchedulingOrders.every(order => order.id !== created.id));

    LocalDatabase.save(mockDb as any);
  });

  test('order signer is treated as the first related staff member', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const salesToken = generateToken('user-sale-1', 'sale1@studio.com', 0);
    const db = LocalDatabase.get();
    db.customers = [{
      id: 'customer-related-staff',
      full_name: 'Khách kiểm tra người liên quan',
      phone: '0908888888',
      email: null,
      address: null,
      notes: null,
      birthday: null,
      wedding_date: null,
      facebook_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];
    db.orders = [];
    db.tasks = [];
    db.order_status_history = [];
    LocalDatabase.save(db);

    const directoryRes = await fetch(`${BASE_URL}/api/users/directory`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert.strictEqual(directoryRes.status, 200);
    const directory = await directoryRes.json() as any[];
    assert.ok(directory.some(user => user.id === 'user-sale-1'));
    assert.ok(directory.every(user => user.password_hash === undefined && user.email === undefined));

    const createRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        customer_id: 'customer-related-staff',
        shoot_date: '',
        package_name: 'Gói kiểm tra truy dấu'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json() as any;
    assert.strictEqual(created.created_by, 'user-admin');

    const signerFilterRes = await fetch(`${BASE_URL}/api/orders?assigned_staff=user-admin`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(signerFilterRes.status, 200);
    const signerOrders = await signerFilterRes.json() as any[];
    assert.ok(signerOrders.some(order => order.id === created.id));

    const unrelatedFilterRes = await fetch(`${BASE_URL}/api/orders?assigned_staff=user-sale-1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(unrelatedFilterRes.status, 200);
    const unrelatedOrders = await unrelatedFilterRes.json() as any[];
    assert.ok(unrelatedOrders.every(order => order.id !== created.id));

    db.tasks.push({
      id: 'task-related-staff',
      title: 'Công việc đã giao',
      description: null,
      order_id: created.id,
      assigned_to: 'user-sale-1',
      assigned_by: 'user-admin',
      status: 'pending',
      priority: 'normal',
      due_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    LocalDatabase.save(db);

    const assigneeFilterRes = await fetch(`${BASE_URL}/api/orders?assigned_staff=user-sale-1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(assigneeFilterRes.status, 200);
    const assigneeOrders = await assigneeFilterRes.json() as any[];
    assert.ok(assigneeOrders.some(order => order.id === created.id));

    const detailRes = await fetch(`${BASE_URL}/api/orders/${created.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(detailRes.status, 200);
    const detail = await detailRes.json() as any;
    assert.strictEqual(detail.created_by_name, 'Viet Hoang');

    LocalDatabase.save(mockDb as any);
  });

  test('staff can use the new workflow and repeat the demo revision loop', async () => {
    const db = LocalDatabase.get();
    const originalRoles = db.roles;
    const originalUsers = db.users;
    const originalOrders = db.orders;
    const originalHistory = db.order_status_history;

    db.roles = [...originalRoles, {
      id: 'role-order-editor',
      name: 'order_editor',
      display_name: 'Nhân sự xử lý ảnh',
      permissions: ['orders.view', 'orders.edit']
    }];
    db.users = [...originalUsers, {
      id: 'user-order-editor',
      full_name: 'Nhân sự xử lý ảnh',
      email: 'editor@studio.com',
      password_hash: bcrypt.hashSync('EditorTest@2026!', 10),
      role_id: 'role-order-editor',
      is_active: true,
      created_at: new Date().toISOString(),
      session_version: 0
    }];
    db.orders = [{
      id: 'order-status-workflow',
      order_code: 'ORD-STATUS',
      customer_id: 'customer-related-staff',
      status: 'demo_sent',
      shoot_date: '2026-08-20',
      shoot_time: '09:00',
      package_name: 'Gói kiểm tra trạng thái',
      package_price: 12000,
      deposit_amount: 3000,
      total_amount: 12000,
      notes: null,
      created_by: 'user-admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }];
    db.order_status_history = [];
    LocalDatabase.save(db);

    const editorToken = generateToken('user-order-editor', 'editor@studio.com', 0);
    const updateStatus = (status: string) => fetch(`${BASE_URL}/api/orders/order-status-workflow/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${editorToken}`
      },
      body: JSON.stringify({ status })
    });

    const revisionRes = await updateStatus('revision');
    assert.strictEqual(revisionRes.status, 200);
    const demoAgainRes = await updateStatus('demo_sent');
    assert.strictEqual(demoAgainRes.status, 200);

    db.orders[0].status = 'photos_ready';
    LocalDatabase.save(db);
    const backwardRes = await updateStatus('selected');
    assert.strictEqual(backwardRes.status, 400);

    assert.deepStrictEqual(
      db.order_status_history.slice(0, 2).map((item: any) => item.to_status),
      ['revision', 'demo_sent']
    );

    db.roles = originalRoles;
    db.users = originalUsers;
    db.orders = originalOrders;
    db.order_status_history = originalHistory;
    LocalDatabase.save(db);
  });

  test('9. /api/demo/cleanup is blocked in production or without users.manage permission', async () => {
    const salesToken = generateToken('user-sale-1', 'sale1@studio.com', 0);

    const res = await fetch(`${BASE_URL}/api/demo/cleanup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${salesToken}`
      }
    });

    assert.strictEqual(res.status, 403);
  });

  test('10. GET /api/system/status requires users.manage permission', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const salesToken = generateToken('user-sale-1', 'sale1@studio.com', 0);

    const salesRes = await fetch(`${BASE_URL}/api/system/status`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert.strictEqual(salesRes.status, 403);

    const adminRes = await fetch(`${BASE_URL}/api/system/status`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminRes.status, 200);
    const statusData = await adminRes.json() as any;
    assert.strictEqual(statusData.backend, 'online');
    assert.ok(statusData.database);
  });

  test('11. Backup restore and delete reject path traversal and invalid filenames', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    
    // Inject a malicious backup entry
    const db = LocalDatabase.get();
    db.backups = [
      {
        id: 'malicious-backup-1',
        filename: '../package.json',
        created_at: '2026-07-10T00:00:00Z',
        size_bytes: 100,
        trigger_type: 'manual',
        status: 'success'
      },
      {
        id: 'malicious-backup-2',
        filename: 'subfolder/escape.json',
        created_at: '2026-07-10T00:00:00Z',
        size_bytes: 100,
        trigger_type: 'manual',
        status: 'success'
      }
    ];
    LocalDatabase.save(db);

    // Try to restore traversal filename
    const restoreRes1 = await fetch(`${BASE_URL}/api/database/backups/restore/malicious-backup-1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(restoreRes1.status, 500); // throws error inside try block which is caught and returns 500
    const restoreData1 = await restoreRes1.json() as any;
    assert.match(restoreData1.error, /Tên file backup không hợp lệ|Lỗi khôi phục/);

    // Try to delete traversal filename
    const deleteRes1 = await fetch(`${BASE_URL}/api/database/backups/malicious-backup-1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(deleteRes1.status, 400);
    const deleteData1 = await deleteRes1.json() as any;
    assert.match(deleteData1.error, /Tên file backup không hợp lệ/);

    // Try to delete path with invalid subfolder characters
    const deleteRes2 = await fetch(`${BASE_URL}/api/database/backups/malicious-backup-2`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(deleteRes2.status, 400);
    const deleteData2 = await deleteRes2.json() as any;
    assert.match(deleteData2.error, /Tên file backup không hợp lệ/);

    // Clean up
    const cleanDb = LocalDatabase.get();
    cleanDb.backups = [];
    LocalDatabase.save(cleanDb);
  });

  test('12. GET /healthz is publicly accessible and returns OK', async () => {
    const res = await fetch(`${BASE_URL}/healthz`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as any;
    assert.strictEqual(data.status, 'OK');
  });

  test('13. Chat contacts expose safe fields and enforce private-message policy', async () => {
    const salesToken = generateToken('user-sale-1', 'sale1@studio.com', 0);
    const contactsRes = await fetch(`${BASE_URL}/api/chat/contacts`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert.strictEqual(contactsRes.status, 200);
    const contacts = await contactsRes.json() as any[];
    assert.deepStrictEqual(contacts.map(contact => contact.id), ['user-admin']);
    assert.strictEqual(contacts[0].password_hash, undefined);
    assert.strictEqual(contacts[0].email, undefined);

    const forbiddenRes = await fetch(`${BASE_URL}/api/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({ receiver_id: 'user-sale-2', content: 'Không được phép' })
    });
    assert.strictEqual(forbiddenRes.status, 403);
  });

  test('14. Chat unread state persists per conversation and clears when read', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const salesToken = generateToken('user-sale-1', 'sale1@studio.com', 0);
    const db = LocalDatabase.get();
    db.chat_messages = [];
    db.chat_read_states = [];
    LocalDatabase.save(db);

    const sendRes = await fetch(`${BASE_URL}/api/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ receiver_id: 'user-sale-1', content: 'Tin nhắn cần đọc' })
    });
    assert.strictEqual(sendRes.status, 201);

    const unreadRes = await fetch(`${BASE_URL}/api/chat/unread`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    const unread = await unreadRes.json() as any;
    assert.strictEqual(unread.direct['user-admin'], 1);
    assert.strictEqual(unread.total, 1);

    const readRes = await fetch(`${BASE_URL}/api/chat/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({ receiver_id: 'user-admin' })
    });
    assert.strictEqual(readRes.status, 200);

    const afterReadRes = await fetch(`${BASE_URL}/api/chat/unread`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    const afterRead = await afterReadRes.json() as any;
    assert.strictEqual(afterRead.direct['user-admin'] || 0, 0);
    assert.strictEqual(afterRead.total, 0);
  });

  test('15. Chat pushes new messages to authenticated users in realtime', async () => {
    const salesToken = generateToken('user-sale-1', 'sale1@studio.com', 0);
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const socket = createSocketClient(BASE_URL, {
      path: '/socket.io',
      auth: { token: salesToken },
      transports: ['websocket'],
      forceNew: true,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 2000);
        socket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.once('connect_error', reject);
      });

      const receivedMessage = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Realtime message timeout')), 2000);
        socket.once('chat:message', message => {
          clearTimeout(timeout);
          resolve(message);
        });
      });

      const sendRes = await fetch(`${BASE_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ receiver_id: null, content: 'Realtime test message' })
      });
      assert.strictEqual(sendRes.status, 201);
      const message = await receivedMessage;
      assert.strictEqual(message.content, 'Realtime test message');
      assert.strictEqual(message.sender_id, 'user-admin');
    } finally {
      socket.disconnect();
    }
  });

  test('16. Chat supports protected image attachments, mentions and task references', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const salesToken = generateToken('user-sale-1', 'sale1@studio.com', 0);
    const db = LocalDatabase.get();
    db.tasks = [{
      id: 'task-chat-ref', title: 'Duyệt album khách hàng', description: null, order_id: null,
      assigned_to: 'user-sale-1', assigned_by: 'user-admin', status: 'pending', priority: 'high',
      due_date: null, created_at: '2026-07-12T00:00:00Z', updated_at: '2026-07-12T00:00:00Z'
    }];
    LocalDatabase.save(db);

    const searchRes = await fetch(`${BASE_URL}/api/chat/references?q=duy%E1%BB%87t`, {
      headers: { Authorization: `Bearer ${salesToken}` }
    });
    assert.strictEqual(searchRes.status, 200);
    const references = await searchRes.json() as any[];
    assert.strictEqual(references[0].id, 'task-chat-ref');

    const uploadRes = await fetch(`${BASE_URL}/api/chat/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'anh-test.png',
        data_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      })
    });
    assert.strictEqual(uploadRes.status, 201);
    const attachment = await uploadRes.json() as any;

    try {
      const sendRes = await fetch(`${BASE_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          receiver_id: null,
          content: '@Sale User 1 xem giúp công việc này',
          attachment_filename: attachment.filename,
          attachment_name: attachment.name,
          attachment_mime: attachment.mime,
          reference_type: 'task',
          reference_id: 'task-chat-ref',
          mentioned_user_ids: ['user-sale-1', 'not-a-user']
        })
      });
      assert.strictEqual(sendRes.status, 201);
      const message = await sendRes.json() as any;
      assert.strictEqual(message.reference_id, 'task-chat-ref');
      assert.deepStrictEqual(message.mentioned_user_ids, ['user-sale-1']);
      assert.strictEqual(message.attachment_filename, attachment.filename);

      const imageRes = await fetch(`${BASE_URL}/api/chat/attachments/${attachment.filename}`, {
        headers: { Authorization: `Bearer ${salesToken}` }
      });
      assert.strictEqual(imageRes.status, 200);
      assert.strictEqual(imageRes.headers.get('content-type'), 'image/png');
    } finally {
      const imagePath = path.join(process.cwd(), 'chat_uploads', attachment.filename);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }
  });

  test('17. Admin manages service packages without rewriting contract snapshots', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const createRes = await fetch(`${BASE_URL}/api/service-packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Gói Studio Test', default_price: 1200, description: 'Test', sort_order: 1 })
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json() as any;
    assert.strictEqual(created.default_price, 1200);

    const updateRes = await fetch(`${BASE_URL}/api/service-packages/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ default_price: 1500, is_active: false })
    });
    assert.strictEqual(updateRes.status, 200);
    const updated = await updateRes.json() as any;
    assert.strictEqual(updated.default_price, 1500);
    assert.strictEqual(updated.is_active, false);
  });

  test('18. Payment ledger requires dates, prevents overpayment and preserves void history', async () => {
    const adminToken = generateToken('user-admin', 'viet@studio.com', 0);
    const db = LocalDatabase.get();
    db.customers.push({
      id: 'customer-payment-test', full_name: 'Khách Thanh Toán', phone: '0909000000',
      email: null, address: null, notes: null, birthday: null, wedding_date: null,
      facebook_url: null, created_at: '2026-07-23T00:00:00Z', updated_at: '2026-07-23T00:00:00Z'
    });
    LocalDatabase.save(db);

    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        customer_id: 'customer-payment-test',
        package_name: 'Gói thanh toán test',
        package_price: 1000,
        total_amount: 1000,
        payments: [{ installment_no: 1, amount: 300, payment_date: '2026-07-23' }]
      })
    });
    assert.strictEqual(orderRes.status, 201);
    const order = await orderRes.json() as any;
    assert.strictEqual(order.deposit_amount, 300);

    const missingDateRes = await fetch(`${BASE_URL}/api/orders/${order.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ installment_no: 2, amount: 100 })
    });
    assert.strictEqual(missingDateRes.status, 400);

    const overpaymentRes = await fetch(`${BASE_URL}/api/orders/${order.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ installment_no: 2, amount: 701, payment_date: '2026-07-23' })
    });
    assert.strictEqual(overpaymentRes.status, 400);

    const detailRes = await fetch(`${BASE_URL}/api/orders/${order.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const detail = await detailRes.json() as any;
    assert.strictEqual(detail.payment_summary.paid_total, 300);
    assert.strictEqual(detail.payment_summary.remaining_amount, 700);

    const payment = detail.payments.find((item: any) => !item.voided_at);
    const voidRes = await fetch(`${BASE_URL}/api/orders/${order.id}/payments/${payment.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Nhập nhầm khoản thu' })
    });
    assert.strictEqual(voidRes.status, 200);

    const afterVoid = LocalDatabase.get();
    assert.strictEqual(afterVoid.orders.find((item: any) => item.id === order.id).deposit_amount, 0);
    assert.ok(afterVoid.order_payments.find((item: any) => item.id === payment.id).voided_at);
  });

  test('19. Software update notifications target active admins and are not duplicated', async () => {
    const { buildSoftwareUpdateNotifications } = await import('../server');
    const now = new Date('2026-07-23T12:00:00.000Z');
    const releases = [{
      id: '999',
      date: '2026-07-23',
      summary: 'Bản cập nhật kiểm thử',
      changes: ['Nội dung kiểm thử'],
      status: 'verified' as const
    }];
    const users = [
      { ...mockDb.users[0], id: 'active-admin', role_id: 'role-admin', is_active: true },
      { ...mockDb.users[0], id: 'inactive-admin', role_id: 'role-admin', is_active: false },
      { ...mockDb.users[1], id: 'active-sale', role_id: 'role-sales', is_active: true }
    ];

    const firstBatch = buildSoftwareUpdateNotifications(releases, users as any, [], now);
    assert.strictEqual(firstBatch.length, 1);
    assert.strictEqual(firstBatch[0].receiver_id, 'active-admin');
    assert.strictEqual(firstBatch[0].related_id, 'software_update:999');

    const duplicateBatch = buildSoftwareUpdateNotifications(releases, users as any, firstBatch, now);
    assert.strictEqual(duplicateBatch.length, 0);
  });
});
