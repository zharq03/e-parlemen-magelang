/**
 * store.js - e-Parlemen DPRD Kota Magelang
 * State Management berbasis localStorage dengan sinkronisasi antar-tab
 * Mengimplementasikan Aturan Bisnis TRD v1.1:
 * - Master Filter Unit Tipe & Organisasi Periode Aktif
 * - Penarikan Peserta via user_assignments dengan Deduplikasi
 * - Cek Bentrok Hard Conflict & Interactive Quorum Endpoint
 * - Presensi QR 2-Lapis & Retensi Data saat Pembatalan
 * - Auto-Selesai & Finalisasi Presensi
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
   * Mengambil semua anggota dewan
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
   * Kurasi Anggota P1 - P10 untuk Kemudahan Demo & Penjelasan Kasus
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
   * Mengambil anggota berdasarkan unit yang dipilih (dengan Deduplikasi Peserta TRD v1.1)
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

    // Deduplikasi per user_id dengan menggabungkan jabatan / unit
    var map = {};
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      var mNum = parseInt(m.id.replace('P', ''), 10);

      for (var j = 0; j < unitNames.length; j++) {
        var un = unitNames[j];
        var matched = false;

        if (m.komisi === un || m.unit === un || m.fraksi === un) {
          matched = true;
        } else if (un === 'Badan Anggaran' || un === 'Badan Anggaran (Banggar)') {
          if (mNum <= 25) matched = true;
        } else if (un === 'Badan Musyawarah' || un === 'Badan Musyawarah (Bamus)') {
          if (mNum <= 20) matched = true;
        } else if (un === 'Pimpinan DPRD') {
          if (mNum <= 5) matched = true;
        } else if (un === 'Badan Pembentukan Perda (Bapemperda)') {
          if (mNum <= 15) matched = true;
        } else if (un === 'Badan Kehormatan (BK)') {
          if (mNum >= 6 && mNum <= 12) matched = true;
        } else if (un === 'Panitia Khusus (Pansus)') {
          if (mNum <= 35) matched = true;
        } else if (un === 'Panitia Kerja (Panja)') {
          if (mNum >= 5 && mNum <= 18) matched = true;
        }

        if (matched) {
          if (!map[m.id]) {
            map[m.id] = {
              id: m.id,
              kode: m.kode,
              nama: m.nama,
              jabatan: m.jabatan,
              unit: un,
              unitList: [un],
              komisi: m.komisi,
              fraksi: m.fraksi,
              avatar: m.avatar
            };
          } else {
            // Deduplikasi: tambah unit ke unitList
            if (map[m.id].unitList.indexOf(un) === -1) {
              map[m.id].unitList.push(un);
              map[m.id].unit = map[m.id].unitList.join(' / ');
            }
          }
        }
      }
    }

    var result = [];
    for (var mid in map) {
      result.push(map[mid]);
    }

    // Urutkan berdasarkan ID numerik
    result.sort(function (a, b) {
      return parseInt(a.id.replace('P', ''), 10) - parseInt(b.id.replace('P', ''), 10);
    });

    return result.length > 0 ? result : all.slice(0, 10);
  };

  /**
   * Simulasi API Backend: POST /api/v1/admin/meetings/check-quorum
   * (TRD v1.1 Bagian 5.B, Hal 13-15)
   */
  Store.checkQuorum = function (req) {
    var unitNames = req.unit_ids || [];
    var selectedUserIds = req.selected_user_ids || [];
    var meetingDate = req.meeting_date;
    var startTime = req.start_time;
    var endTime = req.end_time;
    var excludeMeetingId = req.exclude_meeting_id || null;

    var candidate = {
      id: excludeMeetingId,
      tanggal: meetingDate,
      jamMulai: startTime,
      jamSelesai: endTime
    };

    var matchedMembers = Store.getMembersByUnits(unitNames);
    var participantsData = [];
    var conflictCount = 0;

    matchedMembers.forEach(function (m) {
      var isChecked = (selectedUserIds.length === 0 || selectedUserIds.indexOf(m.id) !== -1);
      var acts = Store.getActivitiesForMember(m.id);
      var res = Rules.evaluateParticipantActivities(candidate, acts);

      if (isChecked && res.hasConflict) {
        conflictCount++;
      }

      participantsData.push({
        user_id: m.id,
        member_code: m.kode,
        name: m.nama,
        position_name: m.jabatan,
        unit_name: m.unit,
        is_checked: isChecked,
        has_conflict: res.hasConflict,
        is_checkbox_disabled: res.hasConflict,
        conflict_type: res.conflictType || null,
        conflict_label: res.conflictLabel || (res.conflictDetails.length ? res.conflictDetails[0].keterangan : null)
      });
    });

    var totalInvited = 0;
    participantsData.forEach(function (p) {
      if (p.is_checked) totalInvited++;
    });

    var qCalc = Rules.calculateQuorum(totalInvited, conflictCount);

    return {
      success: true,
      data: {
        total_invited: qCalc.total_invited,
        quorum_required: qCalc.quorum_required,
        conflict_unique_count: qCalc.conflict_unique_count,
        available_count: qCalc.available_count,
        is_quorum_met: qCalc.is_quorum_met,
        banner_message: qCalc.banner_message,
        participants: participantsData
      }
    };
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

  /**
   * Simpan / Jadwalkan Rapat (TRD v1.1 Hal 15-16)
   */
  Store.saveMeeting = function (meeting) {
    var meetings = Store.getMeetings();
    var nowWIB = Rules.formatDateIndo(Store.now()) + ', ' + Rules.formatTimeWIB(Store.now());

    if (!meeting.id) {
      meeting.id = 'rpt-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      meeting.createdAt = nowWIB;
    }
    meeting.updatedAt = nowWIB;

    // Default Dokumen surat undangan jika ada lampiran
    if (!meeting.dokumenUndangan) {
      meeting.dokumenUndangan = {
        nomorSurat: '005/UND/DPRD/XI/2026',
        perihal: 'Undangan ' + meeting.namaRapat,
        tanggalSurat: meeting.tanggal,
        penandatangan: 'Sekretaris DPRD Kota Magelang',
        nip: '19750812 199803 1 004'
      };
    }

    // Hitung Snapshot Kuorum saat Dijadwalkan
    var N = (meeting.peserta || []).length;
    var bentrokUnik = 0;
    var candidate = { tanggal: meeting.tanggal, jamMulai: meeting.jamMulai, jamSelesai: meeting.jamSelesai };

    (meeting.peserta || []).forEach(function (pid) {
      var acts = Store.getActivitiesForMember(pid);
      var res = Rules.evaluateParticipantActivities(candidate, acts);
      if (res.hasConflict) bentrokUnik++;
    });

    var qCalc = Rules.calculateQuorum(N, bentrokUnik);
    meeting.total_invited = N;
    meeting.quorum_required = qCalc.quorum_required;
    meeting.conflict_count = bentrokUnik;
    meeting.available_count = qCalc.available_count;

    // Jika status SCHEDULE (Dijadwalkan), kuorum wajib terpenuhi
    if (meeting.status === 'Dijadwalkan' || meeting.status === 'DIJADWALKAN') {
      if (!qCalc.is_quorum_met) {
        return {
          success: false,
          error_code: 'QUORUM_NOT_MET',
          message: 'Kuorum 2/3 tidak terpenuhi (Tersedia: ' + qCalc.available_count + ' dari minimal ' + qCalc.quorum_required + ' peserta).',
          data: {
            total_invited: N,
            quorum_required: qCalc.quorum_required,
            available_count: qCalc.available_count
          }
        };
      }
      meeting.scheduled_at = nowWIB;
      meeting.qr_token_hash = 'qr_hash_' + meeting.id + '_' + Date.now();
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

    if (meeting.status === 'Dijadwalkan' || meeting.status === 'DIJADWALKAN') {
      var displayName = (meeting.namaRapat || '').trim();
      var hasRapatPrefix = /^rapat\b/i.test(displayName);
      var meetingPrefix = hasRapatPrefix ? '' : 'Rapat ';

      Store.addNotification({
        type: 'rapat_dijadwalkan',
        event_type: 'MEETING_SCHEDULED',
        category: 'Undangan',
        title: (hasRapatPrefix ? 'Undangan ' : 'Undangan Rapat: ') + displayName,
        message: meetingPrefix + displayName + ' telah dijadwalkan pada ' + Rules.formatDateIndo(new Date(meeting.tanggal)) + ' pukul ' + meeting.jamMulai + '–' + meeting.jamSelesai + ' WIB di ' + (meeting.lokasi || 'DPRD Kota Magelang') + '.',
        body_segments: (hasRapatPrefix ? [] : [{ text: 'Rapat ', style: 'DEFAULT' }]).concat([
          { text: displayName, style: 'HIGHLIGHT' },
          { text: ' telah dijadwalkan pada ' + Rules.formatDateIndo(new Date(meeting.tanggal)) + ' pukul ' + meeting.jamMulai + '–' + meeting.jamSelesai + ' WIB.', style: 'DEFAULT' }
        ]),
        redirect_page: 'DETAIL_UNDANGAN_RAPAT',
        meetingId: meeting.id,
        memberIds: meeting.peserta || []
      });
    }

    Store.notifyChange('meeting_saved', meeting);
    return { success: true, data: meeting };
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

  /**
   * Batalkan Rapat (TRD v1.1 Hal 17)
   * Menyimpan alasan batal wajib, menginvalidasi QR, dan mempertahankan arsip presensi
   */
  Store.cancelMeeting = function (meetingId, reason, canceledBy) {
    var meetings = Store.getMeetings();
    var canceledMeeting = null;
    var nowWIB = Rules.formatDateIndo(Store.now()) + ', ' + Rules.formatTimeWIB(Store.now());

    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].id === meetingId) {
        var wasOngoing = (Rules.deriveDisplayStatus(meetings[i], Store.now()) === 'BERLANGSUNG');
        meetings[i].status = 'Batal';
        meetings[i].isBatalSaatBerlangsung = wasOngoing;
        meetings[i].cancel_reason = reason || 'Dibatalkan oleh Admin Sekretariat';
        meetings[i].alasanBatal = meetings[i].cancel_reason;
        meetings[i].cancelled_by = canceledBy || 'Admin Sekretariat';
        meetings[i].dibatalkanOleh = meetings[i].cancelled_by;
        meetings[i].cancelled_at = nowWIB;
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

      var cancelDispName = (canceledMeeting.namaRapat || '').trim();
      var hasCancelRapat = /^rapat\b/i.test(cancelDispName);
      var cancelPrefix = hasCancelRapat ? '' : 'Rapat ';

      Store.addNotification({
        type: 'rapat_dibatalkan',
        event_type: 'MEETING_CANCELLED',
        category: 'Undangan',
        title: 'Pemberitahuan: Rapat Dibatalkan',
        message: cancelPrefix + cancelDispName + ' telah DIBATALKAN oleh ' + (canceledMeeting.dibatalkanOleh || 'Admin Sekretariat') + '. Alasan: ' + canceledMeeting.cancel_reason,
        body_segments: (hasCancelRapat ? [] : [{ text: 'Rapat ', style: 'DEFAULT' }]).concat([
          { text: cancelDispName, style: 'HIGHLIGHT' },
          { text: ' telah DIBATALKAN. Alasan: ' + canceledMeeting.cancel_reason, style: 'DEFAULT' }
        ]),
        redirect_page: 'DETAIL_UNDANGAN_RAPAT',
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
      confirmation_status: 'BELUM_KONFIRMASI',
      presensiStatus: 'Belum presensi',
      attendance_status: 'BELUM_PRESENSI',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: '',
      absence_reason: '',
      badge: null,
      punctualityLabel: null,
      lateMinutes: 0
    };
  };

  /**
   * Konfirmasi Kehadiran (Lapis 1 - Mobile)
   * Bersifat One-Way (sekali pilih, final). Jika Tidak Hadir wajib alasan & status presensi = TIDAK_BERLAKU
   */
  Store.setAttendance = function (meetingId, memberId, response, reason) {
    var presences = Store.getPresences();
    if (!presences[meetingId]) {
      presences[meetingId] = {};
    }

    var current = presences[meetingId][memberId] || {
      kehadiran: 'Belum konfirmasi',
      confirmation_status: 'BELUM_KONFIRMASI',
      presensiStatus: 'Belum presensi',
      attendance_status: 'BELUM_PRESENSI',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: '',
      absence_reason: '',
      badge: null,
      lateMinutes: 0
    };

    if (current.confirmation_status === 'TIDAK_HADIR' || current.kehadiran === 'Tidak hadir') {
      return { success: false, message: 'Status konfirmasi Tidak hadir bersifat final.' };
    }

    if (response === 'Tidak hadir' || response === 'TIDAK_HADIR') {
      if (!reason || !reason.trim()) {
        return { success: false, message: 'Wajib menyertakan alasan ketidakhadiran (absence_reason).' };
      }
      current.kehadiran = 'Tidak hadir';
      current.confirmation_status = 'TIDAK_HADIR';
      current.alasanTidakHadir = reason.trim();
      current.absence_reason = reason.trim();
      current.presensiStatus = '-';
      current.attendance_status = 'TIDAK_BERLAKU';
    } else {
      current.kehadiran = 'Hadir';
      current.confirmation_status = 'HADIR';
      current.alasanTidakHadir = '';
      current.absence_reason = '';
      if (current.presensiStatus === '-' || current.attendance_status === 'TIDAK_BERLAKU') {
        current.presensiStatus = 'Belum presensi';
        current.attendance_status = 'BELUM_PRESENSI';
      }
    }

    current.confirmed_at = Store.now().toISOString();

    presences[meetingId][memberId] = current;
    setJSON(KEYS.PRESENCES, presences);
    Store.notifyChange('attendance_updated', { meetingId: meetingId, memberId: memberId, data: current });
    return { success: true, data: current };
  };

  /**
   * Presensi Scan QR (Lapis 2 - Mobile)
   * Aktif Hari H, boleh scan sebelum jam mulai, catat Tepat Waktu / Terlambat
   */
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
      confirmation_status: 'HADIR',
      presensiStatus: 'Belum presensi',
      attendance_status: 'BELUM_PRESENSI',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: '',
      absence_reason: '',
      badge: null,
      lateMinutes: 0
    };

    var tScan = typeof scanTime === 'number' ? scanTime : new Date(scanTime).getTime();
    var dScan = new Date(tScan);
    var timeStr = Rules.formatTimeWIB(dScan);

    current.kehadiran = 'Hadir';
    current.confirmation_status = 'HADIR';
    current.presensiStatus = 'Sudah presensi';
    current.attendance_status = 'SUDAH_PRESENSI';
    current.waktuPresensi = tScan;
    current.waktuPresensiStr = timeStr;
    current.scanned_at = dScan.toISOString();
    current.badge = validation.badge;
    current.badgeClass = validation.badgeClass;
    current.punctuality_label = validation.punctualityLabel;
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
      punctuality_label: validation.punctualityLabel,
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
      event_type: notif.event_type || 'MEETING_SCHEDULED',
      category: notif.category || 'Undangan',
      title: notif.title || 'Notifikasi',
      message: notif.message || '',
      body_segments: notif.body_segments || [
        { text: notif.message || '', style: 'DEFAULT' }
      ],
      redirect_page: notif.redirect_page || 'DETAIL_UNDANGAN_RAPAT',
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

  Store.generateQRToken = function (meeting) {
    if (!meeting || meeting.status === 'Batal' || meeting.status === 'BATAL') return null;
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

  /**
   * Background Scheduler (Cron Job) TRD v1.1 Hal 18:
   * 1. Scheduler Auto-Selesai (menutup rapat & memfinalisasi presensi yang belum scan)
   */
  Store.autoUpdateMeetingStatuses = function () {
    var nowMs = Store.now().getTime();
    var meetings = Store.getMeetings();
    var presences = Store.getPresences();
    var updated = false;

    for (var i = 0; i < meetings.length; i++) {
      var m = meetings[i];
      if (m.status === 'Dijadwalkan' || m.status === 'DIJADWALKAN') {
        var endMs = Rules.parseDateTime(m.tanggal, m.jamSelesai);
        if (nowMs >= endMs) {
          m.status = 'Selesai';
          updated = true;

          // Memfinalisasi peserta dengan status BELUM_PRESENSI menjadi TIDAK_PRESENSI
          var mPres = presences[m.id] || {};
          var pList = m.peserta || [];
          for (var p = 0; p < pList.length; p++) {
            var pid = pList[p];
            if (mPres[pid] && mPres[pid].presensiStatus === 'Belum presensi' && mPres[pid].kehadiran === 'Hadir') {
              mPres[pid].presensiStatus = 'Tidak presensi';
              mPres[pid].attendance_status = 'TIDAK_PRESENSI';
            }
          }
          presences[m.id] = mPres;
        }
      }
    }

    if (updated) {
      setJSON(KEYS.MEETINGS, meetings);
      setJSON(KEYS.PRESENCES, presences);
      Store.notifyChange('meetings_status_auto_updated');
    }
  };

  /**
   * Scheduler Pengingat H-1 (TRD v1.1 Hal 18)
   */
  Store.checkHMinus1Reminders = function () {
    var nowMs = Store.now().getTime();
    var meetings = Store.getMeetings();
    var presences = Store.getPresences();

    for (var i = 0; i < meetings.length; i++) {
      var m = meetings[i];
      if (m.status === 'Dijadwalkan' || m.status === 'DIJADWALKAN') {
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
              if (notifs[k].meetingId === m.id && (notifs[k].type === 'reminder_h1' || notifs[k].event_type === 'MEETING_REMINDER_H1')) {
                alreadySent = true;
                break;
              }
            }

            if (!alreadySent) {
              var remDispName = (m.namaRapat || '').trim();
              var hasRemRapat = /^rapat\b/i.test(remDispName);
              var remPrefix = hasRemRapat ? '' : 'Rapat ';

              Store.addNotification({
                type: 'reminder_h1',
                event_type: 'MEETING_REMINDER_H1',
                category: 'Undangan',
                title: 'Pengingat Rapat H-1: ' + remDispName,
                message: remPrefix + remDispName + ' akan dilaksanakan besok (' + Rules.formatDateIndo(new Date(m.tanggal)) + ' pukul ' + m.jamMulai + ' WIB). Mohon segera konfirmasi kehadiran Anda.',
                body_segments: (hasRemRapat ? [] : [{ text: 'Rapat ', style: 'DEFAULT' }]).concat([
                  { text: remDispName, style: 'HIGHLIGHT' },
                  { text: ' akan dilaksanakan besok (' + Rules.formatDateIndo(new Date(m.tanggal)) + ' pukul ' + m.jamMulai + ' WIB).', style: 'DEFAULT' }
                ]),
                redirect_page: 'DETAIL_UNDANGAN_RAPAT',
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

    console.log('Seeding e-Parlemen data sesuai TRD v1.1...');

    // 1. Buat 100 Anggota dengan komisi dan fraksi terstruktur
    var members = [];
    var fraksiList = [
      'Fraksi PDI Perjuangan',
      'Fraksi PKB',
      'Fraksi PKS',
      'Fraksi Golkar',
      'Fraksi Gerindra',
      'Fraksi Demokrat'
    ];

    for (var i = 1; i <= 100; i++) {
      var id = 'P' + i;
      var code = 'DPRD-AGT-' + String(i).padStart(3, '0');
      var komisi = 'Komisi ' + (i <= 10 ? 'I' : (i <= 20 ? 'II' : (i <= 30 ? 'III' : (i <= 40 ? 'IV' : ['I', 'II', 'III', 'IV'][(i - 1) % 4]))));
      var fraksi = fraksiList[(i - 1) % fraksiList.length];
      var unit = komisi;
      if (i <= 5) unit = 'Pimpinan DPRD';
      else if (i <= 25) unit = 'Badan Anggaran';

      var jabatan = (i <= 5) ? 'Pimpinan DPRD' : (i === 6 ? 'Ketua ' + komisi : 'Anggota ' + komisi);

      members.push({
        id: id,
        kode: code,
        nama: 'Anggota ' + id,
        jabatan: jabatan,
        unit: unit,
        komisi: komisi,
        fraksi: fraksi,
        avatar: 'A' + i
      });
    }
    setJSON(KEYS.MEMBERS, members);

    // 2. Aktivitas Peserta pada 20 Nov 2026 (Hard Conflict vs Warning vs Lolos)
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

    // 3. Rapat-Rapat Sampel
    var allMemberIds = members.map(function (m) { return m.id; });
    var komisi1Ids = members.filter(function (m) { return m.komisi === 'Komisi I'; }).map(function (m) { return m.id; });
    var komisi2Ids = members.filter(function (m) { return m.komisi === 'Komisi II'; }).map(function (m) { return m.id; });
    var banggarIds = allMemberIds.slice(0, 25);
    var bamusIds = allMemberIds.slice(0, 20);

    // Rapat 1: Rapat Paripurna KUA-PPAS TA 2027 (N=100) -> Test Suite Pass!
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

    // Rapat 2: Rapat Kerja Komisi I (N=10 Peserta, Sedang Berlangsung di jam 08:30)
    var meeting2 = {
      id: 'rpt-komisi1-20261120',
      kodeRapat: 'RPT-2026-002',
      namaRapat: 'Rapat Kerja Komisi I Evaluasi Pelayanan Publik',
      jenisRapat: 'Rapat Komisi',
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
      peserta: komisi1Ids,
      status: 'Dijadwalkan',
      createdAt: 'Senin, 16 November 2026, 09.00 WIB',
      updatedAt: 'Senin, 16 November 2026, 09.00 WIB'
    };

    // Rapat 3: Rapat Badan Anggaran (N=25 Peserta)
    var meeting3 = {
      id: 'rpt-banggar-20261120',
      kodeRapat: 'RPT-2026-003',
      namaRapat: 'Rapat Badan Anggaran Finalisasi Plafon Anggaran',
      jenisRapat: 'Rapat Badan Anggaran (Banggar)',
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
      peserta: banggarIds,
      status: 'Dijadwalkan',
      createdAt: 'Sabtu, 14 November 2026, 11.00 WIB',
      updatedAt: 'Sabtu, 14 November 2026, 11.00 WIB'
    };

    // Rapat 4: Rapat Bamus (Selesai, N=20)
    var meeting4 = {
      id: 'rpt-bamus-20261118',
      kodeRapat: 'RPT-2026-004',
      namaRapat: 'Rapat Badan Musyawarah Penetapan Jadwal Masa Sidang',
      jenisRapat: 'Rapat Badan Musyawarah (Bamus)',
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
      peserta: bamusIds,
      status: 'Selesai',
      createdAt: 'Senin, 10 November 2026, 08.00 WIB',
      updatedAt: 'Rabu, 18 November 2026, 11.30 WIB'
    };

    // Rapat 5: Rapat Pansus (Batal Sebelum Mulai, N=35)
    var meeting5 = {
      id: 'rpt-pansus-20261115',
      kodeRapat: 'RPT-2026-005',
      namaRapat: 'Rapat Koordinasi Pansus Raperda RTRW',
      jenisRapat: 'Rapat Panitia Khusus (Pansus)',
      unit: ['Komisi III', 'Komisi IV'],
      tanggal: '2026-11-15',
      jamMulai: '10:00',
      jamSelesai: '12:00',
      lokasi: 'Ruang Rapat Komisi III',
      deskripsi: 'Koordinasi pembahasan materi naskah akademik peta tematik.',
      lampiran: [],
      peserta: allMemberIds.slice(0, 35),
      status: 'Batal',
      isBatalSaatBerlangsung: false,
      cancel_reason: 'Penundaan naskah akademik peta tematik',
      alasanBatal: 'Penundaan dari pihak penyusun naskah akademik untuk penyempurnaan peta tematik (Dibatalkan sebelum rapat dimulai)',
      cancelled_by: 'Admin Sekretariat',
      dibatalkanOleh: 'Admin Sekretariat',
      cancelled_at: 'Jumat, 14 November 2026, 16.30 WIB',
      dibatalkanPada: 'Jumat, 14 November 2026, 16.30 WIB',
      createdAt: 'Selasa, 11 November 2026, 11.00 WIB',
      updatedAt: 'Jumat, 14 November 2026, 16.30 WIB'
    };

    // Rapat 6: Draf Rapat Komisi II (Draft, N=10)
    var meeting6 = {
      id: 'rpt-draft-20261125',
      kodeRapat: 'RPT-2026-006',
      namaRapat: 'Draf Rapat Kerja Komisi II Pengelolaan Sampah',
      jenisRapat: 'Rapat Komisi',
      unit: ['Komisi II'],
      tanggal: '2026-11-25',
      jamMulai: '09:00',
      jamSelesai: '11:00',
      lokasi: 'Ruang Rapat Komisi II',
      deskripsi: 'Draf rapat audiensi perwakilan pengelola persampahan.',
      lampiran: [],
      peserta: komisi2Ids,
      status: 'Draft',
      createdAt: 'Senin, 16 November 2026, 14.00 WIB',
      updatedAt: 'Senin, 16 November 2026, 14.00 WIB'
    };

    // Rapat 7: Rapat Dibatalkan Saat Sedang Berlangsung (Arsip Presensi Sah & Utuh)
    var meeting7 = {
      id: 'rpt-batal-berjalan-20261120',
      kodeRapat: 'RPT-2026-007',
      namaRapat: 'Rapat Kerja Komisi II (Dibatalkan Saat Sidang Berjalan)',
      jenisRapat: 'Rapat Komisi',
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
      peserta: allMemberIds.slice(0, 25),
      status: 'Batal',
      isBatalSaatBerlangsung: true,
      cancel_reason: 'Gangguan darurat instalasi kelistrikan di ruang sidang (Dibatalkan pukul 08.20 WIB)',
      alasanBatal: 'Dibatalkan oleh Admin Sekretariat saat rapat sedang berlangsung (pukul 08.20 WIB) akibat gangguan darurat instalasi kelistrikan di ruang sidang. Data presensi anggota yang telah hadir dan melakukan scan presensi QR tetap sah dan tersimpan sebagai arsip resmi.',
      cancelled_by: 'Admin Sekretariat',
      dibatalkanOleh: 'Admin Sekretariat',
      cancelled_at: 'Jumat, 20 November 2026, 08.20 WIB',
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
        confirmation_status: 'BELUM_KONFIRMASI',
        presensiStatus: 'Belum presensi',
        attendance_status: 'BELUM_PRESENSI',
        waktuPresensi: null,
        waktuPresensiStr: '-',
        alasanTidakHadir: '',
        absence_reason: '',
        badge: null,
        lateMinutes: 0
      };
    }

    presences[mainMeeting.id]['P1'] = {
      kehadiran: 'Hadir',
      confirmation_status: 'HADIR',
      presensiStatus: 'Sudah presensi',
      attendance_status: 'SUDAH_PRESENSI',
      waktuPresensi: new Date(2026, 10, 20, 8, 50, 0).getTime(),
      waktuPresensiStr: '08.50 WIB',
      alasanTidakHadir: '',
      absence_reason: '',
      badge: 'Tepat Waktu',
      badgeClass: 'badge-success',
      punctuality_label: 'Tepat Waktu',
      lateMinutes: 0
    };

    presences[mainMeeting.id]['P2'] = {
      kehadiran: 'Hadir',
      confirmation_status: 'HADIR',
      presensiStatus: 'Sudah presensi',
      attendance_status: 'SUDAH_PRESENSI',
      waktuPresensi: new Date(2026, 10, 20, 9, 5, 0).getTime(),
      waktuPresensiStr: '09.05 WIB',
      alasanTidakHadir: '',
      absence_reason: '',
      badge: 'Terlambat 5 menit',
      badgeClass: 'badge-warn',
      punctuality_label: 'Terlambat 5 mnt',
      lateMinutes: 5
    };

    presences[mainMeeting.id]['P3'] = {
      kehadiran: 'Hadir',
      confirmation_status: 'HADIR',
      presensiStatus: 'Sudah presensi',
      attendance_status: 'SUDAH_PRESENSI',
      waktuPresensi: new Date(2026, 10, 20, 8, 55, 0).getTime(),
      waktuPresensiStr: '08.55 WIB',
      alasanTidakHadir: '',
      absence_reason: '',
      badge: 'Tepat Waktu',
      badgeClass: 'badge-success',
      punctuality_label: 'Tepat Waktu',
      lateMinutes: 0
    };

    presences[mainMeeting.id]['P4'] = {
      kehadiran: 'Hadir',
      confirmation_status: 'HADIR',
      presensiStatus: 'Belum presensi',
      attendance_status: 'BELUM_PRESENSI',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: '',
      absence_reason: '',
      badge: null,
      lateMinutes: 0
    };

    presences[mainMeeting.id]['P6'] = {
      kehadiran: 'Tidak hadir',
      confirmation_status: 'TIDAK_HADIR',
      presensiStatus: '-',
      attendance_status: 'TIDAK_BERLAKU',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: 'Penugasan di luar kota',
      absence_reason: 'Penugasan di luar kota',
      badge: null,
      lateMinutes: 0
    };

    presences[mainMeeting.id]['P7'] = {
      kehadiran: 'Tidak hadir',
      confirmation_status: 'TIDAK_HADIR',
      presensiStatus: '-',
      attendance_status: 'TIDAK_BERLAKU',
      waktuPresensi: null,
      waktuPresensiStr: '-',
      alasanTidakHadir: 'Urusan keluarga mendesak',
      absence_reason: 'Urusan keluarga mendesak',
      badge: null,
      lateMinutes: 0
    };

    // Presensi untuk Rapat 2 (Komisi I: 10 orang)
    presences[meeting2.id] = {};
    for (var c1 = 0; c1 < komisi1Ids.length; c1++) {
      var c1Id = komisi1Ids[c1];
      presences[meeting2.id][c1Id] = {
        kehadiran: c1 < 7 ? 'Hadir' : (c1 === 7 ? 'Tidak hadir' : 'Belum konfirmasi'),
        confirmation_status: c1 < 7 ? 'HADIR' : (c1 === 7 ? 'TIDAK_HADIR' : 'BELUM_KONFIRMASI'),
        presensiStatus: c1 < 5 ? 'Sudah presensi' : (c1 === 7 ? '-' : 'Belum presensi'),
        attendance_status: c1 < 5 ? 'SUDAH_PRESENSI' : (c1 === 7 ? 'TIDAK_BERLAKU' : 'BELUM_PRESENSI'),
        waktuPresensi: c1 < 5 ? new Date(2026, 10, 20, 8, c1 * 3, 0).getTime() : null,
        waktuPresensiStr: c1 < 5 ? '08.0' + (c1 * 3) + ' WIB' : '-',
        alasanTidakHadir: c1 === 7 ? 'Tugas dinas luar kota' : '',
        absence_reason: c1 === 7 ? 'Tugas dinas luar kota' : '',
        badge: c1 < 5 ? 'Tepat Waktu' : null,
        badgeClass: c1 < 5 ? 'badge-success' : null,
        punctuality_label: c1 < 5 ? 'Tepat Waktu' : null,
        lateMinutes: 0
      };
    }

    // Presensi untuk Rapat 4 (Bamus: Selesai, 20 orang)
    presences[meeting4.id] = {};
    for (var b = 0; b < bamusIds.length; b++) {
      var bId = bamusIds[b];
      var isH = b < 16;
      presences[meeting4.id][bId] = {
        kehadiran: isH ? 'Hadir' : 'Tidak hadir',
        confirmation_status: isH ? 'HADIR' : 'TIDAK_HADIR',
        presensiStatus: isH ? 'Sudah presensi' : '-',
        attendance_status: isH ? 'SUDAH_PRESENSI' : 'TIDAK_BERLAKU',
        waktuPresensi: isH ? new Date(2026, 10, 18, 8, 45 + (b % 15), 0).getTime() : null,
        waktuPresensiStr: isH ? '08.' + String(45 + (b % 15)).padStart(2, '0') + ' WIB' : '-',
        alasanTidakHadir: isH ? '' : 'Dinas luar',
        absence_reason: isH ? '' : 'Dinas luar',
        badge: isH ? 'Tepat Waktu' : null,
        badgeClass: isH ? 'badge-success' : null,
        punctuality_label: isH ? 'Tepat Waktu' : null,
        lateMinutes: 0
      };
    }

    // Presensi untuk Rapat 7 (Dibatalkan Saat Berjalan, Presensi 25 orang tetap sah)
    presences[meeting7.id] = {};
    for (var k2 = 0; k2 < 25; k2++) {
      var k2Id = allMemberIds[k2];
      var k2Hadir = k2 < 18;
      presences[meeting7.id][k2Id] = {
        kehadiran: k2Hadir ? 'Hadir' : (k2 === 18 ? 'Tidak hadir' : 'Belum konfirmasi'),
        confirmation_status: k2Hadir ? 'HADIR' : (k2 === 18 ? 'TIDAK_HADIR' : 'BELUM_KONFIRMASI'),
        presensiStatus: k2Hadir ? 'Sudah presensi' : (k2 === 18 ? '-' : 'Belum presensi'),
        attendance_status: k2Hadir ? 'SUDAH_PRESENSI' : (k2 === 18 ? 'TIDAK_BERLAKU' : 'BELUM_PRESENSI'),
        waktuPresensi: k2Hadir ? new Date(2026, 10, 20, 8, 5 + (k2 % 10), 0).getTime() : null,
        waktuPresensiStr: k2Hadir ? '08.' + String(5 + (k2 % 10)).padStart(2, '0') + ' WIB' : '-',
        alasanTidakHadir: k2 === 18 ? 'Izin kesehatan' : '',
        absence_reason: k2 === 18 ? 'Izin kesehatan' : '',
        badge: k2Hadir ? 'Tepat Waktu' : null,
        badgeClass: k2Hadir ? 'badge-success' : null,
        punctuality_label: k2Hadir ? 'Tepat Waktu' : null,
        lateMinutes: 0
      };
    }

    setJSON(KEYS.PRESENCES, presences);

    // 5. Notifikasi Sampel Sesuai TRD v1.1
    var notifs = [
      {
        id: 'notif-1',
        type: 'reminder_h1',
        event_type: 'MEETING_REMINDER_H1',
        category: 'Undangan',
        title: 'Pengingat Rapat H-1: ' + meeting3.namaRapat,
        message: meeting3.namaRapat + ' akan dilaksanakan besok (Jumat, 20 November 2026 pukul 13:30 WIB). Mohon segera konfirmasi kehadiran Anda melalui aplikasi mobile.',
        body_segments: [
          { text: meeting3.namaRapat, style: 'HIGHLIGHT' },
          { text: ' akan dilaksanakan besok (Jumat, 20 November 2026 pukul 13:30 WIB). Mohon segera konfirmasi kehadiran Anda melalui aplikasi mobile.', style: 'DEFAULT' }
        ],
        redirect_page: 'DETAIL_UNDANGAN_RAPAT',
        dateStr: 'Kamis, 19 November 2026, 08.00 WIB',
        timestamp: new Date(2026, 10, 19, 8, 0, 0).getTime(),
        readBy: [],
        meetingId: meeting3.id,
        memberIds: banggarIds
      },
      {
        id: 'notif-2',
        type: 'rapat_dijadwalkan',
        event_type: 'MEETING_SCHEDULED',
        category: 'Undangan',
        title: 'Undangan ' + mainMeeting.namaRapat,
        message: mainMeeting.namaRapat + ' telah dijadwalkan pada Jumat, 20 November 2026 pukul 09.00–12.00 WIB.',
        body_segments: [
          { text: mainMeeting.namaRapat, style: 'HIGHLIGHT' },
          { text: ' telah dijadwalkan pada Jumat, 20 November 2026 pukul 09.00–12.00 WIB.', style: 'DEFAULT' }
        ],
        redirect_page: 'DETAIL_UNDANGAN_RAPAT',
        dateStr: 'Kamis, 12 November 2026, 10.00 WIB',
        timestamp: new Date(2026, 10, 12, 10, 0, 0).getTime(),
        readBy: ['P1', 'P2'],
        meetingId: mainMeeting.id,
        memberIds: allMemberIds
      },
      {
        id: 'notif-3',
        type: 'rapat_dibatalkan',
        event_type: 'MEETING_CANCELLED',
        category: 'Undangan',
        title: 'Pemberitahuan: Rapat Pansus Dibatalkan',
        message: 'Rapat Koordinasi Pansus Raperda RTRW tanggal 15 November 2026 telah dibatalkan oleh Admin Sekretariat. Alasan: Penundaan naskah akademik.',
        body_segments: [
          { text: 'Rapat Koordinasi Pansus Raperda RTRW', style: 'HIGHLIGHT' },
          { text: ' tanggal 15 November 2026 telah dibatalkan oleh Admin Sekretariat. Alasan: Penundaan naskah akademik.', style: 'DEFAULT' }
        ],
        redirect_page: 'DETAIL_UNDANGAN_RAPAT',
        dateStr: 'Jumat, 14 November 2026, 16.30 WIB',
        timestamp: new Date(2026, 10, 14, 16, 30, 0).getTime(),
        readBy: [],
        meetingId: meeting5.id,
        memberIds: meeting5.peserta
      }
    ];
    setJSON(KEYS.NOTIFICATIONS, notifs);
  };

  // Inisialisasi awal saat skrip dimuat (Auto-update seed jika schema baru)
  var CURRENT_SCHEMA_VER = '2026.11.18.v1.1_final';
  if (localStorage.getItem('epar_schema_version') !== CURRENT_SCHEMA_VER) {
    localStorage.setItem('epar_schema_version', CURRENT_SCHEMA_VER);
    Store.seedData(true);
  } else {
    Store.seedData(false);
  }

  window.Store = Store;
})(window);
