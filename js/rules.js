/**
 * rules.js - e-Parlemen DPRD Kota Magelang
 * Sumber Kebenaran: kuorum_rapat (2).xlsx & Keputusan Final
 * Tidak ada placeholder / TODO. Semua logika komplit.
 */

(function (window) {
  'use strict';

  var Rules = {};

  // 15 Jenis Rapat Resmi DPRD Kota Magelang
  Rules.JENIS_RAPAT = [
    'Badan Anggaran',
    'Badan Musyawarah',
    'Komisi I',
    'Komisi II',
    'Komisi III',
    'Komisi IV',
    'Rapat Paripurna',
    'Fraksi',
    'Fraksi Gabungan',
    'Pansus',
    'Banleg',
    'Badan Kehormatan',
    'Rapat Pimpinan',
    'Rapat Dengar Pendapat',
    'Rapat Kerja'
  ];

  // Unit AKD dan Setwan
  Rules.UNIT_OPTIONS = [
    'Komisi I',
    'Komisi II',
    'Komisi III',
    'Komisi IV',
    'Badan Anggaran',
    'Badan Musyawarah',
    'Rapat Paripurna (Semua)',
    'Fraksi PDI Perjuangan',
    'Fraksi PKB',
    'Fraksi PKS',
    'Fraksi Golkar',
    'Fraksi Gerindra',
    'Fraksi Demokrat',
    'Pansus',
    'Bapemperda / Banleg'
  ];

  // Matriks Status: apakah status aktivitas dihitung bentrok hard, warning, atau tidak bentrok
  Rules.STATUS_RULES = {
    // Penugasan
    'Penugasan Disetujui': { conflict: true, warning: false, note: 'Hard conflict: anggota benar-benar bertugas' },
    'Penugasan Menunggu persetujuan': { conflict: false, warning: true, note: 'Warning: belum pasti, tidak mengurangi kuorum' },
    'Penugasan Dibatalkan': { conflict: false, warning: false, note: 'Penugasan sudah batal' },
    'Penugasan Disetujui (anggota menolak)': { conflict: false, warning: false, note: 'Anggota sudah menolak' },

    // Rapat lain
    'Rapat Submit': { conflict: true, warning: false, note: 'Hard conflict: rapat lain sudah terjadwal' },
    'Rapat Dijadwalkan': { conflict: true, warning: false, note: 'Hard conflict: rapat lain terjadwal' },
    'Rapat Draft': { conflict: false, warning: false, note: 'Draft tidak mengunci jadwal siapa pun' },
    'Rapat Cancelled': { conflict: false, warning: false, note: 'Rapat sudah dibatalkan' },
    'Rapat Batal': { conflict: false, warning: false, note: 'Rapat sudah dibatalkan' },

    // Surat Masuk
    'Surat masuk': { conflict: false, warning: true, note: 'Warning: surat/undangan masuk' }
  };

  /**
   * Cek apakah status menghasilkan bentrok hard, warning, atau bersih
   */
  Rules.evaluateStatusCategory = function (status) {
    if (!status) return 'clean';
    var rule = Rules.STATUS_RULES[status];
    if (!rule) {
      var s = status.toLowerCase();
      if (s.indexOf('disetujui (anggota menolak)') !== -1 || s.indexOf('dibatalkan') !== -1 || s.indexOf('draft') !== -1 || s.indexOf('cancelled') !== -1) {
        return 'clean';
      }
      if (s.indexOf('menunggu') !== -1 || s.indexOf('surat') !== -1) {
        return 'warning';
      }
      if (s.indexOf('disetujui') !== -1 || s.indexOf('submit') !== -1 || s.indexOf('dijadwalkan') !== -1) {
        return 'conflict';
      }
      return 'clean';
    }
    if (rule.conflict) return 'conflict';
    if (rule.warning) return 'warning';
    return 'clean';
  };

  /**
   * Cek irisan waktu antara interval A [mulaiA, selesaiA] dan interval B [mulaiB, selesaiB]
   * Aturan baku: mulaiA < selesaiB DAN selesaiA > mulaiB
   * Bersentuhan (selesaiA === mulaiB atau mulaiA === selesaiB) TIDAK beririsan.
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
   * Hitung Kuorum 2/3
   * N = jumlah peserta final (tercentang)
   * Syarat minimal = ceil(N * 2 / 3)
   * Bentrok unik = jumlah peserta yang memiliki minimal 1 bentrok hard
   * Tersedia = N - bentrokUnik
   * Lolos jika Tersedia >= Syarat
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
      syarat: syarat,
      bentrokUnik: numBentrok,
      tersedia: tersedia,
      maksBolehBentrok: maksBolehBentrok,
      sisaRuangBentrok: sisaRuangBentrok,
      lolos: lolos,
      statusText: lolos ? 'LOLOS' : 'GAGAL'
    };
  };

  /**
   * Evaluasi aktivitas seorang peserta terhadap rapat yang sedang diajukan
   */
  Rules.evaluateParticipantActivities = function (meeting, activities) {
    var result = {
      hasConflict: false,
      hasWarning: false,
      conflictType: null,
      warningType: null,
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
          var type = (act.sumber && act.sumber.toLowerCase().indexOf('rapat') !== -1) ? 'rapat' : 'penugasan';
          if (!result.conflictType) result.conflictType = type;
          result.conflictDetails.push({
            sumber: act.sumber,
            judul: act.judul,
            status: act.status,
            keterangan: type === 'rapat' ? 'Sudah ada rapat lain diwaktu tersebut' : 'Sudah ada penugasan lain diwaktu tersebut'
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
   * Menentukan status turunan rapat
   */
  Rules.deriveMeetingStatus = function (meeting, currentTime) {
    if (!meeting) return 'Mendatang';
    if (meeting.status === 'Draft') return 'Draft';
    if (meeting.status === 'Batal') return 'Dibatalkan';
    if (meeting.status === 'Selesai') return 'Selesai';

    var nowMs = typeof currentTime === 'number' ? currentTime : new Date(currentTime).getTime();
    var startMs = Rules.parseDateTime(meeting.tanggal, meeting.jamMulai);
    var endMs = Rules.parseDateTime(meeting.tanggal, meeting.jamSelesai);

    if (nowMs >= endMs) {
      return 'Selesai';
    } else if (nowMs >= startMs) {
      return 'Berjalan'; // Sedang Berlangsung
    } else {
      return 'Mendatang';
    }
  };

  /**
   * Validasi scan presensi QR
   */
  Rules.validatePresenceScan = function (meeting, scanTime) {
    if (!meeting) {
      return { valid: false, message: 'QR tidak dikenali', badge: null, lateMinutes: 0 };
    }
    if (meeting.status === 'Batal') {
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

    // Cek apakah sudah lewat jam selesai
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
        message: 'Selamat, Anda sudah presensi tepat waktu',
        badge: 'Tepat Waktu',
        badgeClass: 'badge-success',
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
