process.env.NODE_ENV = 'test';
process.env.PORT = '3012';
process.env.JWT_SECRET = 'test-jwt-secret-key-anniversary';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { LocalDatabase } from '../src/db_service';
import jwt from 'jsonwebtoken';

// Setup mock database state
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

before(async () => {
  LocalDatabase.initialize = async () => {
    console.log('Mocked LocalDatabase.initialize() in anniversary tests');
  };
  LocalDatabase.save(mockDb as any);

  // Dynamically import server to start it
  const serverModule = await import('../server');
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

  test('1. Customer API supports saving birthday and wedding_date', async () => {
    const db = LocalDatabase.get();
    db.customers = [];
    LocalDatabase.save(db);

    const token = jwt.sign(
      { userId: 'user-admin', email: 'viet@studio.com', sessionVersion: 0 },
      'test-jwt-secret-key-anniversary',
      { expiresIn: '1h' }
    );

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

    // Verify it is saved in memory database
    const dbAfter = LocalDatabase.get();
    const found = dbAfter.customers.find(c => c.id === customer.id);
    assert.ok(found);
    assert.strictEqual(found.birthday, '2020-07-15');
    assert.strictEqual(found.wedding_date, '2024-07-15');
    assert.strictEqual(found.facebook_url, 'https://facebook.com/test.customer');
  });

  test('2. Settings API supports saving anniversary_reminder_days', async () => {
    const token = jwt.sign(
      { userId: 'user-admin', email: 'viet@studio.com', sessionVersion: 0 },
      'test-jwt-secret-key-anniversary',
      { expiresIn: '1h' }
    );

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
  });
});
