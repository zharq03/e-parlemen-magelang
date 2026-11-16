/**
 * store.js - e-Parlemen DPRD Kota Magelang
 * State Management berbasis localStorage dengan sinkronisasi antar-tab
 * Menyediakan filter peserta berdasarkan unit/komisi, sample demo padat,
 * dokumen surat undangan, dan pelacakan status Sedang Berlangsung.
 */

(function (window) {
  'use strict';

  var Store = {};

  var KEYS = {
    TIME: 'epar_current_time',
    CURRENT_MEMBER: 'epar_current_member',
    MEETINGS: 'epar_meetings',
    MEMBERS: 'epar_members',
    ACTIVITIES: 'epar_activities',
    PRESENCES: 'epar_presences',
    NOTIFICATIONS: 'epar_notifications',
    REPORTS: 'epar_reports',
    CANCELED_CODES: 'epar_canceled_codes'
  };

  // Default simulated time: 20 November 2026, 08:30 WIB
  var DEFAULT_SIMULATED_TIME = '2026-11-20T08:30:00';

  /**
   * Mengambil waktu simulasi sekarang
   */
  Store.now = function () {
    var stored = localStorage.getItem(KEYS.TIME);
    if (!stored) {
      stored = DEFAULT_SIMULATED_TIME;
      localStorage.setItem(KEYS.TIME, stored);
    }
    var d = new Date(stored);
    if (isNaN(d.getTime())) {
      d = new Date(DEFAULT_SIMULATED_TIME);
    }
    return d;
  };

  /**
   * Mengatur waktu simulasi sekarang
   */
  Store.setTime = function (dateInput) {
    var d;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
      d = new Date(dateInput);
    }
    if (!d || isNaN(d.getTime())) {
      d = new Date(DEFAULT_SIMULATED_TIME);
    }

    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    var s = String(d.getSeconds()).padStart(2, '0');
    var isoStr = y + '-' + m + '-' + day + 'T' + h + ':' + min + ':' + s;

    localStorage.setItem(KEYS.TIME, isoStr);
    Store.autoUpdateMeetingStatuses();
    Store.checkHMinus1Reminders();
    Store.notifyChange('time');
  };

  Store.resetTime = function () {
    Store.setTime(DEFAULT_SIMULATED_TIME);
  };

  Store.getCurrentMemberId = function () {
    return localStorage.getItem(KEYS.CURRENT_MEMBER) || 'P1';
  };

  Store.setCurrentMemberId = function (memberId) {
    localStorage.setItem(KEYS.CURRENT_MEMBER, memberId);
    Store.notifyChange('current_member');
  };

  function getJSON(key, defaultVal) {
    try {
      var item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultVal;
    } catch (e) {
      console.error('Error parsing localStorage key ' + key, e);
      return defaultVal;
    }
  }

  function setJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error('Error saving localStorage key ' + key, e);
    }
  }

  Store.notifyChange = function (type, detail) {
    var event = new CustomEvent('epar-store-changed', {
      detail: { type: type, data: detail, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  };

  window.addEventListener('storage', function (e) {
    if (e.key && e.key.indexOf('epar_') === 0) {
      Store.notifyChange('sync', { key: e.key });
    }
  });

  /**
   * Mengambil semua anggota
   */
  Store.getMembers = function () {
    return getJSON(KEYS.MEMBERS, []);
  };

  Store.getMemberById = function (memberId) {
    var members = Store.getMembers();
    for (var i = 0; i < members.length; i++) {
      if (members[i].id === memberId) return members[i];
    }
    return null;
  };

  /**
   * Kurasi Anggota P1 - P10 untuk Kemudahan Demo Mobile & Penjelasan Kasus
   */
  Store.getCuratedDemoMembers = function () {
    return [
      { id: 'P1', tag: 'Penugasan Luar Kota (Bentrok Penuh)' },
      { id: 'P2', tag: 'Penugasan 08:00-09:30 (Bentrok Irisan Waktu)' },
      { id: 'P3', tag: 'Hadir & Sudah Presensi QR (Tepat Waktu)' },
      { id: 'P4', tag: 'Hadir & Belum Scan QR (Siap Scan Hari H)' },
      { id: 'P5', tag: 'Penugasan 12:30-14:00 (Tidak Bentrok)' },
      { id: 'P6', tag: 'Penugasan Pending (Peringatan Warning)' },
      { id: 'P7', tag: 'Tidak Hadir (Alasan Final / Tombol Scan Hilang)' },
      { id: 'P8', tag: 'Penugasan Dibatalkan (Jadwal Bersih)' },
      { id: 'P9', tag: 'Bentrok Rapat Lain 10:00-11:00 (Submit)' },
      { id: 'P10', tag: 'Belum Konfirmasi Kehadiran (Ada Opsi Hadir/Tidak)' }
    ];
  };

  /**
   * Mengambil anggota berdasarkan unit yang dipilih
   * Contoh: Komisi I hanya 10 orang, Komisi II 10 orang, Badan Anggaran 25 orang, Paripurna 100 orang.
   */
  Store.getMembersByUnits = function (unitNames) {
    var all = Store.getMembers();
    if (!unitNames || unitNames.length === 0) return all;

    var isParipurna = false;
    for (var u = 0; u < unitNames.length; u++) {
      if (unitNames[u].indexOf('Paripurna') !== -1 || unitNames[u] === 'Semua Anggota') {
        isParipurna = true;
        break;
      }
    }
    if (isParipurna) return all;

    var matchedIds = {};
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      for (var j = 0; j < unitNames.length; j++) {
        var un = unitNames[j];
        if (m.komisi === un || m.unit === un || m.fraksi === un) {
          matchedIds[m.id] = true;
          break;
        }
        // Unit Banggar: P1-P25
        if (un === 'Badan Anggaran' && parseInt(m.id.replace('P', ''), 10) <= 25) {
          matchedIds[m.id] = true;
          break;
        }
        // Unit Bamus: P1-P20
        if (un === 'Badan Musyawarah' && parseInt(m.id.replace('P', ''), 10) <= 20) {
          matchedIds[m.id] = true;
          break;
        }
      }
    }

    var result = all.filter(function (m) { return !!matchedIds[m.id]; });
    return result.length > 0 ? result : all.slice(0, 10);
  };

  Store.getActivities = function () {
    return getJSON(KEYS.ACTIVITIES, {});
  };

  Store.getActivitiesForMember = function (memberId) {
    var acts = Store.getActivities();
    return acts[memberId] || [];
  };

  Store.getMeetings = function () {
    return getJSON(KEYS.MEETINGS, []);
  };

  Store.getMeetingById = function (id) {
    var meetings = Store.getMeetings();
    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].id === id) return meetings[i];
    }
    return null;
  };

  Store.isMeetingCodeTaken = function (code, excludeId) {
    var normCode = (code || '').trim().toUpperCase();
    var meetings = Store.getMeetings();
    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].id !== excludeId && (meetings[i].kodeRapat || '').trim().toUpperCase() === normCode) {
        return true;
      }
    }
    var canceledCodes = getJSON(KEYS.CANCELED_CODES, []);
    for (var j = 0; j < canceledCodes.length; j++) {
      if (canceledCodes[j].toUpperCase() === normCode) {
        return true;
      }
    }
    return false;
  };

  Store.saveMeeting = function (meeting) {
    var meetings = Store.getMeetings();
    var nowWIB = Rules.formatDateIndo(Store.now()) + ', ' + Rules.formatTimeWIB(Store.now());

    if (!meeting.id) {
      meeting.id = 'rpt-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      meeting.createdAt = nowWIB;
    }
    meeting.updatedAt = nowWIB;

    // Dokumen surat undangan default jika ada lampiran
    if (!meeting.dokumenUndangan) {
      meeting.dokumenUndangan = {
        nomorSurat: '005/UND/DPRD/XI/2026',
        perihal: 'Undangan ' + meeting.namaRapat,
        tanggalSurat: meeting.tanggal,
        penandatangan: 'Sekretaris DPRD Kota Magelang',
        nip: '19750812 199803 1 004'
      };
    }

    var index = -1;
    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].id === meeting.id) {
        index = i;
        break;
      }
    }

    if (index >= 0) {
      meetings[index] = meeting;
    } else {
      meetings.unshift(meeting);
    }

    setJSON(KEYS.MEETINGS, meetings);

    if (meeting.status === 'Dijadwalkan') {
      Store.addNotification({
        type: 'rapat_dijadwalkan',
        category: 'Undangan',
        title: 'Undangan Rapat Baru: ' + meeting.namaRapat,
        message: 'Rapat ' + meeting.namaRapat + ' telah dijadwalkan pada ' + Rules.formatDateIndo(new Date(meeting.tanggal)) + ' pukul ' + meeting.jamMulai + '–' + meeting.jamSelesai + ' WIB di ' + (meeting.lokasi || 'DPRD Kota Magelang') + '.',
        meetingId: meeting.id,
        memberIds: meeting.peserta || []
      });
    }

    Store.notifyChange('meeting_saved', meeting);
    return meeting;
  };

  Store.deleteMeeting = function (meetingId) {
    var meetings = Store.getMeetings();
    var filtered = [];
    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].id !== meetingId) {
        filtered.push(meetings[i]);
      }
    }
    setJSON(KEYS.MEETINGS, filtered);
    Store.notifyChange('meeting_deleted', { id: meetingId });
  };

  Store.cancelMeeting = function (meetingId, reason, canceledBy) {
    var meetings = Store.getMeetings();
    var canceledMeeting = null;
    var nowWIB = Rules.formatDateIndo(Store.now()) + ', ' + Rules.formatTimeWIB(Store.now());

    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].id === meetingId) {
        var wasOngoing = (Rules.deriveMeetingStatus(meetings[i], Store.now()) === 'Berjalan');
        meetings[i].status = 'Batal';
        meetings[i].isBatalSaatBerlangsung = wasOngoing;
        meetings[i].alasanBatal = reason || 'Dibatalkan oleh admin sekretariat';
        meetings[i].dibatalkanOleh = canceledBy || 'Admin Sekretariat';
        meetings[i].dibatalkanPada = nowWIB;
        canceledMeeting = meetings[i];

        if (meetings[i].kodeRapat) {
          var canceledCodes = getJSON(KEYS.CANCELED_CODES, []);
          if (canceledCodes.indexOf(meetings[i].kodeRapat) === -1) {
            canceledCodes.push(meetings[i].kodeRapat);
            setJSON(KEYS.CANCELED_CODES, canceledCodes);
          }
        }
        break;
      }
    }

    if (canceledMeeting) {
      setJSON(KEYS.MEETINGS, meetings);

      Store.addNotification({
        type: 'rapat_dibatalkan',
        category: 'Undangan',
        title: 'Pemberitahuan: Rapat Dibatalkan',
        message: 'Rapat ' + canceledMeeting.namaRapat + ' yang dijadwalkan pada ' + Rules.formatDateIndo(new Date(canceledMeeting.tanggal)) + ' telah DIBATALKAN oleh ' + (canceledMeeting.dibatalkanOleh || 'Admin Sekretariat') + '. Alasan: ' + canceledMeeting.alasanBatal,
        meetingId: canceledMeeting.id,
        memberIds: canceledMeeting.peserta || []
      });

      Store.notifyChange('meeting_canceled', canceledMeeting);
    }

    return canceledMeeting;
  };

  Store.getPresences = function () {
    return getJSON(KEYS.PRESENCES, {});
  };

  Store.getPresenceForMeeting = function (meetingId) {
    var presences = Store.getPresences();
    return presences[meetingId] || {};
  };

  Store.getPresence = function (meetingId, memberId) {
    var map = Store.getPresenceForMeeting(meetingId);
    return map[memberId] || {
      kehadiran: 'Belum konfirmasi',
      presensiStatus: 'Belum presensi',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: '',
      badge: null,
      lateMinutes: 0
    };
  };

  Store.setAttendance = function (meetingId, memberId, response, reason) {
    var presences = Store.getPresences();
    if (!presences[meetingId]) {
      presences[meetingId] = {};
    }

    var current = presences[meetingId][memberId] || {
      kehadiran: 'Belum konfirmasi',
      presensiStatus: 'Belum presensi',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: '',
      badge: null,
      lateMinutes: 0
    };

    if (current.kehadiran === 'Tidak hadir') {
      return { success: false, message: 'Status konfirmasi Tidak hadir bersifat final.' };
    }

    current.kehadiran = response;
    if (response === 'Tidak hadir') {
      current.alasanTidakHadir = (reason || '').trim();
      current.presensiStatus = '-';
    } else if (response === 'Hadir') {
      if (current.presensiStatus === '-') {
        current.presensiStatus = 'Belum presensi';
      }
    }

    presences[meetingId][memberId] = current;
    setJSON(KEYS.PRESENCES, presences);
    Store.notifyChange('attendance_updated', { meetingId: meetingId, memberId: memberId, data: current });
    return { success: true, data: current };
  };

  Store.recordPresence = function (meetingId, memberId, scanTime) {
    var meeting = Store.getMeetingById(meetingId);
    if (!meeting) {
      return { success: false, message: 'Rapat tidak ditemukan' };
    }

    var validation = Rules.validatePresenceScan(meeting, scanTime);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    var presences = Store.getPresences();
    if (!presences[meetingId]) {
      presences[meetingId] = {};
    }

    var current = presences[meetingId][memberId] || {
      kehadiran: 'Hadir',
      presensiStatus: 'Belum presensi',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: '',
      badge: null,
      lateMinutes: 0
    };

    var tScan = typeof scanTime === 'number' ? scanTime : new Date(scanTime).getTime();
    var dScan = new Date(tScan);
    var timeStr = Rules.formatTimeWIB(dScan);

    current.kehadiran = 'Hadir';
    current.presensiStatus = 'Sudah presensi';
    current.waktuPresensi = tScan;
    current.waktuPresensiStr = timeStr;
    current.badge = validation.badge;
    current.badgeClass = validation.badgeClass;
    current.lateMinutes = validation.lateMinutes;

    presences[meetingId][memberId] = current;
    setJSON(KEYS.PRESENCES, presences);

    Store.notifyChange('presence_recorded', { meetingId: meetingId, memberId: memberId, data: current });
    return {
      success: true,
      message: validation.message,
      timeStr: timeStr,
      badge: validation.badge,
      badgeClass: validation.badgeClass,
      data: current
    };
  };

  Store.getNotifications = function (memberId) {
    var notifs = getJSON(KEYS.NOTIFICATIONS, []);
    if (!memberId) return notifs;
    return notifs.filter(function (n) {
      return !n.memberIds || n.memberIds.length === 0 || n.memberIds.indexOf(memberId) !== -1;
    });
  };

  Store.addNotification = function (notif) {
    var notifs = getJSON(KEYS.NOTIFICATIONS, []);
    var nowWIB = Rules.formatDateIndo(Store.now()) + ', ' + Rules.formatTimeWIB(Store.now());
    var item = {
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      type: notif.type || 'info',
      category: notif.category || 'Undangan',
      title: notif.title || 'Notifikasi',
      message: notif.message || '',
      dateStr: nowWIB,
      timestamp: Store.now().getTime(),
      readBy: [],
      meetingId: notif.meetingId || null,
      memberIds: notif.memberIds || []
    };
    notifs.unshift(item);
    setJSON(KEYS.NOTIFICATIONS, notifs);
    Store.notifyChange('notification_added', item);
    return item;
  };

  Store.markAllNotificationsRead = function (memberId) {
    var notifs = getJSON(KEYS.NOTIFICATIONS, []);
    for (var i = 0; i < notifs.length; i++) {
      if (notifs[i].readBy.indexOf(memberId) === -1) {
        notifs[i].readBy.push(memberId);
      }
    }
    setJSON(KEYS.NOTIFICATIONS, notifs);
    Store.notifyChange('notifications_read', { memberId: memberId });
  };

  Store.getReport = function (meetingId) {
    var reports = getJSON(KEYS.REPORTS, {});
    return reports[meetingId] || null;
  };

  Store.saveReport = function (meetingId, reportText, reporter) {
    var reports = getJSON(KEYS.REPORTS, {});
    var nowWIB = Rules.formatDateIndo(Store.now()) + ', ' + Rules.formatTimeWIB(Store.now());
    reports[meetingId] = {
      meetingId: meetingId,
      text: reportText,
      reporter: reporter || 'Admin Sekretariat',
      updatedAt: nowWIB
    };
    setJSON(KEYS.REPORTS, reports);
    Store.notifyChange('report_saved', reports[meetingId]);
    return reports[meetingId];
  };

  Store.generateQRToken = function (meeting) {
    if (!meeting || meeting.status === 'Batal') return null;
    var expMs = Rules.parseDateTime(meeting.tanggal, meeting.jamSelesai);
    var payload = {
      v: 1,
      mId: meeting.id,
      code: meeting.kodeRapat,
      title: meeting.namaRapat,
      date: meeting.tanggal,
      start: meeting.jamMulai,
      end: meeting.jamSelesai,
      exp: expMs
    };
    var jsonStr = JSON.stringify(payload);
    var token = 'EPMC-' + btoa(unescape(encodeURIComponent(jsonStr)));
    return {
      token: token,
      payload: payload,
      qrText: token
    };
  };

  Store.decodeQRToken = function (tokenStr) {
    if (!tokenStr) return null;
    try {
      var raw = tokenStr.trim();
      if (raw.indexOf('EPMC-') === 0) {
        raw = raw.substring(5);
      }
      var decoded = decodeURIComponent(escape(atob(raw)));
      return JSON.parse(decoded);
    } catch (e) {
      try {
        return JSON.parse(tokenStr);
      } catch (e2) {
        return null;
      }
    }
  };

  Store.autoUpdateMeetingStatuses = function () {
    var nowMs = Store.now().getTime();
    var meetings = Store.getMeetings();
    var updated = false;

    for (var i = 0; i < meetings.length; i++) {
      var m = meetings[i];
      if (m.status === 'Dijadwalkan') {
        var endMs = Rules.parseDateTime(m.tanggal, m.jamSelesai);
        if (nowMs >= endMs) {
          m.status = 'Selesai';
          updated = true;
        }
      }
    }

    if (updated) {
      setJSON(KEYS.MEETINGS, meetings);
      Store.notifyChange('meetings_status_auto_updated');
    }
  };

  Store.checkHMinus1Reminders = function () {
    var nowMs = Store.now().getTime();
    var meetings = Store.getMeetings();
    var presences = Store.getPresences();

    for (var i = 0; i < meetings.length; i++) {
      var m = meetings[i];
      if (m.status === 'Dijadwalkan') {
        var startMs = Rules.parseDateTime(m.tanggal, m.jamMulai);
        var diffHours = (startMs - nowMs) / (1000 * 60 * 60);

        if (diffHours > 0 && diffHours <= 24) {
          var unconfirmed = [];
          var mPres = presences[m.id] || {};
          var list = m.peserta || [];
          for (var j = 0; j < list.length; j++) {
            var pid = list[j];
            var pData = mPres[pid];
            if (!pData || pData.kehadiran === 'Belum konfirmasi') {
              unconfirmed.push(pid);
            }
          }

          if (unconfirmed.length > 0) {
            var notifs = getJSON(KEYS.NOTIFICATIONS, []);
            var alreadySent = false;
            for (var k = 0; k < notifs.length; k++) {
              if (notifs[k].meetingId === m.id && notifs[k].type === 'reminder_h1') {
                alreadySent = true;
                break;
              }
            }
            if (!alreadySent) {
              Store.addNotification({
                type: 'reminder_h1',
                category: 'Undangan',
                title: 'Pengingat Rapat H-1: ' + m.namaRapat,
                message: 'Rapat ' + m.namaRapat + ' akan dilaksanakan besok (' + Rules.formatDateIndo(new Date(m.tanggal)) + ' pukul ' + m.jamMulai + ' WIB). Mohon segera konfirmasi kehadiran Anda melalui aplikasi mobile.',
                meetingId: m.id,
                memberIds: unconfirmed
              });
            }
          }
        }
      }
    }
  };

  /**
   * SEED DATA LENGKAP
   */
  Store.seedData = function (forceReset) {
    if (!forceReset && localStorage.getItem(KEYS.MEMBERS)) {
      return;
    }

    console.log('Seeding e-Parlemen data...');

    // 1. Buat 100 Anggota dengan komisi dan fraksi terstruktur
    // Komisi I: P1 - P10 (10 orang)
    // Komisi II: P11 - P20 (10 orang)
    // Komisi III: P21 - P30 (10 orang)
    // Komisi IV: P31 - P40 (10 orang)
    // Anggota lainnya: P41 - P100 terbagi rata
    var members = [];
    var fraksiList = ['Fraksi PDI Perjuangan', 'Fraksi PKB', 'Fraksi PKS', 'Fraksi Golkar', 'Fraksi Gerindra', 'Fraksi Demokrat'];

    for (var i = 1; i <= 100; i++) {
      var id = 'P' + i;
      var code = 'DPRD-AGT-' + String(i).padStart(3, '0');
      var komisi = 'Komisi ' + (i <= 10 ? 'I' : (i <= 20 ? 'II' : (i <= 30 ? 'III' : (i <= 40 ? 'IV' : ['I', 'II', 'III', 'IV'][(i - 1) % 4]))));
      var fraksi = fraksiList[(i - 1) % fraksiList.length];
      var unit = komisi;
      if (i <= 25) {
        unit = 'Badan Anggaran';
      }

      members.push({
        id: id,
        kode: code,
        nama: 'Anggota ' + id,
        jabatan: i <= 5 ? 'Pimpinan DPRD' : (i === 6 ? 'Ketua ' + komisi : 'Anggota ' + komisi),
        unit: unit,
        komisi: komisi,
        fraksi: fraksi,
        avatar: 'A' + i
      });
    }
    setJSON(KEYS.MEMBERS, members);

    // 2. Aktivitas Peserta pada 20 Nov 2026
    var activities = {};

    activities['P1'] = [{
      sumber: 'Penugasan',
      judul: 'Kunjungan Kerja Luar Kota Badan Anggaran',
      status: 'Penugasan Disetujui',
      start: new Date(2026, 10, 19, 0, 0, 0).getTime(),
      end: new Date(2026, 10, 21, 23, 59, 59).getTime()
    }];

    activities['P2'] = [{
      sumber: 'Penugasan',
      judul: 'Audiensi Tokoh Masyarakat Magelang',
      status: 'Penugasan Disetujui',
      start: new Date(2026, 10, 20, 8, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 9, 30, 0).getTime()
    }];

    activities['P4'] = [{
      sumber: 'Penugasan',
      judul: 'Penerimaan Tamu Pagi Hari',
      status: 'Penugasan Disetujui',
      start: new Date(2026, 10, 20, 6, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 9, 0, 0).getTime()
    }];

    activities['P5'] = [{
      sumber: 'Penugasan',
      judul: 'Inspeksi Lapangan Siang Hari',
      status: 'Penugasan Disetujui',
      start: new Date(2026, 10, 20, 12, 30, 0).getTime(),
      end: new Date(2026, 10, 20, 14, 0, 0).getTime()
    }];

    activities['P6'] = [{
      sumber: 'Penugasan',
      judul: 'Konsultasi Hukum Perda (Pending)',
      status: 'Penugasan Menunggu persetujuan',
      start: new Date(2026, 10, 20, 9, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 12, 0, 0).getTime()
    }];

    activities['P7'] = [{
      sumber: 'Penugasan',
      judul: 'Sosialisasi Perda (Anggota Menolak)',
      status: 'Penugasan Disetujui (anggota menolak)',
      start: new Date(2026, 10, 20, 9, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 12, 0, 0).getTime()
    }];

    activities['P8'] = [{
      sumber: 'Penugasan',
      judul: 'Studi Komparasi (Dibatalkan)',
      status: 'Penugasan Dibatalkan',
      start: new Date(2026, 10, 20, 9, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 12, 0, 0).getTime()
    }];

    activities['P9'] = [
      {
        sumber: 'Rapat lain',
        judul: 'Rapat Dengar Pendapat Komisi II',
        status: 'Rapat Submit',
        start: new Date(2026, 10, 20, 10, 0, 0).getTime(),
        end: new Date(2026, 10, 20, 11, 0, 0).getTime()
      },
      {
        sumber: 'Penugasan',
        judul: 'Tugas Pendampingan Wilayah',
        status: 'Penugasan Disetujui',
        start: new Date(2026, 10, 20, 10, 0, 0).getTime(),
        end: new Date(2026, 10, 20, 11, 0, 0).getTime()
      }
    ];

    activities['P10'] = [{
      sumber: 'Rapat lain',
      judul: 'Rapat Koordinasi Bapemperda',
      status: 'Rapat Submit',
      start: new Date(2026, 10, 20, 10, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 11, 0, 0).getTime()
    }];

    activities['P11'] = [{
      sumber: 'Rapat lain',
      judul: 'Rapat Pimpinan Gabungan Fraksi',
      status: 'Rapat Submit',
      start: new Date(2026, 10, 20, 10, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 11, 0, 0).getTime()
    }];

    activities['P12'] = [{
      sumber: 'Rapat lain',
      judul: 'Draf Rapat Internal Fraksi',
      status: 'Rapat Draft',
      start: new Date(2026, 10, 20, 9, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 12, 0, 0).getTime()
    }];

    activities['P13'] = [{
      sumber: 'Rapat lain',
      judul: 'Rapat Koordinasi Internal (Cancelled)',
      status: 'Rapat Cancelled',
      start: new Date(2026, 10, 20, 9, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 12, 0, 0).getTime()
    }];

    activities['P14'] = [{
      sumber: 'Surat masuk',
      judul: 'Undangan Upacara Hari Jadi Kota Magelang',
      status: 'Surat masuk',
      start: new Date(2026, 10, 20, 0, 0, 0).getTime(),
      end: new Date(2026, 10, 20, 23, 59, 59).getTime()
    }];

    setJSON(KEYS.ACTIVITIES, activities);

    // 3. Rapat-Rapat Beragam Ukuran Peserta (N=10, N=25, N=100)
    var allMemberIds = members.map(function (m) { return m.id; });
    var komisi1Ids = members.filter(function (m) { return m.komisi === 'Komisi I'; }).map(function (m) { return m.id; });
    var komisi2Ids = members.filter(function (m) { return m.komisi === 'Komisi II'; }).map(function (m) { return m.id; });
    var banggarIds = allMemberIds.slice(0, 25);
    var bamusIds = allMemberIds.slice(0, 20);

    // Rapat 1: Rapat Utama Paripurna KUA-PPAS TA 2027 (N=100) -> Menjaga Test Suite 100% PASS!
    var mainMeeting = {
      id: 'rpt-utama-20261120',
      kodeRapat: 'RPT-2026-001',
      namaRapat: 'Rapat Paripurna Pembahasan KUA-PPAS TA 2027',
      jenisRapat: 'Rapat Paripurna',
      unit: ['Rapat Paripurna (Semua)'],
      tanggal: '2026-11-20',
      jamMulai: '09:00',
      jamSelesai: '12:00',
      lokasi: 'Ruang Sidang Paripurna DPRD Kota Magelang',
      deskripsi: 'Pembahasan rancangan Kebijakan Umum Anggaran dan Prioritas Plafon Anggaran Sementara (KUA-PPAS) Tahun Anggaran 2027 bersama TAPD.',
      lampiran: [
        { name: 'Undangan_Resmi_Paripurna_KUA_PPAS.pdf', size: '1.4 MB' },
        { name: 'Draf_KUA_PPAS_TA_2027.pdf', size: '2.8 MB' }
      ],
      dokumenUndangan: {
        nomorSurat: '005/UND-PARIPURNA/DPRD/XI/2026',
        perihal: 'Undangan Rapat Paripurna KUA-PPAS TA 2027',
        tanggalSurat: '2026-11-12',
        penandatangan: 'H. Budi Santoso, S.E. (Sekretaris DPRD)',
        nip: '19750812 199803 1 004'
      },
      peserta: allMemberIds,
      status: 'Dijadwalkan',
      createdAt: 'Kamis, 12 November 2026, 10.00 WIB',
      updatedAt: 'Kamis, 12 November 2026, 10.00 WIB'
    };

    // Rapat 2: Rapat Kerja Komisi I (N=10 Peserta!) - Dimulai 08:00 (Sedang Berlangsung di jam 08:30!)
    var meeting2 = {
      id: 'rpt-komisi1-20261120',
      kodeRapat: 'RPT-2026-002',
      namaRapat: 'Rapat Kerja Komisi I Evaluasi Pelayanan Publik',
      jenisRapat: 'Komisi I',
      unit: ['Komisi I'],
      tanggal: '2026-11-20',
      jamMulai: '08:00',
      jamSelesai: '11:00',
      lokasi: 'Ruang Rapat Komisi I DPRD Kota Magelang',
      deskripsi: 'Evaluasi standar pelayanan publik dan perizinan terpadu bersama dinas terkait.',
      lampiran: [{ name: 'Surat_Undangan_Rapat_Komisi_I.pdf', size: '820 KB' }],
      dokumenUndangan: {
        nomorSurat: '005/UND-KOMISI-I/DPRD/XI/2026',
        perihal: 'Undangan Rapat Evaluasi Pelayanan Publik',
        tanggalSurat: '2026-11-15',
        penandatangan: 'Drs. Supriyanto (Koordinator Komisi I)',
        nip: '19700315 199501 1 002'
      },
      peserta: komisi1Ids, // Tepat 10 orang!
      status: 'Dijadwalkan',
      createdAt: 'Senin, 16 November 2026, 09.00 WIB',
      updatedAt: 'Senin, 16 November 2026, 09.00 WIB'
    };

    // Rapat 3: Rapat Badan Anggaran (N=25 Peserta)
    var meeting3 = {
      id: 'rpt-banggar-20261120',
      kodeRapat: 'RPT-2026-003',
      namaRapat: 'Rapat Badan Anggaran Finalisasi Plafon Anggaran',
      jenisRapat: 'Badan Anggaran',
      unit: ['Badan Anggaran'],
      tanggal: '2026-11-20',
      jamMulai: '13:30',
      jamSelesai: '16:00',
      lokasi: 'Ruang Rapat Banggar DPRD',
      deskripsi: 'Finalisasi rekapitulasi masukan fraksi terhadap usulan plafon anggaran daerah.',
      lampiran: [{ name: 'Undangan_Rapat_Badan_Anggaran.pdf', size: '945 KB' }],
      dokumenUndangan: {
        nomorSurat: '005/UND-BANGGAR/DPRD/XI/2026',
        perihal: 'Undangan Rapat Kerja Badan Anggaran',
        tanggalSurat: '2026-11-14',
        penandatangan: 'Pimpinan Badan Anggaran DPRD',
        nip: '19720410 199703 1 003'
      },
      peserta: banggarIds, // 25 orang!
      status: 'Dijadwalkan',
      createdAt: 'Sabtu, 14 November 2026, 11.00 WIB',
      updatedAt: 'Sabtu, 14 November 2026, 11.00 WIB'
    };

    // Rapat 4: Rapat Bamus (Selesai, N=20)
    var meeting4 = {
      id: 'rpt-bamus-20261118',
      kodeRapat: 'RPT-2026-004',
      namaRapat: 'Rapat Badan Musyawarah Penetapan Jadwal Masa Sidang',
      jenisRapat: 'Badan Musyawarah',
      unit: ['Badan Musyawarah'],
      tanggal: '2026-11-18',
      jamMulai: '09:00',
      jamSelesai: '11:30',
      lokasi: 'Ruang Rapat Bamus',
      deskripsi: 'Penetapan jadwal kegiatan dan agenda rapat paripurna masa persidangan I.',
      lampiran: [{ name: 'Surat_Undangan_Bamus.pdf', size: '640 KB' }],
      dokumenUndangan: {
        nomorSurat: '005/UND-BAMUS/DPRD/XI/2026',
        perihal: 'Undangan Rapat Badan Musyawarah',
        tanggalSurat: '2026-11-10',
        penandatangan: 'Sekretaris DPRD Kota Magelang',
        nip: '19750812 199803 1 004'
      },
      peserta: bamusIds, // 20 orang!
      status: 'Selesai',
      createdAt: 'Senin, 10 November 2026, 08.00 WIB',
      updatedAt: 'Rabu, 18 November 2026, 11.30 WIB'
    };

    // Rapat 5: Rapat Pansus (Batal, N=35)
    var meeting5 = {
      id: 'rpt-pansus-20261115',
      kodeRapat: 'RPT-2026-005',
      namaRapat: 'Rapat Koordinasi Pansus Raperda RTRW',
      jenisRapat: 'Pansus',
      unit: ['Komisi III', 'Komisi IV'],
      tanggal: '2026-11-15',
      jamMulai: '10:00',
      jamSelesai: '12:00',
      lokasi: 'Ruang Rapat Komisi III',
      deskripsi: 'Koordinasi pembahasan materi naskah akademik peta tematik.',
      lampiran: [],
      peserta: allMemberIds.slice(0, 35), // 35 orang mencakup P1 s.d. P10
      status: 'Batal',
      isBatalSaatBerlangsung: false,
      alasanBatal: 'Penundaan dari pihak penyusun naskah akademik untuk penyempurnaan peta tematik (Dibatalkan sebelum rapat dimulai)',
      dibatalkanOleh: 'Admin Sekretariat',
      dibatalkanPada: 'Jumat, 14 November 2026, 16.30 WIB',
      createdAt: 'Selasa, 11 November 2026, 11.00 WIB',
      updatedAt: 'Jumat, 14 November 2026, 16.30 WIB'
    };

    // Rapat 6: Draf Rapat Komisi II (Draft, N=10)
    var meeting6 = {
      id: 'rpt-draft-20261125',
      kodeRapat: 'RPT-2026-006',
      namaRapat: 'Draf Rapat Kerja Komisi II Pengelolaan Sampah',
      jenisRapat: 'Komisi II',
      unit: ['Komisi II'],
      tanggal: '2026-11-25',
      jamMulai: '09:00',
      jamSelesai: '11:00',
      lokasi: 'Ruang Rapat Komisi II',
      deskripsi: 'Draf rapat audiensi perwakilan pengelola persampahan.',
      lampiran: [],
      peserta: komisi2Ids, // 10 orang!
      status: 'Draft',
      createdAt: 'Senin, 16 November 2026, 14.00 WIB',
      updatedAt: 'Senin, 16 November 2026, 14.00 WIB'
    };

    // Rapat 7: Kasus Khusus: Rapat Dibatalkan Saat Sedang Berlangsung (Anggota Sudah Hadir & Presensi QR)
    var meeting7 = {
      id: 'rpt-batal-berjalan-20261120',
      kodeRapat: 'RPT-2026-007',
      namaRapat: 'Rapat Kerja Komisi II (Dibatalkan Saat Sidang Berjalan)',
      jenisRapat: 'Komisi II',
      unit: ['Komisi II'],
      tanggal: '2026-11-20',
      jamMulai: '08:00',
      jamSelesai: '10:30',
      lokasi: 'Ruang Rapat Komisi II DPRD Kota Magelang',
      deskripsi: 'Evaluasi tata kelola persampahan daerah yang dihentikan darurat di tengah sidang.',
      lampiran: [{ name: 'Surat_Undangan_Komisi_II.pdf', size: '780 KB' }],
      dokumenUndangan: {
        nomorSurat: '005/UND-KOMISI-II/DPRD/XI/2026',
        perihal: 'Undangan Rapat Evaluasi Sampah & Lingkungan',
        tanggalSurat: '2026-11-15',
        penandatangan: 'Sekretaris DPRD Kota Magelang',
        nip: '19750812 199803 1 004'
      },
      peserta: allMemberIds.slice(0, 25), // Mencakup P1 s.d. P25 agar seluruh akun demo melihat rapat ini
      status: 'Batal',
      isBatalSaatBerlangsung: true,
      alasanBatal: 'Dibatalkan oleh Admin Sekretariat saat rapat sedang berlangsung (pukul 08.20 WIB) akibat gangguan darurat instalasi kelistrikan di ruang sidang. Data presensi anggota yang telah hadir dan melakukan scan presensi QR tetap sah dan tersimpan sebagai arsip resmi.',
      dibatalkanOleh: 'Admin Sekretariat',
      dibatalkanPada: 'Jumat, 20 November 2026, 08.20 WIB',
      createdAt: 'Minggu, 15 November 2026, 13.00 WIB',
      updatedAt: 'Jumat, 20 November 2026, 08.20 WIB'
    };

    var meetings = [mainMeeting, meeting2, meeting3, meeting4, meeting5, meeting6, meeting7];
    setJSON(KEYS.MEETINGS, meetings);

    // 4. Presensi Awal
    var presences = {};
    presences[mainMeeting.id] = {};
    for (var mIdx = 0; mIdx < allMemberIds.length; mIdx++) {
      var pId = allMemberIds[mIdx];
      presences[mainMeeting.id][pId] = {
        kehadiran: 'Belum konfirmasi',
        presensiStatus: 'Belum presensi',
        waktuPresensi: null,
        waktuPresensiStr: '-',
        alasanTidakHadir: '',
        badge: null,
        lateMinutes: 0
      };
    }

    presences[mainMeeting.id]['P1'] = {
      kehadiran: 'Hadir',
      presensiStatus: 'Sudah presensi',
      waktuPresensi: new Date(2026, 10, 20, 8, 50, 0).getTime(),
      waktuPresensiStr: '08.50 WIB',
      alasanTidakHadir: '',
      badge: 'Tepat Waktu',
      badgeClass: 'badge-success',
      lateMinutes: 0
    };

    presences[mainMeeting.id]['P2'] = {
      kehadiran: 'Hadir',
      presensiStatus: 'Sudah presensi',
      waktuPresensi: new Date(2026, 10, 20, 9, 5, 0).getTime(),
      waktuPresensiStr: '09.05 WIB',
      alasanTidakHadir: '',
      badge: 'Terlambat 5 menit',
      badgeClass: 'badge-warn',
      lateMinutes: 5
    };

    presences[mainMeeting.id]['P3'] = {
      kehadiran: 'Hadir',
      presensiStatus: 'Sudah presensi',
      waktuPresensi: new Date(2026, 10, 20, 8, 55, 0).getTime(),
      waktuPresensiStr: '08.55 WIB',
      alasanTidakHadir: '',
      badge: 'Tepat Waktu',
      badgeClass: 'badge-success',
      lateMinutes: 0
    };

    presences[mainMeeting.id]['P4'] = {
      kehadiran: 'Hadir',
      presensiStatus: 'Belum presensi',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: '',
      badge: null,
      lateMinutes: 0
    };

    presences[mainMeeting.id]['P6'] = {
      kehadiran: 'Tidak hadir',
      presensiStatus: '-',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: 'Penugasan di luar kota',
      badge: null,
      lateMinutes: 0
    };

    presences[mainMeeting.id]['P7'] = {
      kehadiran: 'Tidak hadir',
      presensiStatus: '-',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: 'Urusan keluarga mendesak',
      badge: null,
      lateMinutes: 0
    };

    // Presensi untuk Rapat 2 (Komisi I: 10 orang)
    presences[meeting2.id] = {};
    for (var c1 = 0; c1 < komisi1Ids.length; c1++) {
      var c1Id = komisi1Ids[c1];
      presences[meeting2.id][c1Id] = {
        kehadiran: c1 < 7 ? 'Hadir' : (c1 === 7 ? 'Tidak hadir' : 'Belum konfirmasi'),
        presensiStatus: c1 < 5 ? 'Sudah presensi' : (c1 === 7 ? '-' : 'Belum presensi'),
        waktuPresensi: c1 < 5 ? new Date(2026, 10, 20, 8, 10, 0).getTime() : null,
        waktuPresensiStr: c1 < 5 ? '08.10 WIB' : '-',
        alasanTidakHadir: c1 === 7 ? 'Tugas komisi lain' : '',
        badge: c1 < 5 ? 'Tepat Waktu' : null,
        badgeClass: c1 < 5 ? 'badge-success' : null,
        lateMinutes: 0
      };
    }

    // Presensi untuk Rapat 7 (Dibatalkan Saat Berjalan - Anggota Sudah Hadir & Presensi QR)
    presences[meeting7.id] = {};
    for (var bIdx = 0; bIdx < 25; bIdx++) {
      var bMid = allMemberIds[bIdx];
      presences[meeting7.id][bMid] = {
        kehadiran: 'Hadir',
        presensiStatus: 'Sudah presensi',
        waktuPresensi: new Date(2026, 10, 20, 8, 12, 0).getTime(),
        waktuPresensiStr: '08.12 WIB',
        alasanTidakHadir: '',
        badge: 'Tepat Waktu',
        badgeClass: 'badge-success',
        lateMinutes: 0
      };
    }

    setJSON(KEYS.PRESENCES, presences);

    // 5. Laporan Rapat Selesai
    var reports = {};
    reports[meeting4.id] = {
      meetingId: meeting4.id,
      text: 'Rapat Badan Musyawarah berjalan tertib dan kuorum tercapai. Seluruh fraksi menyepakati pembagian waktu masa sidang I tahun anggaran berjalan.',
      reporter: 'Admin Sekretariat',
      updatedAt: 'Rabu, 18 November 2026, 11.45 WIB'
    };
    setJSON(KEYS.REPORTS, reports);

    // 6. Notifikasi Awal
    var notifications = [
      {
        id: 'notif-seed-1',
        type: 'rapat_dijadwalkan',
        category: 'Undangan',
        title: 'Undangan Rapat Paripurna KUA-PPAS TA 2027',
        message: 'Rapat Paripurna Pembahasan KUA-PPAS TA 2027 telah dijadwalkan pada Jumat, 20 November 2026 pukul 09.00–12.00 WIB.',
        dateStr: 'Kamis, 12 November 2026, 10.00 WIB',
        timestamp: new Date(2026, 10, 12, 10, 0, 0).getTime(),
        readBy: [],
        meetingId: mainMeeting.id,
        memberIds: allMemberIds
      },
      {
        id: 'notif-seed-2',
        type: 'rapat_dibatalkan',
        category: 'Undangan',
        title: 'Pemberitahuan: Rapat Pansus Dibatalkan',
        message: 'Rapat Koordinasi Pansus Raperda RTRW tanggal 15 November 2026 telah dibatalkan oleh Admin Sekretariat. Alasan: Penundaan naskah akademik.',
        dateStr: 'Jumat, 14 November 2026, 16.30 WIB',
        timestamp: new Date(2026, 10, 14, 16, 30, 0).getTime(),
        readBy: [],
        meetingId: meeting5.id,
        memberIds: meeting5.peserta
      },
      {
        id: 'notif-seed-3',
        type: 'reminder_h1',
        category: 'Undangan',
        title: 'Pengingat Rapat H-1: KUA-PPAS TA 2027',
        message: 'Rapat KUA-PPAS TA 2027 akan diselenggarakan besok (20 Nov 2026). Mohon konfirmasi kehadiran sebelum rapat dimulai.',
        dateStr: 'Kamis, 19 November 2026, 09.00 WIB',
        timestamp: new Date(2026, 10, 19, 9, 0, 0).getTime(),
        readBy: [],
        meetingId: mainMeeting.id,
        memberIds: allMemberIds
      }
    ];
    setJSON(KEYS.NOTIFICATIONS, notifications);

    setJSON(KEYS.CANCELED_CODES, ['RPT-2026-005', 'RPT-2026-007']);
    localStorage.setItem(KEYS.TIME, DEFAULT_SIMULATED_TIME);
    localStorage.setItem(KEYS.CURRENT_MEMBER, 'P1');

    console.log('Seed completed successfully.');
    Store.notifyChange('seed_reset');
  };

  window.Store = Store;

  // Auto-refresh seed data if schema version changes to guarantee new demo cases appear
  var CURRENT_SEED_VERSION = 'v2026_11_16_multistatus_final_v6';
  if (localStorage.getItem('epar_seed_schema_version') !== CURRENT_SEED_VERSION || !localStorage.getItem(KEYS.MEMBERS)) {
    Store.seedData(true);
    localStorage.setItem('epar_seed_schema_version', CURRENT_SEED_VERSION);
  }
})(window);
