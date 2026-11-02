/**
 * logParser.js — Analisis Log Besar
 * Parsing, pengelompokan, filtering, timeline, dan rendering untuk log besar.
 * Membaca ERROR_RULES dari rules.js (global) — tanpa duplikasi aturan.
 * Dipanggil oleh script.js ketika log melebihi 20 baris.
 */

// ─── Konstanta ───────────────────────────────────────────────────────────────
const LP_PAGE_SIZE     = 50;   // jumlah kelompok yang dirender per batch
const LP_LARGE_LINES   = 20;   // ambang batas untuk mode log besar
const LP_MAX_SAMPLES   = 3;    // jumlah baris sampel yang ditampilkan per kelompok

// Level yang dikenali (urutan severity dari rendah ke tinggi)
const LP_LEVELS = ["DEBUG", "INFO", "WARN", "WARNING", "ERROR", "FATAL", "CRITICAL"];
const LP_SEVERITY_RANK = { DEBUG: 0, INFO: 1, WARN: 2, WARNING: 2, ERROR: 3, FATAL: 4, CRITICAL: 4 };
const LP_LEVEL_COLOR = {
  DEBUG:    "lp-level-debug",
  INFO:     "lp-level-info",
  WARN:     "lp-level-warn",
  WARNING:  "lp-level-warn",
  ERROR:    "lp-level-error",
  FATAL:    "lp-level-fatal",
  CRITICAL: "lp-level-fatal",
};

// ─── Regex pola utama ────────────────────────────────────────────────────────

// Pola timestamp: ISO 8601, [YYYY-MM-DD HH:mm:ss], atau HH:mm:ss
const RE_TIMESTAMP = /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?|\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]|\d{2}:\d{2}:\d{2})/;

// Pola level log (standalone word, case-insensitive)
const RE_LEVEL = new RegExp(`\\b(${LP_LEVELS.join("|")})\\b`, "i");

// Pola yang menunjukkan baris ini adalah sambungan stack trace (menjorok)
const RE_CONTINUATION = /^\s{2,}(at |File "|#\d|\t|\.{3})/;

// ─── Fungsi escape XSS ───────────────────────────────────────────────────────
/**
 * Melarikan karakter HTML untuk mencegah XSS.
 * @param {string} str
 * @returns {string}
 */
function lpEscape(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, (ch) => map[ch]);
}

// ─── 1. PARSING ──────────────────────────────────────────────────────────────

/**
 * Memecah teks log menjadi array entri.
 * Baris yang menjorok (stack trace) digabungkan ke entri error di atasnya.
 *
 * @param {string} rawLog - Teks log mentah
 * @returns {Array<{raw: string, timestamp: string|null, level: string|null, message: string}>}
 */
function lpParseEntries(rawLog) {
  const lines = rawLog.split(/\r?\n/);
  const entries = [];

  for (const line of lines) {
    if (!line.trim()) continue; // abaikan baris kosong

    const isContinuation = RE_CONTINUATION.test(line);

    if (isContinuation && entries.length > 0) {
      // Gabungkan ke entri sebelumnya sebagai stack trace
      entries[entries.length - 1].raw += "\n" + line;
      continue;
    }

    // Ekstrak timestamp
    const tsMatch = line.match(RE_TIMESTAMP);
    const timestamp = tsMatch ? tsMatch[1].replace(/^\[|\]$/g, "") : null;

    // Ekstrak level
    const lvlMatch = line.match(RE_LEVEL);
    const rawLevel = lvlMatch ? lvlMatch[1].toUpperCase() : null;
    // Normalisasi WARNING → WARN, CRITICAL → FATAL
    const level = rawLevel === "WARNING" ? "WARN" : rawLevel === "CRITICAL" ? "FATAL" : rawLevel;

    // Pesan bersih: hapus timestamp dan level dari awal baris
    let message = line
      .replace(RE_TIMESTAMP, "")
      .replace(RE_LEVEL, "")
      .replace(/^\s*[\[\]:\-|]+\s*/, "") // karakter pemisah
      .trim();

    entries.push({ raw: line, timestamp, level, message });
  }

  return entries;
}

// ─── 2. NORMALISASI & PENGELOMPOKAN ──────────────────────────────────────────

/**
 * Menormalkan pesan error agar varian yang sama bisa dikelompokkan:
 * - Angka dan ID UUID dihapus/diganti placeholder
 * - Path file dinormalisasi
 * - Pointer/address memory dihapus
 *
 * @param {string} message
 * @returns {string} Kunci normalisasi
 */
function lpNormalizeKey(message) {
  return message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<UUID>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<HEX>")   // memory address
    .replace(/\b\d{4,}\b/g, "<NUM>")           // angka 4+ digit (ID, port, dll.)
    .replace(/\b\d+\.\d+\.\d+\.\d+\b/g, "<IP>")
    .replace(/\/[\w./-]+\.(js|py|java|cpp|ts|rb|go|php|cs):\d+/gi, "<FILE>:<LINE>")
    .replace(/line \d+/gi, "line <LINE>")
    .replace(/:\d+:\d+/g, ":<LINE>:<COL>")
    .trim()
    .toLowerCase()
    .substring(0, 120); // batas kunci agar tidak terlalu panjang
}

/**
 * Mengelompokkan entri error berdasarkan kunci normalisasi pesan.
 * Hanya entri dengan level WARN/ERROR/FATAL yang dikelompokkan;
 * entri INFO/DEBUG dikumpulkan terpisah untuk statistik.
 *
 * @param {Array} entries - Hasil lpParseEntries()
 * @returns {{ groups: Array, stats: Object }}
 */
function lpGroupEntries(entries) {
  const groupMap = new Map(); // key → group object
  const stats = { total: 0, byLevel: {}, uniqueErrors: 0 };

  for (const entry of entries) {
    stats.total++;
    const lv = entry.level || "UNKNOWN";
    stats.byLevel[lv] = (stats.byLevel[lv] || 0) + 1;

    // Kelompokkan entri yang berisi level yang perlu diperhatikan
    const rank = LP_SEVERITY_RANK[lv] ?? -1;
    if (rank < LP_SEVERITY_RANK["WARN"]) continue; // DEBUG dan INFO tidak dikelompokkan

    const key = lpNormalizeKey(entry.message);
    if (!key) continue;

    if (groupMap.has(key)) {
      const g = groupMap.get(key);
      g.count++;
      g.samples.push(entry);
      // Perbarui waktu terakhir
      if (entry.timestamp) g.lastSeen = entry.timestamp;
      // Naikkan severity jika diperlukan
      if ((LP_SEVERITY_RANK[entry.level] ?? 0) > (LP_SEVERITY_RANK[g.maxLevel] ?? 0)) {
        g.maxLevel = entry.level;
      }
    } else {
      groupMap.set(key, {
        key,
        count: 1,
        maxLevel: entry.level || "UNKNOWN",
        firstSeen:  entry.timestamp || null,
        lastSeen:   entry.timestamp || null,
        samples:    [entry],   // semua kemunculan (dibatasi saat render)
        matchedRules: null,    // diisi lazy saat di-expand
      });
    }
  }

  const groups = [...groupMap.values()];
  stats.uniqueErrors = groups.length;

  return { groups, stats };
}

// ─── 3. SORTING ──────────────────────────────────────────────────────────────

/**
 * Mengurutkan kelompok error berdasarkan kriteria yang dipilih.
 * @param {Array} groups
 * @param {'frequency'|'newest'|'severity'} sortBy
 * @returns {Array} Kelompok yang sudah diurutkan
 */
function lpSortGroups(groups, sortBy) {
  return [...groups].sort((a, b) => {
    if (sortBy === "frequency") return b.count - a.count;
    if (sortBy === "severity")  return (LP_SEVERITY_RANK[b.maxLevel] ?? 0) - (LP_SEVERITY_RANK[a.maxLevel] ?? 0);
    // newest: bandingkan lastSeen sebagai string (format ISO sortable)
    if (sortBy === "newest") {
      if (!a.lastSeen && !b.lastSeen) return 0;
      if (!a.lastSeen) return 1;
      if (!b.lastSeen) return -1;
      return b.lastSeen.localeCompare(a.lastSeen);
    }
    return 0;
  });
}

// ─── 4. FILTER ───────────────────────────────────────────────────────────────

/**
 * Memfilter kelompok berdasarkan level dan teks pencarian.
 * @param {Array} groups
 * @param {string} levelFilter - 'ALL' | 'WARN' | 'ERROR' | 'FATAL'
 * @param {string} searchText  - Teks pencarian (case-insensitive)
 * @returns {Array} Kelompok yang lolos filter
 */
function lpFilterGroups(groups, levelFilter, searchText) {
  let result = groups;

  if (levelFilter !== "ALL") {
    result = result.filter((g) => {
      if (levelFilter === "FATAL") return g.maxLevel === "FATAL";
      if (levelFilter === "ERROR") return LP_SEVERITY_RANK[g.maxLevel] >= LP_SEVERITY_RANK["ERROR"];
      if (levelFilter === "WARN")  return LP_SEVERITY_RANK[g.maxLevel] >= LP_SEVERITY_RANK["WARN"];
      return true;
    });
  }

  if (searchText.trim()) {
    const q = searchText.trim().toLowerCase();
    result = result.filter((g) =>
      g.samples[0].raw.toLowerCase().includes(q) ||
      g.key.includes(q)
    );
  }

  return result;
}

// ─── 5. TIMELINE ─────────────────────────────────────────────────────────────

/**
 * Membuat data timeline: jumlah error per interval waktu.
 * Interval dipilih otomatis berdasarkan rentang waktu total.
 *
 * @param {Array} entries - Semua entri hasil parsing
 * @returns {Array<{label: string, count: number}>|null} null jika tidak ada timestamp
 */
function lpBuildTimeline(entries) {
  const timestamped = entries.filter((e) => e.timestamp && LP_SEVERITY_RANK[e.level] >= LP_SEVERITY_RANK["WARN"]);
  if (timestamped.length < 2) return null;

  // Ambil epoch ms dari timestamp — coba parse
  const times = timestamped.map((e) => {
    const t = e.timestamp.replace("[", "").replace("]", "").replace(" ", "T");
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d.getTime();
  }).filter(Boolean);

  if (times.length < 2) return null;

  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const rangeMs = maxT - minT;

  if (rangeMs === 0) return null;

  // Pilih interval: <1 menit → detik, <1 jam → menit, lainnya → jam
  let intervalMs, labelFn;
  if (rangeMs < 60_000) {
    intervalMs = 5_000; // 5 detik
    labelFn = (t) => new Date(t).toISOString().substring(11, 19);
  } else if (rangeMs < 3_600_000) {
    intervalMs = 60_000; // 1 menit
    labelFn = (t) => new Date(t).toISOString().substring(11, 16);
  } else {
    intervalMs = 3_600_000; // 1 jam
    labelFn = (t) => new Date(t).toISOString().substring(11, 13) + ":00";
  }

  // Buat bucket
  const buckets = new Map();
  for (const t of times) {
    const bucket = Math.floor((t - minT) / intervalMs) * intervalMs + minT;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }

  // Urutkan dan konversi ke array
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, count]) => ({ label: labelFn(t), count }));
}

// ─── 6. COCOKKAN RULES ───────────────────────────────────────────────────────

/**
 * Mencocokkan teks sampel dari sebuah kelompok dengan ERROR_RULES.
 * Dijalankan lazy (saat card di-expand) untuk performa.
 * @param {Object} group
 * @returns {Array} Aturan yang cocok
 */
function lpMatchRules(group) {
  if (typeof ERROR_RULES === "undefined") return [];
  const sampleText = group.samples.map((s) => s.raw).join("\n");
  return ERROR_RULES.filter((rule) => rule.pattern.test(sampleText));
}

// ─── 7. RINGKASAN HTML ───────────────────────────────────────────────────────

/**
 * Membangun HTML blok ringkasan (total baris, per level, error unik, paling sering).
 * @param {Object} stats
 * @param {Array} groups - Kelompok yang sudah diurutkan
 * @returns {string} HTML string
 */
function lpBuildSummaryHtml(stats, groups) {
  const levelOrder = ["FATAL", "ERROR", "WARN", "INFO", "DEBUG"];
  const levelBadges = levelOrder
    .filter((lv) => stats.byLevel[lv])
    .map((lv) => `<span class="lp-stat-badge ${LP_LEVEL_COLOR[lv]}">${lpEscape(lv)} <strong>${stats.byLevel[lv]}</strong></span>`)
    .join("");

  const topError = groups.length > 0
    ? `<span class="text-red-600 font-medium">${lpEscape(groups[0].samples[0].message.substring(0, 80))}</span> <span class="text-gray-400">(${groups[0].count}×)</span>`
    : '<span class="text-gray-400">—</span>';

  // Total unknown (tidak ada level yang terdeteksi)
  const unknownCount = stats.byLevel["UNKNOWN"] || 0;
  const unknownBadge = unknownCount > 0
    ? `<span class="lp-stat-badge lp-level-debug">LAINNYA <strong>${unknownCount}</strong></span>`
    : "";

  return `
    <div class="lp-summary-grid">
      <div class="lp-stat-card">
        <span class="lp-stat-num">${stats.total.toLocaleString("id-ID")}</span>
        <span class="lp-stat-label">Total Baris</span>
      </div>
      <div class="lp-stat-card">
        <span class="lp-stat-num">${stats.uniqueErrors}</span>
        <span class="lp-stat-label">Error Unik</span>
      </div>
      <div class="lp-stat-card lp-stat-levels" style="grid-column:span 2">
        <span class="lp-stat-label mb-1">Per Level</span>
        <div class="flex flex-wrap gap-1">${levelBadges}${unknownBadge}</div>
      </div>
    </div>
    <div class="lp-top-error">
      <span class="text-xs text-gray-500 font-semibold uppercase tracking-wide">🔥 Error Paling Sering:</span>
      <p class="mt-0.5 text-sm">${topError}</p>
    </div>`;
}

// ─── 8. TIMELINE HTML ────────────────────────────────────────────────────────

/**
 * Membangun HTML timeline horizontal (SVG-less, CSS bar chart).
 * @param {Array<{label: string, count: number}>} timelineData
 * @returns {string} HTML string
 */
function lpBuildTimelineHtml(timelineData) {
  if (!timelineData || timelineData.length === 0) return "";

  const maxCount = Math.max(...timelineData.map((d) => d.count));

  const bars = timelineData.map((d) => {
    const pct = maxCount > 0 ? Math.round((d.count / maxCount) * 100) : 0;
    return `
      <div class="lp-tl-bar-wrap" title="${lpEscape(d.label)}: ${d.count} error">
        <div class="lp-tl-bar" style="height:${pct}%" aria-label="${lpEscape(d.label)}: ${d.count}"></div>
        <span class="lp-tl-label">${lpEscape(d.label)}</span>
      </div>`;
  }).join("");

  return `
    <div class="lp-timeline-section" aria-label="Timeline distribusi error">
      <h3 class="lp-section-heading">📈 Distribusi Error per Waktu</h3>
      <div class="lp-timeline-chart" role="img" aria-label="Bar chart distribusi error">
        ${bars}
      </div>
    </div>`;
}

// ─── 9. CARD KELOMPOK ERROR ───────────────────────────────────────────────────

/**
 * Membangun HTML untuk satu card kelompok error (expand/collapse).
 * @param {Object} group - Kelompok error
 * @param {number} index - Urutan (untuk ID unik)
 * @returns {string} HTML string
 */
function lpBuildGroupCard(group, index) {
  const sample = group.samples[0];
  const levelClass = LP_LEVEL_COLOR[group.maxLevel] || "lp-level-debug";
  const cardId = `lp-group-${index}`;
  const bodyId = `lp-body-${index}`;

  // Ambil 3 baris pertama sebagai preview sampel
  const previewLines = group.samples
    .slice(0, LP_MAX_SAMPLES)
    .map((s) => `<span class="lp-sample-line">${lpEscape(s.raw.split("\n")[0])}</span>`)
    .join("");

  const moreCount = group.samples.length > LP_MAX_SAMPLES
    ? `<span class="text-xs text-gray-400">+${group.samples.length - LP_MAX_SAMPLES} kemunculan lainnya</span>`
    : "";

  const timeMeta = (group.firstSeen || group.lastSeen)
    ? `<span class="lp-meta">🕐 ${lpEscape(group.firstSeen || "")}${group.lastSeen && group.lastSeen !== group.firstSeen ? ` → ${lpEscape(group.lastSeen)}` : ""}</span>`
    : "";

  return `
    <article class="lp-group-card" id="${cardId}" aria-label="Kelompok error: ${lpEscape(sample.message.substring(0, 60))}">
      <!-- Header card (klik untuk expand/collapse) -->
      <button
        class="lp-group-header"
        onclick="lpToggleCard('${bodyId}', this)"
        aria-expanded="false"
        aria-controls="${bodyId}"
      >
        <div class="lp-group-header-left">
          <span class="lp-level-badge ${levelClass}">${lpEscape(group.maxLevel)}</span>
          <span class="lp-group-count" title="${group.count} kemunculan">${group.count}×</span>
          <span class="lp-group-msg">${lpEscape(sample.message.substring(0, 120))}</span>
        </div>
        <div class="lp-group-header-right">
          ${timeMeta}
          <span class="lp-chevron" aria-hidden="true">▶</span>
        </div>
      </button>

      <!-- Body card (tersembunyi saat collapsed) -->
      <div id="${bodyId}" class="lp-group-body hidden" role="region">
        <!-- Sampel baris log -->
        <div class="lp-sample-block">
          <h4 class="lp-subsection-title">📋 Contoh Log</h4>
          <div class="lp-sample-lines">${previewLines}</div>
          ${moreCount}
        </div>
        <!-- Placeholder analisis rules — diisi oleh lpExpandCard() -->
        <div class="lp-rules-placeholder" data-group-index="${index}">
          <span class="text-xs text-gray-400">Memuat analisis…</span>
        </div>
      </div>
    </article>`;
}

// ─── 10. RENDER UTAMA ────────────────────────────────────────────────────────

/**
 * State rendering yang disimpan di window untuk akses dari event handler.
 * @type {{ allGroups: Array, filteredGroups: Array, renderedCount: number, sortBy: string, levelFilter: string, searchText: string }}
 */
window.lpState = null;

/**
 * Titik masuk utama: render seluruh tampilan log besar.
 * Dipanggil dari script.js setelah deteksi log besar.
 *
 * @param {string} rawLog - Teks log mentah
 */
function lpRender(rawLog) {
  // Pastikan elemen utama section tersedia sebelum melanjutkan
  if (!document.getElementById("lp-section")) return;

  // Parse
  const entries = lpParseEntries(rawLog);
  const { groups, stats } = lpGroupEntries(entries);
  const sortedGroups = lpSortGroups(groups, "frequency");
  const timelineData = lpBuildTimeline(entries);

  // Simpan state global untuk filter/sort
  window.lpState = {
    allGroups:     sortedGroups,
    filteredGroups: sortedGroups,
    renderedCount: 0,
    sortBy:        "frequency",
    levelFilter:   "ALL",
    searchText:    "",
    entries,
  };

  // Render ringkasan
  const summaryEl = document.getElementById("lp-summary");
  if (summaryEl) summaryEl.innerHTML = lpBuildSummaryHtml(stats, sortedGroups);

  // Render timeline (hanya jika ada data)
  const timelineEl = document.getElementById("lp-timeline");
  if (timelineEl) {
    const tlHtml = lpBuildTimelineHtml(timelineData);
    timelineEl.innerHTML = tlHtml;
    timelineEl.classList.toggle("hidden", !tlHtml);
  }

  // Reset filter state UI
  lpResetFilterUI();

  // Render kelompok pertama
  lpRenderGroups(true);

  // Tampilkan section
  const section = document.getElementById("lp-section");
  if (section) section.classList.remove("hidden");
}

/**
 * Merender kelompok error ke dalam container.
 * @param {boolean} reset - Jika true, kosongkan container sebelum render
 */
function lpRenderGroups(reset = false) {
  const state = window.lpState;
  if (!state) return;

  const container = document.getElementById("lp-groups");
  if (!container) return;

  if (reset) {
    container.innerHTML = "";
    state.renderedCount = 0;
  }

  const { filteredGroups, renderedCount } = state;
  const nextBatch = filteredGroups.slice(renderedCount, renderedCount + LP_PAGE_SIZE);

  // Render batch secara bertahap menggunakan DocumentFragment untuk performa
  const fragment = document.createDocumentFragment();
  nextBatch.forEach((group, i) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = lpBuildGroupCard(group, renderedCount + i);
    fragment.appendChild(wrapper.firstElementChild);
  });
  container.appendChild(fragment);

  state.renderedCount += nextBatch.length;

  // Tombol "Tampilkan lebih banyak"
  const showMoreBtn = document.getElementById("lp-show-more");
  if (showMoreBtn) {
    const remaining = filteredGroups.length - state.renderedCount;
    if (remaining > 0) {
      showMoreBtn.textContent = `Tampilkan lebih banyak (${remaining} tersisa)`;
      showMoreBtn.classList.remove("hidden");
    } else {
      showMoreBtn.classList.add("hidden");
    }
  }

  // Tampilkan pesan jika tidak ada hasil
  const emptyMsg = document.getElementById("lp-empty");
  if (emptyMsg) {
    emptyMsg.classList.toggle("hidden", filteredGroups.length > 0);
  }
}

// ─── 11. EXPAND/COLLAPSE CARD ─────────────────────────────────────────────────

/**
 * Toggle expand/collapse card kelompok error.
 * Saat pertama kali dibuka, jalankan analisis rules secara lazy.
 * @param {string} bodyId   - ID elemen body card
 * @param {HTMLElement} btn - Tombol header yang diklik
 */
function lpToggleCard(bodyId, btn) {
  const body = document.getElementById(bodyId);
  if (!body) return;

  const isOpen = !body.classList.contains("hidden");

  if (isOpen) {
    body.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
    btn.querySelector(".lp-chevron").textContent = "▶";
  } else {
    body.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
    btn.querySelector(".lp-chevron").textContent = "▼";

    // Analisis rules lazy: hanya dijalankan sekali saat pertama dibuka
    const placeholder = body.querySelector(".lp-rules-placeholder");
    if (placeholder && !placeholder.dataset.loaded) {
      const groupIndex = parseInt(placeholder.dataset.groupIndex, 10);
      const group = window.lpState?.filteredGroups[groupIndex];
      if (group) {
        placeholder.innerHTML = lpBuildRulesAnalysisHtml(group);
        placeholder.dataset.loaded = "true";
      }
    }
  }
}

/**
 * Membangun HTML analisis rules untuk sebuah kelompok.
 * Menggunakan ERROR_RULES dari rules.js (tidak menduplikasi aturan).
 * @param {Object} group
 * @returns {string} HTML string
 */
function lpBuildRulesAnalysisHtml(group) {
  if (group.matchedRules === null) {
    group.matchedRules = lpMatchRules(group);
  }

  if (group.matchedRules.length === 0) {
    return `<div class="lp-rules-empty">
      <p class="text-xs text-gray-500">Pola ini tidak ditemukan dalam database aturan. Coba salin baris error ke <strong>textarea utama</strong> untuk analisis mendalam.</p>
    </div>`;
  }

  const rulesHtml = group.matchedRules.map((rule) => {
    const steps = rule.steps.map((s, i) =>
      `<li class="lp-rule-step"><span class="step-num">${i + 1}</span><span>${lpEscape(s)}</span></li>`
    ).join("");

    return `
      <div class="lp-rule-item">
        <div class="lp-rule-header">
          <span class="lp-rule-name">${lpEscape(rule.name)}</span>
          <span class="lp-rule-lang">${lpEscape(rule.language.toUpperCase())}</span>
        </div>
        <p class="lp-rule-explanation">${lpEscape(rule.explanation)}</p>
        <ol class="lp-rule-steps">${steps}</ol>
      </div>`;
  }).join("");

  return `<div class="lp-rules-section">
    <h4 class="lp-subsection-title">🔍 Analisis</h4>
    ${rulesHtml}
  </div>`;
}

// ─── 12. EVENT HANDLERS FILTER & SORT ────────────────────────────────────────

/**
 * Menerapkan filter dan sort saat ada perubahan.
 * Dipanggil dari event listener di index.html.
 */
function lpApplyFilter() {
  if (!window.lpState) return;
  const { allGroups, sortBy } = window.lpState;

  const levelFilter = document.querySelector(".lp-filter-btn.active")?.dataset.level || "ALL";
  const searchText  = document.getElementById("lp-search")?.value || "";

  const filtered  = lpFilterGroups(allGroups, levelFilter, searchText);
  const sorted    = lpSortGroups(filtered, sortBy);

  window.lpState.filteredGroups = sorted;
  window.lpState.levelFilter    = levelFilter;
  window.lpState.searchText     = searchText;

  lpRenderGroups(true);
}

/**
 * Mengubah kriteria pengurutan dan me-render ulang.
 * @param {string} sortBy - 'frequency' | 'newest' | 'severity'
 */
function lpSetSort(sortBy) {
  if (!window.lpState) return;
  window.lpState.sortBy = sortBy;

  // Update tombol sort UI
  document.querySelectorAll(".lp-sort-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sort === sortBy);
  });

  const filtered = lpFilterGroups(window.lpState.allGroups, window.lpState.levelFilter, window.lpState.searchText);
  window.lpState.filteredGroups = lpSortGroups(filtered, sortBy);
  lpRenderGroups(true);
}

/**
 * Mereset semua filter dan sort ke state awal.
 */
function lpResetFilterUI() {
  // Aktifkan tombol "All" pada filter level
  document.querySelectorAll(".lp-filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.level === "ALL");
  });
  // Aktifkan tombol "Paling Sering" pada sort
  document.querySelectorAll(".lp-sort-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sort === "frequency");
  });
  // Kosongkan kolom pencarian
  const searchEl = document.getElementById("lp-search");
  if (searchEl) searchEl.value = "";
}

/**
 * Handler klik tombol filter level.
 * Mengaktifkan tombol yang diklik dan menonaktifkan yang lain,
 * lalu menerapkan filter.
 * @param {HTMLElement} clickedBtn
 */
function lpClickFilterBtn(clickedBtn) {
  document.querySelectorAll(".lp-filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn === clickedBtn);
  });
  lpApplyFilter();
}
