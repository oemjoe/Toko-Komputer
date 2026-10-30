const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'toko-service-invoice-draft';
const DB_NAME = 'cimahi-service-komputer-db';
const DB_VERSION = 1;
const STORE_NAME = 'invoices';
const SHEETS_URL_KEY = 'cimahi-service-google-sheets-url';
const DEFAULT_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyiUy0L7jY59nUwbNVTTv5qRf7s8u-IlNSjnRvkfyaVhIX56Rx_aOulwP0XmfhZAGKe/exec';
const numberFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function today() { return new Date().toISOString().slice(0, 10); }
function nextNumber() { return String(Number(localStorage.getItem('toko-service-last-number') || '367') + 1).padStart(5, '0'); }
function checkedValues(containerId) { return [...document.querySelectorAll(`#${containerId} input:checked`)].map((input) => input.value); }
function setText(id, value, fallback = '-') { $(id).textContent = value || fallback; }
function formatDate(value) { if (!value) return '-'; return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }); }
function sheetsUrl() { return ($('sheetsUrl').value || localStorage.getItem(SHEETS_URL_KEY) || DEFAULT_SHEETS_URL).trim(); }

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('Browser ini tidak mendukung database lokal.')); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Database tidak dapat dibuka.'));
  });
}

function collectData() {
  return {
    id: $('invoiceNumber').value,
    invoiceNumber: $('invoiceNumber').value,
    invoiceDate: $('invoiceDate').value,
    invoiceType: $('invoiceType').value,
    serviceTypes: checkedValues('serviceTypeGroup'),
    customerName: $('customerName').value,
    customerAddress: $('customerAddress').value,
    customerPhone: $('customerPhone').value,
    device: $('device').value,
    serialNumber: $('serialNumber').value,
    accessories: checkedValues('accessoriesGroup'),
    issues: checkedValues('issueGroup'),
    problemDescription: $('problemDescription').value,
    serviceFee: $('serviceFee').value,
    paymentStatus: $('paymentStatus').value,
    notes: $('notes').value,
    savedAt: new Date().toISOString()
  };
}

function applyData(data) {
  ['invoiceNumber','invoiceDate','invoiceType','customerName','customerAddress','customerPhone','device','serialNumber','problemDescription','serviceFee','paymentStatus','notes'].forEach((key) => { if (data[key] !== undefined) $(key).value = data[key]; });
  ['accessories','issues','serviceTypes'].forEach((key) => document.querySelectorAll(`#${key === 'accessories' ? 'accessoriesGroup' : key === 'issues' ? 'issueGroup' : 'serviceTypeGroup'} input`).forEach((input) => { input.checked = (data[key] || []).includes(input.value); }));
  render();
}

function qrPayload(data) { return `Nama toko: Cimahi Service Komputer\nNo. Nota: ${data.invoiceNumber}\nTanggal: ${formatDate(data.invoiceDate)}`; }
function renderQr(data) {
  const container = $('qrcode');
  container.replaceChildren();
  if (data.invoiceType === 'final' || !window.QRCode) return;
  new QRCode(container, { text: qrPayload(data), width: 58, height: 58, colorDark: '#202226', colorLight: '#ffffff' });
}

function render() {
  const data = collectData();
  const temporary = data.invoiceType !== 'final';
  setText('previewNumber', data.invoiceNumber); setText('previewDate', formatDate(data.invoiceDate));
  setText('previewCustomer', data.customerName); setText('previewAddress', data.customerAddress); setText('previewPhone', data.customerPhone);
  setText('previewDevice', data.device); setText('previewSerial', data.serialNumber ? `SN: ${data.serialNumber}` : '');
  setText('previewDescription', data.problemDescription || data.issues.join(', ')); setText('previewFee', numberFormat.format(Number(data.serviceFee || 0)));
  setText('previewSignNameTemporary', data.customerName); setText('previewSignNameFinal', data.customerName);
  setText('previewPaymentTemporary', data.paymentStatus); setText('previewPaymentFinal', data.paymentStatus); setText('previewNotes', data.notes ? `Catatan: ${data.notes}` : '');
  $('previewAccessories').innerHTML = ['Charger','CD/DVD','Driver','Mouse','Tas'].map((value) => `<span class="small-check ${data.accessories.includes(value) ? 'checked' : ''}">${value}</span>`).join('');
  $('previewIssues').innerHTML = ['Install ulang + aplikasi standar','Repair harddisk','Recovery data','Engsel casing rusak','Mati total','Instalasi jaringan LAN'].map((value) => `<span class="damage-item ${data.issues.includes(value) ? 'checked' : ''}">${value}</span>`).join('');
  $('previewServiceTypes').innerHTML = ['Check Up','Service','Garansi'].map((value) => `<span class="type-item ${data.serviceTypes.includes(value) ? 'checked' : ''}">${value}</span>`).join('');
  $('temporarySignatureRow').style.display = temporary ? 'grid' : 'none';
  $('finalSignatureRow').style.display = temporary ? 'none' : 'grid';
  $('digitalNotice').style.display = temporary ? 'block' : 'none';
  $('finalNotice').style.display = temporary ? 'none' : 'block';
  renderQr(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function saveToLocalDatabase(data) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(data);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Nota tidak dapat disimpan.')); };
  }));
}
function saveToDatabase(data) {
  return saveToLocalDatabase(data).then(() => {
    if (!sheetsUrl()) return { remote: false };
    return remoteRequest('save', { record: data }).then(() => ({ remote: true }));
  });
}
function readAllLocalInvoices() {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))); };
    request.onerror = () => { db.close(); reject(request.error); };
  }));
}
function remoteRequest(action, payload = {}) {
  const url = sheetsUrl();
  if (!url) return Promise.reject(new Error('URL Google Apps Script belum diisi.'));
  return fetch(url, { method: action === 'list' ? 'GET' : 'POST', headers: action === 'list' ? undefined : { 'Content-Type': 'text/plain;charset=utf-8' }, body: action === 'list' ? undefined : JSON.stringify({ action, ...payload }) }).then((response) => { if (!response.ok) throw new Error('Google Sheets tidak merespons.'); return response.json(); });
}
function readAllInvoices() {
  if (!sheetsUrl()) return readAllLocalInvoices();
  return remoteRequest('list').then((result) => result.records || []).catch(() => readAllLocalInvoices());
}
function readInvoice(id) {
  if (sheetsUrl()) return readAllInvoices().then((invoices) => invoices.find((invoice) => String(invoice.id) === String(id)));
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  }));
}
function refreshHistory() {
  readAllInvoices().then((invoices) => {
    $('invoiceHistory').innerHTML = '<option value="">Pilih nota untuk dibuka</option>';
    invoices.forEach((invoice) => {
      const option = document.createElement('option');
      option.value = invoice.id;
      option.textContent = `${invoice.invoiceNumber} · ${invoice.customerName || 'Tanpa nama'} · ${invoice.invoiceType === 'final' ? 'Final' : 'Sementara'}`;
      $('invoiceHistory').appendChild(option);
    });
  }).catch(() => { $('saveMessage').textContent = 'Database lokal belum tersedia di browser ini.'; });
}

function newInvoice() {
  const current = Number(localStorage.getItem('toko-service-last-number') || '367') + 1;
  localStorage.setItem('toko-service-last-number', String(current));
  $('invoiceForm').reset(); $('invoiceNumber').value = String(current).padStart(5, '0'); $('invoiceDate').value = today(); $('invoiceType').value = 'temporary'; render();
}

document.querySelectorAll('#invoiceForm input, #invoiceForm textarea, #invoiceForm select').forEach((el) => { el.addEventListener('input', render); el.addEventListener('change', render); });
$('printInvoice').addEventListener('click', () => { render(); window.print(); });
$('newInvoice').addEventListener('click', newInvoice);
$('saveDraft').addEventListener('click', () => {
  const data = collectData();
  saveToDatabase(data).then((result) => { render(); refreshHistory(); $('saveMessage').textContent = result.remote ? 'Nota tersimpan di lokal dan Google Sheets.' : 'Nota tersimpan di database lokal browser.'; setTimeout(() => $('saveMessage').textContent = '', 3000); }).catch((error) => { $('saveMessage').textContent = `Lokal tersimpan, tetapi Google Sheets gagal: ${error.message}`; });
});
$('sheetsUrl').value = localStorage.getItem(SHEETS_URL_KEY) || '';
$('sheetsUrl').addEventListener('change', () => { localStorage.setItem(SHEETS_URL_KEY, $('sheetsUrl').value.trim()); refreshHistory(); });
$('syncSheets').addEventListener('click', () => {
  const url = sheetsUrl();
  if (!url) { $('saveMessage').textContent = 'Isi URL Web App Google Apps Script terlebih dahulu.'; return; }
  readAllLocalInvoices().then((invoices) => Promise.all(invoices.map((invoice) => remoteRequest('save', { record: invoice })))).then(() => { refreshHistory(); $('saveMessage').textContent = 'Data lokal berhasil disinkronkan ke Google Sheets.'; }).catch((error) => { $('saveMessage').textContent = `Sinkronisasi gagal: ${error.message}`; });
});
$('loadInvoice').addEventListener('click', () => {
  const id = $('invoiceHistory').value;
  if (!id) { $('saveMessage').textContent = 'Pilih nota yang ingin dibuka.'; return; }
  readInvoice(id).then((invoice) => { applyData(invoice); $('saveMessage').textContent = `Nota ${invoice.invoiceNumber} dibuka.`; }).catch(() => { $('saveMessage').textContent = 'Nota tidak dapat dibuka.'; });
});

const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
if (!localStorage.getItem(SHEETS_URL_KEY)) localStorage.setItem(SHEETS_URL_KEY, DEFAULT_SHEETS_URL);
if (saved) applyData(saved); else { $('invoiceNumber').value = nextNumber(); $('invoiceDate').value = today(); $('invoiceType').value = 'temporary'; render(); }
refreshHistory();
