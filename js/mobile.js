/**
 * mobile.js - Controller Mobile Anggota DPRD e-Parlemen
 * Menyesuaikan Dokumen TRD & API Specification v1.1:
 * - Tab Default: BERLANGSUNG
 * - State Machine & Real-Time Computed display_status
 * - Konfirmasi Kehadiran One-Way & Alasan Tidak Hadir Wajib
 * - Scan QR Presensi Hari-H (Boleh scan sebelum jam mulai)
 * - Punctuality Tracking: Tepat Waktu vs Terlambat X Menit
 * - Formatted Notification Feed dengan body_segments JSONB
 */

(function (window) {
  'use strict';

  var Mobile = {};

  var activeTab = 'agenda';
  var agendaFilterTab = 'Berjalan'; // DEFAULT tab Berjalan (BERLANGSUNG) TRD v1.1 Hal 17
  var activeMeetingDetailId = null;
  var scanSubTab = 'scan';

  Mobile.init = function () {
    Mobile.renderTimeBar();
    Mobile.renderHeaderUser();
    Mobile.bindEvents();
    Mobile.switchTab('agenda');

    window.addEventListener('epar-store-changed', function () {
      Mobile.renderTimeBar();
      Mobile.updateBadgeCounters();
      if (activeMeetingDetailId) {
        Mobile.renderMeetingDetail(activeMeetingDetailId);
      } else if (activeTab === 'agenda') {
        Mobile.renderAgendaList();
      } else if (activeTab === 'beranda') {
        Mobile.renderBeranda();
      } else if (activeTab === 'notifikasi') {
        Mobile.renderNotifikasi();
      }
    });
  };

  Mobile.renderTimeBar = function () {
    var bar = document.getElementById('mobileTimeBar');
    if (!bar) return;

    var now = Store.now();
    var ymd = Rules.formatDateYMD(now);
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var nowStr = Rules.formatDateIndo(now) + ', ' + Rules.formatTimeWIB(now);

    bar.innerHTML =
      '<div style="display:flex; align-items:center; justify-content:space-between; width:100%;">' +
      '<div style="font-size:11px; font-weight:700; color:var(--gold-light); display:flex; align-items:center; gap:4px;">' +
      '<svg class="ic-svg" viewBox="0 0 24 24" style="width:12px; height:12px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' +
      '<span>' + nowStr + '</span>' +
      '</div>' +
      '<button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:10px; background:rgba(255,255,255,0.2); color:#fff; border:none;" id="btnToggleSimMob">Ubah Waktu</button>' +
      '</div>' +
      '<div id="simMobDropdown" style="display:none; margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.2); width:100%;">' +
      '<div style="display:flex; gap:6px; margin-bottom:6px;">' +
      '<input type="date" id="mobTsDate" value="' + ymd + '" style="background:#fff; border:1px solid #ccc; font-size:11px; padding:3px 6px; border-radius:4px; flex:1;">' +
      '<input type="time" id="mobTsTime" value="' + h + ':' + m + '" style="background:#fff; border:1px solid #ccc; font-size:11px; padding:3px 6px; border-radius:4px;">' +
      '<button type="button" class="btn btn-gold btn-sm" id="btnMobSetTime" style="padding:2px 8px; font-size:11px;">Set</button>' +
      '</div>' +
      '<div style="display:flex; gap:4px; flex-wrap:wrap;">' +
      '<button type="button" class="ts-btn" data-mobpreset="2026-11-20T08:30:00">08:30 (Berlangsung)</button>' +
      '<button type="button" class="ts-btn" data-mobpreset="2026-11-20T09:30:00">09:30 (Berjalan)</button>' +
      '<button type="button" class="ts-btn" data-mobpreset="2026-11-20T12:05:00">12:05 (Selesai)</button>' +
      '<button type="button" class="ts-btn" data-mobpreset="2026-11-19T08:00:00">19 Nov (H-1)</button>' +
      '<button type="button" class="ts-btn" id="btnMobReset">Reset</button>' +
      '</div>' +
      '</div>';

    document.getElementById('btnToggleSimMob').onclick = function () {
      var dd = document.getElementById('simMobDropdown');
      dd.style.display = (dd.style.display === 'none') ? 'block' : 'none';
    };

    document.getElementById('btnMobSetTime').onclick = function () {
      var d = document.getElementById('mobTsDate').value;
      var t = document.getElementById('mobTsTime').value;
      if (d && t) {
        Store.setTime(d + 'T' + t + ':00');
        Mobile.showToast('Waktu diubah: ' + t + ' WIB');
      }
    };

    document.getElementById('btnMobReset').onclick = function () {
      Store.resetTime();
      Mobile.showToast('Waktu direset ke 20 Nov 08:30 WIB');
    };

    bar.querySelectorAll('[data-mobpreset]').forEach(function (btn) {
      btn.onclick = function () {
        var iso = btn.getAttribute('data-mobpreset');
        Store.setTime(iso);
        Mobile.showToast('Waktu disetel: ' + btn.textContent);
      };
    });
  };

  /**
   * Header Profil User dengan Selector 10 Akun Demo Terkurasi
   */
  Mobile.renderHeaderUser = function () {
    var pill = document.getElementById('mobHeaderUserPill');
    if (!pill) return;

    var curId = Store.getCurrentMemberId();
    var curated = Store.getCuratedDemoMembers();

    var selectHtml = '<select id="memberSelector" title="Pilih Akun Anggota Demo">';
    curated.forEach(function (item) {
      selectHtml += '<option value="' + item.id + '" ' + (item.id === curId ? 'selected' : '') + '>' + item.id + ' (' + item.tag + ')</option>';
    });
    selectHtml += '</select>';

    pill.innerHTML =
      '<svg class="ic-svg" viewBox="0 0 24 24" style="width:13px; height:13px;"><circle cx="12" cy="8" r="4"></circle><path d="M6 20v-2a6 6 0 0 1 12 0v2"></path></svg>' +
      selectHtml;

    document.getElementById('memberSelector').onchange = function (e) {
      var newId = e.target.value;
      Store.setCurrentMemberId(newId);
      Mobile.showToast('Beralih ke profil: ' + newId);
    };
  };

  Mobile.bindEvents = function () {
    var navButtons = document.querySelectorAll('.bottom-nav .nav-item');
    navButtons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var target = btn.getAttribute('data-mobtab');
        Mobile.switchTab(target);
      });
    });
  };

  Mobile.switchTab = function (tabName) {
    activeTab = tabName;
    activeMeetingDetailId = null;

    document.querySelectorAll('.bottom-nav .nav-item').forEach(function (btn) {
      if (btn.getAttribute('data-mobtab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    var container = document.getElementById('mobileMainContent');
    if (!container) return;

    if (tabName === 'beranda') {
      Mobile.renderBeranda(container);
    } else if (tabName === 'notifikasi') {
      Mobile.renderNotifikasi(container);
    } else if (tabName === 'scan') {
      Mobile.renderScanScreen(container);
    } else if (tabName === 'agenda') {
      Mobile.renderAgendaScreen(container);
    } else if (tabName === 'profil') {
      Mobile.renderProfil(container);
    }

    Mobile.updateBadgeCounters();
  };

  Mobile.updateBadgeCounters = function () {
    var curId = Store.getCurrentMemberId();
    var notifs = Store.getNotifications(curId);
    var unread = notifs.filter(function (n) {
      return n.readBy.indexOf(curId) === -1;
    }).length;

    var badge = document.getElementById('mobNotifBadgeDot');
    if (badge) {
      if (unread > 0) {
        badge.style.display = 'block';
        badge.textContent = unread > 9 ? '9+' : unread;
      } else {
        badge.style.display = 'none';
      }
    }
  };

  /* ==========================================================================
     MENU 1: BERANDA
     ========================================================================== */
  Mobile.renderBeranda = function (container) {
    container = container || document.getElementById('mobileMainContent');
    var curMember = Store.getMemberById(Store.getCurrentMemberId());
    var now = Store.now();
    var allMeetings = Store.getMeetings();

    var todayStr = Rules.formatDateYMD(now);
    var todayMeetings = allMeetings.filter(function (m) {
      return m.status !== 'Draft' && m.tanggal === todayStr && (m.peserta || []).indexOf(curMember.id) !== -1;
    });

    var nextMeetings = allMeetings.filter(function (m) {
      var der = Rules.deriveDisplayStatus(m, now);
      return m.status !== 'Draft' && m.status !== 'Batal' && (der === 'BERLANGSUNG' || der === 'DIJADWALKAN') && (m.peserta || []).indexOf(curMember.id) !== -1;
    });
    nextMeetings.sort(function (a, b) {
      return a.tanggal.localeCompare(b.tanggal) || a.jamMulai.localeCompare(b.jamMulai);
    });
    var nextM = nextMeetings.length ? nextMeetings[0] : null;

    container.innerHTML =
      '<div class="card bl-gold" style="margin-bottom:14px;">' +
      '<div style="display:flex; gap:12px; align-items:center;">' +
      '<div style="width:46px; height:46px; border-radius:50%; background:var(--green-mid); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px;">' +
      curMember.id +
      '</div>' +
      '<div style="flex:1;">' +
      '<div style="font-weight:700; font-size:15px; color:var(--ink);">' + curMember.nama + '</div>' +
      '<div style="font-size:11.5px; color:var(--muted); font-family:monospace;">' + curMember.kode + ' · ' + curMember.jabatan + '</div>' +
      '<div style="margin-top:4px;"><span class="tag-unit">' + curMember.unit + '</span> <span class="tag-unit" style="background:#eef2ff; color:#3b5998; border-color:#d0d9f5;">' + curMember.fraksi + '</span></div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="card bl-danger" style="background:#fff9f9; border-color:#f8dcdc; cursor:pointer;" onclick="Mobile.openTodayMeetingsModal()">' +
      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
      '<div>' +
      '<div style="font-size:11px; font-weight:700; color:var(--danger); text-transform:uppercase; letter-spacing:0.5px;">Agenda Hari Ini · ' + Rules.formatDateIndo(now) + '</div>' +
      '<div style="font-size:17px; font-weight:800; color:var(--ink); margin-top:2px;">' + todayMeetings.length + ' Agenda Rapat</div>' +
      '</div>' +
      '<div class="btn btn-sm btn-danger" style="padding:4px 8px; font-size:11px;">Lihat Hari Ini &rsaquo;</div>' +
      '</div>' +
      '</div>' +

      '<div class="card" style="background:linear-gradient(135deg, var(--green-mid), var(--green-dark)); color:#fff; margin-bottom:14px;">' +
      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
      '<div>' +
      '<div style="font-size:15px; font-weight:700; color:#fff;">Presensi Rapat Cepat</div>' +
      '<div style="font-size:12px; color:var(--gold-light); margin-top:2px;">Scan QR kode rapat dari layar admin</div>' +
      '</div>' +
      '<button type="button" class="btn btn-gold" onclick="Mobile.switchTab(\'scan\')">' +
      '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg> Scan QR' +
      '</button>' +
      '</div>' +
      '</div>' +

      '<div style="margin-bottom:14px;">' +
      '<div style="font-size:14px; font-weight:700; margin-bottom:8px; color:var(--ink);">Agenda Terdekat</div>' +
      (nextM ?
        '<div class="meeting-card bl-success" onclick="Mobile.openMeetingDetail(\'' + nextM.id + '\')">' +
        '<div class="mc-header">' +
        '<div>' +
        '<span class="badge ' + (Rules.deriveDisplayStatus(nextM, now) === 'BERLANGSUNG' ? 'badge-live' : 'badge-info') + '">' +
        (Rules.deriveDisplayStatus(nextM, now) === 'BERLANGSUNG' ? 'Sedang Berjalan' : 'Mendatang') +
        '</span>' +
        '<div class="mc-title" style="margin-top:6px;">' + nextM.namaRapat + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="mc-meta-row">' +
        '<svg class="ic-svg" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
        '<span>' + Rules.formatDateIndo(new Date(nextM.tanggal)) + ' · ' + nextM.jamMulai + '–' + nextM.jamSelesai + ' WIB</span>' +
        '</div>' +
        '<div class="mc-meta-row">' +
        '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' +
        '<span>' + (nextM.lokasi || 'DPRD Kota Magelang') + '</span>' +
        '</div>' +
        '<div style="text-align:right; margin-top:8px;">' +
        '<span class="btn btn-sm btn-secondary" style="font-size:11px;">Buka Detail Undangan &rsaquo;</span>' +
        '</div>' +
        '</div>'
        : '<div class="card" style="text-align:center; color:var(--muted); font-size:12.5px;">Tidak ada jadwal rapat mendatang.</div>') +
      '</div>';
  };

  /* ==========================================================================
     MENU 2: NOTIFIKASI DENGAN BODY_SEGMENTS FORMAT (TRD v1.1 Hal 18-19)
     ========================================================================== */
  Mobile.renderNotifikasi = function (container, filterCat) {
    container = container || document.getElementById('mobileMainContent');
    filterCat = filterCat || 'Semua';
    var curId = Store.getCurrentMemberId();
    var notifs = Store.getNotifications(curId);

    if (filterCat !== 'Semua') {
      notifs = notifs.filter(function (n) { return n.category === filterCat; });
    }

    var html =
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
      '<div style="font-size:16px; font-weight:700; color:var(--ink);">Pemberitahuan</div>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="btnMarkAllRead" style="font-size:11px;">Tandai Semua Dibaca</button>' +
      '</div>' +

      '<div class="mobile-tabs">' +
      ['Semua', 'Undangan', 'Persuratan', 'Penugasan'].map(function (c) {
        return '<button type="button" class="mobile-tab ' + (filterCat === c ? 'active' : '') + '" onclick="Mobile.renderNotifikasi(null, \'' + c + '\')">' + c + '</button>';
      }).join('') +
      '</div>' +

      '<div id="notifListContainer">';

    if (notifs.length === 0) {
      html += '<div class="card" style="text-align:center; padding:30px 10px; color:var(--muted); font-size:13px;">Tidak ada pemberitahuan pada kategori ini.</div>';
    } else {
      notifs.forEach(function (n) {
        var isRead = n.readBy.indexOf(curId) !== -1;
        var borderCls = (n.event_type === 'MEETING_CANCELLED' || n.type === 'rapat_dibatalkan')
          ? 'bl-danger'
          : ((n.event_type === 'MEETING_SCHEDULED' || n.type === 'rapat_dijadwalkan') ? 'bl-success' : 'bl-gold');

        // Render Segments JSONB jika tersedia
        var formattedMsg = '';
        if (n.body_segments && n.body_segments.length) {
          formattedMsg = n.body_segments.map(function (seg) {
            if (seg.style === 'HIGHLIGHT') {
              return '<strong style="color:var(--green-dark);">' + seg.text + '</strong>';
            }
            return seg.text;
          }).join('');
        } else {
          formattedMsg = n.message || '';
        }

        html +=
          '<div class="card ' + borderCls + '" style="' + (isRead ? 'opacity:0.8;' : 'background:#fff;') + ' margin-bottom:10px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">' +
          '<div style="font-weight:700; font-size:13.5px; color:var(--ink);">' + n.title + '</div>' +
          (!isRead ? '<span class="badge badge-today" style="font-size:9.5px;">Baru</span>' : '') +
          '</div>' +
          '<div style="font-size:12.5px; color:#49564f; margin-top:4px;">' + formattedMsg + '</div>' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:11px; color:var(--muted);">' +
          '<span>' + n.dateStr + '</span>' +
          (n.meetingId ? '<a href="#" style="color:var(--green); font-weight:600;" onclick="Mobile.openMeetingDetail(\'' + n.meetingId + '\'); return false;">Lihat Rapat &rsaquo;</a>' : '') +
          '</div>' +
          '</div>';
      });
    }

    html += '</div>';
    container.innerHTML = html;

    document.getElementById('btnMarkAllRead').onclick = function () {
      Store.markAllNotificationsRead(curId);
      Mobile.showToast('Semua notifikasi ditandai dibaca.');
      Mobile.renderNotifikasi(null, filterCat);
    };
  };

  /* ==========================================================================
     MENU 3: SCAN QR PRESENSI
     ========================================================================== */
  Mobile.renderScanScreen = function (container) {
    container = container || document.getElementById('mobileMainContent');
    var curMember = Store.getMemberById(Store.getCurrentMemberId());
    var allMeetings = Store.getMeetings();

    container.innerHTML =
      '<div class="mobile-tabs" style="margin-bottom:14px;">' +
      '<button type="button" class="mobile-tab ' + (scanSubTab === 'scan' ? 'active' : '') + '" id="tabBtnScanKehadiran">Scan Kehadiran</button>' +
      '<button type="button" class="mobile-tab ' + (scanSubTab === 'qrsaya' ? 'active' : '') + '" id="tabBtnQRSaya">QR Saya</button>' +
      '</div>' +

      '<div id="scanSubViewContainer"></div>';

    document.getElementById('tabBtnScanKehadiran').onclick = function () {
      scanSubTab = 'scan';
      Mobile.renderScanScreen(container);
    };
    document.getElementById('tabBtnQRSaya').onclick = function () {
      scanSubTab = 'qrsaya';
      Mobile.renderScanScreen(container);
    };

    var subContainer = document.getElementById('scanSubViewContainer');

    if (scanSubTab === 'qrsaya') {
      subContainer.innerHTML =
        '<div class="card qr-display-box">' +
        '<div style="font-weight:700; font-size:15px; margin-bottom:4px;">QR Identitas Anggota</div>' +
        '<div style="font-size:12px; color:var(--muted); margin-bottom:14px;">Identitas resmi anggota DPRD Kota Magelang</div>' +
        '<div class="qr-canvas-holder" id="memberQrHolder"></div>' +
        '<div style="font-family:monospace; font-weight:700; font-size:14px; margin-top:8px;">' + curMember.kode + '</div>' +
        '<div style="font-size:13px; font-weight:700; color:var(--ink); margin-top:2px;">' + curMember.nama + '</div>' +
        '<div style="font-size:11.5px; color:var(--muted);">' + curMember.unit + ' · ' + curMember.fraksi + '</div>' +
        '</div>';

      var holder = document.getElementById('memberQrHolder');
      if (window.QRCode) {
        new QRCode(holder, {
          text: curMember.kode,
          width: 170,
          height: 170,
          colorDark: '#0f2318',
          colorLight: '#ffffff'
        });
      } else {
        holder.innerHTML = '<div style="width:170px; height:170px; display:flex; align-items:center; justify-content:center; background:#eee; font-family:monospace;">' + curMember.kode + '</div>';
      }

    } else {
      subContainer.innerHTML =
        '<div class="scanner-viewport">' +
        '<div class="scanner-frame-corners">' +
        '<div class="scanner-beam"></div>' +
        '</div>' +
        '</div>' +

        '<div class="card">' +
        '<div style="font-weight:700; font-size:14px; margin-bottom:6px;">Arahkan Kamera ke QR Rapat</div>' +
        '<div style="font-size:12px; color:var(--muted); margin-bottom:12px;">Presensi dibuka pada hari rapat (diperbolehkan sebelum jam mulai) hingga jam rapat selesai.</div>' +

        '<div style="background:#f7f6f2; border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px; margin-bottom:12px;">' +
        '<div style="font-weight:700; font-size:12.5px; color:var(--ink); margin-bottom:6px;">Simulasi Scan Presensi:</div>' +
        '<div style="font-size:11.5px; color:var(--muted); margin-bottom:8px;">Pilih sesi rapat untuk simulasi scan kode:</div>' +
        '<div class="form-group" style="margin-bottom:8px;">' +
        '<select id="simScanMeetingSelect" style="font-size:12px; padding:6px 10px;">' +
        allMeetings.filter(function (m) { return m.status !== 'Draft'; }).map(function (m) {
          return '<option value="' + m.id + '">' + m.kodeRapat + ' — ' + m.namaRapat + ' (' + m.tanggal + ' ' + m.jamMulai + ')' + '</option>';
        }).join('') +
        '</select>' +
        '</div>' +
        '<button type="button" class="btn btn-primary btn-block" id="btnSimulateScan">Simulasikan Scan Presensi</button>' +
        '</div>' +

        '<div id="scanResultNotice" style="display:none; margin-top:10px;"></div>' +
        '</div>';

      document.getElementById('btnSimulateScan').onclick = function () {
        var mId = document.getElementById('simScanMeetingSelect').value;
        Mobile.executeScanProcess(mId);
      };
    }
  };

  Mobile.executeScanProcess = function (meetingId) {
    var curId = Store.getCurrentMemberId();
    var meeting = Store.getMeetingById(meetingId);
    var now = Store.now();

    var resNotice = document.getElementById('scanResultNotice');

    if (!meeting) {
      if (resNotice) {
        resNotice.style.display = 'block';
        resNotice.innerHTML = '<div class="card bl-danger" style="background:#fdf2f2; color:var(--danger); font-size:13px; font-weight:700;">QR tidak dikenali</div>';
      }
      return;
    }

    var recordResult = Store.recordPresence(meeting.id, curId, now);

    if (recordResult.success) {
      var msg = recordResult.badge === 'Tepat Waktu'
        ? 'Selamat Anda Sudah Presensi Tepat Waktu (Pukul ' + recordResult.timeStr + ')'
        : 'Presensi berhasil (Pukul ' + recordResult.timeStr + ' - ' + recordResult.badge + ')';

      Mobile.showScanModal(
        'Presensi Berhasil',
        '<div style="text-align:center; padding:10px 0;">' +
        '<div style="font-size:40px; margin-bottom:8px;">🎉</div>' +
        '<div style="font-weight:700; font-size:15px; color:var(--success);">' + msg + '</div>' +
        '<div style="font-size:12.5px; color:var(--muted); margin-top:8px;">' + meeting.namaRapat + ' (' + meeting.kodeRapat + ')</div>' +
        '</div>',
        function () {
          Mobile.openMeetingDetail(meeting.id);
        }
      );
    } else {
      Mobile.showScanModal(
        'Gagal Presensi',
        '<div style="text-align:center; padding:10px 0;">' +
        '<div style="font-size:40px; margin-bottom:8px;">⚠️</div>' +
        '<div style="font-weight:700; font-size:14px; color:var(--danger);">' + recordResult.message + '</div>' +
        '<div style="font-size:12px; color:var(--muted); margin-top:6px;">Silakan arahkan ke QR Kode yang benar atau periksa jadwal rapat Anda.</div>' +
        '</div>',
        function () {
          Mobile.openMeetingDetail(meeting.id);
        }
      );
    }
  };

  /* ==========================================================================
     MENU 4: AGENDA (DEFAULT TAB: BERJALAN / BERLANGSUNG - TRD v1.1 Hal 17)
     ========================================================================== */
  Mobile.renderAgendaScreen = function (container) {
    container = container || document.getElementById('mobileMainContent');
    var curMember = Store.getMemberById(Store.getCurrentMemberId());
    var allMeetings = Store.getMeetings();
    var now = Store.now();

    var todayStr = Rules.formatDateYMD(now);
    var todayCount = allMeetings.filter(function (m) {
      return m.status !== 'Draft' && m.tanggal === todayStr && (m.peserta || []).indexOf(curMember.id) !== -1;
    }).length;

    var myMeetings = allMeetings.filter(function (m) {
      if (m.status === 'Draft') return false;
      return (m.peserta || []).indexOf(curMember.id) !== -1;
    });

    var countBerjalan = 0, countMendatang = 0, countSelesai = 0, countDibatalkan = 0;
    myMeetings.forEach(function (m) {
      var d = Rules.deriveDisplayStatus(m, now);
      if (m.status === 'Batal' || d === 'BATAL') countDibatalkan++;
      else if (d === 'BERLANGSUNG') countBerjalan++;
      else if (d === 'SELESAI') countSelesai++;
      else countMendatang++;
    });

    container.innerHTML =
      '<div class="card bl-danger" style="background:#fff7f7; border-color:#fad7d7; cursor:pointer; margin-bottom:12px;" onclick="Mobile.openTodayMeetingsModal()">' +
      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
      '<div>' +
      '<div style="font-size:11px; font-weight:700; color:var(--danger); text-transform:uppercase;">Hari Ini · ' + Rules.formatDateIndo(now) + '</div>' +
      '<div style="font-size:15px; font-weight:800; color:var(--ink); margin-top:1px;">' + todayCount + ' Agenda Rapat Hari Ini</div>' +
      '</div>' +
      '<button type="button" class="btn btn-sm btn-danger" style="font-size:10.5px;">Lihat &rsaquo;</button>' +
      '</div>' +
      '</div>' +

      // Tab Berjalan (DEFAULT TRD v1.1 Hal 17)
      '<div class="mobile-tabs">' +
      [
        { id: 'Berjalan', label: 'Berjalan (' + countBerjalan + ')' },
        { id: 'Mendatang', label: 'Mendatang (' + countMendatang + ')' },
        { id: 'Selesai', label: 'Selesai (' + countSelesai + ')' },
        { id: 'Dibatalkan', label: 'Dibatalkan (' + countDibatalkan + ')' },
        { id: 'Semua', label: 'Semua (' + myMeetings.length + ')' }
      ].map(function (tabObj) {
        return '<button type="button" class="mobile-tab ' + (agendaFilterTab === tabObj.id ? 'active' : '') + '" data-agendatab="' + tabObj.id + '">' + tabObj.label + '</button>';
      }).join('') +
      '</div>' +

      '<div style="background:#fff; border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:12px; font-size:12px;">' +
      '<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">' +
      '<span style="color:var(--muted); width:45px;">Dari:</span>' +
      '<input type="date" id="mobFilterStart" style="flex:1; padding:4px 8px; border:1px solid var(--border); border-radius:4px; font-size:11.5px;">' +
      '</div>' +
      '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">' +
      '<span style="color:var(--muted); width:45px;">Sampai:</span>' +
      '<input type="date" id="mobFilterEnd" style="flex:1; padding:4px 8px; border:1px solid var(--border); border-radius:4px; font-size:11.5px;">' +
      '</div>' +
      '<div style="display:flex; justify-content:flex-end; gap:6px;">' +
      '<button type="button" class="btn btn-secondary btn-sm" id="btnMobResetFilter" style="font-size:11px;">Reset</button>' +
      '<button type="button" class="btn btn-primary btn-sm" id="btnMobApplyFilter" style="font-size:11px;">Terapkan</button>' +
      '</div>' +
      '</div>' +

      '<div id="agendaCardsContainer"></div>';

    container.querySelectorAll('[data-agendatab]').forEach(function (btn) {
      btn.onclick = function () {
        container.querySelectorAll('[data-agendatab]').forEach(function (x) { x.classList.remove('active'); });
        btn.classList.add('active');
        agendaFilterTab = btn.getAttribute('data-agendatab');
        Mobile.renderAgendaList();
      };
    });

    document.getElementById('btnMobApplyFilter').onclick = Mobile.renderAgendaList;
    document.getElementById('btnMobResetFilter').onclick = function () {
      document.getElementById('mobFilterStart').value = '';
      document.getElementById('mobFilterEnd').value = '';
      Mobile.renderAgendaList();
      Mobile.showToast('Filter tanggal direset');
    };

    Mobile.renderAgendaList();
  };

  Mobile.renderAgendaList = function () {
    var container = document.getElementById('agendaCardsContainer');
    if (!container) return;

    var curMember = Store.getMemberById(Store.getCurrentMemberId());
    var allMeetings = Store.getMeetings();
    var now = Store.now();

    var startDate = document.getElementById('mobFilterStart') ? document.getElementById('mobFilterStart').value : '';
    var endDate = document.getElementById('mobFilterEnd') ? document.getElementById('mobFilterEnd').value : '';

    var filtered = allMeetings.filter(function (m) {
      if (m.status === 'Draft') return false; // Draft tidak pernah tampil di mobile!
      if ((m.peserta || []).indexOf(curMember.id) === -1) return false;

      var derived = Rules.deriveDisplayStatus(m, now);

      if (agendaFilterTab === 'Mendatang') {
        if (derived !== 'DIJADWALKAN') return false;
      } else if (agendaFilterTab === 'Berjalan') {
        if (derived !== 'BERLANGSUNG') return false;
      } else if (agendaFilterTab === 'Selesai') {
        if (derived !== 'SELESAI') return false;
      } else if (agendaFilterTab === 'Dibatalkan') {
        if (m.status !== 'Batal' && derived !== 'BATAL') return false;
      }

      if (startDate && m.tanggal < startDate) return false;
      if (endDate && m.tanggal > endDate) return false;

      return true;
    });

    filtered.sort(function (a, b) {
      if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal);
      return (b.jamMulai || '').localeCompare(a.jamMulai || '');
    });

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="card" style="text-align:center; padding:30px 10px; color:var(--muted); font-size:12.5px;">' +
        'Tidak ada rapat pada kategori ini.' +
        '</div>';
      return;
    }

    var html = '';
    filtered.forEach(function (m) {
      var derived = Rules.deriveDisplayStatus(m, now);
      var isToday = (m.tanggal === Rules.formatDateYMD(now));

      var borderCls = (m.status === 'Batal' || derived === 'BATAL')
        ? 'bl-danger'
        : (derived === 'BERLANGSUNG' ? 'bl-success' : (isToday ? 'bl-danger' : 'bl-gold'));

      var badgeHtml = '';
      if (m.status === 'Batal' || derived === 'BATAL') {
        badgeHtml = '<span class="badge badge-danger">Dibatalkan</span>';
      } else if (derived === 'BERLANGSUNG') {
        badgeHtml = '<span class="badge badge-live">Sedang Berjalan</span>';
      } else if (derived === 'SELESAI') {
        badgeHtml = '<span class="badge badge-neutral">Selesai</span>';
      } else {
        badgeHtml = '<span class="badge badge-info">Mendatang</span>';
      }

      var pres = Store.getPresence(m.id, curMember.id);
      var myStatusBadge = '';
      if (m.status === 'Batal' && pres.presensiStatus === 'Sudah presensi') {
        myStatusBadge = '<span class="badge badge-success">Sudah Presensi (' + (pres.badge || 'Tepat Waktu') + ')</span>';
      } else if (pres.kehadiran === 'Hadir') {
        myStatusBadge = '<span class="badge badge-success">Hadir</span>';
      } else if (pres.kehadiran === 'Tidak hadir') {
        myStatusBadge = '<span class="badge badge-danger">Tidak Hadir</span>';
      } else {
        myStatusBadge = '<span class="badge badge-neutral">Belum Konfirmasi</span>';
      }

      html +=
        '<div class="meeting-card ' + borderCls + '" id="mcard-' + m.id + '">' +
        '<div class="mc-header">' +
        '<div>' +
        '<div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap; margin-bottom:4px;">' +
        (isToday ? '<span class="badge badge-today">Hari Ini</span> ' : '') +
        badgeHtml +
        '<span class="tag-unit">' + m.jenisRapat + '</span>' +
        '</div>' +
        '<div class="mc-title">' + m.namaRapat + '</div>' +
        '<div class="mc-code">' + m.kodeRapat + '</div>' +
        '</div>' +
        '<button type="button" class="btn btn-secondary btn-sm" style="padding:3px 6px; font-size:11px;" onclick="Mobile.toggleCardExpand(\'' + m.id + '\')">' +
        '<svg class="ic-svg" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
        '</button>' +
        '</div>' +

        '<div class="mc-meta-row">' +
        '<svg class="ic-svg" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
        '<span>' + Rules.formatDateIndo(new Date(m.tanggal)) + ' · ' + m.jamMulai + '–' + m.jamSelesai + ' WIB</span>' +
        '</div>' +

        '<div class="mc-meta-row">' +
        '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' +
        '<span>' + (m.lokasi || 'DPRD Kota Magelang') + '</span>' +
        '</div>' +

        '<div class="mc-expandable-content">' +
        '<div style="font-size:12px; margin-bottom:6px;"><span style="color:var(--muted);">Status Anda:</span> ' + myStatusBadge + '</div>' +
        '<div style="display:flex; justify-content:flex-end;">' +
        '<button type="button" class="btn btn-primary btn-sm" style="font-size:11.5px;" onclick="Mobile.openMeetingDetail(\'' + m.id + '\')">Buka Detail Undangan &rsaquo;</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    });

    container.innerHTML = html;
  };

  Mobile.toggleCardExpand = function (meetingId) {
    var card = document.getElementById('mcard-' + meetingId);
    if (card) card.classList.toggle('expanded');
  };

  /* ==========================================================================
     LAYAR DETAIL UNDANGAN (TRD v1.1 Hal 17: Konfirmasi & Scan QR Flags)
     ========================================================================== */
  Mobile.openMeetingDetail = function (meetingId) {
    activeMeetingDetailId = meetingId;
    Mobile.renderMeetingDetail(meetingId);
  };

  Mobile.renderMeetingDetail = function (meetingId) {
    var container = document.getElementById('mobileMainContent');
    if (!container) return;

    var meeting = Store.getMeetingById(meetingId);
    if (!meeting) {
      container.innerHTML = '<div class="card">Rapat tidak ditemukan. <button class="btn btn-sm btn-secondary" onclick="Mobile.switchTab(\'agenda\')">Kembali</button></div>';
      return;
    }

    var curMember = Store.getMemberById(Store.getCurrentMemberId());
    var now = Store.now();
    var pres = Store.getPresence(meeting.id, curMember.id);
    var flags = Rules.getActionFlags(meeting, now, pres);

    var isBatal = (meeting.status === 'Batal' || flags.display_status === 'BATAL');
    var isSelesai = (meeting.status === 'Selesai' || flags.display_status === 'SELESAI');

    var statusBadge = '';
    if (isBatal) statusBadge = '<span class="badge badge-danger">Dibatalkan</span>';
    else if (isSelesai) statusBadge = '<span class="badge badge-neutral">Selesai</span>';
    else if (pres.kehadiran === 'Hadir') statusBadge = '<span class="badge badge-success">Dikonfirmasi Hadir</span>';
    else if (pres.kehadiran === 'Tidak hadir') statusBadge = '<span class="badge badge-danger">Tidak Hadir</span>';
    else statusBadge = '<span class="badge badge-warn">Belum Dikonfirmasi</span>';

    var docAttachment = (meeting.lampiran && meeting.lampiran.length > 0)
      ? meeting.lampiran[0]
      : { name: 'Surat_Undangan_' + meeting.kodeRapat + '.pdf', size: '842 KB' };

    container.innerHTML =
      '<div style="margin-bottom:10px;">' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="Mobile.switchTab(\'agenda\')">' +
      '<svg class="ic-svg" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg> Kembali ke Agenda' +
      '</button>' +
      '</div>' +

      // CARD 1: IDENTITAS UNDANGAN
      '<div class="card">' +
      '<div style="display:flex; justify-content:space-between; align-items:flex-start;">' +
      '<span class="badge badge-danger">UNDANGAN RAPAT</span>' +
      statusBadge +
      '</div>' +
      '<h3 class="ctitle" style="margin-top:10px; font-size:16px;">' + meeting.namaRapat + '</h3>' +
      '<div class="hint">Nomor: ' + (meeting.dokumenUndangan ? meeting.dokumenUndangan.nomorSurat : '005/UND/DPRD/XI/2026') + '</div>' +
      '<div class="divider"></div>' +
      '<div class="kv-row"><span class="k">Hari / Tanggal</span><span class="v">' + Rules.formatDateIndo(new Date(meeting.tanggal)) + '</span></div>' +
      '<div class="kv-row"><span class="k">Waktu</span><span class="v">' + meeting.jamMulai + ' – ' + meeting.jamSelesai + ' WIB</span></div>' +
      '<div class="kv-row"><span class="k">Tempat</span><span class="v">' + (meeting.lokasi || 'DPRD Kota Magelang') + '</span></div>' +
      '<div class="kv-row"><span class="k">Pemrakarsa</span><span class="v">' + ((meeting.unit && meeting.unit.length) ? meeting.unit.join(', ') : 'Sekretariat DPRD') + '</span></div>' +
      '<div class="kv-row"><span class="k">Tingkat / Jenis</span><span class="v"><span class="badge badge-neutral">' + meeting.jenisRapat + '</span></span></div>' +
      '</div>' +

      // CARD 2: AGENDA RAPAT
      '<div class="card">' +
      '<h3 class="ctitle">Agenda Rapat</h3>' +
      '<div class="hint">' + (meeting.deskripsi || 'Pembahasan agenda dan program kerja bersama instansi terkait.') + '</div>' +
      '</div>' +

      // CARD 3: DOKUMEN SURAT UNDANGAN RESMI
      '<div class="card">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">' +
      '<h3 class="ctitle" style="margin-bottom:0;">Dokumen Undangan</h3>' +
      '<span class="badge badge-info" style="font-size:10px;">Dari Setwan</span>' +
      '</div>' +
      '<div class="list-item" style="margin-bottom:8px; cursor:pointer;" onclick="Mobile.openDocumentModal(\'' + meeting.id + '\')">' +
      '<div class="icon-box" style="background:var(--danger-bg); color:var(--danger);">PDF</div>' +
      '<div class="content">' +
      '<div class="title">' + docAttachment.name + '</div>' +
      '<div class="meta">' + docAttachment.size + ' · Klik untuk membaca surat resmi</div>' +
      '</div>' +
      '<span class="chev" style="color:var(--green); font-weight:700; font-size:12px;">Lihat &rsaquo;</span>' +
      '</div>' +
      '<button type="button" class="btn btn-secondary btn-block btn-sm" style="font-size:11.5px;" onclick="Mobile.openDocumentModal(\'' + meeting.id + '\')">' +
      '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Buka Surat Undangan Resmi' +
      '</button>' +
      '</div>' +

      // CARD 4: DAFTAR PESERTA
      '<div class="card">' +
      '<h3 class="ctitle">Daftar Peserta (' + (meeting.peserta ? meeting.peserta.length : 0) + ')</h3>' +
      '<div class="stats-grid">' +
      '<div class="stat"><div class="num">' + (meeting.peserta ? meeting.peserta.length : 0) + '</div><div class="lbl">Anggota Dewan</div></div>' +
      '<div class="stat"><div class="num">' + (meeting.peserta && meeting.peserta.length > 5 ? 5 : 1) + '</div><div class="lbl">Pimpinan</div></div>' +
      '<div class="stat"><div class="num">8</div><div class="lbl">OPD Terkait</div></div>' +
      '<div class="stat"><div class="num">Setwan</div><div class="lbl">Fasilitator</div></div>' +
      '</div>' +
      '</div>' +

      // KONDISI RAPAT DIBATALKAN (TRD v1.1 Hal 17: cancel_reason & read-only)
      (isBatal ?
        '<div class="card bl-danger" style="background:#fdf2f2; border-color:#f5c6c6;">' +
        '<div style="font-weight:700; color:var(--danger); font-size:14px;">Rapat Telah Dibatalkan</div>' +
        '<div style="font-size:12.5px; color:var(--ink); margin-top:4px;">Alasan: <strong>' + (meeting.cancel_reason || meeting.alasanBatal || '-') + '</strong></div>' +
        '<div style="font-size:11px; color:var(--muted); margin-top:6px;">Dibatalkan oleh ' + (meeting.cancelled_by || meeting.dibatalkanOleh || 'Admin Sekretariat') + ' · ' + (meeting.cancelled_at || meeting.dibatalkanPada || '-') + '</div>' +
        (meeting.isBatalSaatBerlangsung && pres.presensiStatus === 'Sudah presensi' ?
          '<div style="background:#eaf8ef; border:1px solid #bce1c7; padding:10px 12px; border-radius:8px; margin-top:10px; font-size:12px; color:var(--success); font-weight:700;">' +
          '✓ Anda sudah presensi pada pukul ' + pres.waktuPresensiStr + ' (' + (pres.badge || 'Tepat Waktu') + '). Data presensi Anda tetap tercatat sah sebagai arsip resmi meskipun rapat dihentikan darurat.' +
          '</div>' : '') +
        '<div style="font-size:11.5px; color:var(--muted); margin-top:8px; font-style:italic;">Tombol konfirmasi dan scan presensi dinonaktifkan (Read-only).</div>' +
        '</div>' : '') +

      // CARD 5: KONFIRMASI KEHADIRAN & SCAN QR (TRD v1.1 Hal 11-12)
      (!isBatal && !isSelesai ?
        '<div class="card" id="confirmCard">' +
        '<h3 class="ctitle">Konfirmasi Kehadiran &amp; Presensi</h3>' +
        '<div class="hint" style="margin-bottom:10px; color:var(--danger);">Batas konfirmasi: Sebelum jam rapat selesai (' + meeting.jamSelesai + ' WIB)</div>' +

        // Lapis 1: Konfirmasi Kehadiran
        (flags.can_confirm ?
          '<div>' +
          '<div style="font-size:12.5px; color:var(--muted); margin-bottom:8px;">Silakan tentukan konfirmasi kehadiran Anda (One-way, final):</div>' +
          '<div style="display:flex; gap:10px;">' +
          '<button type="button" class="btn btn-primary" style="flex:1;" onclick="Mobile.confirmAttendance(\'' + meeting.id + '\', \'Hadir\')">' +
          '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6"></path></svg> Hadir' +
          '</button>' +
          '<button type="button" class="btn btn-danger-solid" style="flex:1;" onclick="Mobile.openAbsentReasonModal(\'' + meeting.id + '\')">' +
          '<svg class="ic-svg" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Tidak Hadir' +
          '</button>' +
          '</div>' +
          '</div>' : '') +

        (pres.kehadiran === 'Hadir' ?
          '<div>' +
          '<div style="background:#eaf8ef; border:1px solid #bce1c7; padding:10px 12px; border-radius:8px; margin-bottom:12px; font-size:12.5px; color:var(--success); font-weight:700;">' +
          '✓ Anda telah mengonfirmasi HADIR pada rapat ini.' +
          '</div>' +

          // Lapis 2: Scan QR Berdasarkan scan_button_state
          (flags.scan_button_state === 'ALREADY_SCANNED' ?
            '<div class="card bl-success" style="background:#eaf8ef; margin-bottom:0; padding:12px;">' +
            '<div style="font-weight:700; color:var(--success); font-size:13.5px;">Anda sudah presensi pada pukul ' + pres.waktuPresensiStr + '</div>' +
            '<div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Status Presensi: <span class="badge ' + (pres.badgeClass || 'badge-success') + '">' + (pres.badge || 'Tepat Waktu') + '</span></div>' +
            '</div>'
            : (flags.scan_button_state === 'ACTIVE' ?
              '<div>' +
              '<button type="button" class="btn btn-primary btn-block btn-lg" onclick="Mobile.openScanForMeeting(\'' + meeting.id + '\')">' +
              '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg> Scan QR Presensi' +
              '</button>' +
              '<div style="font-size:11px; color:var(--muted); margin-top:6px; text-align:center;">Presensi dibuka hari ini (diperbolehkan sebelum jam ' + meeting.jamMulai + ' WIB).</div>' +
              '</div>'
              :
              '<div>' +
              '<button type="button" class="btn btn-secondary btn-block btn-lg" disabled>' +
              '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg> Scan QR Belum Aktif' +
              '</button>' +
              '<div style="font-size:11.5px; color:var(--warn); margin-top:6px; text-align:center;">Presensi hanya aktif pada hari rapat (' + Rules.formatDateIndo(new Date(meeting.tanggal)) + ').</div>' +
              '</div>'
            )) +
          '</div>' : '') +

        (pres.kehadiran === 'Tidak hadir' ?
          '<div style="background:#fdf2f2; border:1px solid #f6c0c0; padding:10px 12px; border-radius:8px; font-size:12px; color:var(--ink);">' +
          '<div style="font-weight:700; color:var(--danger); margin-bottom:4px;">Anda mengonfirmasi TIDAK HADIR (Final)</div>' +
          '<div>Alasan: <strong>' + (pres.alasanTidakHadir || pres.absence_reason || '-') + '</strong></div>' +
          '<div style="font-size:11px; color:var(--muted); margin-top:4px;">Status presensi: <span class="badge badge-neutral">TIDAK BERLAKU</span></div>' +
          '</div>' : '') +

        '</div>' : '');
  };

  /**
   * Modal Penampil Dokumen Surat Undangan Resmi DPRD
   */
  Mobile.openDocumentModal = function (meetingId) {
    var meeting = Store.getMeetingById(meetingId);
    if (!meeting) return;

    var doc = meeting.dokumenUndangan || {
      nomorSurat: '005/UND/DPRD/XI/2026',
      perihal: 'Undangan ' + meeting.namaRapat,
      tanggalSurat: meeting.tanggal,
      penandatangan: 'Sekretaris DPRD Kota Magelang',
      nip: '19750812 199803 1 004'
    };

    var modalHtml =
      '<div class="modal-backdrop" id="docViewerModal">' +
      '<div class="modal-card" style="max-width:480px;">' +
      '<div class="modal-header">' +
      '<h3>Dokumen Surat Undangan Resmi</h3>' +
      '<button type="button" class="modal-close" onclick="Mobile.closeModal(\'docViewerModal\')">&times;</button>' +
      '</div>' +
      '<div class="modal-body" style="background:#fff; font-family:\'Times New Roman\', serif; color:#000; padding:22px; font-size:13px; line-height:1.6;">' +
      '<div style="text-align:center; border-bottom:3px double #000; padding-bottom:8px; margin-bottom:14px;">' +
      '<div style="font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">DEWAN PERWAKILAN RAKYAT DAERAH</div>' +
      '<div style="font-size:16px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">KOTA MAGELANG</div>' +
      '<div style="font-size:11px; font-family:sans-serif; color:#444;">Jl. Pahlawan No. 1, Kota Magelang, Jawa Tengah 56117 | Telp: (0293) 362241</div>' +
      '</div>' +

      '<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:12px; font-family:sans-serif;">' +
      '<div>' +
      '<div>Nomor : <strong>' + doc.nomorSurat + '</strong></div>' +
      '<div>Sifat : Penting</div>' +
      '<div>Lampiran : 1 (satu) berkas</div>' +
      '<div>Hal : <strong>Undangan Rapat DPRD</strong></div>' +
      '</div>' +
      '<div style="text-align:right;">Magelang, ' + Rules.formatDateIndo(new Date(doc.tanggalSurat || meeting.tanggal)) + '</div>' +
      '</div>' +

      '<div style="margin-bottom:12px; font-size:12.5px;">' +
      'Kepada Yth.<br>' +
      '<strong>Bapak / Ibu Anggota DPRD Kota Magelang</strong><br>' +
      'di Tempat' +
      '</div>' +

      '<p style="text-align:justify; text-indent:24px; margin:0 0 10px;">' +
      'Menindaklanjuti agenda kerja pimpinan dewan dan komisi, bersama ini kami mengundang Bapak/Ibu Anggota DPRD Kota Magelang untuk menghadiri rapat kedewanan yang akan diselenggarakan pada:' +
      '</p>' +

      '<div style="background:#fcfbf8; border:1px solid #e8e4da; border-radius:6px; padding:10px 14px; margin-bottom:12px; font-family:sans-serif; font-size:12px;">' +
      '<div style="display:grid; grid-template-columns:90px 10px 1fr; gap:4px;">' +
      '<span>Hari, Tanggal</span><span>:</span><strong>' + Rules.formatDateIndo(new Date(meeting.tanggal)) + '</strong>' +
      '<span>Waktu</span><span>:</span><strong>' + meeting.jamMulai + ' – ' + meeting.jamSelesai + ' WIB</strong>' +
      '<span>Tempat</span><span>:</span><strong>' + (meeting.lokasi || 'DPRD Kota Magelang') + '</strong>' +
      '<span>Acara</span><span>:</span><strong>' + meeting.namaRapat + '</strong>' +
      '</div>' +
      '</div>' +

      '<p style="text-align:justify; text-indent:24px; margin:0 0 16px;">' +
      'Mengingat pentingnya materi pembahasan tersebut, kami mengharapkan kehadiran Bapak/Ibu tepat pada waktunya serta melakukan presensi kehadiran digital mandiri melalui aplikasi e-Parlemen.' +
      '</p>' +

      '<div style="text-align:right; margin-top:14px; font-family:sans-serif; font-size:12px;">' +
      '<div>a.n. Pimpinan DPRD Kota Magelang</div>' +
      '<div style="font-weight:700;">' + doc.penandatangan + '</div>' +
      '<div style="margin:20px 0 4px; color:var(--green-dark); font-weight:800; font-size:11px;">[ TERTANDA TANGAN ELEKTRONIK ]</div>' +
      '<div style="font-size:10.5px; color:#555;">NIP. ' + doc.nip + '</div>' +
      '</div>' +

      '</div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-secondary" onclick="Mobile.closeModal(\'docViewerModal\')">Tutup Dokumen</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  Mobile.confirmAttendance = function (meetingId, response) {
    var curId = Store.getCurrentMemberId();
    var res = Store.setAttendance(meetingId, curId, response, '');
    if (res.success) {
      Mobile.showToast('Konfirmasi kehadiran disimpan: ' + response);
      Mobile.renderMeetingDetail(meetingId);
    } else {
      alert(res.message);
    }
  };

  Mobile.openAbsentReasonModal = function (meetingId) {
    var modalHtml =
      '<div class="modal-backdrop" id="absentModal">' +
      '<div class="modal-card">' +
      '<div class="modal-header">' +
      '<h3>Konfirmasi Tidak Hadir</h3>' +
      '<button type="button" class="modal-close" onclick="Mobile.closeModal(\'absentModal\')">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
      '<p style="margin-top:0;">Konfirmasi ini bersifat <strong>FINAL (One-Way)</strong> dan tidak dapat diubah kembali setelah dikirim.</p>' +
      '<div class="form-group">' +
      '<label>Alasan Tidak Hadir (absence_reason) <span class="req">* (Wajib diisi)</span></label>' +
      '<textarea id="mobAbsentReasonText" placeholder="Contoh: Tugas dinas luar kota / Sakit..." required></textarea>' +
      '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-secondary" onclick="Mobile.closeModal(\'absentModal\')">Batal</button>' +
      '<button type="button" class="btn btn-danger-solid" id="btnSubmitAbsent">Kirim Konfirmasi</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btnSubmitAbsent').onclick = function () {
      var reason = (document.getElementById('mobAbsentReasonText').value || '').trim();
      if (!reason) {
        alert('Alasan tidak hadir wajib diisi.');
        return;
      }
      var curId = Store.getCurrentMemberId();
      var res = Store.setAttendance(meetingId, curId, 'Tidak hadir', reason);
      Mobile.closeModal('absentModal');
      if (res.success) {
        Mobile.showToast('Konfirmasi Tidak Hadir disimpan.');
        Mobile.renderMeetingDetail(meetingId);
      } else {
        alert(res.message);
      }
    };
  };

  Mobile.openScanForMeeting = function (meetingId) {
    Mobile.switchTab('scan');
    var select = document.getElementById('simScanMeetingSelect');
    if (select) select.value = meetingId;
  };

  /* ==========================================================================
     MENU 5: PROFIL
     ========================================================================== */
  Mobile.renderProfil = function (container) {
    container = container || document.getElementById('mobileMainContent');
    var curMember = Store.getMemberById(Store.getCurrentMemberId());
    var curated = Store.getCuratedDemoMembers();

    container.innerHTML =
      '<div class="card" style="text-align:center; padding:24px 16px;">' +
      '<div style="width:64px; height:64px; border-radius:50%; background:var(--green-mid); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:20px; margin:0 auto 10px; border:3px solid var(--gold);">' +
      curMember.id +
      '</div>' +
      '<h3 style="font-size:16px; margin-bottom:2px; color:var(--ink);">' + curMember.nama + '</h3>' +
      '<div style="font-family:monospace; font-size:12px; color:var(--muted);">' + curMember.kode + '</div>' +
      '<div style="font-size:13px; font-weight:600; color:var(--green); margin-top:4px;">' + curMember.jabatan + '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div style="font-weight:700; font-size:14px; margin-bottom:12px;">Informasi Keanggotaan</div>' +
      '<div style="display:flex; flex-direction:column; gap:10px; font-size:13px;">' +
      '<div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Unit / AKD:</span> <strong>' + curMember.unit + '</strong></div>' +
      '<div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Komisi:</span> <strong>' + curMember.komisi + '</strong></div>' +
      '<div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Fraksi:</span> <strong>' + curMember.fraksi + '</strong></div>' +
      '<div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Instansi:</span> <strong>DPRD Kota Magelang</strong></div>' +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div style="font-weight:700; font-size:14px; margin-bottom:6px;">Ganti Profil Skenario Demo</div>' +
      '<div style="font-size:12px; color:var(--muted); margin-bottom:10px;">Pilih salah satu dari 10 profil kasus uji:</div>' +
      '<select id="profilMemberSelect" class="filter-select" style="width:100%; font-size:12.5px;">' +
      curated.map(function (item) {
        return '<option value="' + item.id + '" ' + (item.id === curMember.id ? 'selected' : '') + '>' + item.id + ' — ' + item.tag + '</option>';
      }).join('') +
      '</select>' +
      '</div>' +

      '<div style="text-align:center; padding:10px 0;">' +
      '<a href="index.html" class="btn btn-secondary btn-block">Kembali ke Portal Utama</a>' +
      '</div>';

    document.getElementById('profilMemberSelect').onchange = function (e) {
      var newId = e.target.value;
      Store.setCurrentMemberId(newId);
      Mobile.renderHeaderUser();
      Mobile.renderProfil(container);
      Mobile.showToast('Beralih ke Anggota ' + newId);
    };
  };

  Mobile.openTodayMeetingsModal = function () {
    var curMember = Store.getMemberById(Store.getCurrentMemberId());
    var allMeetings = Store.getMeetings();
    var now = Store.now();
    var todayStr = Rules.formatDateYMD(now);

    var todayMeetings = allMeetings.filter(function (m) {
      return m.status !== 'Draft' && m.tanggal === todayStr && (m.peserta || []).indexOf(curMember.id) !== -1;
    });

    var itemsHtml = '';
    if (todayMeetings.length === 0) {
      itemsHtml = '<div style="color:var(--muted); text-align:center; padding:20px;">Tidak ada agenda rapat untuk hari ini.</div>';
    } else {
      todayMeetings.forEach(function (m) {
        var der = Rules.deriveDisplayStatus(m, now);
        var lbl = (der === 'BERLANGSUNG') ? 'Sedang Berjalan' : ((der === 'SELESAI') ? 'Selesai' : 'Mendatang');
        itemsHtml +=
          '<div class="card" style="margin-bottom:8px; cursor:pointer;" onclick="Mobile.closeModal(\'todayModal\'); Mobile.openMeetingDetail(\'' + m.id + '\')">' +
          '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<div style="font-weight:700; font-size:13.5px;">' + m.namaRapat + '</div>' +
          '<span class="badge ' + (der === 'BERLANGSUNG' ? 'badge-live' : 'badge-info') + '">' + lbl + '</span>' +
          '</div>' +
          '<div style="font-size:12px; color:var(--muted); margin-top:4px;">' + m.jamMulai + '–' + m.jamSelesai + ' WIB · ' + (m.lokasi || 'DPRD Kota Magelang') + '</div>' +
          '</div>';
      });
    }

    var modalHtml =
      '<div class="modal-backdrop" id="todayModal">' +
      '<div class="modal-card">' +
      '<div class="modal-header">' +
      '<h3>Agenda Hari Ini (' + todayMeetings.length + ')</h3>' +
      '<button type="button" class="modal-close" onclick="Mobile.closeModal(\'todayModal\')">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' + itemsHtml + '</div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-secondary" onclick="Mobile.closeModal(\'todayModal\')">Tutup</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  Mobile.showScanModal = function (title, contentHtml, onOk) {
    var modalHtml =
      '<div class="modal-backdrop" id="scanNoticeModal">' +
      '<div class="modal-card">' +
      '<div class="modal-header">' +
      '<h3>' + title + '</h3>' +
      '<button type="button" class="modal-close" onclick="Mobile.closeModal(\'scanNoticeModal\')">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' + contentHtml + '</div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-primary" id="btnScanModalOk">OK</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btnScanModalOk').onclick = function () {
      Mobile.closeModal('scanNoticeModal');
      if (onOk) onOk();
    };
  };

  Mobile.closeModal = function (id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  };

  Mobile.showToast = function (msg) {
    var existing = document.getElementById('mobToastNotice');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'mobToastNotice';
    toast.className = 'toast-notice';
    toast.style.bottom = '75px';
    toast.style.right = '16px';
    toast.style.left = '16px';
    toast.innerHTML =
      '<svg class="ic-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 8 12 12 14 14"></polyline></svg>' +
      '<span>' + msg + '</span>';
    document.body.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2800);
  };

  window.Mobile = Mobile;
})(window);
