const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

class MockRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet; this.row = row; this.col = col; this.numRows = numRows; this.numCols = numCols;
  }
  setValues(values) {
    values.forEach((rowValues, rowOffset) => {
      const targetRow = this.row - 1 + rowOffset;
      while (this.sheet.data.length <= targetRow) this.sheet.data.push([]);
      rowValues.forEach((value, colOffset) => { this.sheet.data[targetRow][this.col - 1 + colOffset] = value; });
    });
    return this;
  }
  setValue(value) { return this.setValues([[value]]); }
  setNumberFormat() { return this; }
  getValues() {
    const values = [];
    for (let row = this.row - 1; row < this.row - 1 + this.numRows; row++) {
      const current = [];
      for (let col = this.col - 1; col < this.col - 1 + this.numCols; col++) {
        current.push(this.sheet.data[row] && this.sheet.data[row][col] !== undefined ? this.sheet.data[row][col] : '');
      }
      values.push(current);
    }
    return values;
  }
}

class MockSheet {
  constructor(name) { this.name = name; this.data = []; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data.reduce((max, row) => Math.max(max, row.length), 0); }
  getRange(row, col, numRows = 1, numCols = 1) { return new MockRange(this, row, col, numRows, numCols); }
  getDataRange() { return new MockRange(this, 1, 1, Math.max(this.data.length, 1), Math.max(this.getLastColumn(), 1)); }
  deleteRow(row) { this.data.splice(row - 1, 1); }
}

class MockSpreadsheet {
  constructor() { this.sheets = new Map(); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const sheet = new MockSheet(name); this.sheets.set(name, sheet); return sheet; }
}

function createApi() {
  const spreadsheet = new MockSpreadsheet();
  const SpreadsheetApp = { openById: () => spreadsheet };
  const LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  const Utilities = { formatDate: (date) => date.toISOString().slice(0, 10) };
  const Session = { getScriptTimeZone: () => 'UTC' };
  const ContentService = {
    createTextOutput: (text) => ({ setMimeType() { return this; }, getContent() { return text; } }),
    MimeType: { JSON: 'json' }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');
  // Only repo-owned source is evaluated, never external input.
  const api = new Function('SpreadsheetApp', 'LockService', 'Utilities', 'Session', 'ContentService',
    source + '\nreturn { setup, saveProcurementRecord_, doGet, doPost, saveRecord_ };'
  )(SpreadsheetApp, LockService, Utilities, Session, ContentService);
  api.setup();
  return { api, spreadsheet };
}

function procurementRecord(overrides = {}) {
  return {
    id: 'PGD-00001', docNumber: 'PGD-00001', docDate: '2026-11-20', docType: 'invoice',
    customerName: 'Dinas Pendidikan', customerAddress: 'Cimahi', customerPic: 'Budi', customerPhone: '0812',
    items: [{ name: 'PC Desktop', spec: 'i5', qty: 2, unit: 'unit', price: 6000000 }],
    ppnRate: 11, subtotal: 12000000, ppn: 1320000, grandTotal: 13320000,
    paymentStatus: 'Lunas', validUntil: '', notes: '', savedAt: '2026-11-20T08:00:00.000Z',
    ...overrides
  };
}

test('saves procurement records and updates them by id', () => {
  const { api } = createApi();
  api.saveProcurementRecord_(procurementRecord());
  api.saveProcurementRecord_(procurementRecord({ customerName: 'Dinas Pendidikan Kota' }));

  const list = JSON.parse(api.doGet({ parameter: { action: 'listProcurements' } }).getContent());
  assert.equal(list.ok, true);
  assert.equal(list.records.length, 1);
  assert.equal(list.records[0].customerName, 'Dinas Pendidikan Kota');
  assert.equal(list.records[0].items.length, 1);
  assert.equal(list.records[0].items[0].name, 'PC Desktop');
  assert.equal(list.records[0].grandTotal, 13320000);
});

test('neutralizes formula-like values and stores items as JSON', () => {
  const { api, spreadsheet } = createApi();
  api.saveProcurementRecord_(procurementRecord({
    id: 'PGD-00002', docNumber: 'PGD-00002',
    customerName: '=HYPERLINK("http://example.test","klik")'
  }));

  const row = spreadsheet.getSheetByName('Procurements').data.find((item) => item[0] === 'PGD-00002');
  assert.ok(String(row[4]).startsWith("'="));
  assert.ok(String(row[8]).startsWith('['));
});

test('keeps service invoices with their itemized detail rows', () => {
  const { api, spreadsheet } = createApi();
  api.saveRecord_({
    id: '00370', invoiceNumber: '00370', invoiceDate: '2026-11-20', invoiceType: 'temporary',
    customerName: 'Tes Service', customerAddress: '', customerPhone: '', device: '', serialNumber: '',
    accessories: [], issues: [], problemDescription: '', serviceFee: '150000', paymentStatus: 'Lunas',
    notes: '', savedAt: '2026-11-20T08:00:00.000Z', serviceTypes: ['Service'],
    partsItems: [{ name: 'SSD', qty: 1, price: 500000 }],
    laborItems: [{ name: 'Jasa', qty: 1, price: 150000 }],
    partsTotal: 500000, laborTotal: 150000, grandTotal: 650000
  });

  const list = JSON.parse(api.doGet({ parameter: { action: 'list' } }).getContent());
  assert.equal(list.records.length, 1);
  assert.equal(list.records[0].partsItems.length, 1);
  assert.equal(list.records[0].laborItems[0].price, 150000);
  assert.equal(spreadsheet.getSheetByName('DetailPerbaikan').data.length, 3);
});

test('accepts saveProcurement through doPost', () => {
  const { api, spreadsheet } = createApi();
  const response = api.doPost({ postData: { contents: JSON.stringify({ action: 'saveProcurement', record: procurementRecord() }) } });
  assert.equal(JSON.parse(response.getContent()).ok, true);
  assert.equal(spreadsheet.getSheetByName('Procurements').data.length, 2);
});
