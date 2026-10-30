const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'toko-service-invoice-draft';
const numberFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function today() { return new Date().toISOString().slice(0, 10); }
function nextNumber() { return String(Number(localStorage.getItem('toko-service-last-number') || '367') + 1).padStart(5, '0'); }
function checkedValues(containerId) { return [...document.querySelectorAll(`#${containerId} input:checked`)].map((input) => input.value); }
function setText(id, value, fallback = '-') { $(id).textContent = value || fallback; }
function formatDate(value) { if (!value) return '-'; return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }); }

function collectData() {
  return {
    invoiceNumber: $('invoiceNumber').value,
    invoiceDate: $('invoiceDate').value,
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
    notes: $('notes').value
  };
}

function applyData(data) {
  ['invoiceNumber','invoiceDate','customerName','customerAddress','customerPhone','device','serialNumber','problemDescription','serviceFee','paymentStatus','notes'].forEach((key) => { if (data[key] !== undefined) $(key).value = data[key]; });
  ['accessories','issues'].forEach((key) => document.querySelectorAll(`#${key === 'accessories' ? 'accessoriesGroup' : 'issueGroup'} input`).forEach((input) => { input.checked = (data[key] || []).includes(input.value); }));
  render();
}

function render() {
  const data = collectData();
  setText('previewNumber', data.invoiceNumber); setText('previewDate', formatDate(data.invoiceDate));
  setText('previewCustomer', data.customerName); setText('previewAddress', data.customerAddress); setText('previewPhone', data.customerPhone);
  setText('previewDevice', data.device); setText('previewSerial', data.serialNumber ? `SN: ${data.serialNumber}` : '');
  setText('previewDescription', data.problemDescription || data.issues.join(', ')); setText('previewFee', numberFormat.format(Number(data.serviceFee || 0)));
  setText('previewSignName', data.customerName); setText('previewPayment', data.paymentStatus); setText('previewNotes', data.notes ? `Catatan: ${data.notes}` : '');
  $('previewAccessories').innerHTML = ['Charger','CD/DVD','Driver','Mouse','Tas'].map((value) => `<span class="small-check ${data.accessories.includes(value) ? 'checked' : ''}">${value}</span>`).join('');
  $('previewIssues').innerHTML = ['Install ulang + aplikasi standar','Repair harddisk','Recovery data','Engsel casing rusak','Mati total','Instalasi jaringan LAN'].map((value) => `<span class="damage-item ${data.issues.includes(value) ? 'checked' : ''}">${value}</span>`).join('');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function newInvoice() {
  const current = Number(localStorage.getItem('toko-service-last-number') || '367') + 1;
  localStorage.setItem('toko-service-last-number', String(current));
  $('invoiceForm').reset(); $('invoiceNumber').value = String(current).padStart(5, '0'); $('invoiceDate').value = today(); render();
}

document.querySelectorAll('#invoiceForm input, #invoiceForm textarea, #invoiceForm select').forEach((el) => el.addEventListener('input', render));
$('printInvoice').addEventListener('click', () => { render(); window.print(); });
$('newInvoice').addEventListener('click', newInvoice);
$('saveDraft').addEventListener('click', () => { render(); $('saveMessage').textContent = 'Draft tersimpan di browser ini.'; setTimeout(() => $('saveMessage').textContent = '', 2500); });

const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
if (saved) applyData(saved); else { $('invoiceNumber').value = nextNumber(); $('invoiceDate').value = today(); render(); }
