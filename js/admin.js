/**
 * admin.js - Controller Web Admin e-Parlemen DPRD Kota Magelang (Revisi Template)
 * Menangani Jadwal Rapat, Form Buat/Edit Rapat (Peserta sesuai Komisi/Unit, Tombol Bawah,
 * Cek Kuorum hanya saat klik Jadwalkan), Status Sedang Berlangsung (Bisa Dibatalkan),
 * QR Code, Rekap Presensi, dan Laporan Rapat.
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
    selectedUnits: ['Komisi I'], // Default Komisi I (10 orang) agar realistis
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
        '<span>Simulator Waktu (WIB)</span>' +
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
          '<button type="button" class="ts-btn" data-preset="2026-11-19T09:00:00">H-1 (19 Nov)</button>' +
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
     VIEW: JADWAL RAPAT (LIST) - Termasuk Tab Sedang Berlangsung & Batalkan
     ========================================================================== */
  Admin.renderJadwalView = function (container) {
    var allM = Store.getMeetings();
    var nowTime = Store.now();
    var cMendatang = 0, cBerlangsung = 0, cSelesai = 0, cBatal = 0;
    allM.forEach(function (m) {
      var d = Rules.deriveMeetingStatus(m, nowTime);
      if (m.status === 'Batal') cBatal++;
      else if (d === 'Berjalan') cBerlangsung++;
      else if (d === 'Selesai') cSelesai++;
      else cMendatang++;
    });

    container.innerHTML =
      '<div class="admin-topbar">' +
        '<div>' +
          '<h2>Jadwal Rapat</h2>' +
          '<div class="admin-crumb">Admin Sekretariat › Manajemen Rapat DPRD Kota Magelang</div>' +
        '</div>' +
        '<div>' +
          '<button class="btn btn-primary" id="btnTambahRapat">' +
            '<svg class="ic-svg" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
            ' Tambah Rapat' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="admin-content">' +
        '<div class="tabs-nav">' +
          '<button class="tab-btn ' + (currentTab === 'Mendatang' ? 'active' : '') + '" data-tab="Mendatang">Mendatang (' + cMendatang + ')</button>' +
          '<button class="tab-btn ' + (currentTab === 'Sedang Berlangsung' ? 'active' : '') + '" data-tab="Sedang Berlangsung"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:4px;"></span>Sedang Berlangsung (' + cBerlangsung + ')</button>' +
          '<button class="tab-btn ' + (currentTab === 'Selesai' ? 'active' : '') + '" data-tab="Selesai">Selesai (' + cSelesai + ')</button>' +
          '<button class="tab-btn ' + (currentTab === 'Dibatalkan' ? 'active' : '') + '" data-tab="Dibatalkan">Dibatalkan (' + cBatal + ')</button>' +
          '<button class="tab-btn ' + (currentTab === 'Semua' ? 'active' : '') + '" data-tab="Semua">Semua (' + allM.length + ')</button>' +
        '</div>' +

        '<div class="filter-bar">' +
          '<div class="search-input-wrap">' +
            '<svg class="ic-svg ic-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
            '<input type="text" id="filterSearch" placeholder="Cari kode rapat atau nama rapat...">' +
          '</div>' +
          '<select class="filter-select" id="filterJenis">' +
            '<option value="">Semua Jenis Rapat (15)</option>' +
            Rules.JENIS_RAPAT.map(function (j) { return '<option value="' + j + '">' + j + '</option>'; }).join('') +
          '</select>' +
          '<select class="filter-select" id="filterStatus">' +
            '<option value="">Semua Status DB</option>' +
            '<option value="Draft">Draft</option>' +
            '<option value="Dijadwalkan">Dijadwalkan</option>' +
            '<option value="Selesai">Selesai</option>' +
            '<option value="Batal">Batal</option>' +
          '</select>' +
          '<div class="filter-date-group">' +
            '<span>Dari:</span><input type="date" id="filterStartDate">' +
            '<span>Sampai:</span><input type="date" id="filterEndDate">' +
            '<button class="btn btn-secondary btn-sm" id="btnFilterApply">Terapkan</button>' +
            '<button class="btn btn-secondary btn-sm" id="btnFilterReset">Reset</button>' +
          '</div>' +
        '</div>' +

        '<div id="meetingListContainer"></div>' +
      '</div>';

    document.getElementById('btnTambahRapat').onclick = function () {
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
      var derived = Rules.deriveMeetingStatus(m, now);

      if (currentTab === 'Mendatang') {
        if (derived !== 'Mendatang' && m.status !== 'Draft') return false;
      } else if (currentTab === 'Sedang Berlangsung') {
        if (derived !== 'Berjalan' || m.status === 'Batal') return false;
      } else if (currentTab === 'Selesai') {
        if (derived !== 'Selesai') return false;
      } else if (currentTab === 'Dibatalkan') {
        if (m.status !== 'Batal') return false;
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
      '<th>Kode & Nama Rapat</th>' +
      '<th>Jenis & Unit</th>' +
      '<th>Waktu & Lokasi</th>' +
      '<th>Peserta</th>' +
      '<th>Status</th>' +
      '<th style="text-align:right;">Aksi</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < filtered.length; i++) {
      var m = filtered[i];
      var derived = Rules.deriveMeetingStatus(m, now);
      var isToday = (m.tanggal === Rules.formatDateYMD(now));

      var statusBadge = '';
      if (m.status === 'Draft') {
        statusBadge = '<span class="badge badge-neutral">Draft</span>';
      } else if (m.status === 'Batal') {
        statusBadge = '<span class="badge badge-danger">Dibatalkan</span>';
      } else if (derived === 'Berjalan') {
        statusBadge = '<span class="badge badge-live">Sedang Berlangsung</span>';
      } else if (derived === 'Selesai') {
        statusBadge = '<span class="badge badge-neutral">Selesai</span>';
      } else {
        statusBadge = '<span class="badge badge-info">Dijadwalkan</span>';
      }

      var todayBadge = isToday ? '<span class="badge badge-today">Hari Ini</span> ' : '';

      var actionBtns = '';
      if (m.status === 'Draft') {
        actionBtns =
          '<button class="btn btn-secondary btn-sm" onclick="Admin.navigate(\'form\', \'' + m.id + '\')">Lanjutkan</button> ' +
          '<button class="btn btn-danger btn-sm" onclick="Admin.confirmDeleteMeeting(\'' + m.id + '\')">Hapus</button>';
      } else if (m.status === 'Batal') {
        actionBtns =
          '<button class="btn btn-secondary btn-sm" onclick="Admin.navigate(\'detail\', \'' + m.id + '\')">Lihat Detail</button> ' +
          '<button class="btn btn-primary btn-sm" onclick="Admin.openReportModal(\'' + m.id + '\')">Rekap Presensi</button>' +
          (m.alasanBatal ? '<div style="font-size:11px; color:var(--danger); margin-top:4px; max-width:200px; text-align:right;">Alasan: ' + (m.alasanBatal.length > 45 ? m.alasanBatal.slice(0, 45) + '...' : m.alasanBatal) + '</div>' : '');
      } else if (derived === 'Berjalan' || m.status === 'Dijadwalkan') {
        // Sedang berlangsung maupun Mendatang: BISA DIBATALKAN!
        actionBtns =
          '<button class="btn btn-secondary btn-sm" onclick="Admin.navigate(\'detail\', \'' + m.id + '\')">Lihat Detail</button> ' +
          '<button class="btn btn-danger btn-sm" onclick="Admin.openCancelMeetingModal(\'' + m.id + '\')">Batalkan Rapat</button>';
      } else {
        // Selesai
        actionBtns =
          '<button class="btn btn-secondary btn-sm" onclick="Admin.navigate(\'detail\', \'' + m.id + '\')">Lihat Detail</button> ' +
          '<button class="btn btn-primary btn-sm" onclick="Admin.openReportModal(\'' + m.id + '\')">Rekap Presensi</button>';
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
     VIEW: FORM RAPAT (PESERTA SESUAI KOMISI, TOMBOL BAWAH, CEK KUORUM DI BTN)
     ========================================================================== */
  Admin.renderFormView = function (container, draftId) {
    var draft = draftId ? Store.getMeetingById(draftId) : null;
    var isEdit = !!draft;

    var defaultKode = isEdit ? draft.kodeRapat : 'RPT-2026-' + String(Math.floor(Math.random() * 900) + 100);
    var defaultNama = isEdit ? draft.namaRapat : '';
    var defaultJenis = isEdit ? draft.jenisRapat : 'Komisi I';
    var defaultLokasi = isEdit ? draft.lokasi : 'Ruang Rapat Komisi I DPRD Kota Magelang';
    var defaultTanggal = isEdit ? draft.tanggal : '2026-11-20';
    var defaultMulai = isEdit ? draft.jamMulai : '10:00';
    var defaultSelesai = isEdit ? draft.jamSelesai : '12:00';
    var defaultDeskripsi = isEdit ? (draft.deskripsi || '') : '';

    formState.selectedUnits = isEdit ? (draft.unit || ['Komisi I']) : ['Komisi I'];
    formState.uploadedFiles = isEdit && draft.lampiran ? draft.lampiran.slice() : [
      { name: 'Surat_Undangan_Rapat.pdf', size: '820 KB' }
    ];

    container.innerHTML =
      '<div class="admin-topbar">' +
        '<div>' +
          '<h2>' + (isEdit ? 'Lanjutkan Draf Rapat' : 'Buat Jadwal Rapat Baru') + '</h2>' +
          '<div class="admin-crumb"><a href="#" onclick="Admin.confirmLeaveForm(); return false;">Jadwal Rapat</a> › ' + (isEdit ? 'Edit Draf' : 'Form Buat Rapat') + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="admin-content">' +
        '<div class="info-box" style="background:#e8f4ec; border:1px solid #bce1c7; padding:12px 16px; border-radius:8px; margin-bottom:18px; font-size:12.5px; display:flex; gap:10px; align-items:center;">' +
          '<svg class="ic-svg" viewBox="0 0 24 24" style="color:var(--green);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>' +
          '<span>Daftar peserta otomatis menyesuaikan komisi / unit yang dipilih. Pengecekan <strong>Kuorum ⅔</strong> akan dievaluasi saat Anda menekan tombol <strong>Jadwalkan Rapat</strong> di bagian bawah.</span>' +
        '</div>' +

        '<form id="meetingForm" onsubmit="return false;">' +

          // CARD 1: INFORMASI RAPAT
          '<div class="card">' +
            '<div class="form-section-title">Informasi Rapat</div>' +
            '<div class="form-section-hint">Detail dasar identitas dan unit penyelenggara rapat.</div>' +

            '<div class="form-grid-2">' +
              '<div class="form-group">' +
                '<label>Kode Rapat <span class="req">*</span></label>' +
                '<input type="text" id="fKodeRapat" value="' + defaultKode + '" placeholder="Contoh: RPT-2026-001" required>' +
                '<div class="field-hint">Wajib, manual, dan unik. Kode dibatalkan tetap terpakai.</div>' +
              '</div>' +
              '<div class="form-group">' +
                '<label>Jenis Rapat (15 Opsi) <span class="req">*</span></label>' +
                '<select id="fJenisRapat" required>' +
                  Rules.JENIS_RAPAT.map(function (j) {
                    return '<option value="' + j + '" ' + (j === defaultJenis ? 'selected' : '') + '>' + j + '</option>';
                  }).join('') +
                '</select>' +
              '</div>' +
            '</div>' +

            '<div class="form-group">' +
              '<label>Nama / Judul Rapat <span class="req">*</span></label>' +
              '<input type="text" id="fNamaRapat" value="' + defaultNama + '" placeholder="Contoh: Rapat Kerja Komisi I Evaluasi Pelayanan Publik" required>' +
            '</div>' +

            '<div class="form-group">' +
              '<label>Pilih Unit Kerja / Komisi Penyelenggara <span class="req">*</span></label>' +
              '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:6px;" id="unitChipsContainer">' +
                Rules.UNIT_OPTIONS.map(function (u) {
                  var isSel = formState.selectedUnits.indexOf(u) !== -1;
                  return '<button type="button" class="btn btn-sm ' + (isSel ? 'btn-primary' : 'btn-secondary') + '" data-unit="' + u + '">' + u + '</button>';
                }).join('') +
              '</div>' +
              '<div class="field-hint">Klik untuk memilih unit. Contoh: Pilih <strong>Komisi I</strong> untuk rapat 10 orang, atau <strong>Rapat Paripurna</strong> untuk 100 orang.</div>' +
            '</div>' +
          '</div>' +

          // CARD 2: PESERTA RAPAT (Sesuai Komisi / Unit Terpilih)
          '<div class="card">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
              '<div class="form-section-title">Peserta Rapat (<span id="unitPesertaCount">0</span> Anggota)</div>' +
              '<div style="display:flex; gap:6px;">' +
                '<button type="button" class="btn btn-secondary btn-sm" id="btnCheckAll">Pilih Semua</button>' +
                '<button type="button" class="btn btn-secondary btn-sm" id="btnUncheckAll">Batal Pilih</button>' +
              '</div>' +
            '</div>' +
            '<div class="form-section-hint">Tentukan anggota mana saja yang diundang menghadiri rapat ini. Anda dapat mencentang atau menghapus centang secara individual.</div>' +

            '<div class="table-container" style="max-height: 320px; overflow-y:auto; margin-top:8px;">' +
              '<table class="data-table">' +
                '<thead><tr>' +
                  '<th style="width:40px;"><input type="checkbox" id="masterCheckbox" checked></th>' +
                  '<th>Nama & Kode Anggota</th>' +
                  '<th>Jabatan & Unit</th>' +
                  '<th>Status Jadwal</th>' +
                '</tr></thead>' +
                '<tbody id="participantsTableBody"></tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +

          // CARD 3: WAKTU & LOKASI PELAKSANAAN
          '<div class="card">' +
            '<div class="form-section-title">Waktu &amp; Lokasi Pelaksanaan</div>' +
            '<div class="form-section-hint">Jam mulai dan selesai digunakan sebagai jendela validasi presensi pada hari H.</div>' +

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
            '<div class="form-section-title">Dokumen Surat Undangan</div>' +
            '<div class="form-section-hint">Unggah surat undangan resmi yang dapat diakses oleh anggota dewan di aplikasi mobile.</div>' +

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

    // Unit toggle
    var unitBtns = container.querySelectorAll('#unitChipsContainer button');
    unitBtns.forEach(function (btn) {
      btn.onclick = function () {
        var u = btn.getAttribute('data-unit');
        var idx = formState.selectedUnits.indexOf(u);
        if (idx !== -1) {
          if (formState.selectedUnits.length > 1) {
            formState.selectedUnits.splice(idx, 1);
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
          } else {
            Admin.showToast('Pilih minimal satu unit kerja / komisi.');
            return;
          }
        } else {
          formState.selectedUnits.push(u);
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
        }
        Admin.refreshFormParticipants(draft ? draft.peserta : null);
      };
    });

    // Check all / uncheck all
    document.getElementById('btnCheckAll').onclick = function () {
      var chks = container.querySelectorAll('.part-chk');
      chks.forEach(function (c) {
        c.checked = true;
        formState.checkedParticipants[c.getAttribute('data-mid')] = true;
      });
    };
    document.getElementById('btnUncheckAll').onclick = function () {
      var chks = container.querySelectorAll('.part-chk');
      chks.forEach(function (c) {
        c.checked = false;
        formState.checkedParticipants[c.getAttribute('data-mid')] = false;
      });
    };
    document.getElementById('masterCheckbox').onchange = function (e) {
      var val = e.target.checked;
      var chks = container.querySelectorAll('.part-chk');
      chks.forEach(function (c) {
        c.checked = val;
        formState.checkedParticipants[c.getAttribute('data-mid')] = val;
      });
    };

    // Date changes refresh conflict indicators
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
   * Refresh daftar peserta form berdasarkan unit/komisi yang dipilih
   */
  Admin.refreshFormParticipants = function (preferredCheckedIds) {
    var tbody = document.getElementById('participantsTableBody');
    var countEl = document.getElementById('unitPesertaCount');
    if (!tbody) return;

    var matchedMembers = Store.getMembersByUnits(formState.selectedUnits);
    if (countEl) countEl.textContent = matchedMembers.length;

    var tanggal = document.getElementById('fTanggal').value;
    var jamMulai = document.getElementById('fJamMulai').value;
    var jamSelesai = document.getElementById('fJamSelesai').value;
    var candidate = { tanggal: tanggal, jamMulai: jamMulai, jamSelesai: jamSelesai };

    var rowsHtml = '';
    matchedMembers.forEach(function (member) {
      var isChecked = true;
      if (preferredCheckedIds) {
        isChecked = preferredCheckedIds.indexOf(member.id) !== -1;
      } else if (formState.checkedParticipants[member.id] !== undefined) {
        isChecked = formState.checkedParticipants[member.id];
      }
      formState.checkedParticipants[member.id] = isChecked;

      var acts = Store.getActivitiesForMember(member.id);
      var res = Rules.evaluateParticipantActivities(candidate, acts);

      var statusBadge = '';
      if (res.hasConflict) {
        statusBadge = '<span class="badge badge-danger">' + res.conflictDetails[0].keterangan + '</span>';
      } else if (res.hasWarning) {
        statusBadge = '<span class="badge badge-warn">' + res.warningDetails[0].keterangan + '</span>';
      } else {
        statusBadge = '<span style="color:var(--muted); font-size:11.5px;">Tersedia (Bersih)</span>';
      }

      rowsHtml +=
        '<tr>' +
          '<td><input type="checkbox" class="part-chk" data-mid="' + member.id + '" ' + (isChecked ? 'checked' : '') + '></td>' +
          '<td>' +
            '<div style="font-weight:700;">' + member.nama + '</div>' +
            '<div style="font-family:monospace; font-size:11px; color:var(--muted);">' + member.kode + '</div>' +
          '</td>' +
          '<td>' +
            '<span class="tag-unit">' + member.unit + '</span>' +
            '<div style="font-size:11px; color:var(--muted); margin-top:2px;">' + member.fraksi + '</div>' +
          '</td>' +
          '<td>' + statusBadge + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = rowsHtml;

    tbody.querySelectorAll('.part-chk').forEach(function (chk) {
      chk.onchange = function () {
        var mid = chk.getAttribute('data-mid');
        formState.checkedParticipants[mid] = chk.checked;
      };
    });
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
   * Kuorum HANYA dicek saat klik 'Jadwalkan Rapat'!
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
      alert('Kode rapat "' + kode + '" sudah digunakan atau pernah dibatalkan.');
      return;
    }

    // Anggota tercentang dari unit terpilih
    var matchedMembers = Store.getMembersByUnits(formState.selectedUnits);
    var selectedPeserta = [];
    var bentrokUnik = 0;
    var candidate = { tanggal: tanggal, jamMulai: jamMulai, jamSelesai: jamSelesai };

    matchedMembers.forEach(function (m) {
      if (formState.checkedParticipants[m.id]) {
        selectedPeserta.push(m.id);
        var acts = Store.getActivitiesForMember(m.id);
        var res = Rules.evaluateParticipantActivities(candidate, acts);
        if (res.hasConflict) bentrokUnik++;
      }
    });

    if (selectedPeserta.length === 0) {
      alert('Pilih minimal satu peserta rapat.');
      return;
    }

    var N = selectedPeserta.length;
    var qResult = Rules.calculateQuorum(N, bentrokUnik);

    // KETIKA JADWALKAN: Cek kuorum 2/3 dan tampilkan pop up hasil pengecekan
    if (actionStatus === 'Dijadwalkan') {
      if (!qResult.lolos) {
        // GAGAL KUORUM
        Admin.showModalNotice(
          'Pengecekan Kuorum GAGAL!',
          '<div style="text-align:center; padding:10px 0;">' +
            '<div style="font-size:44px; margin-bottom:8px;">❌</div>' +
            '<div style="font-weight:800; font-size:16px; color:var(--danger); margin-bottom:8px;">Syarat ⅔ Kuorum Tidak Terpenuhi</div>' +
            '<div style="font-size:13px; color:var(--ink); line-height:1.6; text-align:left; background:#fdf2f2; padding:12px; border-radius:8px; border:1px solid #f6c0c0;">' +
              '<div>• Peserta Terpilih (N): <strong>' + qResult.N + ' Anggota</strong></div>' +
              '<div>• Syarat Minimal Tersedia: <strong>' + qResult.syarat + ' Anggota</strong></div>' +
              '<div>• Anggota Bentrok Jadwal: <strong style="color:var(--danger);">' + qResult.bentrokUnik + ' Anggota</strong></div>' +
              '<div>• Anggota Tersedia: <strong style="color:var(--danger);">' + qResult.tersedia + ' Anggota</strong> (&lt; ' + qResult.syarat + ')</div>' +
            '</div>' +
            '<div style="font-size:12px; color:var(--muted); margin-top:10px;">Rapat tidak dapat dijadwalkan karena peserta tersedia kurang dari syarat kuorum. Silakan simpan sebagai Draft atau sesuaikan jadwal rapat.</div>' +
          '</div>',
          'Tutup'
        );
        return;
      }
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

    var saved = Store.saveMeeting(meetingObj);

    if (actionStatus === 'Dijadwalkan') {
      // LOLOS KUORUM & BERHASIL DIJADWALKAN
      Admin.showModalNotice(
        'Rapat Berhasil Dijadwalkan!',
        '<div style="text-align:center; padding:10px 0;">' +
          '<div style="font-size:44px; margin-bottom:8px;">✅</div>' +
          '<div style="font-weight:800; font-size:16px; color:var(--success); margin-bottom:8px;">Lolos Pengecekan ⅔ Kuorum Rapat</div>' +
          '<div style="font-size:13px; color:var(--ink); line-height:1.6; text-align:left; background:#eaf8ef; padding:12px; border-radius:8px; border:1px solid #bce1c7;">' +
            '<div>• Nama Rapat: <strong>' + saved.namaRapat + '</strong></div>' +
            '<div>• Peserta Terpilih (N): <strong>' + qResult.N + ' Anggota</strong></div>' +
            '<div>• Syarat Minimal Kuorum: <strong>' + qResult.syarat + ' Anggota</strong></div>' +
            '<div>• Peserta Tersedia: <strong style="color:var(--success);">' + qResult.tersedia + ' Anggota</strong> (&ge; ' + qResult.syarat + ')</div>' +
            '<div>• Bentrok Unik: <strong>' + qResult.bentrokUnik + ' Anggota</strong></div>' +
            '<div>• Status Kuorum: <strong style="color:var(--success); font-weight:800;">LOLOS TERPENUHI</strong></div>' +
          '</div>' +
          '<div style="font-size:12px; color:var(--muted); margin-top:10px;">Notifikasi undangan dan kode QR presensi otomatis diterbitkan untuk para peserta.</div>' +
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
     VIEW: DETAIL RAPAT
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
    var derived = Rules.deriveMeetingStatus(meeting, now);

    var isBatal = meeting.status === 'Batal';
    var isSelesai = meeting.status === 'Selesai' || derived === 'Selesai';
    var isDijadwalkan = !isBatal && !isSelesai;

    var headerBadge = '';
    if (isBatal) headerBadge = '<span class="badge badge-danger">Dibatalkan</span>';
    else if (isSelesai) headerBadge = '<span class="badge badge-neutral">Selesai</span>';
    else if (derived === 'Berjalan') headerBadge = '<span class="badge badge-live">Sedang Berlangsung</span>';
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
    if (isDijadwalkan || derived === 'Berjalan') {
      topbarActions = '<button class="btn btn-danger" onclick="Admin.openCancelMeetingModal(\'' + meeting.id + '\')">Batalkan Rapat</button>';
    } else if (isSelesai || isBatal) {
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
            '<div style="font-size:13px; color:var(--ink); margin-top:4px;">Alasan: <strong>' + (meeting.alasanBatal || '-') + '</strong></div>' +
            '<div style="font-size:11.5px; color:var(--muted); margin-top:6px;">Dibatalkan oleh ' + (meeting.dibatalkanOleh || 'Admin Sekretariat') + ' · ' + (meeting.dibatalkanPada || '-') + '</div>' +
            (meeting.isBatalSaatBerlangsung ? '<div style="background:#eaf8ef; border:1px solid #bce1c7; padding:10px 14px; border-radius:6px; margin-top:10px; font-size:12.5px; color:var(--success); font-weight:700;">✓ Rapat ini dihentikan saat sedang berlangsung. Anggota dewan yang telah hadir dan melakukan scan presensi QR sebelum pembatalan tetap sah tercatat dalam arsip rekapitulasi di bawah ini.</div>' : '') +
          '</div>' : '') +

        '<div style="display:grid; grid-template-columns: ' + (isDijadwalkan ? '2fr 1fr' : '1fr') + '; gap:18px; margin-bottom:18px;">' +

          '<div class="card">' +
            '<div class="form-section-title" style="margin-bottom:12px;">Informasi Rapat</div>' +
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">' +
              '<div><span style="color:var(--muted);">Kode Rapat:</span> <strong>' + meeting.kodeRapat + '</strong></div>' +
              '<div><span style="color:var(--muted);">Jenis Rapat:</span> <span class="tag-unit">' + meeting.jenisRapat + '</span></div>' +
              '<div><span style="color:var(--muted);">Tanggal:</span> <strong>' + Rules.formatDateIndo(new Date(meeting.tanggal)) + '</strong></div>' +
              '<div><span style="color:var(--muted);">Waktu:</span> <strong>' + meeting.jamMulai + ' – ' + meeting.jamSelesai + ' WIB</strong></div>' +
              '<div><span style="color:var(--muted);">Lokasi:</span> <strong>' + (meeting.lokasi || 'DPRD Kota Magelang') + '</strong></div>' +
              '<div><span style="color:var(--muted);">Peserta Rapat:</span> <strong>' + countTotal + ' Anggota</strong></div>' +
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

          (isDijadwalkan ?
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
          '<div class="stat-mini-card"><div class="num">' + countTotal + '</div><div class="lbl">Diundang</div></div>' +
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
                '<th>Nama Anggota</th>' +
                '<th>Status Kehadiran</th>' +
                '<th>Status Presensi</th>' +
                '<th>Waktu Presensi (WIB)</th>' +
                '<th>Alasan Tidak Hadir</th>' +
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
                      '<div style="font-family:monospace; font-size:11px; color:var(--muted);">' + m.kode + '</div>' +
                    '</td>' +
                    '<td>' + respBadge + '</td>' +
                    '<td>' + presBadge + '</td>' +
                    '<td style="font-family:monospace;">' + (p.waktuPresensiStr || '-') + '</td>' +
                    '<td style="color:' + (p.alasanTidakHadir ? 'var(--danger)' : 'var(--muted)') + ';">' + (p.alasanTidakHadir || '-') + '</td>' +
                  '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +

      '</div>';

    if (isDijadwalkan) {
      Admin.renderMeetingQRCode(meeting);
    }
  };

  Admin.renderMeetingQRCode = function (meeting) {
    var holder = document.getElementById('adminQrHolder');
    var tokenHolder = document.getElementById('qrTokenString');
    if (!holder) return;

    holder.innerHTML = '';
    var tokenData = Store.generateQRToken(meeting);
    if (!tokenData) return;

    if (tokenHolder) {
      tokenHolder.textContent = 'Token: ' + tokenData.token.substring(0, 18) + '...';
    }

    if (window.QRCode) {
      new QRCode(holder, {
        text: tokenData.token,
        width: 170,
        height: 170,
        colorDark: '#0f2318',
        colorLight: '#ffffff'
      });
    } else {
      holder.innerHTML = '<div style="width:170px; height:170px; display:flex; align-items:center; justify-content:center; background:#f0f0ea; border:1px solid #ccc; font-size:11px; padding:10px; text-align:center;">QR Presensi<br><strong>' + meeting.kodeRapat + '</strong></div>';
    }
  };

  Admin.refreshMeetingQR = function (meetingId) {
    var meeting = Store.getMeetingById(meetingId);
    if (meeting) {
      Admin.renderMeetingQRCode(meeting);
      Admin.showToast('QR Code diperbarui');
    }
  };

  Admin.openCancelMeetingModal = function (meetingId) {
    var meeting = Store.getMeetingById(meetingId);
    if (!meeting) return;

    var modalHtml =
      '<div class="modal-backdrop" id="cancelModal">' +
        '<div class="modal-card">' +
          '<div class="modal-header">' +
            '<h3>Batalkan Rapat</h3>' +
            '<button type="button" class="modal-close" onclick="Admin.closeModal(\'cancelModal\')">&times;</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<p style="margin-top:0;">Anda akan membatalkan rapat <strong>' + meeting.namaRapat + '</strong> (' + meeting.kodeRapat + '). Seluruh peserta akan menerima pemberitahuan pembatalan.</p>' +
            '<div class="form-group">' +
              '<label>Alasan Pembatalan <span class="req">* (Wajib diisi)</span></label>' +
              '<textarea id="mAlasanBatal" placeholder="Tuliskan alasan pembatalan rapat..." required></textarea>' +
            '</div>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" onclick="Admin.closeModal(\'cancelModal\')">Kembali</button>' +
            '<button type="button" class="btn btn-danger-solid" id="btnConfirmCancel">Konfirmasi Batalkan</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btnConfirmCancel').onclick = function () {
      var reason = (document.getElementById('mAlasanBatal').value || '').trim();
      if (!reason) {
        alert('Alasan pembatalan wajib diisi.');
        return;
      }
      Store.cancelMeeting(meeting.id, reason, 'Admin Sekretariat');
      Admin.closeModal('cancelModal');
      Admin.showToast('Rapat telah dibatalkan.');
      Admin.navigate('detail', meeting.id);
    };
  };

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
              '<h3 style="margin:0; font-size:16px;">Laporan Rekapitulasi Kehadiran & Presensi</h3>' +
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
              '<div style="font-size:12px; color:var(--muted);">Sistem Informasi e-Parlemen Manajemen Presensi & Kuorum Sidang</div>' +
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

            // DAFTAR REKAPITULASI ANGGOTA (RESPONSIVE HORIZONTAL SCROLL TABLE)
            '<div style="font-weight:700; font-size:13px; margin-bottom:8px;">Rincian Kehadiran & Presensi Anggota Dewan:</div>' +
            '<div class="table-container" style="max-height:360px; overflow-y:auto; margin-bottom:16px;">' +
              '<table class="data-table">' +
                '<thead><tr>' +
                  '<th style="width:40px;">No</th>' +
                  '<th>Kode & Nama Anggota</th>' +
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
                      '<td>' + confBadge + '</td>' +
                      '<td>' + presBadge + '</td>' +
                      '<td style="font-family:monospace; font-weight:600;">' + (p.waktuPresensiStr || '-') + '</td>' +
                      '<td style="font-size:12px; color:' + (p.alasanTidakHadir ? 'var(--danger)' : 'var(--muted)') + ';">' + (p.alasanTidakHadir || (p.presensiStatus === 'Sudah presensi' ? 'Sah' : '-')) + '</td>' +
                    '</tr>';
                  }).join('') +
                '</tbody>' +
              '</table>' +
            '</div>' +

            // TANDA TANGAN / PENGESAHAN
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
            '<button type="button" class="btn btn-primary" onclick="window.print()">' +
              '<svg class="ic-svg" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Cetak / Export Rekapitulasi' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  Admin.confirmDeleteMeeting = function (meetingId) {
    Admin.showConfirmModal(
      'Hapus Draf Rapat',
      'Apakah Anda yakin ingin menghapus draf rapat ini? Tindakan ini tidak dapat dibatalkan.',
      function () {
        Store.deleteMeeting(meetingId);
        Admin.showToast('Draf rapat berhasil dihapus.');
        Admin.renderMeetingList();
      }
    );
  };

  Admin.showModalNotice = function (title, contentHtml, btnText, onBtnClick) {
    var modalHtml =
      '<div class="modal-backdrop" id="noticeGenModal">' +
        '<div class="modal-card">' +
          '<div class="modal-header">' +
            '<h3>' + title + '</h3>' +
            '<button type="button" class="modal-close" onclick="Admin.closeModal(\'noticeGenModal\')">&times;</button>' +
          '</div>' +
          '<div class="modal-body">' + contentHtml + '</div>' +
          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-primary" id="btnNoticeOk">' + (btnText || 'OK') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('btnNoticeOk').onclick = function () {
      Admin.closeModal('noticeGenModal');
      if (onBtnClick) onBtnClick();
    };
  };

  Admin.showConfirmModal = function (title, message, onConfirm) {
    var modalHtml =
      '<div class="modal-backdrop" id="confirmGenModal">' +
        '<div class="modal-card">' +
          '<div class="modal-header">' +
            '<h3>' + title + '</h3>' +
            '<button type="button" class="modal-close" onclick="Admin.closeModal(\'confirmGenModal\')">&times;</button>' +
          '</div>' +
          '<div class="modal-body"><p style="margin:0;">' + message + '</p></div>' +
          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" onclick="Admin.closeModal(\'confirmGenModal\')">Tidak</button>' +
            '<button type="button" class="btn btn-primary" id="btnGenYes">Ya</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('btnGenYes').onclick = function () {
      Admin.closeModal('confirmGenModal');
      if (onConfirm) onConfirm();
    };
  };

  Admin.closeModal = function (modalId) {
    var el = document.getElementById(modalId);
    if (el) el.remove();
  };

  Admin.showToast = function (message) {
    var existing = document.getElementById('adminToast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.className = 'toast-notice';
    toast.innerHTML =
      '<svg class="ic-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 8 12 12 14 14"></polyline></svg>' +
      '<span>' + message + '</span>';
    document.body.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  };

  Admin.showLockedNotice = function (featureName) {
    Admin.showModalNotice(
      'Fitur Terkunci (Di Luar Lingkup Prototype)',
      '<div style="text-align:center; padding:10px 0;">' +
        '<div style="font-size:44px; margin-bottom:10px;">🔒</div>' +
        '<div style="font-weight:700; font-size:16px; color:var(--ink); margin-bottom:6px;">Menu ' + featureName + ' Terkunci</div>' +
        '<div style="font-size:13px; color:var(--muted); line-height:1.5;">Menu ini tidak termasuk dalam cakupan pengujian prototype sistem e-Parlemen.<br>Fokus prototype aktif adalah pada <strong>Manajemen Jadwal Rapat, Verifikasi Kuorum ⅔, dan Presensi QR</strong>.</div>' +
      '</div>',
      'Mengerti'
    );
  };

  Admin.openLiveQRPresence = function () {
    var all = Store.getMeetings();
    var now = Store.now();
    var ongoing = null;
    for (var i = 0; i < all.length; i++) {
      if (Rules.deriveMeetingStatus(all[i], now) === 'Berjalan' && all[i].status !== 'Batal') {
        ongoing = all[i];
        break;
      }
    }
    var target = ongoing || all[0];
    if (target) {
      Admin.openQRModal(target.id);
    } else {
      Admin.showToast('Tidak ada rapat yang sedang berlangsung untuk ditampilkan QR Presensinya.');
    }
  };

  window.Admin = Admin;
})(window);
