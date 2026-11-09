/* Rincian sparepart dan jasa service untuk Cimahi Service Komputer. */
function calculateRepairCosts(parts, labor) {
  function sum(items) {
    return (Array.isArray(items) ? items : []).reduce(function (total, item) {
      return total + Math.max(0, Number(item.qty) || 0) * Math.max(0, Number(item.price) || 0);
    }, 0);
  }
  var partsTotal = sum(parts), laborTotal = sum(labor);
  return { partsTotal: partsTotal, laborTotal: laborTotal, grandTotal: partsTotal + laborTotal };
}
if (typeof module !== "undefined" && module.exports) module.exports = { calculateRepairCosts: calculateRepairCosts };

(function () {
  if (typeof document === "undefined") return;
  var money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  var safe = function (v) { return Math.max(0, Number(v) || 0); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]; }); };
  var form = document.getElementById("invoiceForm"), fee = document.getElementById("serviceFee");
  var feeRow = document.querySelector(".fee-row");
  if (!form || !fee || !feeRow) return;

  var css = [
    ".repair-costs{margin-top:14px;padding:14px;border:1px solid #d7e2e8;border-radius:10px;background:#fbfdfe}",
    ".repair-costs h3{margin:10px 0 8px;color:#0b4166;font-size:13px}",
    ".repair-costs .cost-row{display:grid;grid-template-columns:minmax(110px,1fr) 66px 112px 34px;gap:6px;margin:6px 0;align-items:center}",
    ".repair-costs input{min-width:0;margin:0;padding:8px}.repair-costs button{border:0;border-radius:7px;padding:8px 10px;cursor:pointer;font-weight:700}",
    ".repair-costs .add-cost{background:#e7f2f7;color:#0b4166;margin:5px 0 8px}.repair-costs .remove-cost{background:#fff0f0;color:#9a2525}",
    ".repair-costs .cost-subtotal{display:flex;justify-content:space-between;padding:5px 0;font-size:12px}",
    ".repair-costs .grand-total{border-top:2px solid #0b4166;margin-top:6px;padding-top:9px;font-size:15px;font-weight:800;color:#0b4166}",
    ".repair-cost-preview{margin-top:8px;border:1px solid #a4a6aa;padding:8px;font-size:10px}",
    ".repair-cost-preview table{width:100%;border-collapse:collapse;font-size:9px}",
    ".repair-cost-preview th,.repair-cost-preview td{border-bottom:1px solid #ddd;padding:4px;text-align:left}",
    ".repair-cost-preview td:last-child,.repair-cost-preview th:last-child{text-align:right}",
    ".repair-cost-preview .total-line{display:flex;justify-content:space-between;padding:3px 0}",
    ".repair-cost-preview .grand{border-top:1px solid #444;margin-top:4px;padding-top:5px;font-weight:800;font-size:12px}",
    "@media(max-width:520px){.repair-costs .cost-row{grid-template-columns:minmax(90px,1fr) 54px 90px 30px;gap:4px}}",
    "@media print{.repair-costs,.fee-row{display:none!important}.repair-cost-preview{break-inside:avoid}}"
  ].join("");
  var style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
  fee.closest("label").style.display = "none";

  var section = document.createElement("section");
  section.className = "repair-costs"; section.id = "repairCosts";
  section.innerHTML = '<h3>Sparepart</h3><div id="partsRows"></div><button type="button" class="add-cost" data-add="parts">+ Tambah sparepart</button>' +
    '<div class="cost-subtotal"><span>Total sparepart</span><strong id="partsTotal">Rp0</strong></div>' +
    '<h3>Jasa perbaikan</h3><div id="laborRows"></div><button type="button" class="add-cost" data-add="labor">+ Tambah jasa</button>' +
    '<div class="cost-subtotal"><span>Total jasa</span><strong id="laborTotal">Rp0</strong></div>' +
    '<div class="cost-subtotal grand-total"><span>Total keseluruhan</span><strong id="grandTotal">Rp0</strong></div>';
  fee.closest(".form-grid").insertAdjacentElement("afterend", section);

  var preview = document.createElement("section");
  preview.className = "repair-cost-preview"; preview.id = "repairCostPreview";
  preview.innerHTML = '<strong>RINCIAN BIAYA PERBAIKAN</strong><table><thead><tr><th>Jenis</th><th>Rincian</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody id="repairCostPreviewRows"></tbody></table>' +
    '<div class="total-line"><span>Total sparepart</span><strong id="previewPartsTotal">Rp0</strong></div>' +
    '<div class="total-line"><span>Total jasa</span><strong id="previewLaborTotal">Rp0</strong></div>' +
    '<div class="total-line grand"><span>TOTAL PEMBAYARAN</span><strong id="previewGrandTotal">Rp0</strong></div>';
  feeRow.insertAdjacentElement("afterend", preview);

  function rowMarkup(kind, item) {
    item = item || {};
    var row = document.createElement("div"); row.className = "cost-row"; row.dataset.kind = kind;
    var name = document.createElement("input"); name.type = "text"; name.placeholder = kind === "parts" ? "Nama sparepart" : "Nama jasa";
    name.className = "cost-name"; name.value = item.name || ""; name.setAttribute("aria-label", name.placeholder);
    var qty = document.createElement("input"); qty.type = "number"; qty.min = "1"; qty.step = "1"; qty.value = item.qty == null ? 1 : item.qty;
    qty.className = "cost-qty"; qty.setAttribute("aria-label", "Jumlah");
    var price = document.createElement("input"); price.type = "number"; price.min = "0"; price.step = "1000"; price.placeholder = "Harga";
    price.value = item.price == null ? "" : item.price; price.className = "cost-price"; price.setAttribute("aria-label", "Harga satuan");
    var remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-cost"; remove.textContent = "×";
    remove.title = "Hapus rincian"; remove.setAttribute("aria-label", "Hapus rincian");
    remove.addEventListener("click", function () { row.remove(); update(); });
    [name, qty, price, remove].forEach(function (el) { row.appendChild(el); });
    [name, qty, price].forEach(function (el) { el.addEventListener("input", update); el.addEventListener("change", update); });
    return row;
  }
  function readRows(kind) {
    return Array.prototype.slice.call(section.querySelectorAll('.cost-row[data-kind="' + kind + '"]')).map(function (row) {
      return { name: row.querySelector(".cost-name").value.trim(), qty: safe(row.querySelector(".cost-qty").value), price: safe(row.querySelector(".cost-price").value) };
    }).filter(function (item) { return item.name || item.price > 0; });
  }
  function setRows(kind, items) {
    var host = document.getElementById(kind === "parts" ? "partsRows" : "laborRows");
    host.replaceChildren();
    (Array.isArray(items) && items.length ? items : [{}]).forEach(function (item) { host.appendChild(rowMarkup(kind, item)); });
  }
  function update() {
    var parts = readRows("parts"), labor = readRows("labor"), totals = calculateRepairCosts(parts, labor);
    document.getElementById("partsTotal").textContent = money.format(totals.partsTotal);
    document.getElementById("laborTotal").textContent = money.format(totals.laborTotal);
    document.getElementById("grandTotal").textContent = money.format(totals.grandTotal);
    document.getElementById("previewPartsTotal").textContent = money.format(totals.partsTotal);
    document.getElementById("previewLaborTotal").textContent = money.format(totals.laborTotal);
    document.getElementById("previewGrandTotal").textContent = money.format(totals.grandTotal);
    var rows = parts.map(function (x) { return Object.assign({ kind: "Sparepart" }, x); }).concat(
      labor.map(function (x) { return Object.assign({ kind: "Jasa" }, x); }));
    document.getElementById("repairCostPreviewRows").innerHTML = rows.length
      ? rows.map(function (x) { return "<tr><td>" + x.kind + "</td><td>" + esc(x.name || "-") + "</td><td>" + x.qty + "</td><td>" + money.format(x.qty * x.price) + "</td></tr>"; }).join("")
      : '<tr><td colspan="4">Belum ada rincian biaya</td></tr>';
    fee.value = String(totals.laborTotal);
  }
  section.addEventListener("click", function (event) {
    var button = event.target.closest("[data-add]"); if (!button) return;
    document.getElementById(button.dataset.add === "parts" ? "partsRows" : "laborRows").appendChild(rowMarkup(button.dataset.add));
    update();
  });

  var oldCollect = window.collectData;
  if (typeof oldCollect === "function") window.collectData = function () {
    var data = oldCollect(), parts = readRows("parts"), labor = readRows("labor"), totals = calculateRepairCosts(parts, labor);
    return Object.assign({}, data, { partsItems: parts, laborItems: labor, partsTotal: totals.partsTotal,
      laborTotal: totals.laborTotal, grandTotal: totals.grandTotal, serviceFee: String(totals.laborTotal) });
  };
  var oldApply = window.applyData;
  if (typeof oldApply === "function") window.applyData = function (data) {
    oldApply(data);
    var legacy = Array.isArray(data.laborItems) && data.laborItems.length ? data.laborItems :
      (Number(data.serviceFee) > 0 ? [{ name: "Jasa service", qty: 1, price: Number(data.serviceFee) }] : []);
    setRows("parts", data.partsItems || []); setRows("labor", legacy); update();
    if (typeof window.render === "function") window.render();
  };
  var oldRender = window.render;
  if (typeof oldRender === "function") window.render = function () { oldRender(); update(); };

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem("toko-service-invoice-draft") || "null"); } catch (e) {}
  var oldFee = safe(fee.value);
  setRows("parts", saved && Array.isArray(saved.partsItems) ? saved.partsItems : []);
  setRows("labor", saved && Array.isArray(saved.laborItems) ? saved.laborItems :
    (oldFee > 0 ? [{ name: "Jasa service", qty: 1, price: oldFee }] : []));
  update();
})();