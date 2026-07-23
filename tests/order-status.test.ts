import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  ORDER_STATUS_IDS,
  canTransitionOrderStatus,
  getOrderStatusLabel,
  isActiveOrderStatus,
  normalizeOrderStatus,
} from '../src/lib/orderStatus';

describe('Order status workflow', () => {
  test('contains the approved workflow in business order', () => {
    assert.deepStrictEqual(ORDER_STATUS_IDS, [
      'new',
      'raw_sent',
      'selected',
      'demo_sent',
      'revision',
      'print_approved',
      'photos_ready',
      'completed',
      'cancelled',
    ]);
  });

  test('maps legacy statuses without changing historical records', () => {
    assert.strictEqual(normalizeOrderStatus('confirmed'), 'new');
    assert.strictEqual(normalizeOrderStatus('shooting'), 'raw_sent');
    assert.strictEqual(normalizeOrderStatus('editing'), 'revision');
    assert.strictEqual(normalizeOrderStatus('ready'), 'photos_ready');
    assert.strictEqual(normalizeOrderStatus('delivered'), 'completed');
    assert.strictEqual(getOrderStatusLabel('editing'), 'Đang chỉnh sửa lại');
  });

  test('allows forward progress and the demo revision loop for staff', () => {
    assert.strictEqual(canTransitionOrderStatus('new', 'raw_sent'), true);
    assert.strictEqual(canTransitionOrderStatus('demo_sent', 'revision'), true);
    assert.strictEqual(canTransitionOrderStatus('revision', 'demo_sent'), true);
    assert.strictEqual(canTransitionOrderStatus('photos_ready', 'selected'), false);
    assert.strictEqual(canTransitionOrderStatus('photos_ready', 'selected', true), true);
  });

  test('treats only completed and cancelled orders as inactive', () => {
    assert.strictEqual(isActiveOrderStatus('revision'), true);
    assert.strictEqual(isActiveOrderStatus('completed'), false);
    assert.strictEqual(isActiveOrderStatus('delivered'), false);
    assert.strictEqual(isActiveOrderStatus('cancelled'), false);
  });
});
