/**
 * script.js — Error Log Explainer
 * Logika utama aplikasi: analisis error, manajemen riwayat, dan interaksi UI.
 */

// ─── Konstanta konfigurasi ───────────────────────────────────────────────────
const MAX_HISTORY = 5;
const HISTORY_KEY = "errorLogHistory";

// ─── Referensi elemen DOM ────────────────────────────────────────────────────
const logInput       = document.getElementById("log-input");
const languageSelect = document.getElementById("language-select");
const analyzeBtn     = document.getElementById("btn-analyze");
const clearBtn       = document.getElementById("btn-clear");
const copyBtn        = document.getElementById("btn-copy");
const sampleBtn      = document.getElementById("btn-sample");
const resultsSection = document.getElementById("results-section");
const resultsContainer = document.getElementById("results-container");
const logPreview        = document.getElementById("log-preview");
const logPreviewSection = document.getElementById("log-preview-section");
const historyList       = document.getElementById("history-list");
const historySection = document.getElementById("history-section");
const charCount      = document.getElementById("char-count");

// ─── Konstanta mode log besar ────────────────────────────────────────────────
const LP_AUTO_THRESHOLD = 20; // jumlah baris minimal untuk mode log besar

// ─── Contoh log untuk setiap bahasa ─────────────────────────────────────────
const SAMPLE_LOGS = {
  auto: `TypeError: Cannot read properties of undefined (reading 'map')
    at App.render (App.js:42:18)
    at processChild (/node_modules/react-dom/cjs/react-dom.development.js:3990:14)

ModuleNotFoundError: No module named 'pandas'

ECONNREFUSED 127.0.0.1:5432`,

  javascript: `Uncaught TypeError: Cannot read properties of undefined (reading 'name')
    at getUserName (utils.js:15:23)
    at main (index.js:8:5)

Uncaught ReferenceError: myVariable is not defined
    at <anonymous>:1:13`,

  python: `Traceback (most recent call last):
  File "app.py", line 12, in <module>
    import pandas as pd
ModuleNotFoundError: No module named 'pandas'

  File "server.py", line 8
    def connect(
               ^
IndentationError: expected an indented block`,

  java: `Exception in thread "main" java.lang.NullPointerException
	at com.example.Main.getUserName(Main.java:25)
	at com.example.Main.main(Main.java:10)

java.lang.ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 3
	at com.example.DataProcessor.process(DataProcessor.java:44)`,

  sql: `ERROR 1064 (42000): You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'SELCT name FROM users' at line 1

ERROR 1146 (42S02): Table 'mydb.invoices' doesn't exist`,

  http: `GET /api/users/profile HTTP/1.1
→ 404 Not Found

POST /api/payment HTTP/1.1
→ 500 Internal Server Error

Access to fetch at 'https://api.external.com/data' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.

Error: connect ECONNREFUSED 127.0.0.1:3306`,

  // Contoh 1: Compile errors dari g++
  cpp_compile: `main.cpp:5:5: error: 'cout' was not declared in this scope
    5 |     cout << "Halo Dunia" << endl;
      |     ^~~~
main.cpp:12:10: error: no matching function for call to 'cetak(const char [6])'
   12 |     cetak("teks");
      |     ^~~~~~~~~~~~~~
main.cpp:7:6: note: candidate: 'void cetak(int)'
    7 | void cetak(int angka) { cout << angka; }
      |      ^~~~~
/usr/bin/ld: main.o: undefined reference to symbol 'utils::tambah(int, int)'
collect2: error: ld returned 1 exit status`,

  // Contoh 2: Runtime errors (Segfault + AddressSanitizer)
  cpp_runtime: `Segmentation fault (core dumped)

==12345==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x602000000014
READ of size 4 at 0x602000000014 thread T0
    #0 0x401234 in main main.cpp:18:14
    #1 0x7f1234abcd in __libc_start_main

terminate called after throwing an instance of 'std::bad_alloc'
  what():  std::bad_alloc
Aborted (core dumped)`,

  // Contoh log besar (~100 baris) campuran level dengan error berulang
  large: `2024-01-15 08:00:01 INFO  [App] Aplikasi dimulai, versi 2.3.1
2024-01-15 08:00:02 INFO  [DB] Koneksi database berhasil dibuat
2024-01-15 08:00:02 INFO  [Cache] Redis cache terhubung di localhost:6379
2024-01-15 08:00:03 INFO  [Server] HTTP server berjalan di port 3000
2024-01-15 08:00:05 DEBUG [Auth] Token validation middleware terdaftar
2024-01-15 08:00:10 INFO  [API] GET /api/users 200 OK (45ms)
2024-01-15 08:00:11 INFO  [API] GET /api/products 200 OK (32ms)
2024-01-15 08:00:12 WARN  [DB] Query lambat terdeteksi: 1200ms untuk SELECT * FROM orders
2024-01-15 08:00:13 INFO  [API] POST /api/orders 201 Created (88ms)
2024-01-15 08:00:14 ERROR [API] GET /api/users/9999 404 Not Found
2024-01-15 08:00:15 INFO  [API] GET /api/products/1 200 OK (28ms)
2024-01-15 08:00:16 WARN  [DB] Query lambat terdeteksi: 1450ms untuk SELECT * FROM orders
2024-01-15 08:00:17 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
    at Layer.handle [as handle_request] (express/lib/router/layer.js:95:5)
2024-01-15 08:00:18 INFO  [API] GET /api/dashboard 200 OK (120ms)
2024-01-15 08:00:19 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
    at Layer.handle [as handle_request] (express/lib/router/layer.js:95:5)
2024-01-15 08:00:20 WARN  [Auth] Token mendekati kedaluwarsa untuk user_id=1042
2024-01-15 08:00:21 INFO  [API] POST /api/login 200 OK (55ms)
2024-01-15 08:00:22 DEBUG [Cache] Cache miss untuk key: product_catalog_page_2
2024-01-15 08:00:23 ERROR [DB] ECONNREFUSED 127.0.0.1:5432 — koneksi database terputus
2024-01-15 08:00:24 ERROR [DB] ECONNREFUSED 127.0.0.1:5432 — koneksi database terputus
2024-01-15 08:00:25 FATAL [App] Tidak dapat terhubung ke database setelah 3 percobaan ulang
2024-01-15 08:00:26 ERROR [DB] ECONNREFUSED 127.0.0.1:5432 — koneksi database terputus
2024-01-15 08:00:27 INFO  [DB] Mencoba reconnect ke database...
2024-01-15 08:00:30 INFO  [DB] Koneksi database berhasil dipulihkan
2024-01-15 08:00:31 INFO  [API] GET /api/users 200 OK (41ms)
2024-01-15 08:00:32 WARN  [DB] Query lambat terdeteksi: 980ms untuk SELECT * FROM orders
2024-01-15 08:00:33 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
2024-01-15 08:00:34 INFO  [API] GET /api/stats 200 OK (67ms)
2024-01-15 08:00:35 WARN  [Auth] Token mendekati kedaluwarsa untuk user_id=2087
2024-01-15 08:00:36 ERROR [API] GET /api/users/0 500 Internal Server Error
2024-01-15 08:00:37 ERROR [App] ReferenceError: userCache is not defined
    at CacheService.get (services/cache.js:22:12)
    at UserController.getProfile (controllers/user.js:40:18)
2024-01-15 08:00:38 INFO  [API] GET /api/products 200 OK (29ms)
2024-01-15 08:00:39 WARN  [Rate] Rate limit hampir tercapai untuk IP 192.168.1.105 (95/100)
2024-01-15 08:00:40 ERROR [API] GET /api/users/0 500 Internal Server Error
2024-01-15 08:00:41 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
2024-01-15 08:00:42 DEBUG [Cache] Cache hit untuk key: user_profile_1042
2024-01-15 08:00:43 INFO  [API] PUT /api/products/5 200 OK (72ms)
2024-01-15 08:00:44 ERROR [App] ReferenceError: userCache is not defined
    at CacheService.get (services/cache.js:22:12)
2024-01-15 08:00:45 WARN  [DB] Koneksi pool hampir penuh: 18/20 koneksi aktif
2024-01-15 08:00:46 ERROR [API] POST /api/upload 413 Payload Too Large
2024-01-15 08:00:47 INFO  [API] GET /api/orders 200 OK (95ms)
2024-01-15 08:00:48 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
2024-01-15 08:00:49 WARN  [DB] Query lambat terdeteksi: 2100ms untuk SELECT * FROM orders
2024-01-15 08:00:50 ERROR [Network] Access to fetch has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
2024-01-15 08:00:51 INFO  [API] GET /api/health 200 OK (5ms)
2024-01-15 08:00:52 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
2024-01-15 08:00:53 DEBUG [GC] Garbage collection: freed 45MB heap
2024-01-15 08:00:54 WARN  [Auth] Token mendekati kedaluwarsa untuk user_id=3301
2024-01-15 08:00:55 ERROR [App] ReferenceError: userCache is not defined
    at CacheService.get (services/cache.js:22:12)
2024-01-15 08:00:56 INFO  [API] GET /api/users/42 200 OK (38ms)
2024-01-15 08:00:57 ERROR [DB] ECONNREFUSED 127.0.0.1:5432 — koneksi database terputus
2024-01-15 08:00:58 WARN  [DB] Query lambat terdeteksi: 1800ms untuk SELECT * FROM orders
2024-01-15 08:00:59 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
2024-01-15 08:01:00 INFO  [API] GET /api/products?page=2 200 OK (44ms)
2024-01-15 08:01:01 ERROR [App] SyntaxError: Unexpected token < in JSON at position 0
    at JSON.parse (<anonymous>)
    at parseResponse (utils/http.js:18:20)
2024-01-15 08:01:02 WARN  [Rate] Rate limit hampir tercapai untuk IP 10.0.0.55 (98/100)
2024-01-15 08:01:03 INFO  [API] DELETE /api/sessions/old 200 OK (25ms)
2024-01-15 08:01:04 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
2024-01-15 08:01:05 ERROR [App] ReferenceError: userCache is not defined
    at CacheService.get (services/cache.js:22:12)
2024-01-15 08:01:06 INFO  [Worker] Background job selesai: send_email_queue (8 pesan terkirim)
2024-01-15 08:01:07 WARN  [DB] Koneksi pool hampir penuh: 19/20 koneksi aktif
2024-01-15 08:01:08 ERROR [API] GET /api/admin/users 403 Forbidden
2024-01-15 08:01:09 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
2024-01-15 08:01:10 INFO  [API] GET /api/products/trending 200 OK (88ms)
2024-01-15 08:01:11 ERROR [App] SyntaxError: Unexpected token < in JSON at position 0
    at JSON.parse (<anonymous>)
2024-01-15 08:01:12 WARN  [Auth] Token mendekati kedaluwarsa untuk user_id=4412
2024-01-15 08:01:13 DEBUG [Cache] Cache eviction: 12 kunci lama dihapus
2024-01-15 08:01:14 ERROR [DB] ECONNREFUSED 127.0.0.1:5432 — koneksi database terputus
2024-01-15 08:01:15 FATAL [App] Heap out of memory: process.memoryUsage exceeded 512MB
2024-01-15 08:01:16 ERROR [App] TypeError: Cannot read properties of undefined (reading 'email')
    at UserController.getProfile (controllers/user.js:45:18)
2024-01-15 08:01:17 INFO  [Monitor] CPU usage: 78% | Memory: 490MB / 512MB
2024-01-15 08:01:18 WARN  [DB] Query lambat terdeteksi: 3200ms untuk SELECT * FROM orders
2024-01-15 08:01:19 ERROR [App] UnhandledPromiseRejection: Promise rejected without handler
    at processTicksAndRejections (internal/process/task_queues.js:95:5)
2024-01-15 08:01:20 INFO  [App] Graceful shutdown dimulai...
2024-01-15 08:01:21 INFO  [DB] Menutup semua koneksi database
2024-01-15 08:01:22 INFO  [App] Aplikasi berhenti.`,
};

// ─── Fungsi utama: analisis log ───────────────────────────────────────────────

/**
 * Mengambil daftar aturan yang relevan berdasarkan bahasa yang dipilih.
 * @param {string} language - Kode bahasa (auto/javascript/python/java/sql/http/cpp)
 * @returns {Array} Daftar aturan yang difilter
 */
function getRulesForLanguage(language) {
  if (language === "auto") return ERROR_RULES;
  return ERROR_RULES.filter(
    (rule) => rule.language === language || rule.language === "http"
  );
}

/**
 * Mendeteksi bahasa dari log secara otomatis berdasarkan pola khas.
 * @param {string} logText - Teks log yang dianalisis
 * @returns {string} Nama bahasa yang terdeteksi
 */
function detectLanguage(logText) {
  // C++ dideteksi lebih awal karena pola file .cpp/.h sangat khas
  if (/\.cpp:\d+|\.hpp:\d+|was not declared in this scope|undefined reference to|Segmentation fault|double free or corruption|AddressSanitizer|fatal error:.*No such file/i.test(logText)) return "C++";
  if (/Traceback|\.py.*line\s+\d+|ModuleNotFoundError|IndentationError/i.test(logText)) return "Python";
  if (/at\s+[\w.$]+\(.*\.java:\d+\)|NullPointerException|ArrayIndexOutOfBoundsException/i.test(logText)) return "Java";
  if (/\.js:\d+|TypeError|ReferenceError|SyntaxError|UnhandledPromise/i.test(logText)) return "JavaScript";
  if (/SQL syntax|Table '.*' doesn't exist|relation ".*" does not exist/i.test(logText)) return "SQL";
  if (/HTTP\/\d|CORS|ECONNREFUSED|ENOTFOUND|404|500/i.test(logText)) return "HTTP/Network";
  return "Tidak Terdeteksi";
}

/**
 * Mencari baris dan nama file dari teks error jika ada.
 * Mendukung format: JS stack trace, Python, Java, dan g++/clang (file.cpp:12:5: error: ...).
 * @param {string} logText - Teks log
 * @returns {Object|null} Object { file, line } atau null
 */
function extractFileInfo(logText) {
  const patterns = [
    // g++/clang: main.cpp:12:5: error: ... atau main.cpp:12: error: ...
    /([^\s:]+\.(?:cpp|cc|cxx|c|hpp|h))(?:\s*):(\d+)(?::\d+)?:\s*(?:error|warning|fatal error)/i,
    /at\s+[\w.$/<>]+\s+\((.+?):(\d+):\d+\)/,     // JS stack trace
    /File "(.+?)", line (\d+)/,                      // Python
    /\((.+?\.java):(\d+)\)/,                         // Java
  ];

  for (const pat of patterns) {
    const match = logText.match(pat);
    if (match) {
      return { file: match[1], line: match[2] };
    }
  }
  return null;
}

/**
 * Melarikan karakter HTML untuk mencegah XSS.
 * @param {string} str - String yang akan di-escape
 * @returns {string} String yang sudah aman
 */
function escapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, (ch) => map[ch]);
}

/**
 * Membuat badge HTML untuk severity level.
 * @param {string} severity - 'Low' | 'Medium' | 'High'
 * @returns {string} HTML string badge
 */
function createSeverityBadge(severity) {
  const colors = {
    Low:    "bg-green-100 text-green-800 border-green-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    High:   "bg-red-100 text-red-800 border-red-200",
  };
  const icons = { Low: "✓", Medium: "⚠", High: "✕" };
  const cls = colors[severity] || "bg-gray-100 text-gray-700 border-gray-200";
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}">
    <span>${icons[severity] || "?"}</span> ${escapeHtml(severity)}
  </span>`;
}

/**
 * Membangun HTML card hasil analisis untuk satu aturan.
 * @param {Object} rule - Aturan error yang cocok
 * @param {Object|null} fileInfo - Informasi file/baris dari log
 * @param {number} index - Urutan card (untuk animasi stagger)
 * @returns {string} HTML string card
 */
function buildResultCard(rule, fileInfo, index) {
  const steps = rule.steps
    .map((s, i) => `<li class="result-step"><span class="step-num">${i + 1}</span><span>${escapeHtml(s)}</span></li>`)
    .join("");

  const causes = rule.causes
    .map((c) => `<li class="flex gap-2"><span class="text-orange-500 mt-0.5">•</span><span>${escapeHtml(c)}</span></li>`)
    .join("");

  const fileInfoHtml = fileInfo
    ? `<div class="file-info-badge">
        <span>📄</span>
        <span>File: <code>${escapeHtml(fileInfo.file)}</code></span>
        <span class="mx-1">·</span>
        <span>Baris: <code>${escapeHtml(fileInfo.line)}</code></span>
       </div>`
    : "";

  return `
    <article class="result-card animate-slide-in" style="animation-delay: ${index * 80}ms"
             role="article" aria-label="Hasil analisis: ${escapeHtml(rule.name)}">
      <div class="result-card-header">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="result-error-name">${escapeHtml(rule.name)}</h3>
          ${createSeverityBadge(rule.severity)}
          <span class="lang-badge">${escapeHtml(rule.language.toUpperCase())}</span>
        </div>
        ${fileInfoHtml}
      </div>

      <div class="result-card-body">
        <!-- Penjelasan -->
        <section class="result-section">
          <h4 class="result-section-title">💡 Penjelasan</h4>
          <p class="text-gray-700 text-sm leading-relaxed">${escapeHtml(rule.explanation)}</p>
        </section>

        <!-- Kemungkinan Penyebab -->
        <section class="result-section">
          <h4 class="result-section-title">🔍 Kemungkinan Penyebab</h4>
          <ul class="text-sm text-gray-700 space-y-1">${causes}</ul>
        </section>

        <!-- Langkah Perbaikan -->
        <section class="result-section">
          <h4 class="result-section-title">🛠️ Langkah Perbaikan</h4>
          <ol class="steps-list">${steps}</ol>
        </section>

        <!-- Contoh Kode -->
        <section class="result-section">
          <h4 class="result-section-title">📝 Contoh Kode</h4>
          <pre class="code-block"><code>${escapeHtml(rule.codeExample)}</code></pre>
        </section>
      </div>
    </article>`;
}

/**
 * Membangun HTML card untuk error yang tidak dikenali.
 * @returns {string} HTML string card
 */
function buildUnknownErrorCard() {
  const tips = GENERAL_DEBUG_TIPS
    .map((t, i) => `<li class="result-step"><span class="step-num">${i + 1}</span><span>${escapeHtml(t)}</span></li>`)
    .join("");

  return `
    <article class="result-card unknown-error-card animate-slide-in" role="article" aria-label="Error tidak dikenali">
      <div class="result-card-header">
        <h3 class="result-error-name">❓ Error Belum Dikenali</h3>
      </div>
      <div class="result-card-body">
        <section class="result-section">
          <p class="text-gray-700 text-sm leading-relaxed">
            Pola error ini tidak ditemukan dalam database aturan kami. Berikut adalah saran umum untuk debugging:
          </p>
        </section>
        <section class="result-section">
          <h4 class="result-section-title">🛠️ Tips Debugging Umum</h4>
          <ol class="steps-list">${tips}</ol>
        </section>
      </div>
    </article>`;
}

/**
 * Fungsi utama analisis: mencocokkan log dengan semua aturan dan merender hasilnya.
 */
function analyzeLog() {
  const rawLog = logInput.value.trim();

  // Validasi input kosong
  if (!rawLog) {
    showInputError("Mohon masukkan error log sebelum menganalisis.");
    return;
  }

  clearInputError();

  // ── Deteksi otomatis mode log besar (> LP_AUTO_THRESHOLD baris) ──────────
  const lineCount = rawLog.split(/\r?\n/).filter((l) => l.trim()).length;
  if (lineCount > LP_AUTO_THRESHOLD && typeof lpRender === "function") {
    activateLargeLogMode(rawLog);
    return; // mode log besar menangani analisisnya sendiri
  }

  // ── Mode analisis biasa ───────────────────────────────────────────────────
  hideLargeLogMode();

  const selectedLang = languageSelect.value;
  const rules = getRulesForLanguage(selectedLang);
  const matchedRules = [];

  // Cocokkan setiap aturan dengan teks log
  for (const rule of rules) {
    if (rule.pattern.test(rawLog)) {
      matchedRules.push(rule);
    }
  }

  // Render preview log dengan highlight baris error
  renderLogPreview(rawLog);

  // Render hasil analisis
  let cardsHtml = "";
  if (matchedRules.length === 0) {
    cardsHtml = buildUnknownErrorCard();
  } else {
    const fileInfo = extractFileInfo(rawLog);
    cardsHtml = matchedRules
      .map((rule, i) => buildResultCard(rule, fileInfo, i))
      .join("");
  }

  resultsContainer.innerHTML = cardsHtml;
  resultsSection.classList.remove("hidden");

  // Tampilkan info ringkasan
  const detectedLang = selectedLang === "auto" ? detectLanguage(rawLog) : selectedLang;
  renderSummaryHeader(matchedRules.length, detectedLang);

  // Simpan ke riwayat
  saveToHistory(rawLog, matchedRules.length, detectedLang);
  renderHistory();

  // Publikasikan hasil analisis ke window agar dapat dibaca chatbot.js tanpa re-kalkulasi
  window.lastAnalysis = { rawLog, matchedRules, detectedLang };

  // Scroll ke hasil
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Fungsi mode log besar ────────────────────────────────────────────────────

/**
 * Mengaktifkan mode analisis log besar.
 * Menyembunyikan hasil analisis biasa dan menampilkan section lp-section.
 * @param {string} rawLog
 */
function activateLargeLogMode(rawLog) {
  // Sembunyikan tampilan analisis biasa
  resultsSection.classList.add("hidden");
  logPreviewSection.classList.add("hidden");

  // Jalankan parser log besar (dari logParser.js)
  lpRender(rawLog);

  // Scroll ke section log besar
  const lpSection = document.getElementById("lp-section");
  if (lpSection) lpSection.scrollIntoView({ behavior: "smooth", block: "start" });

  showToast("📊 Mode Analisis Log Besar aktif (" + rawLog.split(/\r?\n/).filter((l) => l.trim()).length + " baris)");
}

/**
 * Menyembunyikan section analisis log besar.
 */
function hideLargeLogMode() {
  const lpSection = document.getElementById("lp-section");
  if (lpSection) lpSection.classList.add("hidden");
}

/**
 * Menjalankan analisis mode biasa secara langsung, melewati cek LP_AUTO_THRESHOLD.
 * Dipakai oleh tombol '← Tampilan Biasa' agar pengguna bisa melihat hasil
 * analisis biasa meskipun log lebih dari 20 baris.
 * @param {string} rawLog
 */
function runBasicAnalysis(rawLog) {
  clearInputError();

  const selectedLang = languageSelect.value;
  const rules = getRulesForLanguage(selectedLang);
  const matchedRules = [];

  for (const rule of rules) {
    if (rule.pattern.test(rawLog)) matchedRules.push(rule);
  }

  renderLogPreview(rawLog);

  let cardsHtml = "";
  if (matchedRules.length === 0) {
    cardsHtml = buildUnknownErrorCard();
  } else {
    const fileInfo = extractFileInfo(rawLog);
    cardsHtml = matchedRules.map((rule, i) => buildResultCard(rule, fileInfo, i)).join("");
  }

  resultsContainer.innerHTML = cardsHtml;
  resultsSection.classList.remove("hidden");

  const detectedLang = selectedLang === "auto" ? detectLanguage(rawLog) : selectedLang;
  renderSummaryHeader(matchedRules.length, detectedLang);
  saveToHistory(rawLog, matchedRules.length, detectedLang);
  renderHistory();
  window.lastAnalysis = { rawLog, matchedRules, detectedLang };
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Fungsi render UI ────────────────────────────────────────────────────────

/**
 * Merender preview log dengan highlight baris yang mengandung kata kunci error.
 * @param {string} logText - Teks log mentah
 */
function renderLogPreview(logText) {
  const lines = logText.split("\n");
  const errorKeywords = /error|exception|traceback|warning|failed|undefined|null|denied|refused/i;

  const highlightedLines = lines.map((line, i) => {
    const lineNum = `<span class="log-line-num">${String(i + 1).padStart(3, " ")}</span>`;
    const safeLine = escapeHtml(line);
    if (errorKeywords.test(line)) {
      return `<span class="log-line log-line-error">${lineNum}${safeLine}</span>`;
    }
    return `<span class="log-line">${lineNum}${safeLine}</span>`;
  });

  logPreview.innerHTML = highlightedLines.join("\n");
  logPreviewSection.classList.remove("hidden");
}

/**
 * Merender header ringkasan hasil analisis.
 * @param {number} count - Jumlah pola yang cocok
 * @param {string} detectedLang - Bahasa yang terdeteksi
 */
function renderSummaryHeader(count, detectedLang) {
  const summaryEl = document.getElementById("results-summary");
  if (!summaryEl) return;

  if (count === 0) {
    summaryEl.innerHTML = `<span class="text-orange-600 font-medium">⚠ Tidak ada pola yang cocok</span> · Bahasa: <span class="font-medium">${escapeHtml(detectedLang)}</span>`;
  } else {
    summaryEl.innerHTML = `<span class="text-blue-600 font-medium">✓ ${count} error ditemukan</span> · Bahasa: <span class="font-medium">${escapeHtml(detectedLang)}</span>`;
  }
}

// ─── Fungsi riwayat ──────────────────────────────────────────────────────────

/**
 * Mengambil riwayat dari localStorage.
 * @returns {Array} Array objek riwayat
 */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Menyimpan satu entri riwayat baru ke localStorage (maks. 5).
 * @param {string} logText - Teks log yang dianalisis
 * @param {number} matchCount - Jumlah error yang ditemukan
 * @param {string} language - Bahasa yang terdeteksi
 */
function saveToHistory(logText, matchCount, language) {
  const history = getHistory();
  const entry = {
    id: Date.now(),
    preview: logText.substring(0, 80).replace(/\n/g, " ") + (logText.length > 80 ? "…" : ""),
    fullLog: logText,
    matchCount,
    language,
    timestamp: new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }),
  };

  // Tambahkan di awal, batasi MAX_HISTORY
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.pop();

  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/**
 * Merender daftar riwayat di sidebar.
 */
function renderHistory() {
  const history = getHistory();

  if (history.length === 0) {
    historySection.classList.add("hidden");
    return;
  }

  historySection.classList.remove("hidden");
  historyList.innerHTML = history.map((entry) => `
    <li class="history-item" data-id="${entry.id}">
      <button class="history-load-btn" onclick="loadFromHistory(${entry.id})"
              aria-label="Muat ulang analisis: ${escapeHtml(entry.preview)}">
        <div class="flex justify-between items-start gap-2">
          <span class="history-preview">${escapeHtml(entry.preview)}</span>
          <span class="history-badge">${escapeHtml(String(entry.matchCount))} error</span>
        </div>
        <div class="history-meta">
          <span>${escapeHtml(entry.language)}</span>
          <span>·</span>
          <span>${escapeHtml(entry.timestamp)}</span>
        </div>
      </button>
      <button class="history-delete-btn" onclick="deleteFromHistory(${entry.id})"
              aria-label="Hapus riwayat ini" title="Hapus">
        ×
      </button>
    </li>
  `).join("");
}

/**
 * Memuat log dari riwayat ke textarea dan menjalankan analisis ulang.
 * @param {number} id - ID entri riwayat
 */
function loadFromHistory(id) {
  const history = getHistory();
  const entry = history.find((h) => h.id === id);
  if (!entry) return;

  logInput.value = entry.fullLog;
  updateCharCount();
  analyzeLog();
  logInput.scrollIntoView({ behavior: "smooth" });
}

/**
 * Menghapus satu entri dari riwayat.
 * @param {number} id - ID entri riwayat
 */
function deleteFromHistory(id) {
  const history = getHistory().filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

/**
 * Menghapus seluruh riwayat.
 */
function clearAllHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

// ─── Fungsi utilitas UI ──────────────────────────────────────────────────────

/**
 * Membersihkan textarea dan hasil analisis.
 */
function clearAll() {
  logInput.value = "";
  updateCharCount();
  resultsSection.classList.add("hidden");
  logPreviewSection.classList.add("hidden");
  hideLargeLogMode(); // juga sembunyikan mode log besar
  clearInputError();
  logInput.focus();
}

/**
 * Menyalin ringkasan hasil analisis ke clipboard.
 */
function copyResults() {
  const cards = resultsContainer.querySelectorAll("[data-copy-text]");

  // Ambil semua teks dari data attribute, atau fallback ke innerText
  let text = "";
  if (cards.length > 0) {
    cards.forEach((c) => (text += c.dataset.copyText + "\n\n"));
  } else {
    // Fallback: ambil teks bersih dari container
    text = resultsContainer.innerText || "";
  }

  if (!text.trim()) {
    text = buildCopyText();
  }

  navigator.clipboard.writeText(text.trim()).then(() => {
    showToast("✓ Hasil analisis berhasil disalin!");
  }).catch(() => {
    // Fallback untuk browser lama
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("✓ Hasil analisis berhasil disalin!");
  });
}

/**
 * Membangun teks ringkasan analisis untuk disalin.
 * @returns {string} Teks ringkasan
 */
function buildCopyText() {
  const articles = resultsContainer.querySelectorAll("article");
  if (articles.length === 0) return "";

  const lines = [`=== HASIL ANALISIS ERROR LOG ===`, `Log: ${logInput.value.substring(0, 100)}...`, ""];

  articles.forEach((art, i) => {
    const title = art.querySelector("h3")?.innerText || "Error";
    const sections = art.querySelectorAll("section");
    lines.push(`--- Error ${i + 1}: ${title} ---`);
    sections.forEach((sec) => {
      const heading = sec.querySelector("h4")?.innerText || "";
      const content = [...sec.querySelectorAll("p, li")]
        .map((el) => el.innerText)
        .join(" / ");
      if (heading) lines.push(`${heading}: ${content}`);
    });
    lines.push("");
  });

  lines.push("Dibuat oleh Error Log Explainer");
  return lines.join("\n");
}

/**
 * Mengisi textarea dengan contoh log berdasarkan bahasa yang dipilih.
 */
function loadSampleLog() {
  const lang = languageSelect.value;

  // Untuk C++, bergantian antara contoh compile error dan runtime error
  if (lang === "cpp") {
    const cppSamples = [SAMPLE_LOGS.cpp_compile, SAMPLE_LOGS.cpp_runtime];
    const current = logInput.value.trim();
    // Pilih contoh yang berbeda dari yang sedang tampil (toggle)
    const next = cppSamples.find((s) => s.trim() !== current) || cppSamples[0];
    logInput.value = next;
  } else {
    logInput.value = SAMPLE_LOGS[lang] || SAMPLE_LOGS.auto;
  }

  updateCharCount();
  logInput.focus();
  showToast("Contoh log telah dimuat!");
}

/**
 * Memperbarui tampilan penghitung karakter.
 */
function updateCharCount() {
  const count = logInput.value.length;
  charCount.textContent = `${count.toLocaleString("id-ID")} karakter`;
  charCount.classList.toggle("text-orange-500", count > 5000);
}

/**
 * Menampilkan pesan error di bawah textarea.
 * @param {string} msg - Pesan error
 */
function showInputError(msg) {
  const el = document.getElementById("input-error");
  if (el) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }
}

/**
 * Menyembunyikan pesan error di bawah textarea.
 */
function clearInputError() {
  const el = document.getElementById("input-error");
  if (el) el.classList.add("hidden");
}

/**
 * Menampilkan notifikasi toast sementara.
 * @param {string} message - Pesan yang ditampilkan
 */
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("opacity-0", "translate-y-4");
  toast.classList.add("opacity-100", "translate-y-0");

  setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-4");
  }, 2500);
}

// ─── Event listeners ─────────────────────────────────────────────────────────
analyzeBtn.addEventListener("click", analyzeLog);
clearBtn.addEventListener("click", clearAll);
copyBtn.addEventListener("click", copyResults);
sampleBtn.addEventListener("click", loadSampleLog);
logInput.addEventListener("input", updateCharCount);

// Tombol Contoh Log Besar — muat sampel dan langsung analisis
document.getElementById("btn-sample-large")?.addEventListener("click", () => {
  logInput.value = SAMPLE_LOGS.large;
  updateCharCount();
  analyzeLog();
  showToast("📂 Contoh log besar dimuat!");
});

// Tombol '← Tampilan Biasa' di mode log besar
document.getElementById("btn-toggle-view")?.addEventListener("click", () => {
  hideLargeLogMode();
  // Jalankan ulang analisis biasa dengan teks yang sama
  const rawLog = logInput.value.trim();
  if (rawLog) {
    // Paksa mode biasa: sementara batasi baris agar tidak kembali ke mode besar
    // Simpan baris asli, analisis ulang tanpa threshold
    const savedLog = rawLog;
    // Gunakan fungsi analisis biasa secara langsung (bypass threshold)
    runBasicAnalysis(savedLog);
  }
});

// Analisis dengan Ctrl+Enter
logInput.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") analyzeLog();
});

// Tombol hapus semua riwayat (delegasi event)
document.getElementById("btn-clear-history")?.addEventListener("click", clearAllHistory);

// ─── Inisialisasi ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateCharCount();
  renderHistory();
});
