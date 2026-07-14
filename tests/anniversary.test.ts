process.env.NODE_ENV = 'test';
process.env.PORT = '3012';
process.env.JWT_SECRET = 'test-jwt-secret-key-anniversary';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { LocalDatabase } from '../src/db_service';
import jwt from 'jsonwebtoken';

// Chuẩn bị state database giả lập.
const mockDb = {
  roles: [
    { id: 'role-admin', name: 'admin', display_name: 'Admin', permissions: ['admin', 'users.manage', 'customers.edit', 'customers.view'] }
  ],
  users: [
    { id: 'user-admin', full_name: 'Viet Hoang', email: 'viet@studio.com', password_hash: 'hash', role_id: 'role-admin', is_active: true, created_at: '2026-01-01', session_version: 0 }
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
    last_backup_time: "",
    anniversary_reminder_days: 7
  },
  backups: [],
  leads: []
};

let serverInstance: any;
let scanAndGenerateAnniversaryNotifications: typeof import('../server').scanAndGenerateAnniversaryNotifications;

before(async () => {
  LocalDatabase.initialize = async () => {
    console.log('Mocked LocalDatabase.initialize() in anniversary tests');
  };
  LocalDatabase.save(mockDb as any);

  // Import động server sau khi đã cấu hình môi trường test.
  const serverModule = await import('../server');
  scanAndGenerateAnniversaryNotifications = serverModule.scanAndGenerateAnniversaryNotifications;
  const res = await serverModule.startServer();
  serverInstance = res.server;
});

after(async () => {
  if (serverInstance) {
    try {
      await new Promise<void>((resolve, reject) => {
        serverInstance.close((err?: Error) => err ? reject(err) : resolve());
      });
    } catch (e) {
      console.log('Graceful server shutdown catch:', e);
    }
  }
  const { prisma } = await import('../src/db_service');
  await prisma.$disconnect();
});

const BASE_URL = 'http://127.0.0.1:3012';

describe('Studio V2 Customer Anniversary & Birthday Reminder Tests', () => {

  const authToken = () => jwt.sign(
    { userId: 'user-admin', email: 'viet@studio.com', sessionVersion: 0 },
    'test-jwt-secret-key-anniversary',
    { expiresIn: '1h' }
  );

  const customer = (overrides: Record<string, unknown> = {}) => ({
    id: 'cust-anniversary',
    full_name: 'Khách hàng kỷ niệm',
    phone: '0900000000',
    email: null,
    address: null,
    notes: null,
    birthday: null,
    wedding_date: null,
    facebook_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  test('1. Customer API supports saving birthday and wedding_date', async () => {
    const db = LocalDatabase.get();
    db.customers = [];
    LocalDatabase.save(db);

    const token = authToken();

    const response = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        full_name: 'Test Customer',
        phone: '0900000000',
        email: 'test@customer.com',
        address: 'Test Address',
        notes: 'Test Notes',
        birthday: '2020-07-15',
        wedding_date: '2024-07-15',
        facebook_url: 'https://facebook.com/test.customer'
      })
    });

    assert.strictEqual(response.status, 201);
    const customer = await response.json() as any;
    assert.strictEqual(customer.birthday, '2020-07-15');
    assert.strictEqual(customer.wedding_date, '2024-07-15');
    assert.strictEqual(customer.facebook_url, 'https://facebook.com/test.customer');

    // Xác nhận dữ liệu đã được lưu vào database trong bộ nhớ.
    const dbAfter = LocalDatabase.get();
    const found = dbAfter.customers.find(c => c.id === customer.id);
    assert.ok(found);
    assert.strictEqual(found.birthday, '2020-07-15');
    assert.strictEqual(found.wedding_date, '2024-07-15');
    assert.strictEqual(found.facebook_url, 'https://facebook.com/test.customer');
  });

  test('2. Customer API rejects invalid calendar dates', async () => {
    const response = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken()}`
      },
      body: JSON.stringify({
        full_name: 'Invalid Date Customer',
        phone: '0900000001',
        birthday: '2027-02-29',
      })
    });

    assert.strictEqual(response.status, 400);
    const body = await response.json() as any;
    assert.match(body.error, /không hợp lệ/);
  });

  test('3. Settings API saves only integer reminder windows from 1 to 30 days', async () => {
    const token = authToken();

    const response = await fetch(`${BASE_URL}/api/studio/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Updated Name',
        phone: '0901234567',
        email: 'updated@studio.com',
        address: 'Updated Address',
        website: 'https://updated.vn',
        opening_hours: '09:00 - 21:00',
        notes: 'Updated Notes',
        backup_schedule: 'daily',
        anniversary_reminder_days: 10
      })
    });

    assert.strictEqual(response.status, 200);
    const settings = await response.json() as any;
    assert.strictEqual(settings.anniversary_reminder_days, 10);

    const dbAfter = LocalDatabase.get();
    assert.strictEqual(dbAfter.studio_settings.anniversary_reminder_days, 10);

    const invalidResponse = await fetch(`${BASE_URL}/api/studio/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Updated Name',
        phone: '0901234567',
        email: 'updated@studio.com',
        address: 'Updated Address',
        anniversary_reminder_days: 31
      })
    });

    assert.strictEqual(invalidResponse.status, 400);
    assert.strictEqual(LocalDatabase.get().studio_settings.anniversary_reminder_days, 10);
  });

  test('4. Scheduler creates birthday and wedding reminders once inside the configured window', async () => {
    const db = LocalDatabase.get();
    db.customers = [customer({
      birthday: '2020-07-20',
      wedding_date: '2024-07-21',
      facebook_url: 'https://facebook.com/anniversary.customer',
    }) as any];
    db.notifications = [];
    db.studio_settings.anniversary_reminder_days = 7;
    LocalDatabase.save(db);

    const now = new Date('2026-07-15T05:00:00.000Z'); // 12:00 ngày 15/07 tại Việt Nam
    assert.strictEqual(await scanAndGenerateAnniversaryNotifications(now), 2);

    const generated = LocalDatabase.get().notifications;
    assert.strictEqual(generated.length, 2);
    assert.ok(generated.some(item => item.related_id === 'anniversary:birthday:cust-anniversary:6:2026'));
    assert.ok(generated.some(item => item.related_id === 'anniversary:wedding:cust-anniversary:2:2026'));
    assert.ok(generated.every(item => item.type === 'anniversary'));

    assert.strictEqual(await scanAndGenerateAnniversaryNotifications(now), 0);
    assert.strictEqual(LocalDatabase.get().notifications.length, 2);
  });

  test('5. Scheduler handles year rollover without notifying events outside the window', async () => {
    const db = LocalDatabase.get();
    db.customers = [
      customer({ id: 'cust-new-year', birthday: '2020-01-02' }) as any,
      customer({ id: 'cust-too-far', birthday: '2020-01-10' }) as any,
    ];
    db.notifications = [];
    db.studio_settings.anniversary_reminder_days = 5;
    LocalDatabase.save(db);

    const now = new Date('2026-12-28T05:00:00.000Z'); // 12:00 ngày 28/12 tại Việt Nam
    assert.strictEqual(await scanAndGenerateAnniversaryNotifications(now), 1);
    assert.strictEqual(
      LocalDatabase.get().notifications[0].related_id,
      'anniversary:birthday:cust-new-year:7:2027'
    );
    assert.match(LocalDatabase.get().notifications[0].content, /02\/01\/2027/);
  });

  test('6. Scheduler reminds 29 February birthdays on 28 February in non-leap years', async () => {
    const db = LocalDatabase.get();
    db.customers = [customer({ id: 'cust-leap-day', birthday: '2020-02-29' }) as any];
    db.notifications = [];
    db.studio_settings.anniversary_reminder_days = 3;
    LocalDatabase.save(db);

    const now = new Date('2027-02-25T05:00:00.000Z'); // 12:00 ngày 25/02 tại Việt Nam
    assert.strictEqual(await scanAndGenerateAnniversaryNotifications(now), 1);
    const reminder = LocalDatabase.get().notifications[0];
    assert.strictEqual(reminder.related_id, 'anniversary:birthday:cust-leap-day:7:2027');
    assert.match(reminder.content, /28\/02\/2027/);
  });
});
