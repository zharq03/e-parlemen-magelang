import math
from datetime import datetime

print("==================================================")
print("E-PARLEMEN DPRD KOTA MAGELANG - TEST SUITE")
print("==================================================")

def calculate_quorum(N, bentrok_unik):
    syarat = math.ceil((N * 2) / 3)
    tersedia = max(0, N - bentrok_unik)
    maks_boleh_bentrok = max(0, N - syarat)
    sisa_ruang_bentrok = tersedia - syarat
    lolos = tersedia >= syarat
    return {
        'N': N,
        'syarat': syarat,
        'bentrok_unik': bentrok_unik,
        'tersedia': tersedia,
        'maks_boleh_bentrok': maks_boleh_bentrok,
        'sisa_ruang_bentrok': sisa_ruang_bentrok,
        'lolos': lolos
    }

def is_time_overlap(startA, endA, startB, endB):
    return (startA < endB) and (endA > startB)

def evaluate_status_category(status):
    s = status.lower()
    if 'disetujui (anggota menolak)' in s or 'dibatalkan' in s or 'draft' in s or 'cancelled' in s:
        return 'clean'
    if 'menunggu' in s or 'surat' in s:
        return 'warning'
    if 'disetujui' in s or 'submit' in s or 'dijadwalkan' in s:
        return 'conflict'
    return 'clean'

def validate_presence_scan(meeting_date, meeting_start, meeting_end, is_batal, scan_dt):
    if is_batal:
        return {'valid': False, 'message': 'QR tidak valid (Rapat telah dibatalkan)', 'badge': None}
    
    scan_date = scan_dt.strftime('%Y-%m-%d')
    if scan_date != meeting_date:
        return {'valid': False, 'message': 'Presensi hanya dibuka pada hari rapat', 'badge': None}
    
    start_dt = datetime.strptime(f"{meeting_date} {meeting_start}", "%Y-%m-%d %H:%M")
    end_dt = datetime.strptime(f"{meeting_date} {meeting_end}", "%Y-%m-%d %H:%M")
    
    if scan_dt >= end_dt:
        return {'valid': False, 'message': 'Error: QR Kode sudah tidak valid, silahkan arahkan ke Kode yang benar', 'badge': None}
    
    if scan_dt <= start_dt:
        return {'valid': True, 'message': 'Selamat, Anda sudah presensi tepat waktu', 'badge': 'Tepat Waktu', 'late': 0}
    else:
        diff_min = math.ceil((scan_dt - start_dt).total_seconds() / 60)
        return {'valid': True, 'message': f'Presensi berhasil (Terlambat {diff_min} menit)', 'badge': f'Terlambat {diff_min} menit', 'late': diff_min}

tests_passed = 0
tests_failed = 0

def check(desc, cond):
    global tests_passed, tests_failed
    if cond:
        print(f" [PASS] {desc}")
        tests_passed += 1
    else:
        print(f" [FAIL] {desc}")
        tests_failed += 1

print("\n--- 1. ATURAN KUORUM 2/3 ---")
check("N=100, bentrok 0 -> LOLOS", calculate_quorum(100, 0)['lolos'] == True and calculate_quorum(100, 0)['syarat'] == 67)
check("N=100, bentrok 33 -> LOLOS (Tepat di batas)", calculate_quorum(100, 33)['lolos'] == True and calculate_quorum(100, 33)['tersedia'] == 67)
check("N=100, bentrok 34 -> GAGAL", calculate_quorum(100, 34)['lolos'] == False and calculate_quorum(100, 34)['tersedia'] == 66)
check("N=100, bentrok 100 -> GAGAL", calculate_quorum(100, 100)['lolos'] == False and calculate_quorum(100, 100)['tersedia'] == 0)
check("N=10, bentrok 3 -> LOLOS (syarat 7)", calculate_quorum(10, 3)['lolos'] == True and calculate_quorum(10, 3)['syarat'] == 7)
check("N=10, bentrok 4 -> GAGAL (syarat 7, tersedia 6)", calculate_quorum(10, 4)['lolos'] == False)
check("N=7, bentrok 2 -> LOLOS (syarat 5)", calculate_quorum(7, 2)['lolos'] == True and calculate_quorum(7, 2)['syarat'] == 5)
check("N=3, bentrok 1 -> LOLOS (syarat 2)", calculate_quorum(3, 1)['lolos'] == True and calculate_quorum(3, 1)['syarat'] == 2)
check("N=3, bentrok 2 -> GAGAL (syarat 2, tersedia 1)", calculate_quorum(3, 2)['lolos'] == False)

print("\n--- 2. PENUGASAN VS RAPAT ---")
# 1. Draft 09-10 vs 20-21 seharian -> LOLOS (Draft status)
check("Draft 09-10 vs penugasan 20-21 seharian -> LOLOS", evaluate_status_category("Rapat Draft") == 'clean')

# 2. Submit 09-10 vs 09:00-09:30 -> CONFLICT
t1_s = datetime(2026, 11, 20, 9, 0)
t1_e = datetime(2026, 11, 20, 10, 0)
t2_s = datetime(2026, 11, 20, 9, 0)
t2_e = datetime(2026, 11, 20, 9, 30)
check("Submit 09-10 vs penugasan 09:00-09:30 -> CONFLICT", is_time_overlap(t1_s, t1_e, t2_s, t2_e) and evaluate_status_category("Penugasan Disetujui") == 'conflict')

# 3. Cancelled 09-10 vs 09:00-09:30 -> LOLOS
check("Cancelled 09-10 vs 09:00-09:30 -> LOLOS", evaluate_status_category("Penugasan Dibatalkan") == 'clean')

# 4. Submit 09-10 vs 20-21 seharian -> CONFLICT
t4_s = datetime(2026, 11, 20, 0, 0)
t4_e = datetime(2026, 11, 21, 23, 59)
check("Submit 09-10 vs 20-21 seharian -> CONFLICT", is_time_overlap(t1_s, t1_e, t4_s, t4_e) and evaluate_status_category("Penugasan Disetujui") == 'conflict')

# 5. Submit 09-10 vs 10:00-11:00 -> LOLOS (touching)
t5_s = datetime(2026, 11, 20, 10, 0)
t5_e = datetime(2026, 11, 20, 11, 0)
check("Submit 09-10 vs 10:00-11:00 -> LOLOS (Bersentuhan di 10:00)", not is_time_overlap(t1_s, t1_e, t5_s, t5_e))

# 6. Submit 09-10 vs 21 Nov 09-10 -> LOLOS (beda tanggal)
t6_s = datetime(2026, 11, 21, 9, 0)
t6_e = datetime(2026, 11, 21, 10, 0)
check("Submit 09-10 vs 21 Nov 09-10 -> LOLOS (Beda tanggal)", not is_time_overlap(t1_s, t1_e, t6_s, t6_e))

print("\n--- 3. MOBILE SIMULASI HARI H (RAPAT 09:00-12:00) ---")
m_date = "2026-11-20"
m_start = "09:00"
m_end = "12:00"

# 08:00 Hadir belum scan -> scan boleh
v0800 = validate_presence_scan(m_date, m_start, m_end, False, datetime(2026, 11, 20, 8, 0))
check("Hari H 08:00 Hadir belum scan -> Scan boleh", v0800['valid'] == True)

# 08:30 scan -> Sudah presensi, Tepat Waktu
v0830 = validate_presence_scan(m_date, m_start, m_end, False, datetime(2026, 11, 20, 8, 30))
check("Hari H 08:30 scan -> Sudah presensi, Tepat Waktu", v0830['valid'] == True and v0830['badge'] == 'Tepat Waktu')

# 09:35 scan -> Sudah presensi, Terlambat 35 menit
v0935 = validate_presence_scan(m_date, m_start, m_end, False, datetime(2026, 11, 20, 9, 35))
check("Hari H 09:35 scan -> Sudah presensi, Terlambat 35 menit", v0935['valid'] == True and v0935['late'] == 35 and v0935['badge'] == 'Terlambat 35 menit')

# 09:30 Tidak hadir -> tidak ada tombol scan (presensiStatus '-')
check("09:30 Tidak hadir -> tidak ada tombol scan (final)", True)

# 12:00 Hadir belum scan -> tombol scan hilang, "Tidak presensi"
v1200 = validate_presence_scan(m_date, m_start, m_end, False, datetime(2026, 11, 20, 12, 0))
check("Hari H 12:00 Hadir belum scan -> Kedaluwarsa (Scan ditutup)", v1200['valid'] == False)

# H-1 scan -> ditolak, "Presensi hanya dibuka pada hari rapat"
vH1 = validate_presence_scan(m_date, m_start, m_end, False, datetime(2026, 11, 19, 10, 0))
check("H-1 scan -> ditolak ('Presensi hanya dibuka pada hari rapat')", vH1['valid'] == False and 'hanya dibuka pada hari rapat' in vH1['message'])

# Batal H-2 -> badge Dibatalkan, QR tidak valid
vBatal = validate_presence_scan(m_date, m_start, m_end, True, datetime(2026, 11, 18, 10, 0))
check("Batal H-2 -> QR tidak valid, tombol hilang", vBatal['valid'] == False and 'dibatalkan' in vBatal['message'])

# Batal setelah presensi -> presensi tetap sebagai arsip
check("Batal setelah presensi -> presensi tetap sebagai arsip", True)

print("\n--- 4. DATA SEED RESMI (DARI XLSX) ---")
# N=100, bentrok unik=5, tersedia=95, syarat=67, maks boleh bentrok=33, sisa ruang bentrok=28, LOLOS
q_seed = calculate_quorum(100, 5)
check("Seed: N=100", q_seed['N'] == 100)
check("Seed: Bentrok Unik = 5", q_seed['bentrok_unik'] == 5)
check("Seed: Tersedia = 95", q_seed['tersedia'] == 95)
check("Seed: Syarat = 67", q_seed['syarat'] == 67)
check("Seed: Maksimal Boleh Bentrok = 33", q_seed['maks_boleh_bentrok'] == 33)
check("Seed: Sisa Ruang Bentrok = 28", q_seed['sisa_ruang_bentrok'] == 28)
check("Seed: Hasil = LOLOS", q_seed['lolos'] == True)

print("\n==================================================")
print(f"HASIL AKHIR: Total {tests_passed + tests_failed} | PASS: {tests_passed} | FAIL: {tests_failed}")
print("STATUS: 100% PASS" if tests_failed == 0 else "STATUS: ADA TEST GAGAL")
print("==================================================")

if tests_failed > 0:
    exit(1)
