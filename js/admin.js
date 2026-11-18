/**
 * admin.js - Controller Web Admin e-Parlemen DPRD Kota Magelang
 * Menyesuaikan Dokumen TRD & API Specification v1.1:
 * - Master Filter Unit Tipe & Unit Organisasi Periode Aktif
 * - Penarikan Peserta via user_assignments dengan Deduplikasi
 * - Cek Bentrok Hard Conflict & Interactive Quorum Banner
 * - 15 Seeder Jenis Rapat Tetap
 * - Matriks Action Buttons & UI Flags Sesuai State Machine
 * - Laporan Rekapitulasi Presensi Resmi & Ekspor Excel
 */

(function (window) {
  'use strict';

  var Admin = {};

  var currentView = 'jadwal';
  var activeMeetingId = null;
  var editingDraftId = null;
  var currentTab = 'Mendatang'; // 'Mendatang' | 'Sedang Berlangsung' | 'Selesai' | 'Dibatalkan' | 'Semua'

  // State Form Rapat
  var formState = {
    selectedUnitType: 'ALL',
    selectedUnits: ['Komisi I'],
    checkedParticipants: {},
    uploadedFiles: []
  };

  Admin.init = function () {
    Admin.renderTimeBar();
    Admin.renderSidebarUser();
    Admin.bindEvents();
    Admin.navigate('jadwal');

    window.addEventListener('epar-store-changed', function () {
      Admin.renderTimeBar();
      if (currentView === 'jadwal') {
        Admin.renderMeetingList();
      } else if (currentView === 'detail' && activeMeetingId) {
        Admin.renderMeetingDetail(activeMeetingId);
      }
    });
  };

  Admin.renderTimeBar = function () {
    var bar = document.getElementById('adminTimeBar');
    if (!bar) return;

    var now = Store.now();
    var ymd = Rules.formatDateYMD(now);
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    var nowStr = Rules.formatDateIndo(now) + ', ' + Rules.formatTimeWIB(now);

    bar.innerHTML =
      '<div class="ts-title">' +
        '<svg class="ic-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' +
        '<span>Simulator Waktu Server (WIB)</span>' +
      '</div>' +
      '<div class="ts-controls">' +
        '<div class="ts-now-display" id="tsDisplayNow">' + nowStr + '</div>' +
        '<div class="ts-input-group">' +
          '<input type="date" id="tsDateInput" value="' + ymd + '">' +
          '<input type="time" id="tsTimeInput" value="' + h + ':' + m + '">' +
          '<button type="button" class="ts-btn" id="tsSetBtn">Terapkan</button>' +
        '</div>' +
        '<div class="ts-presets">' +
          '<button type="button" class="ts-btn" data-preset="2026-11-20T08:30:00">Hari H 08:30 (Berlangsung)</button>' +
          '<button type="button" class="ts-btn" data-preset="2026-11-20T09:30:00">Hari H 09:30 (Berjalan)</button>' +
          '<button type="button" class="ts-btn" data-preset="2026-11-20T12:05:00">Hari H 12:05 (Selesai)</button>' +
          '<button type="button" class="ts-btn" data-preset="2026-11-19T08:00:00">H-1 08:00 (Reminder)</button>' +
          '<button type="button" class="ts-btn" id="tsResetBtn">Reset Waktu</button>' +
        '</div>' +
      '</div>';

    document.getElementById('tsSetBtn').onclick = function () {
      var d = document.getElementById('tsDateInput').value;
      var t = document.getElementById('tsTimeInput').value;
      if (d && t) {
        Store.setTime(d + 'T' + t + ':00');
        Admin.showToast('Waktu simulasi diubah ke: ' + Rules.formatDateIndo(new Date(d)) + ' pukul ' + t + ' WIB');
      }
    };

    document.getElementById('tsResetBtn').onclick = function () {
      Store.resetTime();
      Admin.showToast('Waktu simulasi direset ke Hari H (20 Nov 2026, 08:30 WIB)');
    };

    bar.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.onclick = function () {
        var iso = btn.getAttribute('data-preset');
        Store.setTime(iso);
        Admin.showToast('Waktu diubah ke: ' + btn.textContent);
      };
    });
  };

  Admin.renderSidebarUser = function () {
    var uEl = document.getElementById('adminSidebarUser');
    if (!uEl) return;
    uEl.innerHTML =
      '<div class="av">AS</div>' +
      '<div>' +
        '<div class="u-name">Admin Sekretariat</div>' +
        '<div class="u-role">Sekretariat DPRD Kota Magelang</div>' +
      '</div>';
  };

  Admin.bindEvents = function () {
    var navLinks = document.querySelectorAll('.snav-item[data-target]');
    navLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        navLinks.forEach(function (l) { l.classList.remove('active'); });
        link.classList.add('active');
        var target = link.getAttribute('data-target');
        Admin.navigate(target);
      });
    });
  };

  Admin.showLockedNotice = function (menuName) {
    Admin.showModalNotice(
      'Fitur Terkunci (Diluar Scope Prototype)',
      '<div style="text-align:center; padding:10px 0;">' +
        '<div style="font-size:38px; margin-bottom:8px;">🔒</div>' +
        '<div style="font-weight:700; font-size:15px; color:var(--ink); margin-bottom:6px;">Menu "' + menuName + '" Terkunci</div>' +
        '<div style="font-size:12.5px; color:var(--muted); line-height:1.5;">' +
          'Berdasarkan ketentuan prototype persidangan e-Parlemen, sidebar aktif difokuskan secara penuh pada modul <strong>Jadwal Rapat &amp; Manajemen Kuorum Presensi</strong>.' +
        '</div>' +
      '</div>',
      'Mengerti'
    );
  };

  Admin.navigate = function (view, param) {
    currentView = view;
    var container = document.getElementById('adminViewContainer');
    if (!container) return;

    if (view === 'jadwal') {
      Admin.renderJadwalView(container);
    } else if (view === 'form') {
      editingDraftId = param || null;
      Admin.renderFormView(container, editingDraftId);
    } else if (view === 'detail') {
      activeMeetingId = param;
      Admin.renderMeetingDetail(activeMeetingId);
    }
  };

  /* ==========================================================================
     VIEW: JADWAL RAPAT (LIST)
     ========================================================================== */
  Admin.renderJadwalView = function (container) {
    var allM = Store.getMeetings();
    var nowTime = Store.now();
    var cMendatang = 0, cBerlangsung = 0, cSelesai = 0, cBatal = 0;
    allM.forEach(function (m) {
      var d = Rules.deriveDisplayStatus(m, nowTime);
      if (m.status === 'Batal' || d === 'BATAL') cBatal++;
      else if (d === 'BERLANGSUNG') cBerlangsung++;
      else if (d === 'SELESAI') cSelesai++;
      else cMendatang++;
    });

    container.innerHTML =
      '<div class="admin-topbar">' +
        '<div>' +
          '<h2>Jadwal Rapat DPRD Kota Magelang</h2>' +
          '<div class="admin-crumb">Manajemen Rapat &amp; Pemantauan Kuorum Sidang (TRD v1.1)</div>' +
        '</div>' +
        '<div style="display:flex; gap:10px;">' +
          '<button class="btn btn-primary" id="btnCreateNewMeeting">' +
            '<svg class="ic-svg" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Buat Jadwal Rapat' +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div class="admin-content">' +
        '<div class="card" style="margin-bottom:18px;">' +
          '<div class="form-grid-3">' +
            '<div class="form-group">' +
              '<label>Pencarian Rapat</label>' +
              '<input type="text" id="filterSearch" placeholder="Cari kode rapat atau nama rapat...">' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Jenis Rapat (15 Opsi Tetap)</label>' +
              '<select id="filterJenis">' +
                '<option value="">Semua Jenis Rapat</option>' +
                Rules.JENIS_RAPAT.map(function (j) {
                  return '<option value="' + j.name + '">' + j.name + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Status DB</label>' +
              '<select id="filterStatus">' +
                '<option value="">Semua Status DB</option>' +
                '<option value="Draft">DRAFT</option>' +
                '<option value="Dijadwalkan">DIJADWALKAN</option>' +
                '<option value="Selesai">SELESAI</option>' +
                '<option value="Batal">BATAL</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="form-grid-3" style="margin-top:8px;">' +
            '<div class="form-group">' +
              '<label>Tanggal Mulai</label>' +
              '<input type="date" id="filterStartDate">' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Tanggal Sampai</label>' +
              '<input type="date" id="filterEndDate">' +
            '</div>' +
            '<div class="form-group" style="display:flex; align-items:flex-end; gap:8px;">' +
              '<button type="button" class="btn btn-secondary" id="btnFilterReset" style="flex:1;">Reset</button>' +
              '<button type="button" class="btn btn-primary" id="btnFilterApply" style="flex:1;">Terapkan</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="tabs-nav">' +
          '<button class="tab-btn ' + (currentTab === 'Mendatang' ? 'active' : '') + '" data-tab="Mendatang">Mendatang (' + cMendatang + ')</button>' +
          '<button class="tab-btn ' + (currentTab === 'Sedang Berlangsung' ? 'active' : '') + '" data-tab="Sedang Berlangsung">Sedang Berlangsung (' + cBerlangsung + ')</button>' +
          '<button class="tab-btn ' + (currentTab === 'Selesai' ? 'active' : '') + '" data-tab="Selesai">Selesai (' + cSelesai + ')</button>' +
          '<button class="tab-btn ' + (currentTab === 'Dibatalkan' ? 'active' : '') + '" data-tab="Dibatalkan">Dibatalkan (' + cBatal + ')</button>' +
          '<button class="tab-btn ' + (currentTab === 'Semua' ? 'active' : '') + '" data-tab="Semua">Semua (' + allM.length + ')</button>' +
        '</div>' +

        '<div id="meetingListContainer"></div>' +
      '</div>';

    document.getElementById('btnCreateNewMeeting').onclick = function () {
      Admin.navigate('form');
    };

    var tabs = container.querySelectorAll('.tab-btn');
    tabs.forEach(function (t) {
      t.onclick = function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        currentTab = t.getAttribute('data-tab');
        Admin.renderMeetingList();
      };
    });

    document.getElementById('filterSearch').oninput = Admin.renderMeetingList;
    document.getElementById('filterJenis').onchange = Admin.renderMeetingList;
    document.getElementById('filterStatus').onchange = Admin.renderMeetingList;
    document.getElementById('btnFilterApply').onclick = Admin.renderMeetingList;
    document.getElementById('btnFilterReset').onclick = function () {
      document.getElementById('filterSearch').value = '';
      document.getElementById('filterJenis').value = '';
      document.getElementById('filterStatus').value = '';
      document.getElementById('filterStartDate').value = '';
      document.getElementById('filterEndDate').value = '';
      Admin.renderMeetingList();
      Admin.showToast('Filter direset');
    };

    Admin.renderMeetingList();
  };

  Admin.renderMeetingList = function () {
    var container = document.getElementById('meetingListContainer');
    if (!container) return;

    var allMeetings = Store.getMeetings();
    var now = Store.now();
    var searchVal = (document.getElementById('filterSearch') ? document.getElementById('filterSearch').value : '').toLowerCase().trim();
    var jenisVal = document.getElementById('filterJenis') ? document.getElementById('filterJenis').value : '';
    var statusVal = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : '';
    var startDate = document.getElementById('filterStartDate') ? document.getElementById('filterStartDate').value : '';
    var endDate = document.getElementById('filterEndDate') ? document.getElementById('filterEndDate').value : '';

    var filtered = allMeetings.filter(function (m) {
      var d = Rules.deriveDisplayStatus(m, now);

      if (currentTab === 'Mendatang') {
        if (d !== 'DIJADWALKAN' && m.status !== 'Draft') return false;
      } else if (currentTab === 'Sedang Berlangsung') {
        if (d !== 'BERLANGSUNG' || m.status === 'Batal') return false;
      } else if (currentTab === 'Selesai') {
        if (d !== 'SELESAI') return false;
      } else if (currentTab === 'Dibatalkan') {
        if (m.status !== 'Batal' && d !== 'BATAL') return false;
      }

      if (searchVal) {
        var matchCode = (m.kodeRapat || '').toLowerCase().indexOf(searchVal) !== -1;
        var matchTitle = (m.namaRapat || '').toLowerCase().indexOf(searchVal) !== -1;
        if (!matchCode && !matchTitle) return false;
      }

      if (jenisVal && m.jenisRapat !== jenisVal) return false;
      if (statusVal && m.status !== statusVal) return false;
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
        '<div class="card" style="text-align:center; padding:40px 20px; color:var(--muted);">' +
          '<div style="font-weight:700; font-size:15px; color:var(--ink);">Tidak ada rapat yang sesuai</div>' +
          '<div style="font-size:12.5px; margin-top:4px;">Silakan sesuaikan tab status atau buat rapat baru.</div>' +
        '</div>';
      return;
    }

    var html = '<div class="table-container"><table class="data-table"><thead><tr>' +
      '<th>Kode &amp; Nama Rapat</th>' +
      '<th>Jenis &amp; Unit</th>' +
      '<th>Waktu &amp; Lokasi</th>' +
      '<th>Peserta</th>' +
      '<th>Status (Display)</th>' +
      '<th style="text-align:right;">Aksi (TRD Matrix)</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < filtered.length; i++) {
      var m = filtered[i];
      var displayStatus = Rules.deriveDisplayStatus(m, now);
      var flags = Rules.getActionFlags(m, now);
      var isToday = (m.tanggal === Rules.formatDateYMD(now));

      var statusBadge = '';
      if (displayStatus === 'DRAFT') {
        statusBadge = '<span class="badge badge-neutral">Draft</span>';
      } else if (displayStatus === 'BATAL') {
        statusBadge = '<span class="badge badge-danger">Dibatalkan</span>';
      } else if (displayStatus === 'BERLANGSUNG') {
        statusBadge = '<span class="badge badge-live">Sedang Berlangsung</span>';
      } else if (displayStatus === 'SELESAI') {
        statusBadge = '<span class="badge badge-neutral">Selesai</span>';
      } else {
        statusBadge = '<span class="badge badge-info">Dijadwalkan</span>';
      }

      var todayBadge = isToday ? '<span class="badge badge-today">Hari Ini</span> ' : '';

      // Action Buttons sesuai Matriks TRD v1.1 Hal 11-12
      var actionBtns = '';
      if (flags.can_continue) {
        actionBtns += '<button class="btn btn-secondary btn-sm" onclick="Admin.navigate(\'form\', \'' + m.id + '\')">Lanjutkan</button> ';
      }
      if (flags.can_delete) {
        actionBtns += '<button class="btn btn-danger btn-sm" onclick="Admin.confirmDeleteMeeting(\'' + m.id + '\')">Hapus</button> ';
      }
      if (flags.can_view_detail) {
        actionBtns += '<button class="btn btn-secondary btn-sm" onclick="Admin.navigate(\'detail\', \'' + m.id + '\')">Lihat Detail</button> ';
      }
      if (flags.can_cancel) {
        actionBtns += '<button class="btn btn-danger btn-sm" onclick="Admin.openCancelMeetingModal(\'' + m.id + '\')">Batalkan Rapat</button> ';
      }
      if (flags.show_report_btn) {
        actionBtns += '<button class="btn btn-primary btn-sm" onclick="Admin.openReportModal(\'' + m.id + '\')">Rekap Presensi</button> ';
      }
      if (flags.show_cancel_reason && m.cancel_reason) {
        actionBtns += '<div style="font-size:11px; color:var(--danger); margin-top:4px; max-width:200px; text-align:right;">Alasan: ' + (m.cancel_reason.length > 40 ? m.cancel_reason.slice(0, 40) + '...' : m.cancel_reason) + '</div>';
      }

      var unitsText = (m.unit && m.unit.length) ? m.unit.slice(0, 2).join(', ') + (m.unit.length > 2 ? ' +' + (m.unit.length - 2) : '') : '-';

      html += '<tr>' +
        '<td>' +
          '<div style="font-family:monospace; font-weight:700; color:var(--muted); font-size:11px;">' + (m.kodeRapat || '-') + '</div>' +
          '<div style="font-weight:700; color:var(--ink); font-size:13.5px; margin-top:2px;">' + todayBadge + m.namaRapat + '</div>' +
        '</td>' +
        '<td>' +
          '<span class="tag-unit">' + m.jenisRapat + '</span>' +
          '<div style="font-size:11px; color:var(--muted); margin-top:4px;">' + unitsText + '</div>' +
        '</td>' +
        '<td>' +
          '<div style="font-weight:600;">' + Rules.formatDateIndo(new Date(m.tanggal)) + '</div>' +
          '<div style="font-size:12px; color:var(--muted);">' + m.jamMulai + ' – ' + m.jamSelesai + ' WIB</div>' +
          '<div style="font-size:11.5px; color:#5b6a5e; margin-top:2px;">' + (m.lokasi || 'DPRD Kota Magelang') + '</div>' +
        '</td>' +
        '<td>' +
          '<div style="font-weight:700; font-size:14px;">' + (m.peserta ? m.peserta.length : 0) + ' <span style="font-size:11px; font-weight:normal; color:var(--muted);">Anggota</span></div>' +
        '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="text-align:right; white-space:nowrap;">' + actionBtns + '</td>' +
        '</tr>';
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;
  };

  /* ==========================================================================
     VIEW: FORM RAPAT (TRD v1.1: Filter Unit Tipe, Penarikan Peserta & Kuorum)
     ========================================================================== */
  Admin.renderFormView = function (container, draftId) {
    var draft = draftId ? Store.getMeetingById(draftId) : null;
    var isEdit = !!draft;

    var defaultKode = isEdit ? draft.kodeRapat : 'RPT-2026-' + String(Math.floor(Math.random() * 900) + 100);
    var defaultNama = isEdit ? draft.namaRapat : '';
    var defaultJenis = isEdit ? draft.jenisRapat : 'Rapat Komisi';
    var defaultLokasi = isEdit ? draft.lokasi : 'Ruang Rapat Komisi I DPRD Kota Magelang';
    var defaultTanggal = isEdit ? draft.tanggal : '2026-11-20';
    var defaultMulai = isEdit ? draft.jamMulai : '10:00';
    var defaultSelesai = isEdit ? draft.jamSelesai : '12:00';
    var defaultDeskripsi = isEdit ? (draft.deskripsi || '') : '';

    formState.selectedUnitType = 'ALL';
    formState.selectedUnits = isEdit ? (draft.unit || ['Komisi I']) : ['Komisi I'];
    formState.uploadedFiles = isEdit && draft.lampiran ? draft.lampiran.slice() : [
      { name: 'Surat_Undangan_Rapat.pdf', size: '820 KB' }
    ];

    container.innerHTML =
      '<div class="admin-topbar">' +
        '<div>' +
          '<h2>' + (isEdit ? 'Lanjutkan Draf Rapat' : 'Buat Jadwal Rapat Baru') + '</h2>' +
          '<div class="admin-crumb"><a href="#" onclick="Admin.confirmLeaveForm(); return false;">Jadwal Rapat</a> › ' + (isEdit ? 'Edit Draf' : 'Form Buat Rapat') + ' (TRD v1.1)</div>' +
        '</div>' +
      '</div>' +

      '<div class="admin-content">' +
        '<div class="info-box" style="background:#e8f4ec; border:1px solid #bce1c7; padding:12px 16px; border-radius:8px; margin-bottom:18px; font-size:12.5px; display:flex; gap:10px; align-items:center;">' +
          '<svg class="ic-svg" viewBox="0 0 24 24" style="color:var(--green);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>' +
          '<span>Daftar peserta ditarik melalui <code>user_assignments</code> (Periode Aktif) dengan <strong>Deduplikasi Peserta</strong>. Syarat kuorum ⅔ dihitung interaktif dan divalidasi ketat saat tombol <strong>Jadwalkan Rapat</strong> ditekan.</span>' +
        '</div>' +

        '<form id="meetingForm" onsubmit="return false;">' +

          // CARD 1: INFORMASI RAPAT
          '<div class="card">' +
            '<div class="form-section-title">1. Informasi Rapat</div>' +
            '<div class="form-section-hint">Identitas rapat dan master klasifikasi sesuai 15 jenis rapat DPRD Kota Magelang.</div>' +

            '<div class="form-grid-2">' +
              '<div class="form-group">' +
                '<label>Kode Rapat <span class="req">*</span></label>' +
                '<input type="text" id="fKodeRapat" value="' + defaultKode + '" placeholder="Contoh: RPT-2026-001" required>' +
                '<div class="field-hint">Wajib, unik, tidak bisa di-reuse meski rapat BATAL.</div>' +
              '</div>' +
              '<div class="form-group">' +
                '<label>Jenis Rapat (15 Opsi Seeder Tetap) <span class="req">*</span></label>' +
                '<select id="fJenisRapat" required>' +
                  Rules.JENIS_RAPAT.map(function (j) {
                    return '<option value="' + j.name + '" ' + (j.name === defaultJenis ? 'selected' : '') + '>' + j.name + '</option>';
                  }).join('') +
                '</select>' +
              '</div>' +
            '</div>' +

            '<div class="form-group">' +
              '<label>Nama / Judul Rapat <span class="req">*</span></label>' +
              '<input type="text" id="fNamaRapat" value="' + defaultNama + '" placeholder="Contoh: Rapat Kerja Komisi I Evaluasi Pelayanan Publik" required>' +
            '</div>' +

            // FILTER UNIT TIPE & UNIT ORGANISASI PERIODE AKTIF (TRD v1.1 Bagian 1.1)
            '<div style="background:#f9f8f5; border:1px solid var(--border); border-radius:8px; padding:14px; margin-top:12px;">' +
              '<div style="font-weight:700; font-size:13px; margin-bottom:8px; color:var(--ink);">Filter Unit Organisasi (Periode Aktif 2024–2029)</div>' +
              '<div class="form-grid-2" style="margin-bottom:10px;">' +
                '<div class="form-group" style="margin-bottom:0;">' +
                  '<label>Pilih Unit Tipe (unit_types)</label>' +
                  '<select id="fUnitTypeFilter">' +
                    Rules.UNIT_TYPES.map(function (ut) {
                      return '<option value="' + ut.code + '">' + ut.name + '</option>';
                    }).join('') +
                  '</select>' +
                '</div>' +
                '<div style="font-size:11.5px; color:var(--muted); display:flex; align-items:center;">' +
                  'Pilih satu atau lebih unit organisasi di bawah ini. Peserta yang tercatat di beberapa unit akan otomatis di-deduplikasi menjadi 1 orang. ' +
                '</div>' +
              '</div>' +

              '<label style="font-size:12px; font-weight:600; color:var(--ink); margin-bottom:6px; display:block;">Unit Organisasi Terpilih (AKD / Setwan):</label>' +
              '<div style="display:flex; flex-wrap:wrap; gap:8px;" id="unitChipsContainer"></div>' +
            '</div>' +
          '</div>' +

          // CARD 2: CEK KUORUM INTERAKTIF & PESERTA RAPAT
          '<div class="card">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
              '<div class="form-section-title">2. Peserta Rapat &amp; Cek Kuorum ⅔</div>' +
              '<div style="display:flex; gap:6px;">' +
                '<button type="button" class="btn btn-secondary btn-sm" id="btnCheckAll">Pilih Semua</button>' +
                '<button type="button" class="btn btn-secondary btn-sm" id="btnUncheckAll">Batal Pilih</button>' +
              '</div>' +
            '</div>' +
            '<div class="form-section-hint">Daftar anggota unik dimuat default tercentang. Deteksi bentrok keras (Hard Conflict) mengecek penugasan approved dan rapat lain dijadwalkan.</div>' +

            // LIVE INTERACTIVE QUORUM BANNER (POST /api/v1/admin/meetings/check-quorum)
            '<div id="interactiveQuorumBox" style="margin:12px 0;"></div>' +

            '<div class="table-container" style="max-height: 320px; overflow-y:auto; margin-top:8px;">' +
              '<table class="data-table">' +
                '<thead><tr>' +
                  '<th style="width:40px;"><input type="checkbox" id="masterCheckbox" checked></th>' +
                  '<th>Nama &amp; Kode Anggota</th>' +
                  '<th>Jabatan &amp; Unit Organisasi</th>' +
                  '<th>Status Jadwal (Bentrok)</th>' +
                '</tr></thead>' +
                '<tbody id="participantsTableBody"></tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +

          // CARD 3: WAKTU & LOKASI PELAKSANAAN
          '<div class="card">' +
            '<div class="form-section-title">3. Waktu &amp; Lokasi Pelaksanaan</div>' +
            '<div class="form-section-hint">Waktu mulai dan selesai dalam 1 hari (WIB). Digunakan sebagai rentang validasi irisan bentrok dan jendela presensi QR.</div>' +

            '<div class="form-grid-3">' +
              '<div class="form-group">' +
                '<label>Tanggal Rapat <span class="req">*</span></label>' +
                '<input type="date" id="fTanggal" value="' + defaultTanggal + '" required>' +
              '</div>' +
              '<div class="form-group">' +
                '<label>Jam Mulai (WIB) <span class="req">*</span></label>' +
                '<input type="time" id="fJamMulai" value="' + defaultMulai + '" required>' +
              '</div>' +
              '<div class="form-group">' +
                '<label>Jam Selesai (WIB) <span class="req">*</span></label>' +
                '<input type="time" id="fJamSelesai" value="' + defaultSelesai + '" required>' +
              '</div>' +
            '</div>' +

            '<div class="form-group">' +
              '<label>Ruang / Lokasi Rapat <span class="opt">(Opsional)</span></label>' +
              '<input type="text" id="fLokasi" value="' + defaultLokasi + '" placeholder="Contoh: Ruang Rapat Komisi I DPRD">' +
            '</div>' +

            '<div class="form-group">' +
              '<label>Agenda / Catatan Rapat <span class="opt">(Opsional)</span></label>' +
              '<textarea id="fDeskripsi" placeholder="Masukkan poin-poin agenda pembahasan rapat...">' + defaultDeskripsi + '</textarea>' +
            '</div>' +
          '</div>' +

          // CARD 4: LAMPIRAN SURAT UNDANGAN
          '<div class="card">' +
            '<div class="form-section-title">4. Dokumen Surat Undangan</div>' +
            '<div class="form-section-hint">Maksimal 10 berkas @ 10 MB (JPG, PNG, DOC, DOCX, PDF, XLSX).</div>' +

            '<div class="upload-drop-zone" id="dropZone">' +
              '<input type="file" id="fFileUpload" multiple accept=".jpg,.jpeg,.png,.doc,.docx,.pdf,.xlsx" style="display:none;">' +
              '<svg class="ic-svg" viewBox="0 0 24 24" style="width:32px; height:32px; stroke:var(--muted); margin-bottom:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' +
              '<div style="font-weight:700; font-size:13px;">Klik untuk memilih berkas undangan</div>' +
              '<div style="font-size:11.5px; color:var(--muted);">Maksimal 10 berkas (PDF, DOCX, XLSX, JPG, PNG)</div>' +
            '</div>' +

            '<div class="file-list-preview" id="filePreviewList"></div>' +
          '</div>' +

          // TOMBOL AKSI FORM DI BAGIAN BAWAH (MERAH: Batal, ABU-ABU: Draft, HIJAU: Jadwalkan)
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding:18px 20px; background:#fff; border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow-sm);">' +
            '<button type="button" class="btn btn-form-batal btn-lg" id="btnFormBatal">' +
              '<svg class="ic-svg" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Batal' +
            '</button>' +
            '<div style="display:flex; gap:12px;">' +
              '<button type="button" class="btn btn-form-draft btn-lg" id="btnFormDraft">' +
                '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Simpan Draft' +
              '</button>' +
              '<button type="button" class="btn btn-form-jadwalkan btn-lg" id="btnFormJadwalkan">' +
                '<svg class="ic-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Jadwalkan Rapat' +
              '</button>' +
            '</div>' +
          '</div>' +

        '</form>' +
      '</div>';

    // Render Chips Unit Organisasi berdasarkan Filter Unit Tipe
    Admin.renderUnitChips();

    document.getElementById('fUnitTypeFilter').onchange = function (e) {
      formState.selectedUnitType = e.target.value;
      Admin.renderUnitChips();
    };

    // Check all / uncheck all
    document.getElementById('btnCheckAll').onclick = function () {
      var chks = container.querySelectorAll('.part-chk');
      chks.forEach(function (c) {
        c.checked = true;
        formState.checkedParticipants[c.getAttribute('data-mid')] = true;
      });
      Admin.refreshInteractiveQuorum();
    };
    document.getElementById('btnUncheckAll').onclick = function () {
      var chks = container.querySelectorAll('.part-chk');
      chks.forEach(function (c) {
        c.checked = false;
        formState.checkedParticipants[c.getAttribute('data-mid')] = false;
      });
      Admin.refreshInteractiveQuorum();
    };
    document.getElementById('masterCheckbox').onchange = function (e) {
      var val = e.target.checked;
      var chks = container.querySelectorAll('.part-chk');
      chks.forEach(function (c) {
        c.checked = val;
        formState.checkedParticipants[c.getAttribute('data-mid')] = val;
      });
      Admin.refreshInteractiveQuorum();
    };

    // Date changes refresh conflict indicators & quorum
    document.getElementById('fTanggal').onchange = function () { Admin.refreshFormParticipants(); };
    document.getElementById('fJamMulai').onchange = function () { Admin.refreshFormParticipants(); };
    document.getElementById('fJamSelesai').onchange = function () { Admin.refreshFormParticipants(); };

    // File upload
    var dropZone = document.getElementById('dropZone');
    var fileInput = document.getElementById('fFileUpload');
    dropZone.onclick = function () { fileInput.click(); };
    fileInput.onchange = function (e) { Admin.handleFilesUpload(e.target.files); };

    // Action buttons at bottom
    document.getElementById('btnFormBatal').onclick = Admin.confirmLeaveForm;
    document.getElementById('btnFormDraft').onclick = function () {
      Admin.submitMeetingForm('Draft');
    };
    document.getElementById('btnFormJadwalkan').onclick = function () {
      Admin.submitMeetingForm('Dijadwalkan');
    };

    Admin.renderFileListPreview();
    Admin.refreshFormParticipants(draft ? draft.peserta : null);
  };

  /**
   * Render Unit Chips sesuai Unit Tipe Terpilih
   */
  Admin.renderUnitChips = function () {
    var container = document.getElementById('unitChipsContainer');
    if (!container) return;

    var curType = formState.selectedUnitType;
    var filteredUnits = Rules.ORGANIZATION_UNITS.filter(function (ou) {
      if (curType === 'ALL') return true;
      return ou.typeCode === curType;
    });

    var html = '';
    filteredUnits.forEach(function (ou) {
      var isSel = formState.selectedUnits.indexOf(ou.name) !== -1;
      html += '<button type="button" class="btn btn-sm ' + (isSel ? 'btn-primary' : 'btn-secondary') + '" data-unit="' + ou.name + '">' + ou.name + '</button>';
    });

    container.innerHTML = html;

    container.querySelectorAll('button[data-unit]').forEach(function (btn) {
      btn.onclick = function () {
        var u = btn.getAttribute('data-unit');
        var idx = formState.selectedUnits.indexOf(u);
        if (idx !== -1) {
          if (formState.selectedUnits.length > 1) {
            formState.selectedUnits.splice(idx, 1);
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
          } else {
            Admin.showToast('Pilih minimal satu unit organisasi.');
            return;
          }
        } else {
          formState.selectedUnits.push(u);
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
        }
        Admin.refreshFormParticipants();
      };
    });
  };

  /**
   * Refresh daftar peserta form & jalankan cek kuorum interaktif
   */
  Admin.refreshFormParticipants = function (preferredCheckedIds) {
    var tbody = document.getElementById('participantsTableBody');
    if (!tbody) return;

    var tanggal = document.getElementById('fTanggal').value;
    var jamMulai = document.getElementById('fJamMulai').value;
    var jamSelesai = document.getElementById('fJamSelesai').value;

    var matchedMembers = Store.getMembersByUnits(formState.selectedUnits);

    var selectedIds = [];
    matchedMembers.forEach(function (m) {
      var isChecked = true;
      if (preferredCheckedIds) {
        isChecked = preferredCheckedIds.indexOf(m.id) !== -1;
      } else if (formState.checkedParticipants[m.id] !== undefined) {
        isChecked = formState.checkedParticipants[m.id];
      }
      formState.checkedParticipants[m.id] = isChecked;
      if (isChecked) selectedIds.push(m.id);
    });

    // Simulasi Request API POST /api/v1/admin/meetings/check-quorum
    var qRes = Store.checkQuorum({
      unit_ids: formState.selectedUnits,
      selected_user_ids: selectedIds,
      meeting_date: tanggal,
      start_time: jamMulai,
      end_time: jamSelesai
    });

    Admin.renderInteractiveQuorumBanner(qRes.data);

    var rowsHtml = '';
    qRes.data.participants.forEach(function (p) {
      var statusBadge = '';
      if (p.has_conflict) {
        statusBadge = '<span class="badge badge-danger">' + (p.conflict_label || 'Sudah ada jadwal bentrok') + '</span>';
      } else {
        statusBadge = '<span style="color:var(--muted); font-size:11.5px;">Tersedia (Bersih)</span>';
      }

      rowsHtml +=
        '<tr>' +
          '<td><input type="checkbox" class="part-chk" data-mid="' + p.user_id + '" ' + (p.is_checked ? 'checked' : '') + '></td>' +
          '<td>' +
            '<div style="font-weight:700;">' + p.name + '</div>' +
            '<div style="font-family:monospace; font-size:11px; color:var(--muted);">' + p.member_code + '</div>' +
          '</td>' +
          '<td>' +
            '<span class="tag-unit">' + p.unit_name + '</span>' +
            '<div style="font-size:11px; color:var(--muted); margin-top:2px;">' + p.position_name + '</div>' +
          '</td>' +
          '<td>' + statusBadge + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = rowsHtml;

    tbody.querySelectorAll('.part-chk').forEach(function (chk) {
      chk.onchange = function () {
        var mid = chk.getAttribute('data-mid');
        formState.checkedParticipants[mid] = chk.checked;
        Admin.refreshInteractiveQuorum();
      };
    });
  };

  Admin.refreshInteractiveQuorum = function () {
    var tanggal = document.getElementById('fTanggal').value;
    var jamMulai = document.getElementById('fJamMulai').value;
    var jamSelesai = document.getElementById('fJamSelesai').value;

    var matchedMembers = Store.getMembersByUnits(formState.selectedUnits);
    var selectedIds = [];
    matchedMembers.forEach(function (m) {
      if (formState.checkedParticipants[m.id]) {
        selectedIds.push(m.id);
      }
    });

    var qRes = Store.checkQuorum({
      unit_ids: formState.selectedUnits,
      selected_user_ids: selectedIds,
      meeting_date: tanggal,
      start_time: jamMulai,
      end_time: jamSelesai
    });

    Admin.renderInteractiveQuorumBanner(qRes.data);
  };

  /**
   * Render Banner Hasil Cek Kuorum Interaktif (TRD v1.1 Hal 14-15)
   */
  Admin.renderInteractiveQuorumBanner = function (qData) {
    var box = document.getElementById('interactiveQuorumBox');
    if (!box) return;

    var isMet = qData.is_quorum_met;
    var bg = isMet ? '#eaf8ef' : '#fdf2f2';
    var border = isMet ? '#bce1c7' : '#f5c6c6';
    var color = isMet ? 'var(--success)' : 'var(--danger)';

    box.innerHTML =
      '<div style="background:' + bg + '; border:1px solid ' + border + '; border-radius:8px; padding:12px 16px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">' +
          '<div style="display:flex; align-items:center; gap:8px;">' +
            '<span style="font-size:20px;">' + (isMet ? '✅' : '⚠️') + '</span>' +
            '<div>' +
              '<div style="font-weight:800; font-size:13.5px; color:' + color + ';">' + qData.banner_message + '</div>' +
              '<div style="font-size:11.5px; color:var(--muted); margin-top:2px;">Kalkulasi: N = ' + qData.total_invited + ' | Syarat Kuorum = ⌈2/3 × ' + qData.total_invited + '⌉ = ' + qData.quorum_required + ' | Bentrok = ' + qData.conflict_unique_count + ' | Tersedia = ' + qData.available_count + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="font-size:12px; font-weight:700; color:' + color + '; padding:4px 10px; background:rgba(255,255,255,0.8); border-radius:4px; border:1px solid ' + border + ';">' +
            (isMet ? 'KUORUM TERPENUHI' : 'KUORUM BELUM TERPENUHI') +
          '</div>' +
        '</div>' +
      '</div>';
  };

  Admin.handleFilesUpload = function (files) {
    if (!files || !files.length) return;
    var allowedExts = ['jpg', 'jpeg', 'png', 'doc', 'docx', 'pdf', 'xlsx'];
    for (var i = 0; i < files.length; i++) {
      if (formState.uploadedFiles.length >= 10) break;
      var f = files[i];
      var ext = f.name.split('.').pop().toLowerCase();
      if (allowedExts.indexOf(ext) === -1) {
        alert('Format berkas "' + f.name + '" tidak didukung.');
        continue;
      }
      var szStr = f.size > 1024 * 1024 ? (f.size / (1024 * 1024)).toFixed(1) + ' MB' : (f.size / 1024).toFixed(0) + ' KB';
      formState.uploadedFiles.push({ name: f.name, size: szStr });
    }
    Admin.renderFileListPreview();
  };

  Admin.renderFileListPreview = function () {
    var preview = document.getElementById('filePreviewList');
    if (!preview) return;
    if (formState.uploadedFiles.length === 0) {
      preview.innerHTML = '<div style="font-size:12px; color:var(--muted); font-style:italic;">Belum ada dokumen yang diunggah.</div>';
      return;
    }

    var html = '';
    formState.uploadedFiles.forEach(function (f, idx) {
      html +=
        '<div class="file-item-pill">' +
          '<div style="display:flex; align-items:center; gap:8px;">' +
            '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' +
            '<span>' + f.name + '</span> <span style="color:var(--muted); font-size:11px;">(' + f.size + ')</span>' +
          '</div>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding:2px 6px; color:var(--danger);" onclick="Admin.removeUploadedFile(' + idx + ')">Hapus</button>' +
        '</div>';
    });
    preview.innerHTML = html;
  };

  Admin.removeUploadedFile = function (index) {
    formState.uploadedFiles.splice(index, 1);
    Admin.renderFileListPreview();
  };

  Admin.confirmLeaveForm = function () {
    Admin.showConfirmModal(
      'Konfirmasi Batal',
      'Data pada form tidak akan tersimpan. Apakah Anda yakin ingin kembali ke daftar rapat?',
      function () { Admin.navigate('jadwal'); }
    );
  };

  /**
   * Submit Rapat (Simpan Draft vs Jadwalkan)
   * Validasi Kuorum 2/3 memblokir submit jika GAGAL (HTTP 422 QUORUM_NOT_MET)
   */
  Admin.submitMeetingForm = function (actionStatus) {
    var kode = (document.getElementById('fKodeRapat').value || '').trim();
    var nama = (document.getElementById('fNamaRapat').value || '').trim();
    var jenis = document.getElementById('fJenisRapat').value;
    var lokasi = (document.getElementById('fLokasi').value || '').trim();
    var tanggal = document.getElementById('fTanggal').value;
    var jamMulai = document.getElementById('fJamMulai').value;
    var jamSelesai = document.getElementById('fJamSelesai').value;
    var deskripsi = (document.getElementById('fDeskripsi').value || '').trim();

    if (!kode) { alert('Kode Rapat wajib diisi.'); return; }
    if (!nama) { alert('Nama Rapat wajib diisi.'); return; }
    if (!tanggal || !jamMulai || !jamSelesai) {
      alert('Tanggal, Jam Mulai, dan Jam Selesai wajib diisi.');
      return;
    }
    if (jamSelesai <= jamMulai) {
      alert('Waktu selesai harus lebih besar dari waktu mulai pada tanggal yang sama.');
      return;
    }
    if (Store.isMeetingCodeTaken(kode, editingDraftId)) {
      alert('Kode rapat "' + kode + '" sudah digunakan atau pernah dibatalkan (Unique Constraint).');
      return;
    }

    var matchedMembers = Store.getMembersByUnits(formState.selectedUnits);
    var selectedPeserta = [];
    matchedMembers.forEach(function (m) {
      if (formState.checkedParticipants[m.id]) {
        selectedPeserta.push(m.id);
      }
    });

    if (selectedPeserta.length === 0) {
      alert('Pilih minimal satu peserta rapat.');
      return;
    }

    var meetingObj = {
      id: editingDraftId || undefined,
      kodeRapat: kode,
      namaRapat: nama,
      jenisRapat: jenis,
      unit: formState.selectedUnits.slice(),
      tanggal: tanggal,
      jamMulai: jamMulai,
      jamSelesai: jamSelesai,
      lokasi: lokasi,
      deskripsi: deskripsi,
      lampiran: formState.uploadedFiles.slice(),
      peserta: selectedPeserta,
      status: actionStatus
    };

    var saveRes = Store.saveMeeting(meetingObj);

    if (!saveRes.success) {
      // 422 Unprocessable Entity - QUORUM_NOT_MET (TRD v1.1 Hal 16)
      Admin.showModalNotice(
        '422 Unprocessable Entity (Kuorum Gagal)',
        '<div style="text-align:center; padding:10px 0;">' +
          '<div style="font-size:44px; margin-bottom:8px;">❌</div>' +
          '<div style="font-weight:800; font-size:16px; color:var(--danger); margin-bottom:8px;">' + saveRes.error_code + '</div>' +
          '<div style="font-size:13px; color:var(--ink); line-height:1.6; text-align:left; background:#fdf2f2; padding:12px; border-radius:8px; border:1px solid #f6c0c0;">' +
            saveRes.message +
          '</div>' +
          '<div style="font-size:12px; color:var(--muted); margin-top:10px;">Proses submit diblokir. Silakan simpan sebagai Draft atau sesuaikan waktu rapat agar anggota tidak bentrok.</div>' +
        '</div>',
        'Tutup'
      );
      return;
    }

    var saved = saveRes.data;

    if (actionStatus === 'Dijadwalkan') {
      Admin.showModalNotice(
        'Rapat Berhasil Dijadwalkan!',
        '<div style="text-align:center; padding:10px 0;">' +
          '<div style="font-size:44px; margin-bottom:8px;">✅</div>' +
          '<div style="font-weight:800; font-size:16px; color:var(--success); margin-bottom:8px;">Lolos Pengecekan ⅔ Kuorum Rapat</div>' +
          '<div style="font-size:13px; color:var(--ink); line-height:1.6; text-align:left; background:#eaf8ef; padding:12px; border-radius:8px; border:1px solid #bce1c7;">' +
            '<div>• Nama Rapat: <strong>' + saved.namaRapat + '</strong></div>' +
            '<div>• Total Peserta (N): <strong>' + saved.total_invited + ' Anggota</strong></div>' +
            '<div>• Syarat Minimal Kuorum: <strong>' + saved.quorum_required + ' Anggota</strong></div>' +
            '<div>• Peserta Tersedia: <strong style="color:var(--success);">' + saved.available_count + ' Anggota</strong></div>' +
            '<div>• Bentrok Jadwal: <strong>' + saved.conflict_count + ' Anggota</strong></div>' +
            '<div>• Token QR: <code style="font-size:11px;">' + (saved.qr_token_hash || 'Tersedia') + '</code></div>' +
          '</div>' +
          '<div style="font-size:12px; color:var(--muted); margin-top:10px;">Notifikasi FCM &amp; In-App otomatis dikirimkan ke seluruh anggota dewan terpilih.</div>' +
        '</div>',
        'Buka Detail Rapat',
        function () {
          Admin.navigate('detail', saved.id);
        }
      );
    } else {
      Admin.showToast('Draf rapat berhasil disimpan tanpa pengecekan kuorum.');
      Admin.navigate('jadwal');
    }
  };

  /* ==========================================================================
     VIEW: DETAIL RAPAT & PEMANTAUAN REAL-TIME
     ========================================================================== */
  Admin.renderMeetingDetail = function (meetingId) {
    var container = document.getElementById('adminViewContainer');
    if (!container) return;

    var meeting = Store.getMeetingById(meetingId);
    if (!meeting) {
      container.innerHTML = '<div class="admin-content"><div class="card">Rapat tidak ditemukan. <a href="#" onclick="Admin.navigate(\'jadwal\')">Kembali</a></div></div>';
      return;
    }

    var now = Store.now();
    var displayStatus = Rules.deriveDisplayStatus(meeting, now);
    var flags = Rules.getActionFlags(meeting, now);

    var isBatal = (meeting.status === 'Batal' || displayStatus === 'BATAL');
    var isSelesai = (meeting.status === 'Selesai' || displayStatus === 'SELESAI');
    var isDijadwalkan = !isBatal && !isSelesai;

    var headerBadge = '';
    if (isBatal) headerBadge = '<span class="badge badge-danger">Dibatalkan</span>';
    else if (isSelesai) headerBadge = '<span class="badge badge-neutral">Selesai</span>';
    else if (displayStatus === 'BERLANGSUNG') headerBadge = '<span class="badge badge-live">Sedang Berlangsung</span>';
    else headerBadge = '<span class="badge badge-info">Dijadwalkan</span>';

    var presMap = Store.getPresenceForMeeting(meeting.id);
    var allMembers = Store.getMembers();
    var participants = allMembers.filter(function (m) {
      return (meeting.peserta || []).indexOf(m.id) !== -1;
    });

    var countTotal = participants.length;
    var countHadir = 0;
    var countTidakHadir = 0;
    var countBelumKonfirmasi = 0;
    var countSudahPresensi = 0;
    var countTerlambat = 0;
    var countBelumPresensi = 0;

    participants.forEach(function (m) {
      var p = presMap[m.id] || { kehadiran: 'Belum konfirmasi', presensiStatus: 'Belum presensi' };
      if (p.kehadiran === 'Hadir') countHadir++;
      else if (p.kehadiran === 'Tidak hadir') countTidakHadir++;
      else countBelumKonfirmasi++;

      if (p.presensiStatus === 'Sudah presensi') {
        countSudahPresensi++;
        if (p.lateMinutes > 0) countTerlambat++;
      } else if (p.kehadiran !== 'Tidak hadir') {
        countBelumPresensi++;
      }
    });

    var pctHadir = countTotal > 0 ? Math.round((countSudahPresensi / countTotal) * 100) : 0;

    var topbarActions = '';
    if (flags.can_cancel) {
      topbarActions = '<button class="btn btn-danger" onclick="Admin.openCancelMeetingModal(\'' + meeting.id + '\')">Batalkan Rapat</button>';
    } else if (flags.show_report_btn) {
      topbarActions = '<button class="btn btn-primary" onclick="Admin.openReportModal(\'' + meeting.id + '\')"><svg class="ic-svg" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Laporan Rekapitulasi Presensi</button>';
    }

    container.innerHTML =
      '<div class="admin-topbar">' +
        '<div>' +
          '<h2>' + meeting.namaRapat + '</h2>' +
          '<div class="admin-crumb"><a href="#" onclick="Admin.navigate(\'jadwal\'); return false;">Jadwal Rapat</a> › Detail Rapat (' + meeting.kodeRapat + ')</div>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
          headerBadge +
          topbarActions +
        '</div>' +
      '</div>' +
      '<div class="admin-content">' +

        (isBatal ?
          '<div class="card bl-danger" style="background:#fff6f6; border-color:#f5c6c6; margin-bottom:18px;">' +
            '<div style="font-weight:700; color:var(--danger); font-size:14px;">Rapat Dibatalkan</div>' +
            '<div style="font-size:13px; color:var(--ink); margin-top:4px;">Alasan: <strong>' + (meeting.cancel_reason || meeting.alasanBatal || '-') + '</strong></div>' +
            '<div style="font-size:11.5px; color:var(--muted); margin-top:6px;">Dibatalkan oleh ' + (meeting.cancelled_by || meeting.dibatalkanOleh || 'Admin Sekretariat') + ' · ' + (meeting.cancelled_at || meeting.dibatalkanPada || '-') + '</div>' +
            (meeting.isBatalSaatBerlangsung ? '<div style="background:#eaf8ef; border:1px solid #bce1c7; padding:10px 14px; border-radius:6px; margin-top:10px; font-size:12.5px; color:var(--success); font-weight:700;">✓ Rapat ini dihentikan saat sedang berlangsung. Anggota dewan yang telah hadir dan melakukan scan presensi QR sebelum pembatalan tetap sah tercatat dalam arsip rekapitulasi di bawah ini.</div>' : '') +
          '</div>' : '') +

        '<div style="display:grid; grid-template-columns: ' + (flags.show_qr ? '2fr 1fr' : '1fr') + '; gap:18px; margin-bottom:18px;">' +

          '<div class="card">' +
            '<div class="form-section-title" style="margin-bottom:12px;">Informasi Rapat</div>' +
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">' +
              '<div><span style="color:var(--muted);">Kode Rapat:</span> <strong>' + meeting.kodeRapat + '</strong></div>' +
              '<div><span style="color:var(--muted);">Jenis Rapat:</span> <span class="tag-unit">' + meeting.jenisRapat + '</span></div>' +
              '<div><span style="color:var(--muted);">Tanggal:</span> <strong>' + Rules.formatDateIndo(new Date(meeting.tanggal)) + '</strong></div>' +
              '<div><span style="color:var(--muted);">Waktu:</span> <strong>' + meeting.jamMulai + ' – ' + meeting.jamSelesai + ' WIB</strong></div>' +
              '<div><span style="color:var(--muted);">Lokasi:</span> <strong>' + (meeting.lokasi || 'DPRD Kota Magelang') + '</strong></div>' +
              '<div><span style="color:var(--muted);">Peserta Rapat (N):</span> <strong>' + countTotal + ' Anggota</strong></div>' +
            '</div>' +
            (meeting.deskripsi ? '<div style="margin-top:14px; font-size:13px; color:#4a564e; padding-top:10px; border-top:1px dashed var(--border);"><span style="color:var(--muted);">Deskripsi:</span> ' + meeting.deskripsi + '</div>' : '') +
            (meeting.lampiran && meeting.lampiran.length ?
              '<div style="margin-top:12px; font-size:12.5px;">' +
                '<span style="color:var(--muted);">Lampiran Dokumen:</span> ' +
                meeting.lampiran.map(function (f) {
                  return '<span class="tag-unit" style="margin-right:6px;">' + f.name + ' (' + f.size + ')</span>';
                }).join('') +
              '</div>' : '') +
          '</div>' +

          (flags.show_qr ?
            '<div class="card qr-display-box">' +
              '<div style="font-weight:700; font-size:14px; margin-bottom:4px;">QR Code Presensi Rapat</div>' +
              '<div style="font-size:11.5px; color:var(--muted); margin-bottom:12px;">Berlaku sampai jam selesai (' + meeting.jamSelesai + ' WIB)</div>' +
              '<div class="qr-canvas-holder" id="adminQrHolder"></div>' +
              '<div style="font-size:11px; font-family:monospace; color:var(--muted); margin-top:6px;" id="qrTokenString"></div>' +
              '<button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="Admin.refreshMeetingQR(\'' + meeting.id + '\')">' +
                '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg> Perbarui QR' +
              '</button>' +
            '</div>' : '') +

        '</div>' +

        '<div class="stats-grid-mini">' +
          '<div class="stat-mini-card"><div class="num">' + countTotal + '</div><div class="lbl">Diundang (N)</div></div>' +
          '<div class="stat-mini-card success"><div class="num">' + countHadir + '</div><div class="lbl">Hadir (Konfirmasi)</div></div>' +
          '<div class="stat-mini-card danger"><div class="num">' + countTidakHadir + '</div><div class="lbl">Tidak Hadir</div></div>' +
          '<div class="stat-mini-card info"><div class="num">' + countBelumKonfirmasi + '</div><div class="lbl">Belum Konfirmasi</div></div>' +
          '<div class="stat-mini-card success"><div class="num">' + countSudahPresensi + '</div><div class="lbl">Sudah Presensi</div></div>' +
          '<div class="stat-mini-card warn"><div class="num">' + countTerlambat + '</div><div class="lbl">Terlambat</div></div>' +
          '<div class="stat-mini-card"><div class="num">' + countBelumPresensi + '</div><div class="lbl">Belum Presensi</div></div>' +
          '<div class="stat-mini-card ' + (pctHadir >= 67 ? 'success' : 'warn') + '"><div class="num">' + countSudahPresensi + '/' + countTotal + ' <span style="font-size:14px;">(' + pctHadir + '%)</span></div><div class="lbl">Kehadiran Presensi</div></div>' +
        '</div>' +

        '<div class="card">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">' +
            '<div style="font-weight:700; font-size:15px;">Rekap Presensi Peserta ' + (isBatal ? '<span class="badge-perlu-konfirmasi">Arsip Read-Only</span>' : '') + '</div>' +
            '<div style="font-size:12px; color:var(--muted);">Total Peserta: ' + participants.length + ' Orang</div>' +
          '</div>' +

          '<div class="table-container">' +
            '<table class="data-table">' +
              '<thead><tr>' +
                '<th style="width:40px;">No</th>' +
                '<th>Nama &amp; Kode Anggota</th>' +
                '<th>Konfirmasi Hadir</th>' +
                '<th>Status Presensi QR</th>' +
                '<th>Waktu Presensi (WIB)</th>' +
                '<th>Keterangan / Alasan</th>' +
              '</tr></thead>' +
              '<tbody>' +
                participants.map(function (m, idx) {
                  var p = presMap[m.id] || { kehadiran: 'Belum konfirmasi', presensiStatus: 'Belum presensi', waktuPresensiStr: '-', alasanTidakHadir: '' };

                  var respBadge = '';
                  if (p.kehadiran === 'Hadir') respBadge = '<span class="badge badge-success">Hadir</span>';
                  else if (p.kehadiran === 'Tidak hadir') respBadge = '<span class="badge badge-danger">Tidak Hadir</span>';
                  else respBadge = '<span class="badge badge-neutral">' + (isSelesai ? 'Tidak Merespons' : 'Belum Konfirmasi') + '</span>';

                  var presBadge = '';
                  if (p.presensiStatus === 'Sudah presensi') {
                    if (p.lateMinutes > 0) {
                      presBadge = '<span class="badge badge-warn">Terlambat ' + p.lateMinutes + ' mnt</span>';
                    } else {
                      presBadge = '<span class="badge badge-success">Tepat Waktu</span>';
                    }
                  } else if (p.kehadiran === 'Tidak hadir') {
                    presBadge = '<span style="color:var(--muted);">-</span>';
                  } else {
                    presBadge = '<span class="badge badge-neutral">' + (isSelesai ? 'Tidak Presensi' : 'Belum Presensi') + '</span>';
                  }

                  return '<tr>' +
                    '<td>' + (idx + 1) + '</td>' +
                    '<td>' +
                      '<div style="font-weight:700;">' + m.nama + '</div>' +
                      '<div style="font-family:monospace; font-size:11px; color:var(--muted);">' + m.kode + ' · ' + m.unit + '</div>' +
                    '</td>' +
                    '<td>' + respBadge + '</td>' +
                    '<td>' + presBadge + '</td>' +
                    '<td style="font-family:monospace; font-weight:600;">' + (p.waktuPresensiStr || '-') + '</td>' +
                    '<td style="font-size:12px; color:' + (p.alasanTidakHadir ? 'var(--danger)' : 'var(--muted)') + ';">' + (p.alasanTidakHadir || (p.presensiStatus === 'Sudah presensi' ? 'Sah' : '-')) + '</td>' +
                  '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +

      '</div>';

    if (flags.show_qr) {
      Admin.renderMeetingQRCanvas(meeting);
    }
  };

  Admin.renderMeetingQRCanvas = function (meeting) {
    var holder = document.getElementById('adminQrHolder');
    var tokenStrEl = document.getElementById('qrTokenString');
    if (!holder) return;

    holder.innerHTML = '';
    var qrData = Store.generateQRToken(meeting);
    if (!qrData) {
      holder.innerHTML = '<div style="color:var(--muted); font-size:12px;">QR tidak aktif</div>';
      return;
    }

    if (window.QRCode) {
      new QRCode(holder, {
        text: qrData.qrText,
        width: 170,
        height: 170,
        colorDark: '#0f2318',
        colorLight: '#ffffff'
      });
    } else {
      holder.innerHTML = '<div style="width:170px; height:170px; background:#eee; display:flex; align-items:center; justify-content:center; font-family:monospace; font-size:10px;">[QR CODE ' + meeting.kodeRapat + ']</div>';
    }

    if (tokenStrEl) {
      tokenStrEl.textContent = meeting.kodeRapat + ' · Exp ' + meeting.jamSelesai + ' WIB';
    }
  };

  Admin.refreshMeetingQR = function (meetingId) {
    var m = Store.getMeetingById(meetingId);
    if (m) {
      Admin.renderMeetingQRCanvas(m);
      Admin.showToast('QR Code diperbarui');
    }
  };

  /* ==========================================================================
     PEMBATALAN RAPAT (TRD v1.1 Hal 17: Sebelum & Saat Berlangsung)
     ========================================================================== */
  Admin.openCancelMeetingModal = function (meetingId) {
    var meeting = Store.getMeetingById(meetingId);
    if (!meeting) return;

    var now = Store.now();
    var displayStatus = Rules.deriveDisplayStatus(meeting, now);
    var isOngoing = (displayStatus === 'BERLANGSUNG');

    var alertNotice = isOngoing
      ? '<div style="background:#fff3cd; border:1px solid #ffeeba; color:#856404; padding:10px 12px; border-radius:6px; margin-bottom:12px; font-size:12px;">' +
          '<strong>Perhatian Pembatalan Darurat:</strong> Rapat ini sedang berlangsung. Anggota dewan yang sudah hadir dan melakukan scan presensi QR tetap sah tercatat sebagai arsip rekapitulasi.' +
        '</div>'
      : '';

    var modalHtml =
      '<div class="modal-backdrop" id="cancelMeetingModal">' +
        '<div class="modal-card">' +
          '<div class="modal-header">' +
            '<h3 style="margin:0; font-size:16px; color:var(--danger);">Batalkan Rapat</h3>' +
            '<button type="button" class="modal-close" onclick="Admin.closeModal(\'cancelMeetingModal\')">&times;</button>' +
          '</div>' +
          '<div class="modal-body">' +
            alertNotice +
            '<div style="font-size:13px; color:var(--ink); margin-bottom:10px;">' +
              'Anda akan membatalkan rapat <strong>' + meeting.namaRapat + '</strong> (' + meeting.kodeRapat + '). Kode rapat tidak dapat digunakan ulang.' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Alasan Pembatalan <span class="req">* (Wajib diisi)</span></label>' +
              '<textarea id="txtCancelReason" placeholder="Masukkan alasan resmi pembatalan rapat..." rows="3" required></textarea>' +
            '</div>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" onclick="Admin.closeModal(\'cancelMeetingModal\')">Kembali</button>' +
            '<button type="button" class="btn btn-danger" id="btnConfirmCancelMeeting">Konfirmasi Batalkan</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btnConfirmCancelMeeting').onclick = function () {
      var reason = (document.getElementById('txtCancelReason').value || '').trim();
      if (!reason) {
        alert('Alasan pembatalan rapat wajib diisi.');
        return;
      }

      Store.cancelMeeting(meetingId, reason, 'Admin Sekretariat');
      Admin.closeModal('cancelMeetingModal');
      Admin.showToast('Rapat berhasil dibatalkan.');
      if (currentView === 'detail') {
        Admin.renderMeetingDetail(meetingId);
      } else {
        Admin.renderMeetingList();
      }
    };
  };

  /* ==========================================================================
     VIEW: LAPORAN REKAPITULASI PRESENSI & EKSPOR EXCEL (.XLSX)
     ========================================================================== */
  Admin.openReportModal = function (meetingId) {
    var meeting = Store.getMeetingById(meetingId);
    if (!meeting) return;

    var presMap = Store.getPresenceForMeeting(meeting.id);
    var allMembers = Store.getMembers();
    var participants = allMembers.filter(function (m) {
      return (meeting.peserta || []).indexOf(m.id) !== -1;
    });

    var countTotal = participants.length;
    var countHadir = 0;
    var countTidakHadir = 0;
    var countBelumKonfirmasi = 0;
    var countSudahPresensi = 0;
    var countTepatWaktu = 0;
    var countTerlambat = 0;
    var countBelumPresensi = 0;

    participants.forEach(function (m) {
      var p = presMap[m.id] || { kehadiran: 'Belum konfirmasi', presensiStatus: 'Belum presensi' };
      if (p.kehadiran === 'Hadir') countHadir++;
      else if (p.kehadiran === 'Tidak hadir') countTidakHadir++;
      else countBelumKonfirmasi++;

      if (p.presensiStatus === 'Sudah presensi') {
        countSudahPresensi++;
        if (p.lateMinutes > 0) countTerlambat++;
        else countTepatWaktu++;
      } else if (p.kehadiran !== 'Tidak hadir') {
        countBelumPresensi++;
      }
    });

    var pctHadir = countTotal > 0 ? Math.round((countSudahPresensi / countTotal) * 100) : 0;
    var syaratKuorum = Math.ceil(countTotal * 2 / 3);
    var kuorumLolos = countSudahPresensi >= syaratKuorum;

    var modalHtml =
      '<div class="modal-backdrop" id="reportModal">' +
        '<div class="modal-card modal-card-lg">' +
          '<div class="modal-header">' +
            '<div>' +
              '<h3 style="margin:0; font-size:16px;">Laporan Rekapitulasi Kehadiran &amp; Presensi</h3>' +
              '<div style="font-size:12px; color:var(--muted); margin-top:2px;">' + meeting.namaRapat + ' (' + meeting.kodeRapat + ')</div>' +
            '</div>' +
            '<button type="button" class="modal-close" onclick="Admin.closeModal(\'reportModal\')">&times;</button>' +
          '</div>' +
          '<div class="modal-body" style="padding:22px;">' +

            // KOP SURAT RESMI
            '<div class="report-kop">' +
              '<div class="report-kop-logo">' +
                '<svg viewBox="0 0 48 48" fill="none" style="width:100%; height:100%;"><rect width="48" height="48" rx="8" fill="#1d4a37"/><path d="M24 8l14 8v12c0 8.8-6 16-14 18-8-2-14-9.2-14-18V16l14-8z" fill="#c9a84c"/><path d="M24 14l8 4.5v6.8c0 5-3.4 9.1-8 10.2-4.6-1.1-8-5.2-8-10.2v-6.8l8-4.5z" fill="#0f2e22"/><circle cx="24" cy="24" r="4" fill="#c9a84c"/></svg>' +
              '</div>' +
              '<div class="report-kop-text">' +
                '<h2>DEWAN PERWAKILAN RAKYAT DAERAH KOTA MAGELANG</h2>' +
                '<h3>SEKRETARIAT DPRD KOTA MAGELANG</h3>' +
                '<p>Jl. Sarwo Edhie Wibowo No. 2, Kota Magelang 56126 · Telp: (0293) 362234 · Web: dprd.magelangkota.go.id</p>' +
              '</div>' +
            '</div>' +

            '<div style="text-align:center; margin-bottom:18px;">' +
              '<h4 style="font-family:var(--font-title); font-size:15px; text-transform:uppercase; margin-bottom:4px; letter-spacing:0.5px;">LAPORAN REKAPITULASI KEHADIRAN ANGGOTA DEWAN</h4>' +
              '<div style="font-size:12px; color:var(--muted);">Sistem Informasi e-Parlemen Manajemen Presensi &amp; Kuorum Sidang</div>' +
            '</div>' +

            // INFORMASI RAPAT
            '<div style="background:#f9f8f5; border:1px solid var(--border); border-radius:8px; padding:12px 16px; margin-bottom:16px; font-size:12.5px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">' +
              '<div><span style="color:var(--muted);">Nama Rapat:</span> <strong>' + meeting.namaRapat + '</strong></div>' +
              '<div><span style="color:var(--muted);">Tingkat / Jenis:</span> <span class="tag-unit">' + meeting.jenisRapat + '</span></div>' +
              '<div><span style="color:var(--muted);">Hari, Tanggal:</span> <strong>' + Rules.formatDateIndo(new Date(meeting.tanggal)) + '</strong></div>' +
              '<div><span style="color:var(--muted);">Waktu Sidang:</span> <strong>' + meeting.jamMulai + ' – ' + meeting.jamSelesai + ' WIB</strong></div>' +
              '<div><span style="color:var(--muted);">Lokasi:</span> ' + (meeting.lokasi || 'DPRD Kota Magelang') + '</div>' +
              '<div><span style="color:var(--muted);">Status Penyelenggaraan:</span> ' +
                (meeting.status === 'Batal' ? '<span class="badge badge-danger">Dibatalkan (' + (meeting.isBatalSaatBerlangsung ? 'Saat Berlangsung' : 'Sebelum Dimulai') + ')</span>' : '<span class="badge badge-neutral">Selesai</span>') +
              '</div>' +
            '</div>' +

            // STATS REKAP
            '<div class="stats-grid-mini" style="margin-bottom:16px;">' +
              '<div class="stat-mini-card"><div class="num">' + countTotal + '</div><div class="lbl">Total Diundang (N)</div></div>' +
              '<div class="stat-mini-card success"><div class="num">' + countSudahPresensi + '</div><div class="lbl">Hadir (Presensi QR)</div></div>' +
              '<div class="stat-mini-card success"><div class="num">' + countTepatWaktu + '</div><div class="lbl">Tepat Waktu</div></div>' +
              '<div class="stat-mini-card warn"><div class="num">' + countTerlambat + '</div><div class="lbl">Terlambat</div></div>' +
              '<div class="stat-mini-card danger"><div class="num">' + countTidakHadir + '</div><div class="lbl">Izin / Tidak Hadir</div></div>' +
              '<div class="stat-mini-card info"><div class="num">' + countBelumPresensi + '</div><div class="lbl">Tanpa Keterangan</div></div>' +
              '<div class="stat-mini-card ' + (kuorumLolos ? 'success' : 'danger') + '">' +
                '<div class="num">' + pctHadir + '%</div>' +
                '<div class="lbl">Tingkat Kehadiran</div>' +
              '</div>' +
              '<div class="stat-mini-card ' + (kuorumLolos ? 'success' : 'danger') + '">' +
                '<div class="num" style="font-size:14px; margin-top:4px;">' + (kuorumLolos ? 'TERPENUHI (≥ 2/3)' : 'TIDAK TERPENUHI') + '</div>' +
                '<div class="lbl">Syarat Kuorum (' + syaratKuorum + ')</div>' +
              '</div>' +
            '</div>' +

            // DAFTAR REKAPITULASI SESUAI TRD v1.1 Hal 16
            '<div style="font-weight:700; font-size:13px; margin-bottom:8px;">Rincian Kehadiran &amp; Presensi Anggota Dewan:</div>' +
            '<div class="table-container" style="max-height:360px; overflow-y:auto; margin-bottom:16px;">' +
              '<table class="data-table">' +
                '<thead><tr>' +
                  '<th style="width:40px;">No</th>' +
                  '<th>Kode &amp; Nama Anggota</th>' +
                  '<th>Jabatan &amp; Unit</th>' +
                  '<th>Konfirmasi Hadir</th>' +
                  '<th>Status Presensi QR</th>' +
                  '<th>Waktu Presensi (WIB)</th>' +
                  '<th>Keterangan / Alasan</th>' +
                '</tr></thead>' +
                '<tbody>' +
                  participants.map(function (m, idx) {
                    var p = presMap[m.id] || { kehadiran: 'Belum konfirmasi', presensiStatus: 'Belum presensi', waktuPresensiStr: '-', alasanTidakHadir: '' };

                    var confBadge = '';
                    if (p.kehadiran === 'Hadir') confBadge = '<span class="badge badge-success">Hadir</span>';
                    else if (p.kehadiran === 'Tidak hadir') confBadge = '<span class="badge badge-danger">Tidak Hadir</span>';
                    else confBadge = '<span class="badge badge-neutral">Belum Konfirmasi</span>';

                    var presBadge = '';
                    if (p.presensiStatus === 'Sudah presensi') {
                      if (p.lateMinutes > 0) {
                        presBadge = '<span class="badge badge-warn">Terlambat ' + p.lateMinutes + ' mnt</span>';
                      } else {
                        presBadge = '<span class="badge badge-success">Tepat Waktu</span>';
                      }
                    } else if (p.kehadiran === 'Tidak hadir') {
                      presBadge = '<span style="color:var(--muted);">-</span>';
                    } else {
                      presBadge = '<span class="badge badge-neutral">Tidak Presensi</span>';
                    }

                    return '<tr>' +
                      '<td>' + (idx + 1) + '</td>' +
                      '<td>' +
                        '<div style="font-weight:700;">' + m.nama + '</div>' +
                        '<div style="font-family:monospace; font-size:11px; color:var(--muted);">' + m.kode + '</div>' +
                      '</td>' +
                      '<td>' +
                        '<div style="font-weight:600; font-size:12px;">' + m.jabatan + '</div>' +
                        '<div style="font-size:11px; color:var(--muted);">' + m.unit + '</div>' +
                      '</td>' +
                      '<td>' + confBadge + '</td>' +
                      '<td>' + presBadge + '</td>' +
                      '<td style="font-family:monospace; font-weight:600;">' + (p.waktuPresensiStr || '-') + '</td>' +
                      '<td style="font-size:12px; color:' + (p.alasanTidakHadir ? 'var(--danger)' : 'var(--muted)') + ';">' + (p.alasanTidakHadir || (p.presensiStatus === 'Sudah presensi' ? 'Sah' : '-')) + '</td>' +
                    '</tr>';
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>' +

            // PENGESAHAN
            '<div style="display:flex; justify-content:flex-end; margin-top:20px; font-size:12.5px;">' +
              '<div style="text-align:center; min-width:240px;">' +
                '<div>Kota Magelang, ' + Rules.formatDateIndo(new Date(meeting.tanggal)) + '</div>' +
                '<div style="margin-top:2px; font-weight:600;">Sekretariat DPRD Kota Magelang</div>' +
                '<div style="margin-top:40px; font-weight:700; text-decoration:underline;">Drs. H. Prawira Kusuma, M.Si.</div>' +
                '<div style="font-size:11px; color:var(--muted);">NIP. 19750812 199803 1 004</div>' +
              '</div>' +
            '</div>' +

          '</div>' +
          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" onclick="Admin.closeModal(\'reportModal\')">Tutup</button>' +
            '<button type="button" class="btn btn-success" onclick="Admin.downloadReportExcel(\'' + meeting.id + '\')">' +
              '<svg class="ic-svg" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download Excel (.xlsx)' +
            '</button>' +
            '<button type="button" class="btn btn-primary" onclick="window.print()">' +
              '<svg class="ic-svg" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Cetak / Export PDF' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  Admin.escapeXml = function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  /**
   * Ekspor Berkas Excel Rekapitulasi Presensi Rapat (Sesuai TRD v1.1 Hal 16)
   */
  Admin.downloadReportExcel = function (meetingId) {
    var meeting = Store.getMeetingById(meetingId);
    if (!meeting) return;

    var presMap = Store.getPresenceForMeeting(meeting.id);
    var allMembers = Store.getMembers();
    var participants = allMembers.filter(function (m) {
      return (meeting.peserta || []).indexOf(m.id) !== -1;
    });

    var derived = Rules.deriveDisplayStatus(meeting, Store.now());
    var statusText = meeting.status === 'Batal' ? 'Dibatalkan' : (meeting.status === 'Selesai' || derived === 'SELESAI' ? 'Selesai' : 'Dijadwalkan');

    var countHadir = 0;
    var countTidakHadir = 0;
    var countSudahPresensi = 0;
    var countTerlambat = 0;

    participants.forEach(function (m) {
      var p = presMap[m.id] || {};
      if (p.kehadiran === 'Hadir') countHadir++;
      else if (p.kehadiran === 'Tidak hadir') countTidakHadir++;
      if (p.presensiStatus === 'Sudah presensi') {
        countSudahPresensi++;
        if (p.lateMinutes > 0) countTerlambat++;
      }
    });

    var rowsXml = '';
    participants.forEach(function (m, idx) {
      var p = presMap[m.id] || {};
      var conf = p.kehadiran || 'Belum konfirmasi';
      var presStatus = p.presensiStatus || 'Belum presensi';
      var punctuality = (presStatus === 'Sudah presensi')
        ? (p.lateMinutes > 0 ? 'Terlambat ' + p.lateMinutes + ' mnt' : 'Tepat Waktu')
        : (conf === 'Tidak hadir' ? '-' : 'Tidak Presensi');
      var wkt = p.waktuPresensiStr || '-';
      var alasan = p.alasanTidakHadir || (presStatus === 'Sudah presensi' ? 'Hadir Sah' : '-');

      rowsXml +=
        '<Row>' +
          '<Cell ss:StyleID="CellBorderCenter"><Data ss:Type="Number">' + (idx + 1) + '</Data></Cell>' +
          '<Cell ss:StyleID="CellBorder"><Data ss:Type="String">' + Admin.escapeXml(m.kode) + '</Data></Cell>' +
          '<Cell ss:StyleID="CellBorderBold"><Data ss:Type="String">' + Admin.escapeXml(m.nama) + '</Data></Cell>' +
          '<Cell ss:StyleID="CellBorder"><Data ss:Type="String">' + Admin.escapeXml(m.jabatan) + '</Data></Cell>' +
          '<Cell ss:StyleID="CellBorder"><Data ss:Type="String">' + Admin.escapeXml(m.unit) + '</Data></Cell>' +
          '<Cell ss:StyleID="CellBorderCenter"><Data ss:Type="String">' + Admin.escapeXml(conf) + '</Data></Cell>' +
          '<Cell ss:StyleID="CellBorderCenter"><Data ss:Type="String">' + Admin.escapeXml(punctuality) + '</Data></Cell>' +
          '<Cell ss:StyleID="CellBorderCenter"><Data ss:Type="String">' + Admin.escapeXml(wkt) + '</Data></Cell>' +
          '<Cell ss:StyleID="CellBorder"><Data ss:Type="String">' + Admin.escapeXml(alasan) + '</Data></Cell>' +
        '</Row>';
    });

    var excelXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<?mso-application progid="Excel.Sheet"?>' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
      ' xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      ' xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
      '<Styles>' +
        '<Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/></Style>' +
        '<Style ss:ID="HeaderTitle"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0F2318"/><Alignment ss:Horizontal="Center"/></Style>' +
        '<Style ss:ID="HeaderSub"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#555555"/><Alignment ss:Horizontal="Center"/></Style>' +
        '<Style ss:ID="ColHeader"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1B3A2B" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>' +
        '<Style ss:ID="CellBorder"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/></Borders></Style>' +
        '<Style ss:ID="CellBorderBold"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/></Borders></Style>' +
        '<Style ss:ID="CellBorderCenter"><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9D9D9"/></Borders></Style>' +
      '</Styles>' +
      '<Worksheet ss:Name="Rekapitulasi Kehadiran">' +
        '<Table>' +
          '<Column ss:Width="30"/>' +
          '<Column ss:Width="100"/>' +
          '<Column ss:Width="160"/>' +
          '<Column ss:Width="120"/>' +
          '<Column ss:Width="120"/>' +
          '<Column ss:Width="110"/>' +
          '<Column ss:Width="120"/>' +
          '<Column ss:Width="90"/>' +
          '<Column ss:Width="180"/>' +
          '<Row><Cell ss:MergeAcross="8" ss:StyleID="HeaderTitle"><Data ss:Type="String">LAPORAN REKAPITULASI KEHADIRAN ANGGOTA DEWAN</Data></Cell></Row>' +
          '<Row><Cell ss:MergeAcross="8" ss:StyleID="HeaderSub"><Data ss:Type="String">DPRD KOTA MAGELANG · e-Parlemen Manajemen Kuorum &amp; Presensi</Data></Cell></Row>' +
          '<Row/>' +
          '<Row><Cell><Data ss:Type="String">Nama Rapat:</Data></Cell><Cell ss:MergeAcross="2"><Data ss:Type="String">' + Admin.escapeXml(meeting.namaRapat) + '</Data></Cell><Cell><Data ss:Type="String">Tingkat / Jenis:</Data></Cell><Cell ss:MergeAcross="3"><Data ss:Type="String">' + Admin.escapeXml(meeting.jenisRapat) + '</Data></Cell></Row>' +
          '<Row><Cell><Data ss:Type="String">Hari, Tanggal:</Data></Cell><Cell ss:MergeAcross="2"><Data ss:Type="String">' + Admin.escapeXml(Rules.formatDateIndo(new Date(meeting.tanggal))) + '</Data></Cell><Cell><Data ss:Type="String">Waktu Sidang:</Data></Cell><Cell ss:MergeAcross="3"><Data ss:Type="String">' + meeting.jamMulai + ' - ' + meeting.jamSelesai + ' WIB</Data></Cell></Row>' +
          '<Row><Cell><Data ss:Type="String">Lokasi:</Data></Cell><Cell ss:MergeAcross="2"><Data ss:Type="String">' + Admin.escapeXml(meeting.lokasi || 'DPRD Kota Magelang') + '</Data></Cell><Cell><Data ss:Type="String">Status Penyelenggaraan:</Data></Cell><Cell ss:MergeAcross="3"><Data ss:Type="String">' + statusText + '</Data></Cell></Row>' +
          '<Row/>' +
          '<Row>' +
            '<Cell ss:StyleID="ColHeader"><Data ss:Type="String">NO</Data></Cell>' +
            '<Cell ss:StyleID="ColHeader"><Data ss:Type="String">KODE ANGGOTA</Data></Cell>' +
            '<Cell ss:StyleID="ColHeader"><Data ss:Type="String">NAMA ANGGOTA</Data></Cell>' +
            '<Cell ss:StyleID="ColHeader"><Data ss:Type="String">JABATAN</Data></Cell>' +
            '<Cell ss:StyleID="ColHeader"><Data ss:Type="String">UNIT ORGANISASI</Data></Cell>' +
            '<Cell ss:StyleID="ColHeader"><Data ss:Type="String">KONFIRMASI KEHADIRAN</Data></Cell>' +
            '<Cell ss:StyleID="ColHeader"><Data ss:Type="String">STATUS PRESENSI QR</Data></Cell>' +
            '<Cell ss:StyleID="ColHeader"><Data ss:Type="String">WAKTU PRESENSI (WIB)</Data></Cell>' +
            '<Cell ss:StyleID="ColHeader"><Data ss:Type="String">KETERANGAN / ALASAN</Data></Cell>' +
          '</Row>' +
          rowsXml +
        '</Table>' +
      '</Worksheet>' +
      '</Workbook>';

    var blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Laporan_Rekapitulasi_Presensi_' + meeting.kodeRapat + '.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Admin.showToast('Berkas Excel presensi berhasil diunduh.');
  };

  /* ==========================================================================
     MODAL UTILITIES
     ========================================================================== */
  Admin.showModalNotice = function (title, contentHtml, closeBtnText, onConfirm) {
    var modalHtml =
      '<div class="modal-backdrop" id="genericNoticeModal">' +
        '<div class="modal-card">' +
          '<div class="modal-header">' +
            '<h3 style="margin:0; font-size:16px;">' + title + '</h3>' +
            '<button type="button" class="modal-close" onclick="Admin.closeModal(\'genericNoticeModal\')">&times;</button>' +
          '</div>' +
          '<div class="modal-body">' + contentHtml + '</div>' +
          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-primary" id="btnNoticeConfirm">' + (closeBtnText || 'Tutup') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('btnNoticeConfirm').onclick = function () {
      Admin.closeModal('genericNoticeModal');
      if (typeof onConfirm === 'function') onConfirm();
    };
  };

  Admin.showConfirmModal = function (title, message, onYes) {
    var modalHtml =
      '<div class="modal-backdrop" id="genericConfirmModal">' +
        '<div class="modal-card">' +
          '<div class="modal-header">' +
            '<h3 style="margin:0; font-size:16px;">' + title + '</h3>' +
            '<button type="button" class="modal-close" onclick="Admin.closeModal(\'genericConfirmModal\')">&times;</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<div style="font-size:13.5px; color:var(--ink);">' + message + '</div>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" onclick="Admin.closeModal(\'genericConfirmModal\')">Batal</button>' +
            '<button type="button" class="btn btn-primary" id="btnConfirmYes">Ya, Lanjutkan</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('btnConfirmYes').onclick = function () {
      Admin.closeModal('genericConfirmModal');
      if (typeof onYes === 'function') onYes();
    };
  };

  Admin.confirmDeleteMeeting = function (meetingId) {
    Admin.showConfirmModal(
      'Hapus Rapat',
      'Apakah Anda yakin ingin menghapus jadwal rapat ini? Tindakan ini tidak dapat dibatalkan.',
      function () {
        Store.deleteMeeting(meetingId);
        Admin.showToast('Rapat berhasil dihapus.');
        Admin.renderMeetingList();
      }
    );
  };

  Admin.closeModal = function (modalId) {
    var m = document.getElementById(modalId);
    if (m) m.remove();
  };

  Admin.showToast = function (msg) {
    var existing = document.getElementById('adminToast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('show');
    }, 10);

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3200);
  };

  window.Admin = Admin;
})(window);
