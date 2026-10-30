# Cimahi Service Komputer

Aplikasi web untuk membuat nota service komputer, menyimpan riwayat nota, dan mencetak nota ke printer atau PDF.

## Menjalankan untuk tes

Buka `index.html` di browser atau jalankan server lokal:

```bash
python -m http.server 8080
```

Lalu buka <http://localhost:8080>.

## Jenis nota

- **Nota service sementara**: menampilkan keterangan invoice digital dan QR berisi nama toko, nomor nota, serta tanggal.
- **Invoice service final**: menghilangkan keterangan digital dan QR, serta menampilkan area tanda tangan basah dan stempel.

## Database Google Sheets

Aplikasi memiliki database lokal browser dan dapat disinkronkan ke spreadsheet Google. Ikuti panduan pada `google-apps-script/README.md`, deploy `Code.gs` sebagai Web App, lalu tempel URL `/exec` pada kolom URL Google Apps Script di aplikasi.

Klik **Simpan ke DB** untuk menyimpan lokal dan mengirim ke Google Sheets jika URL sudah diisi. Tombol **Sinkronkan ke Google Sheets** mengirim seluruh riwayat lokal.
