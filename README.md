# Prototype e-Parlemen DPRD Kota Magelang

Prototype aplikasi web statis (HTML5 + CSS3 + Vanilla JavaScript) untuk sistem manajemen jadwal rapat, verifikasi kuorum ⅔, dan presensi mandiri Anggota Dewan Perwakilan Rakyat Daerah (DPRD) Kota Magelang.

Dibuat untuk di-deploy langsung ke **Vercel** tanpa dependensi backend atau tahapan build (No Framework, No Build Step).

---

## 🚀 Cara Menjalankan

Aplikasi ini 100% statis. Anda dapat membukanya secara langsung melalui browser atau menjalankan server HTTP lokal sederhana:

### Opsi 1: Server Python Lokal
```bash
# Buka terminal di folder project
python -m http.server 8080
```
Buka browser dan akses:
- **Portal Utama:** `http://localhost:8080/index.html`
- **Web Admin:** `http://localhost:8080/admin.html`
- **Mobile Anggota:** `http://localhost:8080/mobile.html`
- **Automated Test Suite:** `http://localhost:8080/test.html`

### Opsi 2: Buka Berkas Secara Langsung
Klik dua kali pada `index.html` di file explorer Anda.

---

## 📁 Struktur Berkas

```
├── index.html          # Portal utama: pemilih peran, simulator waktu global, reset data
├── admin.html          # Web Admin Sekretariat (Dashboard, Jadwal, Form Kuorum, Detail)
├── mobile.html         # Mobile Anggota DPRD (Frame ponsel, Agenda, Scan QR, Notifikasi)
├── test.html           # Automated Test Suite mandiri di browser (100% PASS)
├── test_suite.py       # Test runner CLI otomatis via Python
├── vercel.json         # Konfigurasi static deployment Vercel
├── README.md           # Dokumentasi arsitektur, panduan penggunaan, & hasil uji
├── css/
│   └── style.css       # Desain visual terpadu (palet hijau tua, emas, krem, dan font resmi)
├── js/
│   ├── rules.js        # Aturan bisnis murni: Kuorum ⅔, irisan waktu, status, & jendela scan
│   ├── store.js        # State management localStorage, sinkronisasi antar-tab, data seed
│   ├── admin.js        # Controller Web Admin: tabel rapat, form kuorum real-time, QR dinamis
│   └── mobile.js       # Controller Mobile Anggota: 5 tab menu, konfirmasi final, scan presensi
└── reference/          # Dokumen acuan sumber kebenaran (xlsx, html, png)
```

---

## ⚖️ Aturan Bisnis & Keputusan Final

Seluruh aturan diimplementasikan merujuk pada `reference/kuorum_rapat (2).xlsx` dan Keputusan Final:

1. **Status Kehadiran Anggota:**
   - Hanya memiliki **2 nilai pasti**: `Hadir` dan `Tidak hadir` (ditambah kondisi awal `Belum konfirmasi`).
   - Tidak ada pilihan "Mungkin".
   - Jika memilih `Tidak hadir`, isian **alasan wajib diisi** dan status bersifat **FINAL** (tidak dapat diubah kembali).

2. **Presensi Mandiri Anggota:**
   - Presensi kehadiran rapat **hanya dilakukan oleh Anggota** dengan melakukan scan kode QR rapat melalui aplikasi mobile. Mode petugas scan ditiadakan.

3. **Jendela Presensi:**
   - Presensi dibuka sejak pukul **00.00 WIB hari H** hingga **jam selesai rapat**.
   - Tidak ada toleransi menit tambahan.
   - Scan sebelum atau tepat jam mulai berstatus **Tepat Waktu** (badge hijau).
   - Scan setelah jam mulai tetapi sebelum jam selesai berstatus **Terlambat X menit** (badge oranye). Keduanya sah dihitung hadir.

4. **Form Rapat Web Admin:**
   - **Kode Rapat:** Manual, wajib, dan UNIK (kode rapat yang dibatalkan tetap terpakai/terkunci).
   - **Jenis Rapat:** 15 opsi resmi DPRD Kota Magelang (Badan Anggaran, Komisi I–IV, Paripurna, Pansus, Fraksi, Banleg, dll).
   - **Unit:** Multi-select AKD & Setwan, perubahan unit otomatis memperbarui daftar peserta.
   - **Lampiran:** Maksimal 10 berkas (maks 10 MB per berkas; format JPG, PNG, DOC, DOCX, PDF, XLSX).
   - Tidak ada field "Tingkat Rapat", cakupan peserta, maupun toleransi waktu.

5. **Simulator Waktu Global:**
   - Semua penentuan status rapat dan validasi presensi menggunakan fungsi `Store.now()` yang dapat di-override kapan saja melalui simulator waktu di header portal, web admin, maupun mobile.

6. **Default & Keputusan Lain:**
   - Urutan daftar rapat: **Tanggal rapat terbaru di atas**.
   - Waktu presensi di rekap admin: Ditampilkan dalam zona waktu WIB.
   - Anggota pada rapat Selesai yang belum scan dilabeli *"Tidak presensi"*, yang belum merespons dilabeli *"Tidak merespons"*.
   - Pembatalan rapat saat berlangsung tetap mempertahankan data presensi yang sudah masuk sebagai arsip baca-saja.

7. **Penyempurnaan Form Rapat & Evaluasi Kuorum:**
   - **Filter Peserta Sesuai Unit/Komisi:** Daftar peserta otomatis menyesuaikan unit yang dipilih (misal: Komisi I = 10 anggota dewan, Badan Anggaran = 25 anggota, Paripurna = 100 anggota), anggota dapat dicentang/batal centang secara individual.
   - **Evaluasi Kuorum saat Klik "Jadwalkan Rapat":** Simpan draft tidak memblokir kuorum. Evaluasi kuorum ⅔ dilakukan saat klik tombol *Jadwalkan Rapat*. Jika kuorum terpenuhi ($\text{Tersedia} \ge \lceil N \times 2/3 \rceil$), rapat dijadwalkan dan muncul dialog sukses; jika gagal, muncul peringatan kegagalan kuorum dan rapat tidak dapat dijadwalkan.
   - **Tombol Aksi di Bawah Form:** Disusun rapi di bagian bawah form: **Batal (Merah)**, **Simpan Draft (Abu-abu)**, dan **Jadwalkan Rapat (Hijau)**.
   - **Tab Sedang Berlangsung (Admin):** Memungkinkan pembatalan rapat darurat yang sedang berjalan pada hari H.

8. **Penyempurnaan Mobile Anggota & Dokumen:**
   - **Tanpa Tombol Kalender:** Tombol tambah ke kalender ditiadakan.
   - **Dokumen Surat Undangan Resmi:** Dilengkapi fitur pembaca dokumen surat dinas ber-kop DPRD Kota Magelang, nomor surat, dan tanda tangan Sekretaris DPRD.
   - **Selector Pengguna Terkurasi:** Menampilkan 8 profil demo representatif (P1 s.d. P10) dengan status bentrok, hadir, dan izin yang jelas.
   - **Aksen Visual Khas:** Menggunakan watermark gedung dewan dan gelombang merah tipis (`.hdr-wave`) yang presisi dengan template acuan.

---

## 📊 Parameter & Verifikasi Data Seed

Data contoh awal yang otomatis di-generate ke dalam `localStorage`:
- **Jumlah Anggota:** 100 orang (P1 s.d. P100, kode `DPRD-AGT-001` s.d. `DPRD-AGT-100`).
- **Rapat Utama:** Jumat, 20 November 2026, pukul 09.00–12.00 WIB (status: `Dijadwalkan`).
- **Hasil Kuorum Rapat Utama:**
  - $N = 100$
  - Syarat Minimal Kuorum ($\lceil 100 \times \frac{2}{3} \rceil$): **67 orang**
  - Bentrok Unik: **5 orang** (P1 & P2 penugasan disetujui; P9, P10, & P11 rapat lain submit)
  - Peserta Tersedia ($100 - 5$): **95 orang**
  - Maksimal Boleh Bentrok: **33 orang**
  - Sisa Ruang Bentrok: **28 orang**
  - Status Kuorum: **LOLOS** ($95 \ge 67$)

---

## 🧪 Hasil Uji Assertion (Test Suite)

Semua 30 assertion test case telah diuji dan mendapatkan hasil **100% PASS** pada `test.html` dan `test_suite.py`:

| Kategori Pengujian | Kasus Uji | Hasil |
|---|---|:---:|
| **1. Rumus Kuorum ⅔** | $N=100$ (bentrok 0, 33, 34, 100) | **PASS** |
| | $N=10$ (bentrok 3 lolos, bentrok 4 gagal) | **PASS** |
| | $N=7$ (bentrok 2 lolos syarat 5) | **PASS** |
| | $N=3$ (bentrok 1 lolos syarat 2, bentrok 2 gagal) | **PASS** |
| **2. Penugasan vs Rapat** | Draft 09–10 vs Penugasan 20–21 seharian &rarr; LOLOS | **PASS** |
| | Submit 09–10 vs Penugasan 09.00–09.30 &rarr; CONFLICT | **PASS** |
| | Cancelled 09–10 vs Penugasan 09.00–09.30 &rarr; LOLOS | **PASS** |
| | Submit 09–10 vs Penugasan 20–21 seharian &rarr; CONFLICT | **PASS** |
| | Submit 09–10 vs Rapat lain 10.00–11.00 &rarr; LOLOS (Bersentuhan) | **PASS** |
| | Submit 09–10 vs Rapat lain 21 Nov 09–10 &rarr; LOLOS (Beda Tanggal) | **PASS** |
| **3. Mobile Hari H (09–12 WIB)** | 08.00 Hadir belum scan &rarr; Scan diperbolehkan | **PASS** |
| | 08.30 Scan &rarr; Tepat Waktu (badge hijau) | **PASS** |
| | 09.35 Scan &rarr; Terlambat 35 menit (badge oranye) | **PASS** |
| | 09.30 Tidak hadir &rarr; Tombol scan hilang (final) | **PASS** |
| | 12.00 Hadir belum scan &rarr; Scan ditutup (kedaluwarsa) | **PASS** |
| | H-1 Scan &rarr; Ditolak ("Presensi hanya dibuka pada hari rapat") | **PASS** |
| | Batal H-2 &rarr; QR tidak valid, badge Dibatalkan | **PASS** |
| | Batal setelah presensi &rarr; Data presensi tetap sebagai arsip | **PASS** |
| **4. Validasi Seed Data** | $N=100$, bentrok=5, tersedia=95, syarat=67 &rarr; LOLOS | **PASS** |
