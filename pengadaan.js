/* Modul pengadaan: nota/invoice pengadaan dan surat penawaran harga. */
const PROC_DRAFT_KEY = 'toko-pengadaan-draft';
const PROC_LAST_KEY = 'toko-pengadaan-last-number';
const PROC_DB_NAME = 'cimahi-service-komputer-db';
const PROC_DB_VERSION = 2;
const PROC_STORE = 'procurements';
const procMoney = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function procEl(id) { return document.getElementById(id); }
function procToday() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}
function procEsc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function procQty(value) { return Math.max(0, Number(value) || 0); }
function procNumberValue(value) {
  const match = String(value || '').match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}
function procFormatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}
function procQtyText(value) { return Number.isInteger(value) ? String(value) : value.toLocaleString('id-ID'); }

function openProcDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('Browser ini tidak mendukung database lokal.')); return; }
    const request = indexedDB.open(PROC_DB_NAME, PROC_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('invoices')) db.createObjectStore('invoices', { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PROC_STORE)) db.createObjectStore(PROC_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Database tidak dapat dibuka.'));
  });
}

function saveProcRecord(record) {
  return openProcDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(PROC_STORE, 'readwrite');
    transaction.objectStore(PROC_STORE).put(record);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Pengadaan tidak dapat disimpan.')); };
  }));
}

function readAllProcRecords() {
  return openProcDb().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(PROC_STORE, 'readonly').objectStore(PROC_STORE).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))); };
    request.onerror = () => { db.close(); reject(request.error || new Error('Riwayat tidak dapat dibaca.')); };
  }));
}

function nextProcNumber(records = [], docType = 'invoice') {
  const lastLocal = procNumberValue(localStorage.getItem(PROC_LAST_KEY) || '0');
  const lastRecord = records.reduce((max, record) => Math.max(max, procNumberValue(record.docNumber || record.id)), 0);
  const next = Math.max(lastLocal, lastRecord) + 1;
  localStorage.setItem(PROC_LAST_KEY, String(next));
  const prefix = docType === 'quotation' ? 'PEN' : 'PGD';
  return `${prefix}-${String(next).padStart(5, '0')}`;
}

function addProcRow(item = {}) {
  const row = document.createElement('div');
  row.className = 'proc-row';

  const head = document.createElement('div');
  head.className = 'proc-row-head';
  const name = document.createElement('input');
  name.type = 'text';
  name.className = 'item-name';
  name.placeholder = 'Nama barang';
  name.value = item.name || '';
  name.setAttribute('aria-label', 'Nama barang');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-cost';
  remove.textContent = '×';
  remove.title = 'Hapus barang';
  remove.setAttribute('aria-label', 'Hapus barang');
  head.append(name, remove);

  const spec = document.createElement('input');
  spec.type = 'text';
  spec.className = 'item-spec';
  spec.placeholder = 'Spesifikasi (opsional)';
  spec.value = item.spec || '';
  spec.setAttribute('aria-label', 'Spesifikasi');

  const meta = document.createElement('div');
  meta.className = 'proc-row-meta';
  const qty = document.createElement('input');
  qty.type = 'number';
  qty.className = 'item-qty';
  qty.min = '0';
  qty.step = '1';
  qty.value = item.qty == null ? 1 : item.qty;
  qty.setAttribute('aria-label', 'Qty');
  const unit = document.createElement('input');
  unit.type = 'text';
  unit.className = 'item-unit';
  unit.placeholder = 'Satuan';
  unit.value = item.unit || 'unit';
  unit.setAttribute('aria-label', 'Satuan');
  const price = document.createElement('input');
  price.type = 'number';
  price.className = 'item-price';
  price.min = '0';
  price.step = '1000';
  price.placeholder = 'Harga satuan';
  price.value = item.price == null ? '' : item.price;
  price.setAttribute('aria-label', 'Harga satuan');
  const subtotal = document.createElement('span');
  subtotal.className = 'proc-row-subtotal';
  meta.append(qty, unit, price, subtotal);

  row.append(head, spec, meta);
  remove.addEventListener('click', () => { row.remove(); renderProc(); });
  [name, spec, qty, unit, price].forEach((input) => {
    input.addEventListener('input', renderProc);
    input.addEventListener('change', renderProc);
  });
  procEl('procRows').appendChild(row);
}

function setProcItems(items) {
  procEl('procRows').replaceChildren();
  (Array.isArray(items) && items.length ? items : [{}]).forEach((item) => addProcRow(item));
}

function readProcItems() {
  return [...document.querySelectorAll('#procRows .proc-row')].map((row) => ({
    name: row.querySelector('.item-name').value.trim(),
    spec: row.querySelector('.item-spec').value.trim(),
    qty: procQty(row.querySelector('.item-qty').value),
    unit: row.querySelector('.item-unit').value.trim(),
    price: procQty(row.querySelector('.item-price').value)
  })).filter((item) => item.name || item.spec || item.price > 0);
}

function procTotals(items, rate) {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const ppnRate = Math.min(100, Math.max(0, Number(rate) || 0));
  const ppn = Math.round(subtotal * ppnRate / 100);
  return { subtotal, ppnRate, ppn, grandTotal: subtotal + ppn };
}

function collectProcData() {
  const items = readProcItems();
  const totals = procTotals(items, procEl('procPpnRate').value);
  const docNumber = procEl('procNumber').value.trim();
  return {
    id: docNumber,
    docNumber,
    docDate: procEl('procDate').value,
    docType: procEl('procType').value,
    customerName: procEl('procCustomer').value,
    customerAddress: procEl('procAddress').value,
    customerPic: procEl('procPic').value,
    customerPhone: procEl('procPhone').value,
    items,
    ppnRate: totals.ppnRate,
    subtotal: totals.subtotal,
    ppn: totals.ppn,
    grandTotal: totals.grandTotal,
    paymentStatus: procEl('procPayment').value,
    validUntil: procEl('procValidUntil').value,
    notes: procEl('procNotes').value,
    savedAt: new Date().toISOString()
  };
}

function renderProc() {
  const data = collectProcData();
  const quotation = data.docType === 'quotation';

  procEl('procPreviewBadge').textContent = quotation ? 'SURAT PENAWARAN HARGA' : 'NOTA PENGADAAN';
  procEl('procPreviewNumber').textContent = data.docNumber || '-';
  procEl('procPreviewDate').textContent = procFormatDate(data.docDate);
  procEl('procPreviewCustomer').textContent = data.customerName || '-';
  procEl('procPreviewAddress').textContent = data.customerAddress || '-';
  procEl('procPreviewPic').textContent = data.customerPic || '-';
  procEl('procPreviewPhone').textContent = data.customerPhone || '-';
  procEl('procPreviewPayment').textContent = data.paymentStatus || '-';
  procEl('procPreviewValidity').textContent = procFormatDate(data.validUntil);
  procEl('procMetaPayment').style.display = quotation ? 'none' : 'grid';
  procEl('procMetaValidity').style.display = quotation ? 'grid' : 'none';

  procEl('procPreviewRows').innerHTML = data.items.length
    ? data.items.map((item, index) => '<tr><td>' + (index + 1) + '</td><td><strong>' + procEsc(item.name || '-') + '</strong>' +
      (item.spec ? '<span class="proc-spec">' + procEsc(item.spec) + '</span>' : '') + '</td><td class="num">' + procQtyText(item.qty) +
      '</td><td>' + procEsc(item.unit || '-') + '</td><td class="num">' + procMoney.format(item.price) +
      '</td><td class="num">' + procMoney.format(item.qty * item.price) + '</td></tr>').join('')
    : '<tr><td colspan="6" class="proc-empty">Belum ada barang</td></tr>';

  procEl('procSubtotal').textContent = procMoney.format(data.subtotal);
  procEl('procPpnTotal').textContent = procMoney.format(data.ppn);
  procEl('procGrandTotal').textContent = procMoney.format(data.grandTotal);
  procEl('procPreviewSubtotal').textContent = procMoney.format(data.subtotal);
  procEl('procPreviewPpnRate').textContent = String(data.ppnRate);
  procEl('procPreviewPpn').textContent = procMoney.format(data.ppn);
  procEl('procPreviewGrand').textContent = procMoney.format(data.grandTotal);

  document.querySelectorAll('#procRows .proc-row').forEach((row) => {
    const qty = procQty(row.querySelector('.item-qty').value);
    const price = procQty(row.querySelector('.item-price').value);
    row.querySelector('.proc-row-subtotal').textContent = procMoney.format(qty * price);
  });

  const terms = [];
  if (quotation) {
    if (data.validUntil) terms.push(`Penawaran berlaku hingga ${procFormatDate(data.validUntil)}.`);
    terms.push('Harga belum termasuk biaya pengiriman dan instalasi kecuali disepakati.');
  } else {
    terms.push(`Status pembayaran: ${data.paymentStatus || '-'}.`);
    terms.push('Barang dikirim setelah pembayaran atau kesepakatan diterima.');
  }
  procEl('procPreviewTerms').innerHTML = terms.map((term) => `<span>${procEsc(term)}</span>`).join('');

  procEl('procSignatureLeftLabel').textContent = quotation ? 'Penerima' : 'Pelanggan';
  procEl('procSignatureLeftName').textContent = data.customerName || '';
  procEl('procPreviewNotes').textContent = data.notes ? `Catatan: ${data.notes}` : '';
  procEl('procPreviewNotice').textContent = quotation
    ? 'Dokumen penawaran ini dibuat secara digital. Harga dapat berubah setelah masa penawaran berakhir.'
    : 'Dokumen pengadaan ini dibuat secara digital. Garansi mengikuti ketentuan toko.';

  try { localStorage.setItem(PROC_DRAFT_KEY, JSON.stringify(data)); } catch (error) {}
}

function applyProcData(data) {
  if (!data) return;
  procEl('procNumber').value = data.docNumber || data.id || '';
  procEl('procDate').value = data.docDate || '';
  procEl('procType').value = data.docType === 'quotation' ? 'quotation' : 'invoice';
  procEl('procPayment').value = data.paymentStatus || 'Lunas';
  procEl('procCustomer').value = data.customerName || '';
  procEl('procAddress').value = data.customerAddress || '';
  procEl('procPic').value = data.customerPic || '';
  procEl('procPhone').value = data.customerPhone || '';
  procEl('procPpnRate').value = data.ppnRate == null ? 11 : data.ppnRate;
  procEl('procValidUntil').value = data.validUntil || '';
  procEl('procNotes').value = data.notes || '';
  setProcItems(data.items);
  renderProc();
}

let procMessageTimer = null;
function procMessage(text) {
  procEl('procMessage').textContent = text;
  clearTimeout(procMessageTimer);
  if (text) procMessageTimer = setTimeout(() => { procEl('procMessage').textContent = ''; }, 4000);
}

function refreshProcHistory() {
  readAllProcRecords().then((records) => {
    const select = procEl('procHistory');
    select.innerHTML = '<option value="">Pilih nota untuk dibuka</option>';
    records.forEach((record) => {
      const option = document.createElement('option');
      option.value = record.id;
      option.textContent = `${record.docNumber} · ${record.customerName || 'Tanpa nama'} · ${record.docType === 'quotation' ? 'Penawaran' : 'Pengadaan'} · ${procMoney.format(record.grandTotal || 0)}`;
      select.appendChild(option);
    });
  }).catch(() => { procMessage('Database lokal belum tersedia di browser ini.'); });
}

function newProcurement() {
  readAllProcRecords().catch(() => []).then((records) => {
    procEl('procurementForm').reset();
    procEl('procDate').value = procToday();
    procEl('procPpnRate').value = '11';
    procEl('procNumber').value = nextProcNumber(records, 'invoice');
    setProcItems([{}]);
    renderProc();
    procMessage('Dokumen pengadaan baru siap diisi.');
  });
}

function saveProcurement() {
  const data = collectProcData();
  if (!data.docNumber) { procMessage('Nomor nota wajib diisi.'); return; }
  if (!data.items.length) { procMessage('Tambahkan minimal satu barang.'); return; }
  saveProcRecord(data).then(() => {
    const savedNumber = procNumberValue(data.docNumber);
    if (savedNumber > procNumberValue(localStorage.getItem(PROC_LAST_KEY) || '0')) localStorage.setItem(PROC_LAST_KEY, String(savedNumber));
    procMessage('Pengadaan tersimpan di database lokal browser.');
    refreshProcHistory();
  }).catch((error) => { procMessage(`Gagal menyimpan: ${error.message}`); });
}

procEl('procurementForm').addEventListener('input', renderProc);
procEl('procurementForm').addEventListener('change', renderProc);
procEl('addProcItem').addEventListener('click', () => { addProcRow(); renderProc(); });
procEl('newProcurement').addEventListener('click', newProcurement);
procEl('saveProcurement').addEventListener('click', saveProcurement);
procEl('printProcurement').addEventListener('click', () => {
  renderProc();
  let pageStyle = procEl('procPageStyle');
  if (!pageStyle) {
    pageStyle = document.createElement('style');
    pageStyle.id = 'procPageStyle';
    document.head.appendChild(pageStyle);
  }
  pageStyle.textContent = '@page{size:A4 portrait;margin:0}';
  window.print();
});
procEl('loadProcurement').addEventListener('click', () => {
  const id = procEl('procHistory').value;
  if (!id) { procMessage('Pilih nota yang ingin dibuka.'); return; }
  readAllProcRecords().then((records) => {
    const record = records.find((item) => String(item.id) === String(id));
    if (!record) throw new Error('Nota tidak ditemukan.');
    applyProcData(record);
    procMessage(`Nota ${record.docNumber} dibuka.`);
  }).catch(() => { procMessage('Nota tidak dapat dibuka.'); });
});
window.addEventListener('afterprint', () => {
  const pageStyle = procEl('procPageStyle');
  if (pageStyle) pageStyle.remove();
});

(function initProcurement() {
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(PROC_DRAFT_KEY) || 'null'); } catch (error) { draft = null; }
  if (draft) {
    applyProcData(draft);
  } else {
    procEl('procDate').value = procToday();
    setProcItems([{}]);
    renderProc();
    readAllProcRecords().then((records) => {
      procEl('procNumber').value = nextProcNumber(records, 'invoice');
      renderProc();
    }).catch(() => {
      procEl('procNumber').value = nextProcNumber([], 'invoice');
      renderProc();
    });
  }
  refreshProcHistory();
})();
