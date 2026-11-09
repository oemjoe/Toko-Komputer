const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRepairCosts } = require('../biaya-perbaikan.js');

test('returns zero totals when no items are supplied', () => {
  assert.deepEqual(calculateRepairCosts([], []), {
    partsTotal: 0,
    laborTotal: 0,
    grandTotal: 0
  });
});

test('calculates spareparts and labor separately and combines the grand total', () => {
  assert.deepEqual(calculateRepairCosts(
    [{ name: 'SSD 256GB', qty: 2, price: 350000 }],
    [{ name: 'Pasang SSD', qty: 1, price: 100000 }]
  ), {
    partsTotal: 700000,
    laborTotal: 100000,
    grandTotal: 800000
  });
});

test('supports multiple line items and quantities', () => {
  assert.deepEqual(calculateRepairCosts(
    [
      { name: 'RAM', qty: 2, price: 175000 },
      { name: 'Kabel SATA', qty: 3, price: 20000 }
    ],
    [
      { name: 'Install ulang', qty: 1, price: 80000 },
      { name: 'Pembersihan', qty: 2, price: 50000 }
    ]
  ), {
    partsTotal: 410000,
    laborTotal: 180000,
    grandTotal: 590000
  });
});

test('treats missing, invalid, and negative quantities or prices as zero', () => {
  assert.deepEqual(calculateRepairCosts(
    [
      { name: 'Invalid qty', qty: 'abc', price: 100000 },
      { name: 'Negative price', qty: 2, price: -50000 },
      { name: 'Missing qty', price: 25000 }
    ],
    [{ name: 'Negative qty', qty: -1, price: 90000 }]
  ), {
    partsTotal: 0,
    laborTotal: 0,
    grandTotal: 0
  });
});

test('accepts non-array inputs safely', () => {
  assert.deepEqual(calculateRepairCosts(null, undefined), {
    partsTotal: 0,
    laborTotal: 0,
    grandTotal: 0
  });
});
