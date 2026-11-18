/**
 * rules.js - e-Parlemen DPRD Kota Magelang
 * Berdasarkan TRD & API Specification Modul Jadwal & Presensi Rapat v1.1
 * Zona Waktu: Asia/Jakarta (WIB / UTC+7)
 */

(function (window) {
  'use strict';

  var Rules = {};

  // 15 Jenis Rapat Resmi DPRD Kota Magelang (15 Seeder Tetap)
  Rules.JENIS_RAPAT = [
    { code: 'PARIPURNA', name: 'Rapat Paripurna' },
    { code: 'PARIPURNA_ISTIMEWA', name: 'Rapat Paripurna Istimewa' },
    { code: 'PIMPINAN', name: 'Rapat Pimpinan DPRD' },
    { code: 'FRAKSI', name: 'Rapat Fraksi' },
    { code: 'GABUNGAN_FRAKSI', name: 'Rapat Gabungan Fraksi' },
    { code: 'BAMUS', name: 'Rapat Badan Musyawarah (Bamus)' },
    { code: 'KOMISI', name: 'Rapat Komisi' },
    { code: 'GABUNGAN_KOMISI', name: 'Rapat Gabungan Komisi' },
    { code: 'BANGGAR', name: 'Rapat Badan Anggaran (Banggar)' },
    { code: 'BAPEMPERDA', name: 'Rapat Badan Pembentukan Perda (Bapemperda)' },
    { code: 'BK', name: 'Rapat Badan Kehormatan (BK)' },
    { code: 'PANSUS', name: 'Rapat Panitia Khusus (Pansus)' },
    { code: 'PANJA', name: 'Rapat Panitia Kerja (Panja)' },
    { code: 'KONSULTASI', name: 'Rapat Konsultasi' },
    { code: 'DENGAR_PENDAPAT', name: 'Rapat Dengar Pendapat (RDP / RDPU)' }
  ];

  Rules.JENIS_RAPAT_NAMES = Rules.JENIS_RAPAT.map(function (j) { return j.name; });

  // Master Filter Unit Tipe & Unit Organisasi pada Periode Aktif
  Rules.UNIT_TYPES = [
    { code: 'ALL', name: 'Semua Unit Tipe' },
    { code: 'KOMISI', name: 'KOMISI' },
    { code: 'AKD', name: 'AKD (Alat Kelengkapan DPRD)' },
    { code: 'FRAKSI', name: 'FRAKSI' },
    { code: 'SETWAN', name: 'SETWAN' }
  ];

  Rules.ORGANIZATION_UNITS = [
    // KOMISI
    { id: 'ou-komisi-1', typeCode: 'KOMISI', code: 'KOMISI_I', name: 'Komisi I', memberRange: [1, 10] },
    { id: 'ou-komisi-2', typeCode: 'KOMISI', code: 'KOMISI_II', name: 'Komisi II', memberRange: [11, 20] },
    { id: 'ou-komisi-3', typeCode: 'KOMISI', code: 'KOMISI_III', name: 'Komisi III', memberRange: [21, 30] },
    { id: 'ou-komisi-4', typeCode: 'KOMISI', code: 'KOMISI_IV', name: 'Komisi IV', memberRange: [31, 40] },
    // AKD
    { id: 'ou-pimpinan', typeCode: 'AKD', code: 'PIMPINAN', name: 'Pimpinan DPRD', memberRange: [1, 5] },
    { id: 'ou-bamus', typeCode: 'AKD', code: 'BAMUS', name: 'Badan Musyawarah (Bamus)', memberRange: [1, 20] },
    { id: 'ou-banggar', typeCode: 'AKD', code: 'BANGGAR', name: 'Badan Anggaran (Banggar)', memberRange: [1, 25] },
    { id: 'ou-bapemperda', typeCode: 'AKD', code: 'BAPEMPERDA', name: 'Badan Pembentukan Perda (Bapemperda)', memberRange: [1, 15] },
    { id: 'ou-bk', typeCode: 'AKD', code: 'BK', name: 'Badan Kehormatan (BK)', memberRange: [6, 12] },
    { id: 'ou-pansus', typeCode: 'AKD', code: 'PANSUS', name: 'Panitia Khusus (Pansus)', memberRange: [1, 35] },
    { id: 'ou-panja', typeCode: 'AKD', code: 'PANJA', name: 'Panitia Kerja (Panja)', memberRange: [5, 18] },
    // FRAKSI
    { id: 'ou-fraksi-pdip', typeCode: 'FRAKSI', code: 'F_PDIP', name: 'Fraksi PDI Perjuangan', memberFilter: function (i) { return (i - 1) % 6 === 0; } },
    { id: 'ou-fraksi-pkb', typeCode: 'FRAKSI', code: 'F_PKB', name: 'Fraksi PKB', memberFilter: function (i) { return (i - 1) % 6 === 1; } },
    { id: 'ou-fraksi-pks', typeCode: 'FRAKSI', code: 'F_PKS', name: 'Fraksi PKS', memberFilter: function (i) { return (i - 1) % 6 === 2; } },
    { id: 'ou-fraksi-golkar', typeCode: 'FRAKSI', code: 'F_GOLKAR', name: 'Fraksi Golkar', memberFilter: function (i) { return (i - 1) % 6 === 3; } },
    { id: 'ou-fraksi-gerindra', typeCode: 'FRAKSI', code: 'F_GERINDRA', name: 'Fraksi Gerindra', memberFilter: function (i) { return (i - 1) % 6 === 4; } },
    { id: 'ou-fraksi-demokrat', typeCode: 'FRAKSI', code: 'F_DEMOKRAT', name: 'Fraksi Demokrat', memberFilter: function (i) { return (i - 1) % 6 === 5; } },
    // SETWAN & PARIPURNA (SEMUA)
    { id: 'ou-paripurna', typeCode: 'ALL', code: 'PARIPURNA', name: 'Rapat Paripurna (Semua)', memberRange: [1, 100] },
    { id: 'ou-setwan', typeCode: 'SETWAN', code: 'SETWAN', name: 'Sekretariat DPRD', memberRange: [1, 1] }
  ];

  Rules.UNIT_OPTIONS = Rules.ORGANIZATION_UNITS.map(function (ou) { return ou.name; });

  // Matriks Status: Sumber Bentrok Hard Conflict vs Warning vs Bersih
  Rules.STATUS_RULES = {
    // Penugasan (Hard Conflict jika Approved dan tidak ditolak)
    'Penugasan Disetujui': { conflict: true, warning: false, label: 'Sudah ada penugasan lain diwaktu tersebut' },
    'APPROVED': { conflict: true, warning: false, label: 'Sudah ada penugasan lain diwaktu tersebut' },
    'Penugasan Menunggu persetujuan': { conflict: false, warning: true, label: 'Penugasan Menunggu persetujuan' },
    'Penugasan Dibatalkan': { conflict: false, warning: false, label: 'Penugasan Dibatalkan (Lolos)' },
    'Penugasan Disetujui (anggota menolak)': { conflict: false, warning: false, label: 'Penugasan Disetujui (anggota menolak) (Lolos)' },

    // Rapat lain (Hard Conflict jika Submit / Dijadwalkan)
    'Rapat Submit': { conflict: true, warning: false, label: 'Sudah ada rapat lain diwaktu tersebut' },
    'Rapat Dijadwalkan': { conflict: true, warning: false, label: 'Sudah ada rapat lain diwaktu tersebut' },
    'DIJADWALKAN': { conflict: true, warning: false, label: 'Sudah ada rapat lain diwaktu tersebut' },
    'Rapat Draft': { conflict: false, warning: false, label: 'Rapat Draft (Lolos)' },
    'DRAFT': { conflict: false, warning: false, label: 'Rapat Draft (Lolos)' },
    'Rapat Cancelled': { conflict: false, warning: false, label: 'Rapat Batal (Lolos)' },
    'Rapat Batal': { conflict: false, warning: false, label: 'Rapat Batal (Lolos)' },
    'BATAL': { conflict: false, warning: false, label: 'Rapat Batal (Lolos)' },

    // Surat Masuk
    'Surat masuk': { conflict: false, warning: true, label: 'Surat masuk (Peringatan)' }
  };

  /**
   * Cek apakah status menghasilkan bentrok hard, warning, atau bersih
   */
  Rules.evaluateStatusCategory = function (status) {
    if (!status) return 'clean';
    var rule = Rules.STATUS_RULES[status];
    if (rule) {
      if (rule.conflict) return 'conflict';
      if (rule.warning) return 'warning';
      return 'clean';
    }
    var s = status.toLowerCase();
    if (s.indexOf('disetujui (anggota menolak)') !== -1 || s.indexOf('dibatalkan') !== -1 || s.indexOf('draft') !== -1 || s.indexOf('cancelled') !== -1 || s.indexOf('batal') !== -1) {
      return 'clean';
    }
    if (s.indexOf('menunggu') !== -1 || s.indexOf('surat') !== -1) {
      return 'warning';
    }
    if (s.indexOf('disetujui') !== -1 || s.indexOf('submit') !== -1 || s.indexOf('dijadwalkan') !== -1) {
      return 'conflict';
    }
    return 'clean';
  };

  /**
   * Cek irisan waktu: start_a < end_b AND end_a > start_b
   * Titik batas (jam_selesai == jam_mulai) TIDAK beririsan (LOLOS).
   */
  Rules.isTimeOverlap = function (startA, endA, startB, endB) {
    var tStartA = typeof startA === 'number' ? startA : new Date(startA).getTime();
    var tEndA = typeof endA === 'number' ? endA : new Date(endA).getTime();
    var tStartB = typeof startB === 'number' ? startB : new Date(startB).getTime();
    var tEndB = typeof endB === 'number' ? endB : new Date(endB).getTime();

    if (isNaN(tStartA) || isNaN(tEndA) || isNaN(tStartB) || isNaN(tEndB)) {
      return false;
    }

    return (tStartA < tEndB) && (tEndA > tStartB);
  };

  /**
   * Hitung Kuorum 2/3 (TRD v1.1):
   * N = Total peserta tercentang
   * Syarat Kuorum = ceil(2/3 * N)
   * Tersedia = N - Jumlah Bentrok Unik
   * Lolos = Tersedia >= Syarat Kuorum
   */
  Rules.calculateQuorum = function (N, bentrokUnik) {
    var numN = Math.max(0, parseInt(N, 10) || 0);
    var numBentrok = Math.max(0, parseInt(bentrokUnik, 10) || 0);
    var syarat = Math.ceil((numN * 2) / 3);
    var tersedia = Math.max(0, numN - numBentrok);
    var maksBolehBentrok = Math.max(0, numN - syarat);
    var sisaRuangBentrok = tersedia - syarat;
    var lolos = tersedia >= syarat;

    return {
      N: numN,
      total_invited: numN,
      syarat: syarat,
      quorum_required: syarat,
      bentrokUnik: numBentrok,
      conflict_unique_count: numBentrok,
      tersedia: tersedia,
      available_count: tersedia,
      maksBolehBentrok: maksBolehBentrok,
      sisaRuangBentrok: sisaRuangBentrok,
      lolos: lolos,
      is_quorum_met: lolos,
      statusText: lolos ? 'LOLOS' : 'GAGAL',
      banner_message: lolos
        ? 'Semua anggota rapat memenuhi kriteria 2/3 Kuorum'
        : 'Kuorum 2/3 tidak terpenuhi (Tersedia: ' + tersedia + ' dari minimal ' + syarat + ' peserta).'
    };
  };

  /**
   * Evaluasi aktivitas seorang peserta terhadap rapat yang diajukan
   */
  Rules.evaluateParticipantActivities = function (meeting, activities) {
    var result = {
      hasConflict: false,
      hasWarning: false,
      conflictType: null,
      warningType: null,
      conflictLabel: null,
      conflictDetails: [],
      warningDetails: [],
      cleanActivities: []
    };

    if (!activities || !activities.length) return result;

    var mStart = Rules.parseDateTime(meeting.tanggal, meeting.jamMulai);
    var mEnd = Rules.parseDateTime(meeting.tanggal, meeting.jamSelesai);

    for (var i = 0; i < activities.length; i++) {
      var act = activities[i];
      var actStart = typeof act.start === 'number' ? act.start : new Date(act.start).getTime();
      var actEnd = typeof act.end === 'number' ? act.end : new Date(act.end).getTime();

      var overlaps = Rules.isTimeOverlap(mStart, mEnd, actStart, actEnd);
      var category = Rules.evaluateStatusCategory(act.status);

      if (overlaps) {
        if (category === 'conflict') {
          result.hasConflict = true;
          var isMeeting = (act.sumber && act.sumber.toLowerCase().indexOf('rapat') !== -1);
          var type = isMeeting ? 'MEETING' : 'ASSIGNMENT';
          var label = isMeeting ? 'Sudah ada rapat lain diwaktu tersebut' : 'Sudah ada penugasan lain diwaktu tersebut';
          
          if (!result.conflictType) {
            result.conflictType = type;
            result.conflictLabel = label;
          }
          result.conflictDetails.push({
            sumber: act.sumber,
            judul: act.judul,
            status: act.status,
            type: type,
            keterangan: label
          });
        } else if (category === 'warning') {
          result.hasWarning = true;
          var wtype = (act.sumber && act.sumber.toLowerCase().indexOf('surat') !== -1) ? 'surat' : 'penugasan';
          if (!result.warningType) result.warningType = wtype;
          result.warningDetails.push({
            sumber: act.sumber,
            judul: act.judul,
            status: act.status,
            keterangan: 'Peringatan: ' + act.status + ' (' + (act.judul || act.sumber) + ')'
          });
        } else {
          result.cleanActivities.push(act);
        }
      } else {
        result.cleanActivities.push(act);
      }
    }

    return result;
  };

  /**
   * Menentukan status tampilan (display_status) real-time (TRD v1.1)
   * Nilai Enum DB: DRAFT, DIJADWALKAN, SELESAI, BATAL
   * display_status: DRAFT, DIJADWALKAN, BERLANGSUNG, SELESAI, BATAL
   */
  Rules.deriveDisplayStatus = function (meeting, currentTime) {
    if (!meeting) return 'DIJADWALKAN';
    var st = (meeting.status || '').toUpperCase();
    if (st === 'DRAFT') return 'DRAFT';
    if (st === 'BATAL' || st === 'CANCELLED' || st === 'DIBATALKAN') return 'BATAL';
    if (st === 'SELESAI') return 'SELESAI';

    var nowMs = typeof currentTime === 'number' ? currentTime : new Date(currentTime).getTime();
    var startMs = Rules.parseDateTime(meeting.tanggal, meeting.jamMulai);
    var endMs = Rules.parseDateTime(meeting.tanggal, meeting.jamSelesai);

    if (nowMs >= endMs) {
      return 'SELESAI';
    } else if (nowMs >= startMs) {
      return 'BERLANGSUNG';
    } else {
      return 'DIJADWALKAN';
    }
  };

  /**
   * Alias kompatibilitas UI sebelumnya:
   * Returns: 'Draft' | 'Dibatalkan' | 'Berjalan' | 'Selesai' | 'Mendatang'
   */
  Rules.deriveMeetingStatus = function (meeting, currentTime) {
    var ds = Rules.deriveDisplayStatus(meeting, currentTime);
    if (ds === 'DRAFT') return 'Draft';
    if (ds === 'BATAL') return 'Dibatalkan';
    if (ds === 'BERLANGSUNG') return 'Berjalan';
    if (ds === 'SELESAI') return 'Selesai';
    return 'Mendatang';
  };

  /**
   * Matriks Perilaku Action Button & UI Flags (TRD v1.1 Bagian 4, Hal 11-12)
   */
  Rules.getActionFlags = function (meeting, currentTime, memberPresence) {
    var displayStatus = Rules.deriveDisplayStatus(meeting, currentTime);
    var nowMs = typeof currentTime === 'number' ? currentTime : new Date(currentTime).getTime();
    var todayStr = Rules.formatDateYMD(new Date(nowMs));
    var isToday = (meeting && meeting.tanggal === todayStr);

    var flags = {
      display_status: displayStatus,
      // Web Admin Flags
      can_continue: false,
      can_delete: false,
      can_view_detail: true,
      can_cancel: false,
      show_qr: false,
      show_realtime_counter: false,
      show_report_btn: false,
      show_cancel_reason: false,
      // Mobile Flags
      can_confirm: false,
      scan_button_state: 'HIDDEN' // HIDDEN | DISABLED_NOT_TODAY | ACTIVE | ALREADY_SCANNED
    };

    if (displayStatus === 'DRAFT') {
      flags.can_continue = true;
      flags.can_delete = true;
      flags.can_view_detail = false;
      flags.can_cancel = false;
      flags.can_confirm = false;
      flags.scan_button_state = 'HIDDEN';
    } else if (displayStatus === 'DIJADWALKAN') {
      flags.can_view_detail = true;
      flags.can_cancel = true;
      flags.show_qr = true;
      flags.show_realtime_counter = true;
      flags.show_report_btn = false;

      var pres = memberPresence || {};
      flags.can_confirm = (pres.kehadiran === 'Belum konfirmasi');

      if (pres.kehadiran === 'Hadir') {
        if (!isToday) {
          flags.scan_button_state = 'DISABLED_NOT_TODAY';
        } else if (pres.presensiStatus === 'Sudah presensi') {
          flags.scan_button_state = 'ALREADY_SCANNED';
        } else {
          flags.scan_button_state = 'ACTIVE';
        }
      } else {
        flags.scan_button_state = 'HIDDEN';
      }
    } else if (displayStatus === 'BERLANGSUNG') {
      flags.can_view_detail = true;
      flags.can_cancel = true;
      flags.show_qr = true;
      flags.show_realtime_counter = true;
      flags.show_report_btn = false;

      var presB = memberPresence || {};
      flags.can_confirm = (presB.kehadiran === 'Belum konfirmasi');

      if (presB.kehadiran === 'Hadir') {
        if (presB.presensiStatus === 'Sudah presensi') {
          flags.scan_button_state = 'ALREADY_SCANNED';
        } else {
          flags.scan_button_state = 'ACTIVE';
        }
      } else {
        flags.scan_button_state = 'HIDDEN';
      }
    } else if (displayStatus === 'SELESAI') {
      flags.can_view_detail = true;
      flags.can_cancel = false;
      flags.show_qr = false;
      flags.show_report_btn = true;
      flags.can_confirm = false;
      flags.scan_button_state = 'HIDDEN';
    } else if (displayStatus === 'BATAL') {
      flags.can_view_detail = true;
      flags.can_cancel = false;
      flags.show_qr = false;
      flags.show_report_btn = true;
      flags.show_cancel_reason = true;
      flags.can_confirm = false;
      flags.scan_button_state = 'HIDDEN';
    }

    return flags;
  };

  /**
   * Validasi scan presensi QR (TRD v1.1 Hal 17-18)
   */
  Rules.validatePresenceScan = function (meeting, scanTime) {
    if (!meeting) {
      return { valid: false, message: 'QR tidak dikenali', badge: null, lateMinutes: 0 };
    }
    if (meeting.status === 'Batal' || meeting.status === 'BATAL') {
      return { valid: false, message: 'QR tidak valid (Rapat telah dibatalkan)', badge: null, lateMinutes: 0 };
    }

    var tScan = typeof scanTime === 'number' ? scanTime : new Date(scanTime).getTime();
    var scanDateStr = Rules.formatDateYMD(new Date(tScan));
    var meetingDateStr = meeting.tanggal;

    // Cek hari H
    if (scanDateStr !== meetingDateStr) {
      return {
        valid: false,
        message: 'Presensi hanya dibuka pada hari rapat',
        badge: null,
        lateMinutes: 0
      };
    }

    var startMs = Rules.parseDateTime(meeting.tanggal, meeting.jamMulai);
    var endMs = Rules.parseDateTime(meeting.tanggal, meeting.jamSelesai);

    // Cek apakah sudah lewat jam selesai rapat
    if (tScan >= endMs) {
      return {
        valid: false,
        message: 'Error: QR Kode sudah tidak valid, silahkan arahkan ke Kode yang benar',
        badge: null,
        lateMinutes: 0
      };
    }

    // Berhasil presensi
    if (tScan <= startMs) {
      return {
        valid: true,
        message: 'Selamat Anda Sudah Presensi Tepat Waktu',
        badge: 'Tepat Waktu',
        badgeClass: 'badge-success',
        punctualityLabel: 'Tepat Waktu',
        lateMinutes: 0
      };
    } else {
      var diffMs = tScan - startMs;
      var lateMin = Math.ceil(diffMs / (60 * 1000));
      return {
        valid: true,
        message: 'Presensi berhasil (Terlambat ' + lateMin + ' menit)',
        badge: 'Terlambat ' + lateMin + ' menit',
        badgeClass: 'badge-warn',
        punctualityLabel: 'Terlambat ' + lateMin + ' mnt',
        lateMinutes: lateMin
      };
    }
  };

  /**
   * Helper parse string tanggal YYYY-MM-DD dan waktu HH:mm menjadi timestamp milidetik (WIB)
   */
  Rules.parseDateTime = function (dateStr, timeStr) {
    if (!dateStr) return NaN;
    var parts = dateStr.split('-');
    if (parts.length !== 3) return NaN;
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);

    var hours = 0;
    var minutes = 0;
    if (timeStr) {
      var tparts = timeStr.split(':');
      hours = parseInt(tparts[0], 10) || 0;
      minutes = parseInt(tparts[1], 10) || 0;
    }

    return new Date(year, month, day, hours, minutes, 0, 0).getTime();
  };

  Rules.formatDateYMD = function (date) {
    var d = (date instanceof Date) ? date : new Date(date);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  };

  Rules.formatDateIndo = function (dateInput) {
    var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    var months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    var dayName = days[d.getDay()];
    var day = d.getDate();
    var monthName = months[d.getMonth()];
    var year = d.getFullYear();

    return dayName + ', ' + day + ' ' + monthName + ' ' + year;
  };

  Rules.formatTimeWIB = function (dateInput) {
    var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + '.' + m + ' WIB';
  };

  window.Rules = Rules;
})(window);
