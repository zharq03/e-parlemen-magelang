import zipfile
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

# Data Rekap Presensi Rapat (Sesuai Screenshot User)
meeting_info = {
    "nama_rapat": "Rapat Badan Musyawarah Penetapan Jadwal Masa Sidang",
    "jenis_rapat": "Badan Musyawarah",
    "hari_tanggal": "Rabu, 18 November 2026",
    "waktu_sidang": "09:00 – 11:30 WIB",
    "lokasi": "Ruang Rapat Bamus",
    "status": "Selesai"
}

# Contoh Data Peserta mencakup berbagai kondisi kehadiran & presensi
participants_data = [
    {"no": 1, "kode": "DPRD-AGT-001", "nama": "Anggota P1", "konfirmasi": "Belum Konfirmasi", "presensi": "Tidak Presensi", "waktu": "-", "alasan": "-"},
    {"no": 2, "kode": "DPRD-AGT-002", "nama": "Anggota P2", "konfirmasi": "Belum Konfirmasi", "presensi": "Tidak Presensi", "waktu": "-", "alasan": "-"},
    {"no": 3, "kode": "DPRD-AGT-003", "nama": "Anggota P3", "konfirmasi": "Hadir", "presensi": "Tepat Waktu", "waktu": "08.52 WIB", "alasan": "Sah"},
    {"no": 4, "kode": "DPRD-AGT-004", "nama": "Anggota P4", "konfirmasi": "Hadir", "presensi": "Tepat Waktu", "waktu": "08.55 WIB", "alasan": "Sah"},
    {"no": 5, "kode": "DPRD-AGT-005", "nama": "Anggota P5", "konfirmasi": "Hadir", "presensi": "Terlambat 15 mnt", "waktu": "09.15 WIB", "alasan": "Sah"},
    {"no": 6, "kode": "DPRD-AGT-006", "nama": "Anggota P6", "konfirmasi": "Tidak Hadir", "presensi": "-", "waktu": "-", "alasan": "Tugas dinas luar daerah"},
    {"no": 7, "kode": "DPRD-AGT-007", "nama": "Anggota P7", "konfirmasi": "Hadir", "presensi": "Tepat Waktu", "waktu": "08.45 WIB", "alasan": "Sah"},
    {"no": 8, "kode": "DPRD-AGT-008", "nama": "Anggota P8", "konfirmasi": "Tidak Hadir", "presensi": "-", "waktu": "-", "alasan": "Izin sakit (Surat terlampir)"},
    {"no": 9, "kode": "DPRD-AGT-009", "nama": "Anggota P9", "konfirmasi": "Hadir", "presensi": "Terlambat 25 mnt", "waktu": "09.25 WIB", "alasan": "Sah"},
    {"no": 10, "kode": "DPRD-AGT-010", "nama": "Anggota P10", "konfirmasi": "Belum Konfirmasi", "presensi": "Tidak Presensi", "waktu": "-", "alasan": "-"},
    {"no": 11, "kode": "DPRD-AGT-011", "nama": "Anggota P11", "konfirmasi": "Hadir", "presensi": "Tepat Waktu", "waktu": "08.50 WIB", "alasan": "Sah"},
    {"no": 12, "kode": "DPRD-AGT-012", "nama": "Anggota P12", "konfirmasi": "Hadir", "presensi": "Tepat Waktu", "waktu": "08.58 WIB", "alasan": "Sah"},
    {"no": 13, "kode": "DPRD-AGT-013", "nama": "Anggota P13", "konfirmasi": "Hadir", "presensi": "Tepat Waktu", "waktu": "08.40 WIB", "alasan": "Sah"},
    {"no": 14, "kode": "DPRD-AGT-014", "nama": "Anggota P14", "konfirmasi": "Hadir", "presensi": "Terlambat 10 mnt", "waktu": "09.10 WIB", "alasan": "Sah"},
    {"no": 15, "kode": "DPRD-AGT-015", "nama": "Anggota P15", "konfirmasi": "Hadir", "presensi": "Tepat Waktu", "waktu": "08.53 WIB", "alasan": "Sah"}
]

col_letters = ["A", "B", "C", "D", "E", "F"]
col_widths = [6, 32, 22, 22, 22, 32]

sheet_xml = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>']
sheet_xml.append('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">')

# Definisi lebar kolom
sheet_xml.append('<cols>')
for idx, w in enumerate(col_widths):
    col_num = idx + 1
    sheet_xml.append(f'<col min="{col_num}" max="{col_num}" width="{w}" customWidth="1"/>')
sheet_xml.append('</cols>')

sheet_xml.append('<sheetData>')

# Baris 1: Judul Utama
sheet_xml.append('<row r="1" ht="26" customHeight="1">')
sheet_xml.append(f'<c r="A1" s="1" t="inlineStr"><is><t>LAPORAN REKAPITULASI KEHADIRAN ANGGOTA DEWAN</t></is></c>')
for c in col_letters[1:]:
    sheet_xml.append(f'<c r="{c}1" s="1"/>')
sheet_xml.append('</row>')

# Baris 2: Subtitle
sheet_xml.append('<row r="2" ht="18" customHeight="1">')
sheet_xml.append(f'<c r="A2" s="2" t="inlineStr"><is><t>Sistem Informasi e-Parlemen Manajemen Presensi &amp; Kuorum Sidang</t></is></c>')
for c in col_letters[1:]:
    sheet_xml.append(f'<c r="{c}2" s="2"/>')
sheet_xml.append('</row>')

# Baris 3: Pemisah kosong
sheet_xml.append('<row r="3" ht="10" customHeight="1"/>')

# Baris 4-6: Card Informasi Rapat (Persis gambar user)
# Baris 4: Nama Rapat & Tingkat/Jenis
sheet_xml.append('<row r="4" ht="22" customHeight="1">')
sheet_xml.append(f'<c r="A4" s="3" t="inlineStr"><is><t>Nama Rapat:</t></is></c>')
sheet_xml.append(f'<c r="B4" s="4" t="inlineStr"><is><t>{escape_xml(meeting_info["nama_rapat"])}</t></is></c>')
sheet_xml.append(f'<c r="C4" s="4"/>')
sheet_xml.append(f'<c r="D4" s="3" t="inlineStr"><is><t>Tingkat / Jenis:</t></is></c>')
sheet_xml.append(f'<c r="E4" s="5" t="inlineStr"><is><t>{escape_xml(meeting_info["jenis_rapat"])}</t></is></c>')
sheet_xml.append(f'<c r="F4" s="5"/>')
sheet_xml.append('</row>')

# Baris 5: Hari, Tanggal & Waktu Sidang
sheet_xml.append('<row r="5" ht="22" customHeight="1">')
sheet_xml.append(f'<c r="A5" s="3" t="inlineStr"><is><t>Hari, Tanggal:</t></is></c>')
sheet_xml.append(f'<c r="B5" s="4" t="inlineStr"><is><t>{escape_xml(meeting_info["hari_tanggal"])}</t></is></c>')
sheet_xml.append(f'<c r="C5" s="4"/>')
sheet_xml.append(f'<c r="D5" s="3" t="inlineStr"><is><t>Waktu Sidang:</t></is></c>')
sheet_xml.append(f'<c r="E5" s="4" t="inlineStr"><is><t>{escape_xml(meeting_info["waktu_sidang"])}</t></is></c>')
sheet_xml.append(f'<c r="F5" s="4"/>')
sheet_xml.append('</row>')

# Baris 6: Lokasi & Status Penyelenggaraan
sheet_xml.append('<row r="6" ht="22" customHeight="1">')
sheet_xml.append(f'<c r="A6" s="3" t="inlineStr"><is><t>Lokasi:</t></is></c>')
sheet_xml.append(f'<c r="B6" s="4" t="inlineStr"><is><t>{escape_xml(meeting_info["lokasi"])}</t></is></c>')
sheet_xml.append(f'<c r="C6" s="4"/>')
sheet_xml.append(f'<c r="D6" s="3" t="inlineStr"><is><t>Status Penyelenggaraan:</t></is></c>')
sheet_xml.append(f'<c r="E6" s="5" t="inlineStr"><is><t>{escape_xml(meeting_info["status"])}</t></is></c>')
sheet_xml.append(f'<c r="F6" s="5"/>')
sheet_xml.append('</row>')

# Baris 7: Pemisah kosong
sheet_xml.append('<row r="7" ht="14" customHeight="1"/>')

# Baris 8: Section Title (Rincian Kehadiran & Presensi Anggota Dewan:)
sheet_xml.append('<row r="8" ht="22" customHeight="1">')
sheet_xml.append(f'<c r="A8" s="6" t="inlineStr"><is><t>Rincian Kehadiran &amp; Presensi Anggota Dewan:</t></is></c>')
for c in col_letters[1:]:
    sheet_xml.append(f'<c r="{c}8" s="6"/>')
sheet_xml.append('</row>')

# Baris 9: Table Header (6 Kolom Persis Screenshot)
table_headers = [
    "No",
    "Kode & Nama Anggota",
    "Konfirmasi Hadir",
    "Status Presensi QR",
    "Waktu Presensi (WIB)",
    "Keterangan / Alasan"
]
sheet_xml.append('<row r="9" ht="28" customHeight="1">')
for idx, h in enumerate(table_headers):
    c = col_letters[idx]
    sheet_xml.append(f'<c r="{c}9" s="7" t="inlineStr"><is><t>{escape_xml(h)}</t></is></c>')
sheet_xml.append('</row>')

# Baris 10 dst: Data Peserta
for r_idx, item in enumerate(participants_data):
    row_num = r_idx + 10
    is_zebra = (r_idx % 2 == 1)
    
    # Styles:
    # 8 = data center, 9 = data left (nama/kode), 10 = data left (keterangan)
    # 11, 12, 13 = zebra versions
    s_center = 11 if is_zebra else 8
    s_name   = 12 if is_zebra else 9
    s_desc   = 13 if is_zebra else 10

    # Teks nama & kode 2 baris
    combined_name = f"{item['nama']}\n{item['kode']}"
    
    sheet_xml.append(f'<row r="{row_num}" ht="38" customHeight="1">')
    # Col A: No
    sheet_xml.append(f'<c r="A{row_num}" s="{s_center}" t="inlineStr"><is><t>{item["no"]}</t></is></c>')
    # Col B: Kode & Nama Anggota
    sheet_xml.append(f'<c r="B{row_num}" s="{s_name}" t="inlineStr"><is><t>{escape_xml(combined_name)}</t></is></c>')
    # Col C: Konfirmasi Hadir
    sheet_xml.append(f'<c r="C{row_num}" s="{s_center}" t="inlineStr"><is><t>{escape_xml(item["konfirmasi"])}</t></is></c>')
    # Col D: Status Presensi QR
    sheet_xml.append(f'<c r="D{row_num}" s="{s_center}" t="inlineStr"><is><t>{escape_xml(item["presensi"])}</t></is></c>')
    # Col E: Waktu Presensi (WIB)
    sheet_xml.append(f'<c r="E{row_num}" s="{s_center}" t="inlineStr"><is><t>{escape_xml(item["waktu"])}</t></is></c>')
    # Col F: Keterangan / Alasan
    sheet_xml.append(f'<c r="F{row_num}" s="{s_desc}" t="inlineStr"><is><t>{escape_xml(item["alasan"])}</t></is></c>')
    sheet_xml.append('</row>')

sheet_xml.append('</sheetData>')

# Merge Cells
sheet_xml.append('<mergeCells count="8">')
sheet_xml.append('<mergeCell ref="A1:F1"/>')
sheet_xml.append('<mergeCell ref="A2:F2"/>')
sheet_xml.append('<mergeCell ref="B4:C4"/>')
sheet_xml.append('<mergeCell ref="E4:F4"/>')
sheet_xml.append('<mergeCell ref="B5:C5"/>')
sheet_xml.append('<mergeCell ref="E5:F5"/>')
sheet_xml.append('<mergeCell ref="B6:C6"/>')
sheet_xml.append('<mergeCell ref="E6:F6"/>')
sheet_xml.append('</mergeCells>')

sheet_xml.append('</worksheet>')

# xl/styles.xml
styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
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
      <sz val="9.5"/>
      <color rgb="FF6B7280"/>
      <name val="Segoe UI"/>
    </font>
    <font>
      <b/>
      <sz val="10"/>
      <color rgb="FF111827"/>
      <name val="Segoe UI"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FF0F2E22"/>
      <name val="Segoe UI"/>
    </font>
  </fonts>
  <fills count="5">
    <fill>
      <patternFill patternType="none"/>
    </fill>
    <fill>
      <patternFill patternType="gray125"/>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFF7F6F2"/>
      </patternFill>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFFAFAF8"/>
      </patternFill>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFF9F8F5"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="3">
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
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="14">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: Judul Utama -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 2: Subtitle -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 3: Meta Label (Nama Rapat, dll) -->
    <xf numFmtId="0" fontId="3" fillId="4" borderId="2" xfId="0">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 4: Meta Value Bold -->
    <xf numFmtId="0" fontId="4" fillId="4" borderId="2" xfId="0">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 5: Meta Value Badge Center -->
    <xf numFmtId="0" fontId="4" fillId="4" borderId="2" xfId="0">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 6: Section Title -->
    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 7: Table Header (Cream Background #F7F6F2) -->
    <xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 8: Data Center Regular -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 9: Data Left Bold (Nama Anggota) -->
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- 10: Data Left Regular (Keterangan) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- 11: Data Center Zebra -->
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 12: Data Left Bold Zebra -->
    <xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- 13: Data Left Regular Zebra -->
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>
"""

workbook_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Rekap Presensi Rapat" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
"""

root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
"""

workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""

content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>
"""

output_path = "Template_Rekapitulasi_Presensi_Rapat.xlsx"

with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", root_rels)
    z.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
    z.writestr("xl/workbook.xml", workbook_xml)
    z.writestr("xl/styles.xml", styles_xml)
    z.writestr("xl/worksheets/sheet1.xml", "".join(sheet_xml))

print(f"File template berhasil dibuat: {output_path} ({os.path.getsize(output_path)} bytes)")
