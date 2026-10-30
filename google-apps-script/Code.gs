const SPREADSHEET_ID = '1Xl91lQWYVevpT_INsps61kIgvpEw-exZDgudy4-X0mA';
const SHEET_NAME = 'Invoices';
const HEADERS = [
  'id', 'invoiceNumber', 'invoiceDate', 'invoiceType', 'customerName', 'customerAddress',
  'customerPhone', 'device', 'serialNumber', 'accessories', 'issues', 'problemDescription',
  'serviceFee', 'paymentStatus', 'notes', 'savedAt'
];

function setup() {
  getSheet_();
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'list') return json_({ ok: true, records: readRecords_() });
  return json_({ ok: false, error: 'Action tidak dikenali.' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'save' && body.record) {
      saveRecord_(body.record);
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
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  return sheet;
}

function saveRecord_(record) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getSheet_();
    const row = HEADERS.map((key) => Array.isArray(record[key]) ? record[key].join(' | ') : (record[key] ?? ''));
    const values = sheet.getDataRange().getValues();
    const idIndex = HEADERS.indexOf('id');
    const existingRow = values.findIndex((value, index) => index > 0 && String(value[idIndex]) === String(record.id));
    if (existingRow > 0) sheet.getRange(existingRow + 1, 1, 1, row.length).setValues([row]);
    else sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  } finally {
    lock.releaseLock();
  }
}

function readRecords_() {
  const values = getSheet_().getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter((row) => row[0]).map((row) => {
    const record = {};
    HEADERS.forEach((key, index) => { record[key] = row[index] instanceof Date ? Utilities.formatDate(row[index], Session.getScriptTimeZone(), 'yyyy-MM-dd') : row[index]; });
    record.accessories = record.accessories ? String(record.accessories).split(' | ') : [];
    record.issues = record.issues ? String(record.issues).split(' | ') : [];
    return record;
  });
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
