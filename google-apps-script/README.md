# Google Sheets database

Script `Code.gs` menggunakan spreadsheet yang diberikan untuk menyimpan invoice pada tab `Invoices`.

## Deployment pertama

1. Buka spreadsheet, pilih **Extensions → Apps Script**.
2. Hapus kode contoh, lalu salin isi `Code.gs` ke editor Apps Script.
3. Jalankan fungsi `setup` sekali dan berikan izin yang diminta kepada akun pemilik spreadsheet.
4. Pilih **Deploy → New deployment → Web app**.
5. Pilih **Execute as: Me** dan akses **Anyone with the link**, lalu deploy.
6. Salin URL berakhiran `/exec` ke kolom **URL Web App Google Apps Script** di aplikasi.

Spreadsheet tetap dapat dibiarkan private. Yang dibagikan ke aplikasi adalah URL Web App, bukan akses edit spreadsheet.
