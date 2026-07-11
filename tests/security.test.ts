process.env.NODE_ENV = 'test';
process.env.PORT = '3011';
process.env.JWT_SECRET = 'test-jwt-secret-key';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let LocalDatabase: any;
let serverInstance: any;

// Seed mock database state
const mockDb = {
  roles: [
    {
      id: 'role-admin',
      name: 'admin',
      display_name: 'Quản trị viên',
      permissions: ['admin', 'users.manage', 'leads.view_all', 'leads.manage']
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
      password_hash: bcrypt.hashSync('123abc456', 10),
      role_id: 'role-admin',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      session_version: 0
    },
    {
      id: 'user-sale-1',
      full_name: 'Sale User 1',
      email: 'sale1@studio.com',
      password_hash: bcrypt.hashSync('staff123', 10),
      role_id: 'role-sales',
      is_active: true,
      created_at: '2026-06-01T00:00:00Z',
      session_version: 0
    },
    {
      id: 'user-sale-2',
      full_name: 'Sale User 2',
      email: 'sale2@studio.com',
      password_hash: bcrypt.hashSync('staff123', 10),
      role_id: 'role-sales',
      is_active: true,
      created_at: '2026-06-01T00:00:00Z',
      session_version: 0
    }
  ],
  customers: [],
  orders: [],
  order_status_history: [],
  tasks: [],
  task_updates: [],
  objectives: [],
  objective_key_results: [],
  objective_progress_updates: [],
  notifications: [],
  chat_messages: [],
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
      body: JSON.stringify({ email: 'viet@studio.com', password: '123abc456' })
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
});
