import zipfile
import xml.etree.ElementTree as ET
import os

def escape_xml(s):
    if s is None:
        return ""
    return (str(s)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;'))

# Data definisi kolom (13 kolom persis template)
headers = [
    "No",
    "Trigger Notif",
    "Platform",
    "Keterangan Notif",
    "Modul",
    "User Penerima Notif",
    "Wording Title",
    "Wording Detail (Template)",
    "Redirect Page",
    "Type Notification",
    "Catatan",
    "Flagging BE",
    "Flagging FE"
]

rows = [
    [
        "1",
        'Admin Sekretariat menekan tombol "Jadwalkan Rapat" dan rapat lolos pengecekan kuorum 2/3',
        "Mobile",
        "Push notification FCM & in-app untuk undangan rapat baru yang telah dijadwalkan",
        "Jadwal Rapat",
        "Seluruh Anggota DPRD yang menjadi peserta rapat",
        "Undangan {nama_rapat}",
        'Rapat {nama_rapat} telah dijadwalkan pada {hari}, {tanggal} pukul {jam_mulai}–{jam_selesai} WIB bertempat di {lokasi}. Mohon periksa agenda dan segera konfirmasi kehadiran Anda melalui aplikasi mobile.',
        "Detail Undangan Rapat (Mobile)",
        "Push Notification (FCM) & In-App Mobile",
        'Masuk ke tab "Undangan" dengan indikator garis hijau (bl-success). Flagging unread badge merah.',
        'Server mengirimkan payload FCM broadcast ke token perangkat anggota dengan event: "MEETING_SCHEDULED", status: "Dijadwalkan", is_read: false.',
        'Merender kartu notifikasi bergaris hijau (bl-success) pada tab "Undangan", menampilkan dot merah unread, dan klik kartu mengarahkan ke Mobile.openMeetingDetail(meetingId).'
    ],
    [
        "2",
        "Scheduler otomatis (Cron Job) berjalan pada H-1 pukul 08.00 WIB untuk rapat yang akan dilaksanakan esok hari",
        "Mobile",
        "Push notification pengingat H-1 bagi anggota dewan yang belum mengonfirmasi kehadiran",
        "Jadwal Rapat",
        'Anggota DPRD Peserta Rapat (status: Belum konfirmasi)',
        "Pengingat Rapat H-1: {nama_rapat}",
        "Rapat {nama_rapat} akan dilaksanakan besok ({hari}, {tanggal} pukul {jam_mulai} WIB). Mohon segera konfirmasi kehadiran Anda melalui aplikasi mobile.",
        "Detail Undangan Rapat - Form Konfirmasi (Mobile)",
        "Push Notification (FCM) & In-App Mobile",
        'Sesuai desain UI mockup tab Undangan (Card bergaris emas bl-gold). Mendorong anggota memilih Hadir / Tidak Hadir.',
        'Scheduled task mengecek tanggal_rapat == now() + 1 day dan kehadiran == "Belum konfirmasi", kirim payload FCM event: "MEETING_REMINDER_H1".',
        'Menampilkan kartu notifikasi bergaris emas (bl-gold) di tab Undangan dengan tombol cepat "Lihat Rapat ›" yang membuka modal konfirmasi kehadiran.'
    ],
    [
        "3",
        "Memasuki hari H pelaksanaan rapat (dimulai pukul 00.00 WIB s.d. jam selesai rapat)",
        "Mobile",
        "Push notification pembukaan jendela presensi mandiri berbasis scan QR di lokasi sidang",
        "Presensi Rapat",
        'Anggota DPRD yang telah mengonfirmasi "Hadir"',
        "Presensi Dibuka: {nama_rapat}",
        "Presensi kehadiran untuk {nama_rapat} telah dibuka hari ini. Silakan lakukan pemindaian QR Code di ruang sidang sebelum pukul {jam_mulai} WIB.",
        "Scanner QR Presensi / Detail Rapat (Mobile)",
        "Push Notification (FCM) & In-App Mobile",
        'Jendela presensi berlaku sejak 00.00 WIB hari H s.d. jam selesai rapat. Mengaktifkan tombol "Scan QR Presensi".',
        'Server memvalidasi tanggal hari H, mengirim push FCM ke peserta yang konfirmasi Hadir dan status presensi "Belum presensi".',
        'Tombol "Scan QR Presensi" pada kartu detail rapat berubah dari disabled menjadi aktif (Primary), dan tap notifikasi langsung membuka kamera scanner QR.'
    ],
    [
        "4",
        'Anggota DPRD menekan tombol "Hadir" pada detail undangan di Mobile',
        "Web",
        "Notifikasi in-app web admin sekretariat bahwa anggota telah mengonfirmasi kehadiran",
        "Presensi & Kuorum",
        "Admin Sekretariat DPRD",
        "Konfirmasi Hadir: {nama_anggota}",
        "{nama_anggota} ({fraksi_jabatan}) telah mengonfirmasi HADIR pada {nama_rapat}.",
        "Detail Jadwal Rapat & Rekap Kehadiran (Web Admin)",
        "Sekretariat In-App Web Notification",
        'Mengupdate counter ringkasan "Hadir (Konfirmasi)" pada statistik rapat secara realtime.',
        'Menyimpan record kehadiran: "Hadir" ke tabel presences, trigger WebSocket/SSE event: "ATTENDANCE_STATUS_UPDATED".',
        'Memperbarui live counter mini-stats Hadir secara realtime dan mengubah badge status peserta pada tabel rekap menjadi Hijau ("Hadir").'
    ],
    [
        "5",
        'Anggota DPRD menekan tombol "Tidak Hadir" dan mengisi alasan wajib di Mobile',
        "Web",
        "Notifikasi in-app web admin sekretariat saat anggota berhalangan hadir beserta alasan ketidakhadiran",
        "Presensi & Kuorum",
        "Admin Sekretariat DPRD",
        "Konfirmasi Tidak Hadir: {nama_anggota}",
        'Nama {nama_anggota} mengonfirmasi TIDAK HADIR pada {nama_rapat}. Alasan: "{alasan_tidak_hadir}".',
        "Detail Jadwal Rapat & Rekap Kehadiran (Web Admin)",
        "Sekretariat In-App Web Notification",
        "Status bersifat FINAL (tidak dapat diubah kembali). Alasan tersimpan di database dan tampil di rekapitulasi.",
        'Menyimpan record kehadiran: "Tidak hadir" dan alasan_tidak_hadir, trigger event: "ATTENDANCE_STATUS_UPDATED", perbarui proyeksi kuorum.',
        'Mengubah badge di tabel admin menjadi Merah ("Tidak Hadir"), menampilkan alasan pada kolom keterangan, dan memperbarui angka ringkasan statistik.'
    ],
    [
        "6",
        "Anggota DPRD sukses memindai QR code rapat pada hari H sebelum atau tepat pada jam mulai rapat",
        "Web",
        "Live notifikasi presensi fisik masuk ke ruang sidang dengan status Tepat Waktu",
        "Presensi Rapat",
        "Admin Sekretariat DPRD & Operator Layar Sidang",
        "Presensi Masuk (Tepat Waktu): {nama_anggota}",
        "{nama_anggota} telah berhasil melakukan presensi QR pada pukul {jam_presensi} WIB (Tepat Waktu) untuk {nama_rapat}.",
        "Live Rekap Presensi & Kuorum Sidang (Web Admin)",
        "Sekretariat In-App Web & Live Stream Counter",
        'Presensi tercatat sah di sistem dewan. Mendapat badge hijau "Tepat Waktu".',
        'Menyimpan timestamp presensi, validasi jendela waktu (lateMinutes <= 0), presensiStatus: "Sudah presensi", badge: "Tepat Waktu".',
        'Memperbarui data table rekapitulasi presensi secara live, baris anggota mendapat badge hijau ("Tepat Waktu"), counter presensi bertambah.'
    ],
    [
        "7",
        "Anggota DPRD memindai QR code rapat setelah jam mulai rapat terlewat (dalam jendela sebelum jam selesai)",
        "Web",
        "Live notifikasi presensi masuk dengan status Terlambat",
        "Presensi Rapat",
        "Admin Sekretariat DPRD & Operator Layar Sidang",
        "Presensi Masuk (Terlambat): {nama_anggota}",
        "{nama_anggota} melakukan presensi QR pada pukul {jam_presensi} WIB (Terlambat {jumlah_menit} menit) untuk {nama_rapat}.",
        "Live Rekap Presensi & Kuorum Sidang (Web Admin)",
        "Sekretariat In-App Web & Live Stream Counter",
        'Presensi tetap sah dihitung dalam kuorum kehadiran dewan, namun ditandai badge oranye "Terlambat X menit".',
        'Menghitung lateMinutes = jam_presensi - jam_mulai (> 0), status_presensi: "Sudah presensi", badge: "Terlambat X menit".',
        'Menampilkan badge oranye (badge-warn) pada rekap presensi web admin dengan teks "Terlambat X mnt" dan waktu presensi.'
    ],
    [
        "8",
        "Jumlah anggota yang telah melakukan presensi QR mencapai batas kuorum 2/3 (presensi >= ceil(N * 2 / 3))",
        "Web",
        "High-priority alert bahwa syarat legal kuorum kehadiran telah terpenuhi untuk membuka sidang",
        "Kuorum Rapat",
        "Pimpinan DPRD, Fraksi, & Admin Sekretariat",
        "Kuorum Terpenuhi: {nama_rapat}",
        "Kuorum kehadiran sidang telah tercapai ({jumlah_hadir}/{total_peserta} Anggota - {persen_kehadiran}%). Sidang {nama_rapat} sah untuk dibuka dan mengambil keputusan.",
        "Layar Monitor Sidang & Detail Rapat (Web Admin)",
        "In-App Web High-Priority Alert Banner",
        'Menampilkan banner hijau "KUORUM TERPENUHI" di layar utama ruang sidang dewan.',
        'Evaluasi realtime: is_quorum_reached == true saat event presensi masuk, trigger broadcast "QUORUM_ACHIEVED".',
        'Mengubah indikator kuorum menjadi Hijau Penuh (100% legal), memunculkan tombol konfirmasi "Buka Sidang Resmi" bagi pimpinan.'
    ],
    [
        "9",
        "Waktu tersisa 15 menit sebelum jam mulai sidang, namun presensi QR masih di bawah syarat kuorum 2/3",
        "Web & Mobile",
        "Peringatan darurat kuorum belum tercapai agar petugas mengimbau anggota segera memasuki ruang sidang",
        "Kuorum Rapat",
        "Admin Sekretariat (Web) & Anggota yang Hadir tapi Belum Scan QR (Mobile)",
        "Perhatian: Kuorum {nama_rapat} Belum Terpenuhi",
        "Sidang dimulai dalam 15 menit. Kehadiran saat ini {jumlah_presensi}/{syarat_kuorum} dari total {total_peserta} anggota. Mohon anggota dewan yang berada di gedung segera melakukan scan QR presensi.",
        "Monitor Kuorum (Web) / Scan QR (Mobile)",
        "In-App Alert (Web) & Push Notification Urgen (Mobile)",
        "Mencegah penundaan pembukaan sidang akibat kekurangan kuorum dewan.",
        "Scheduled checker pada T - 15 menit jam_mulai, cek kondisi: presensi_count < ceil(N * 2 / 3).",
        "Menampilkan banner alert oranye berkedip di dashboard admin web dan push notification pengingat cepat di mobile anggota terkait."
    ],
    [
        "10",
        'Admin Sekretariat menekan tombol "Batalkan Rapat" pada status Dijadwalkan sebelum waktu mulai sidang',
        "Mobile",
        "Push notification pemberitahuan resmi bahwa rapat dibatalkan sebelum hari H",
        "Jadwal Rapat",
        "Seluruh Anggota DPRD yang terdaftar pada rapat tersebut",
        "Pemberitahuan: {nama_rapat} Dibatalkan",
        "Rapat {nama_rapat} tanggal {tanggal} telah dibatalkan oleh {dibatalkan_oleh}. Alasan: {alasan_batal}.",
        "Detail Rapat Dibatalkan (Mobile)",
        "Push Notification (FCM) & In-App Mobile",
        'Sesuai desain UI mockup tab Undangan (Card bergaris merah bl-danger). Tombol konfirmasi & presensi otomatis dinonaktifkan.',
        'Mengubah status rapat menjadi Batal, menyimpan alasan_batal, dibatalkan_oleh, dibatalkan_pada, broadcast FCM event: "MEETING_CANCELLED".',
        'Menampilkan kartu notifikasi bergaris merah (bl-danger) di tab Undangan, memindahkan rapat ke tab "Dibatalkan", dan menonaktifkan seluruh tombol aksi.'
    ],
    [
        "11",
        'Admin Sekretariat menekan tombol "Batalkan Rapat" saat sidang sedang berjalan (jam mulai <= sekarang < jam selesai) akibat kendala darurat',
        "Mobile",
        "Push notification darurat pembatalan rapat di tengah sidang berjalan (arsip presensi sah)",
        "Jadwal Rapat",
        "Seluruh Anggota DPRD peserta rapat",
        "PEMBERITAHUAN DARURAT: {nama_rapat} Dibatalkan",
        "Sidang {nama_rapat} dihentikan dan dibatalkan saat sedang berlangsung pada pukul {jam_batal} WIB. Alasan: {alasan_batal}. Data presensi anggota yang telah scan QR tetap sah tercatat sebagai arsip resmi.",
        "Detail Rapat Dibatalkan (Mobile)",
        "Push Notification (FCM) High-Priority",
        "Kasus khusus prototype (RPT-2026-007). Data presensi anggota yang telah masuk TIDAK dihapus, melainkan diarsipkan secara sah.",
        "Status rapat: Batal, isBatalSaatBerlangsung: true, kunci data presensi yang sudah masuk menjadi read-only arsip.",
        'Render badge merah "Dibatalkan", tampilkan banner keterangan penghentian sidang darurat, dan konfirmasi hijau bahwa data scan presensi anggota tetap sah tercatat.'
    ],
    [
        "12",
        "Waktu pelaksanaan rapat melewati jam selesai, status otomatis berubah menjadi Selesai dan Laporan Rekapitulasi Kehadiran resmi diterbitkan",
        "Mobile & Web",
        "Pemberitahuan bahwa rapat telah selesai dan rekapitulasi kehadiran dewan telah siap diunduh/dicetak",
        "Jadwal Rapat & Laporan",
        "Anggota DPRD Peserta Rapat (Mobile) & Sekretariat DPRD (Web)",
        "Rapat Selesai: {nama_rapat}",
        "Rapat {nama_rapat} telah selesai diselenggarakan. Laporan rekapitulasi kehadiran dan pemenuhan kuorum telah diarsipkan secara resmi oleh Sekretariat DPRD.",
        "Detail Riwayat Rapat & Laporan Rekapitulasi (Mobile & Web)",
        "In-App Mobile & Web Notification",
        'Rapat berpindah ke tab "Selesai". Tombol "Rekap Presensi" / "Laporan Rapat" aktif untuk dicetak atau diunduh.',
        "Update status rapat Selesai, kunci tabel presensi, generate snapshot arsip rekapitulasi kehadiran resmi ber-kop surat DPRD.",
        'Menampilkan badge netral abu-abu "Selesai", memunculkan tombol cetak/lihat laporan rekapitulasi kehadiran ber-kop DPRD Kota Magelang.'
    ],
    [
        "13",
        "Modul Penugasan menyetujui surat tugas anggota dewan yang waktunya beririsan dengan jadwal rapat yang telah diagendakan",
        "Web",
        "Alert sistem kepada Admin Sekretariat bahwa ada anggota rapat yang mengalami bentrok jadwal dinas",
        "Manajemen Kuorum & Penugasan",
        "Admin Sekretariat DPRD",
        "Peringatan Bentrok Jadwal: {nama_anggota}",
        "{nama_anggota} memiliki penugasan baru yang disetujui pada {tanggal} ({jam_mulai}–{jam_selesai} WIB) yang beririsan dengan jadwal {nama_rapat}. Sisa kuorum rapat kini {sisa_ruang_bentrok} anggota.",
        "Detail Jadwal Rapat - Cek Kuorum (Web Admin)",
        "In-App Web Warning Banner",
        "Berfungsi menjaga kepastian kuorum rapat sebelum hari H. Jika bentrok melebihi batas (tersedia < 2/3), muncul peringatan bahaya kuorum.",
        "Cross-check inter-modul saat penugasan.status == 'Disetujui', hitung ulang Rules.calculateQuorum().",
        "Menampilkan chip peringatan oranye pada baris peserta di web admin dan memperbarui kalkulasi kuorum."
    ],
    [
        "14",
        "Admin Sekretariat mengunggah atau memperbarui file lampiran surat undangan resmi bertandatangan Sekretaris DPRD",
        "Mobile",
        "Push notification bahwa dokumen surat undangan resmi dari Setwan telah tersedia untuk dibaca/diunduh",
        "Dokumen Undangan",
        "Seluruh Anggota DPRD Peserta Rapat",
        "Dokumen Undangan Tersedia: {nama_rapat}",
        "Sekretariat DPRD telah melampirkan Surat Undangan Resmi No. {nomor_surat} untuk {nama_rapat}. Silakan buka dokumen surat melalui aplikasi mobile.",
        "Detail Dokumen Undangan (Mobile)",
        "Push Notification (FCM) & In-App Mobile",
        "Mengarahkan anggota langsung membuka modal dokumen PDF surat undangan resmi ber-kop DPRD Kota Magelang.",
        "Event MEETING_DOCUMENT_ATTACHED, payload { meeting_id, document_url, nomor_surat }.",
        'Mengaktifkan kartu "Dokumen Undangan (Dari Setwan)" di detail rapat mobile dengan tombol "Buka Surat Undangan Resmi".'
    ]
]

# Bangun XML Worksheet
col_letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"]

# Lebar kolom yang proporsional
col_widths = [6, 36, 12, 34, 18, 28, 30, 44, 26, 24, 34, 42, 44]

sheet_xml = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>']
sheet_xml.append('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">')

# Definisi cols
sheet_xml.append('<cols>')
for idx, w in enumerate(col_widths):
    col_num = idx + 1
    sheet_xml.append(f'<col min="{col_num}" max="{col_num}" width="{w}" customWidth="1"/>')
sheet_xml.append('</cols>')

sheet_xml.append('<sheetData>')

# Baris 1: Judul Utama
sheet_xml.append('<row r="1" ht="28" customHeight="1">')
sheet_xml.append(f'<c r="A1" s="1" t="inlineStr"><is><t>MAPPING SPESIFIKASI NOTIFIKASI - MODUL RAPAT &amp; KUORUM SIDANG (e-PARLEMEN DPRD KOTA MAGELANG)</t></is></c>')
for col in col_letters[1:]:
    sheet_xml.append(f'<c r="{col}1" s="1"/>')
sheet_xml.append('</row>')

# Baris 2: Subtitle
sheet_xml.append('<row r="2" ht="20" customHeight="1">')
sheet_xml.append(f'<c r="A2" s="2" t="inlineStr"><is><t>Template Acuan Integrasi Backend (BE API &amp; FCM Push Notification) &amp; Frontend (FE Web Admin &amp; Mobile App)</t></is></c>')
for col in col_letters[1:]:
    sheet_xml.append(f'<c r="{col}2" s="2"/>')
sheet_xml.append('</row>')

# Baris 3: Pemisah kosong
sheet_xml.append('<row r="3" ht="10" customHeight="1"/>')

# Baris 4: Header Kolom (13 kolom)
sheet_xml.append('<row r="4" ht="30" customHeight="1">')
for idx, h in enumerate(headers):
    col = col_letters[idx]
    sheet_xml.append(f'<c r="{col}4" s="3" t="inlineStr"><is><t>{escape_xml(h)}</t></is></c>')
sheet_xml.append('</row>')

# Baris Data (5 s.d. 18)
for r_idx, r_data in enumerate(rows):
    row_num = r_idx + 5
    is_zebra = (r_idx % 2 == 1)
    sheet_xml.append(f'<row r="{row_num}" ht="55" customHeight="1">')
    for c_idx, val in enumerate(r_data):
        col = col_letters[c_idx]
        # Penentuan style
        if c_idx in [0, 2]: # No, Platform (Center)
            s_idx = 7 if is_zebra else 5
        else: # Left aligned
            s_idx = 6 if is_zebra else 4
        
        sheet_xml.append(f'<c r="{col}{row_num}" s="{s_idx}" t="inlineStr"><is><t>{escape_xml(val)}</t></is></c>')
    sheet_xml.append('</row>')

sheet_xml.append('</sheetData>')

# Merge Cells untuk Judul dan Subtitle
sheet_xml.append('<mergeCells count="2">')
sheet_xml.append('<mergeCell ref="A1:M1"/>')
sheet_xml.append('<mergeCell ref="A2:M2"/>')
sheet_xml.append('</mergeCells>')

sheet_xml.append('</worksheet>')

# xl/styles.xml
styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font>
      <sz val="10"/>
      <color rgb="FF1F2937"/>
      <name val="Segoe UI"/>
    </font>
    <font>
      <b/>
      <sz val="14"/>
      <color rgb="FF0F2E22"/>
      <name val="Segoe UI"/>
    </font>
    <font>
      <i/>
      <sz val="10"/>
      <color rgb="FF4B5563"/>
      <name val="Segoe UI"/>
    </font>
    <font>
      <b/>
      <sz val="10.5"/>
      <color rgb="FFFFFFFF"/>
      <name val="Segoe UI"/>
    </font>
  </fonts>
  <fills count="4">
    <fill>
      <patternFill patternType="none"/>
    </fill>
    <fill>
      <patternFill patternType="gray125"/>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF1D4A37"/>
      </patternFill>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFF4F8F5"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border>
      <left/>
      <right/>
      <top/>
      <bottom/>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="top" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="top" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="top" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>
"""

# xl/workbook.xml
workbook_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Notifikasi Rapat" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
"""

# _rels/.rels
root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
"""

# xl/_rels/workbook.xml.rels
workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""

# [Content_Types].xml
content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>
"""

output_path = "Mapping_Notifikasi_Rapat_eParlemen.xlsx"

with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", root_rels)
    z.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
    z.writestr("xl/workbook.xml", workbook_xml)
    z.writestr("xl/styles.xml", styles_xml)
    z.writestr("xl/worksheets/sheet1.xml", "".join(sheet_xml))

print(f"File berhasil dibuat: {output_path} ({os.path.getsize(output_path)} bytes)")
