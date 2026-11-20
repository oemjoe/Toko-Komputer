# Google Sheets database

Script `Code.gs` menyimpan invoice service pada tab `Invoices` dan `DetailPerbaikan`, serta nota pengadaan pada tab `Procurements`.

## Deployment pertama

1. Buka spreadsheet, pilih **Extensions → Apps Script**.
2. Hapus kode contoh, lalu salin isi `Code.gs` ke editor Apps Script.
3. Jalankan fungsi `setup` sekali dan berikan izin yang diminta kepada akun pemilik spreadsheet.
4. Pilih **Deploy → New deployment → Web app**.
5. Pilih **Execute as: Me** dan akses **Anyone with the link**, lalu deploy.
6. Salin URL berakhiran `/exec` ke kolom **URL Web App Google Apps Script** di aplikasi.

Jika script sudah pernah dideploy sebelumnya, salin ulang versi terbaru `Code.gs`, simpan, lalu buka **Deploy → Manage deployments → Edit → Version: New version → Deploy** agar kolom `serviceTypes` dan action pengadaan (`saveProcurement`/`listProcurements`) ikut dipakai. URL `/exec` tetap sama bila memakai deployment yang sudah ada.

Spreadsheet tetap dapat dibiarkan private. Yang dibagikan ke aplikasi adalah URL Web App, bukan akses edit spreadsheet.
