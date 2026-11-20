const SPREADSHEET_ID = '1Xl91lQWYVevpT_INsps61kIgvpEw-exZDgudy4-X0mA';
const SHEET_NAME = 'Invoices';
const DETAIL_SHEET_NAME = 'DetailPerbaikan';
const HEADERS = [
  'id', 'invoiceNumber', 'invoiceDate', 'invoiceType', 'customerName', 'customerAddress',
  'customerPhone', 'device', 'serialNumber', 'accessories', 'issues', 'problemDescription',
  'serviceFee', 'paymentStatus', 'notes', 'savedAt', 'serviceTypes',
  'partsItems', 'laborItems', 'partsTotal', 'laborTotal', 'grandTotal'
];
const DETAIL_HEADERS = [
  'invoiceId', 'invoiceNumber', 'jenis', 'namaRincian',
  'qty', 'hargaSatuan', 'subtotal', 'savedAt'
];
const PROCUREMENT_SHEET_NAME = 'Procurements';
const PROCUREMENT_HEADERS = [
  'id', 'docNumber', 'docDate', 'docType', 'customerName', 'customerAddress',
  'customerPic', 'customerPhone', 'items', 'ppnRate', 'subtotal', 'ppn',
  'grandTotal', 'paymentStatus', 'validUntil', 'notes', 'savedAt'
];

function setup() {
  getSheet_();
  getDetailSheet_();
  getProcurementSheet_();
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'list') return json_({ ok: true, records: readRecords_() });
  if (action === 'listProcurements') return json_({ ok: true, records: readProcurements_() });
  return json_({ ok: false, error: 'Action tidak dikenali.' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'save' && body.record) {
      saveRecord_(body.record);
      return json_({ ok: true });
    }
    if (body.action === 'saveProcurement' && body.record) {
      saveProcurementRecord_(body.record);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'Payload tidak valid.' });
  } catch (error) {
    return json_({ ok: false, error: String(error) });
  }
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  ensureHeaders_(sheet, HEADERS);
  return sheet;
}

function getDetailSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(DETAIL_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(DETAIL_SHEET_NAME);
  ensureHeaders_(sheet, DETAIL_HEADERS);
  return sheet;
}

function getProcurementSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(PROCUREMENT_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(PROCUREMENT_SHEET_NAME);
  ensureHeaders_(sheet, PROCUREMENT_HEADERS);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  headers.forEach((header) => {
    if (existing.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      existing.push(header);
    }
  });
}

function saveRecord_(record) {
  if (!record || record.id === undefined || record.id === null || String(record.id).trim() === '') {
    throw new Error('Nomor/ID nota wajib tersedia.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getSheet_();
    const detailSheet = getDetailSheet_();
    const row = HEADERS.map((key) => {
      const value = record[key];
      // Detail baru disimpan sebagai baris terpisah pada sheet DetailPerbaikan.
      if (key === 'partsItems' || key === 'laborItems') return '';
      if (Array.isArray(value)) return sanitizeCell_(value.join(' | '));
      return sanitizeCell_(value ?? '');
    });
    const values = sheet.getDataRange().getValues();
    const idIndex = HEADERS.indexOf('id');
    const existingRow = values.findIndex((value, index) => index > 0 && String(value[idIndex]) === String(record.id));
    if (existingRow > 0) sheet.getRange(existingRow + 1, 1, 1, row.length).setValues([row]);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);

    // Replace detail untuk nota ini agar proses simpan ulang tidak menggandakan baris.
    const detailValues = detailSheet.getDataRange().getValues();
    const invoiceIdCol = DETAIL_HEADERS.indexOf('invoiceId');
    for (let i = detailValues.length - 1; i >= 1; i--) {
      if (String(detailValues[i][invoiceIdCol]) === String(record.id)) {
        detailSheet.deleteRow(i + 1);
      }
    }

    const savedAt = record.savedAt || new Date().toISOString();
    const detailRows = [];
    (Array.isArray(record.partsItems) ? record.partsItems : []).forEach((item) => {
      detailRows.push(makeDetailRow_(record, 'Sparepart', item, savedAt));
    });
    (Array.isArray(record.laborItems) ? record.laborItems : []).forEach((item) => {
      detailRows.push(makeDetailRow_(record, 'Jasa', item, savedAt));
    });
    if (detailRows.length) {
      detailSheet.getRange(detailSheet.getLastRow() + 1, 1, detailRows.length, DETAIL_HEADERS.length).setValues(detailRows);
    }
  } finally {
    lock.releaseLock();
  }
}

function saveProcurementRecord_(record) {
  if (!record || record.id === undefined || record.id === null || String(record.id).trim() === '') {
    throw new Error('Nomor/ID pengadaan wajib tersedia.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getProcurementSheet_();
    const row = PROCUREMENT_HEADERS.map((key) => {
      const value = record[key];
      if (key === 'items') return JSON.stringify(Array.isArray(value) ? value : []);
      if (Array.isArray(value)) return sanitizeCell_(value.join(' | '));
      return sanitizeCell_(value ?? '');
    });
    const values = sheet.getDataRange().getValues();
    const idIndex = PROCUREMENT_HEADERS.indexOf('id');
    const existingRow = values.findIndex((value, index) => index > 0 && String(value[idIndex]) === String(record.id));
    if (existingRow > 0) sheet.getRange(existingRow + 1, 1, 1, row.length).setValues([row]);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  } finally {
    lock.releaseLock();
  }
}

function makeDetailRow_(record, kind, item, savedAt) {
  const qty = Math.max(0, Number(item && item.qty) || 0);
  const price = Math.max(0, Number(item && item.price) || 0);
  return [
    sanitizeCell_(record.id), sanitizeCell_(record.invoiceNumber || record.id), kind,
    sanitizeCell_(item && item.name ? String(item.name) : ''),
    qty, price, qty * price, savedAt
  ];
}

function sanitizeCell_(value) {
  // Cegah string pengguna berawalan formula agar tidak dieksekusi Google Sheets.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) return "'" + value;
  return value;
}

function readRecords_() {
  const values = getSheet_().getDataRange().getValues();
  if (values.length < 2) return [];
  const detailByInvoice = readDetailItems_();
  return values.slice(1).filter((row) => row[0]).map((row) => {
    const record = {};
    HEADERS.forEach((key, index) => {
      record[key] = row[index] instanceof Date
        ? Utilities.formatDate(row[index], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : row[index];
    });
    record.accessories = record.accessories ? String(record.accessories).split(' | ') : [];
    record.issues = record.issues ? String(record.issues).split(' | ') : [];
    record.serviceTypes = record.serviceTypes ? String(record.serviceTypes).split(' | ') : [];

    // Utamakan sheet detail. JSON lama di sheet utama tetap dibaca untuk kompatibilitas.
    const savedDetail = detailByInvoice[String(record.id)];
    record.partsItems = savedDetail
      ? savedDetail.partsItems
      : parseJsonArray_(record.partsItems);
    record.laborItems = savedDetail
      ? savedDetail.laborItems
      : parseJsonArray_(record.laborItems);

    ['partsTotal', 'laborTotal', 'grandTotal'].forEach((key) => {
      record[key] = Number(record[key]) || 0;
    });
    // Data lama yang belum memiliki total rincian tetap memakai biaya service yang tersimpan.
    if (!record.laborItems.length && Number(record.serviceFee) > 0) {
      record.laborItems = [{ name: 'Jasa service', qty: 1, price: Number(record.serviceFee) }];
      if (!record.laborTotal) record.laborTotal = Number(record.serviceFee);
    }
    if (!record.partsTotal) {
      record.partsTotal = record.partsItems.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
    }
    if (!record.laborTotal && record.laborItems.length) {
      record.laborTotal = record.laborItems.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
    }
    if (!record.grandTotal) record.grandTotal = record.partsTotal + record.laborTotal;
    return record;
  });
}

function readProcurements_() {
  const values = getProcurementSheet_().getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter((row) => row[0]).map((row) => {
    const record = {};
    PROCUREMENT_HEADERS.forEach((key, index) => {
      record[key] = row[index] instanceof Date
        ? Utilities.formatDate(row[index], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : row[index];
    });
    record.items = parseJsonArray_(record.items);
    ['ppnRate', 'subtotal', 'ppn', 'grandTotal'].forEach((key) => {
      record[key] = Number(record[key]) || 0;
    });
    return record;
  });
}

function readDetailItems_() {
  const values = getDetailSheet_().getDataRange().getValues();
  const result = {};
  if (values.length < 2) return result;
  const index = {};
  DETAIL_HEADERS.forEach((key) => { index[key] = values[0].indexOf(key); });
  values.slice(1).forEach((row) => {
    const id = String(row[index.invoiceId] || '');
    if (!id) return;
    if (!result[id]) result[id] = { partsItems: [], laborItems: [] };
    const item = {
      name: String(row[index.namaRincian] || ''),
      qty: Number(row[index.qty]) || 0,
      price: Number(row[index.hargaSatuan]) || 0
    };
    if (String(row[index.jenis]).toLowerCase() === 'sparepart') result[id].partsItems.push(item);
    else if (String(row[index.jenis]).toLowerCase() === 'jasa') result[id].laborItems.push(item);
  });
  return result;
}

function parseJsonArray_(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
