/**
 * chatbot.js — Debug Buddy
 * Rule-based chatbot untuk membantu pengguna memahami error log.
 * Membaca data dari window.lastAnalysis (ditulis oleh script.js),
 * ERROR_RULES dan GENERAL_DEBUG_TIPS (dari rules.js) — tanpa duplikasi logika.
 */

// ─── Konstanta ───────────────────────────────────────────────────────────────
const CHAT_HISTORY_KEY   = "debugBuddyHistory";
const CHAT_MAX_MESSAGES  = 30;
const BOT_TYPING_DELAY_MS = 600; // durasi animasi "sedang mengetik" (ms)

// ─── Referensi elemen DOM ────────────────────────────────────────────────────
const chatToggleBtn = document.getElementById("chat-toggle-btn");
const chatPanel     = document.getElementById("chat-panel");
const chatMessages  = document.getElementById("chat-messages");
const chatInput     = document.getElementById("chat-input");
const chatSendBtn   = document.getElementById("chat-send-btn");
const chatCloseBtn  = document.getElementById("chat-close-btn");
const chatClearBtn  = document.getElementById("chat-clear-btn");
const chatUnreadDot = document.getElementById("chat-unread-dot");

// ─── State ────────────────────────────────────────────────────────────────────
let isChatOpen = false;

// ─── Fungsi escape & format teks ─────────────────────────────────────────────

/**
 * Melarikan karakter HTML untuk mencegah XSS.
 * @param {string} str
 * @returns {string}
 */
function chatEscapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, (ch) => map[ch]);
}

/**
 * Memformat teks markdown ringan ke HTML untuk gelembung chat bot.
 * Pendekatan dua-langkah aman XSS:
 *   1. Ganti blok kode dengan placeholder, escape sisanya
 *   2. Terapkan format inline, lalu kembalikan blok kode
 * @param {string} text - Teks dengan markdown ringan
 * @returns {string} HTML string yang aman
 */
function formatBotText(text) {
  // Langkah 1: Ekstrak blok kode ke array, ganti dengan placeholder \x00N\x00
  const codeBlocks = [];
  const withPlaceholders = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(`<pre class="chat-code-block"><code>${chatEscapeHtml(code.trim())}</code></pre>`);
    return `\x00${codeBlocks.length - 1}\x00`;
  });

  // Langkah 2: Escape HTML seluruh teks (placeholder \x00 tidak mengandung HTML)
  let html = chatEscapeHtml(withPlaceholders);

  // Langkah 3: Terapkan format inline (karakter ** dan ` sudah di-escape menjadi ** dan `)
  // Setelah escaping, `` * `` tetap ``*``, `` ` `` tetap `` ` ``
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<![a-zA-Z0-9])_([^_\n]+)_(?![a-zA-Z0-9])/g, "<em>$1</em>");
  html = html.replace(/`([^`\n]+)`/g, '<code class="chat-inline-code">$1</code>');
  html = html.replace(/\n/g, "<br>");

  // Langkah 4: Kembalikan blok kode dari placeholder
  html = html.replace(/\x00(\d+)\x00/g, (_, i) => codeBlocks[Number(i)]);

  return html;
}

/**
 * Melarikan karakter markdown agar tidak diinterpretasi sebagai format.
 * Dipakai untuk menyisipkan konten dari rules.js ke dalam teks template bot.
 * @param {string} str
 * @returns {string}
 */
function escapeMarkdown(str) {
  return String(str).replace(/\*/g, "\\*").replace(/_/g, "\\_");
}

// ─── Fungsi helper intent ─────────────────────────────────────────────────────

/**
 * Respons standar saat belum ada hasil analisis yang tersedia.
 * @returns {{ text: string, chips: string[] }}
 */
function noAnalysisYetResponse() {
  return {
    text: "Belum ada log yang dianalisis. Silakan:\n\n1. Tempel error log di **textarea utama** di atas\n2. Klik tombol **Analisis**\n3. Kemudian tanya saya tentang hasilnya!",
    chips: ["Apa yang bisa kamu lakukan?", "Tips debugging"],
  };
}

/**
 * Mencari aturan error di ERROR_RULES berdasarkan kata dari pertanyaan pengguna.
 * @param {string} normalizedInput - Input yang sudah dinormalisasi (huruf kecil)
 * @returns {Object|null} Aturan yang cocok, atau null
 */
function findRuleByKeyword(normalizedInput) {
  if (typeof ERROR_RULES === "undefined") return null;

  // Hapus stopwords agar pencarian lebih akurat
  const stopWords = new Set([
    "apa", "itu", "yang", "dimaksud", "jelaskan", "tentang",
    "definisi", "pengertian", "adalah", "dan", "atau", "di",
  ]);
  const searchWords = normalizedInput
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (searchWords.length === 0) return null;

  // Cari aturan yang namanya mengandung salah satu kata pencarian
  return ERROR_RULES.find((rule) => {
    const ruleName = rule.name.toLowerCase();
    const ruleId   = rule.id.toLowerCase().replace(/_/g, " ");
    return searchWords.some((word) => ruleName.includes(word) || ruleId.includes(word));
  }) || null;
}

// ─── Definisi intent ──────────────────────────────────────────────────────────
/**
 * Setiap intent: { keywords, handler(normalizedInput) → { text, chips? } }
 * Dicocokkan berurutan — yang pertama cocok yang dipakai.
 */
const INTENTS = [

  // ── Sapaan ──────────────────────────────────────────────────────────────────
  {
    keywords: ["halo", "hai", "hello", "hi", "hey", "selamat", "pagi", "siang", "malam", "sore"],
    handler: () => ({
      text: "Halo! Saya **Debug Buddy** 👋\n\nSaya siap membantu kamu memahami error log. Tempel error log di textarea utama lalu klik **Analisis**, kemudian tanya saya apa saja tentang hasilnya!",
      chips: ["Apa yang bisa kamu lakukan?", "Jelaskan error ini", "Tips debugging"],
    }),
  },

  // ── Bantuan: apa yang bisa dilakukan ────────────────────────────────────────
  {
    keywords: ["apa yang bisa", "bisa apa", "bantu apa", "kemampuan", "fitur", "fungsi", "help"],
    handler: () => ({
      text: "Saya bisa membantu kamu dengan:\n\n• **Menjelaskan hasil analisis** — tanya `jelaskan error ini`\n• **Cara memperbaiki** — tanya `bagaimana cara memperbaikinya`\n• **Contoh kode** — tanya `kasih contoh kode perbaikan`\n• **Definisi error** — tanya `apa itu segmentation fault`\n• **Tips debugging** — tanya `tips membaca stack trace`\n• **Beda dua error** — tanya `bedanya TypeError dan ReferenceError`",
      chips: ["Jelaskan error ini", "Tips membaca stack trace", "Apa itu Segmentation fault"],
    }),
  },

  // ── Jelaskan error dari hasil analisis ──────────────────────────────────────
  {
    keywords: [
      "jelaskan", "penjelasan", "maksud", "artinya",
      "kenapa error", "kenapa terjadi", "mengapa error", "apa penyebab",
      "jelaskan error",
    ],
    handler: () => {
      const analysis = window.lastAnalysis;
      if (!analysis || !analysis.matchedRules || analysis.matchedRules.length === 0) {
        return noAnalysisYetResponse();
      }
      const rule = analysis.matchedRules[0];
      const suffix = analysis.matchedRules.length > 1
        ? `\n\n_Selain itu, ditemukan ${analysis.matchedRules.length - 1} error lain. Lihat kartu hasil di atas untuk detail lengkap._`
        : "";
      return {
        text: `**${escapeMarkdown(rule.name)}**\n\n${escapeMarkdown(rule.explanation)}${suffix}`,
        chips: ["Apa penyebabnya?", "Cara memperbaiki", "Contoh kode perbaikan"],
      };
    },
  },

  // ── Penyebab error dari hasil analisis ──────────────────────────────────────
  {
    keywords: ["penyebab", "sebab", "kenapa bisa", "mengapa bisa", "akar masalah", "penyebabnya"],
    handler: () => {
      const analysis = window.lastAnalysis;
      if (!analysis || !analysis.matchedRules || analysis.matchedRules.length === 0) {
        return noAnalysisYetResponse();
      }
      const rule = analysis.matchedRules[0];
      const causeList = rule.causes.map((c, i) => `${i + 1}. ${c}`).join("\n");
      return {
        text: `**Kemungkinan penyebab ${escapeMarkdown(rule.name)}:**\n\n${escapeMarkdown(causeList)}`,
        chips: ["Cara memperbaiki", "Contoh kode perbaikan", "Ada error lain?"],
      };
    },
  },

  // ── Cara memperbaiki dari hasil analisis ────────────────────────────────────
  {
    keywords: [
      "cara memperbaiki", "cara perbaiki", "cara fix", "solusi",
      "langkah perbaikan", "bagaimana memperbaiki", "bagaimana perbaiki",
      "gimana cara", "perbaiki", "memperbaiki",
    ],
    handler: () => {
      const analysis = window.lastAnalysis;
      if (!analysis || !analysis.matchedRules || analysis.matchedRules.length === 0) {
        return noAnalysisYetResponse();
      }
      const rule = analysis.matchedRules[0];
      const stepList = rule.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
      return {
        text: `**Langkah perbaikan untuk ${escapeMarkdown(rule.name)}:**\n\n${escapeMarkdown(stepList)}`,
        chips: ["Contoh kode perbaikan", "Jelaskan error ini", "Ada error lain?"],
      };
    },
  },

  // ── Contoh kode perbaikan dari hasil analisis ────────────────────────────────
  {
    keywords: ["contoh kode", "kode perbaikan", "contoh perbaikan", "kasih contoh", "show code", "code example"],
    handler: () => {
      const analysis = window.lastAnalysis;
      if (!analysis || !analysis.matchedRules || analysis.matchedRules.length === 0) {
        return noAnalysisYetResponse();
      }
      const rule = analysis.matchedRules[0];
      return {
        text: `**Contoh kode untuk ${escapeMarkdown(rule.name)}:**\n\n\`\`\`\n${rule.codeExample}\n\`\`\``,
        chips: ["Ada error lain?", "Cara memperbaiki", "Tips debugging"],
      };
    },
  },

  // ── Daftar semua error dari hasil analisis ───────────────────────────────────
  {
    keywords: ["error lain", "error berikutnya", "ada lagi", "lainnya", "semua error", "daftar error", "error pertama"],
    handler: () => {
      const analysis = window.lastAnalysis;
      if (!analysis || !analysis.matchedRules) return noAnalysisYetResponse();
      if (analysis.matchedRules.length === 0) {
        return {
          text: "Tidak ada error yang berhasil diidentifikasi dari log terakhir. Coba tempel log yang lebih lengkap, atau gunakan tombol **Contoh Log** untuk mencoba contoh.",
          chips: ["Tips debugging", "Apa yang bisa kamu lakukan?"],
        };
      }
      if (analysis.matchedRules.length === 1) {
        return {
          text: `Hanya ditemukan **satu error** dari log terakhir: **${escapeMarkdown(analysis.matchedRules[0].name)}**.`,
          chips: ["Jelaskan error ini", "Cara memperbaiki"],
        };
      }
      const list = analysis.matchedRules
        .map((r, i) => `${i + 1}. **${r.name}** (${r.severity})`)
        .join("\n");
      return {
        text: `Ditemukan **${analysis.matchedRules.length} error** dari log terakhir:\n\n${escapeMarkdown(list)}\n\nLihat kartu hasil di atas untuk detail lengkap masing-masing.`,
        chips: ["Jelaskan error pertama", "Tips debugging"],
      };
    },
  },

  // ── Definisi error tertentu (cari di ERROR_RULES) ────────────────────────────
  {
    keywords: ["apa itu", "apa yang dimaksud", "jelaskan tentang", "definisi", "pengertian"],
    handler: (normalizedInput) => {
      const matched = findRuleByKeyword(normalizedInput);
      if (!matched) {
        return {
          text: "Saya tidak menemukan definisi error yang dimaksud. Coba sebutkan nama error yang lebih spesifik, misalnya:\n\n_`apa itu NullPointerException`_ atau _`apa itu CORS error`_.",
          chips: ["Apa itu TypeError", "Apa itu Segmentation fault", "Apa itu CORS error"],
        };
      }
      return {
        text: `**${escapeMarkdown(matched.name)}**\n\n${escapeMarkdown(matched.explanation)}\n\n_Bahasa: **${matched.language.toUpperCase()}** · Keparahan: **${matched.severity}**_`,
        chips: ["Cara memperbaikinya?", "Apa penyebabnya?", "Contoh kode"],
      };
    },
  },

  // ── Bedanya dua error ────────────────────────────────────────────────────────
  {
    keywords: ["bedanya", "perbedaan", "beda antara", " vs ", "versus", "dibandingkan"],
    handler: () => ({
      text: "Untuk membandingkan dua error, tempel kedua pesan error ke textarea utama dan klik **Analisis** — sistem akan mengenali keduanya sekaligus.\n\nAtau tanya saya satu per satu:\n• _`apa itu TypeError`_\n• _`apa itu ReferenceError`_",
      chips: ["Apa itu TypeError", "Apa itu ReferenceError", "Jelaskan error ini"],
    }),
  },

  // ── Tips membaca stack trace ────────────────────────────────────────────────
  {
    keywords: ["stack trace", "cara membaca", "baca log", "baca error", "stack frame"],
    handler: () => ({
      text: "**Cara membaca Stack Trace:**\n\n1. **Baca dari atas** — baris pertama adalah pesan error utama\n2. **Cari file milikmu** — abaikan baris dari `node_modules/` atau library\n3. **Perhatikan nomor baris** — misal `app.js:42` artinya baris 42 di file app.js\n4. **Ikuti urutan** — dari atas ke bawah adalah urutan pemanggilan fungsi (terbaru di atas)\n5. **Fokus pada 2–3 baris pertama** yang bukan dari library",
      chips: ["Tips pakai console.log", "Tips cari error di Google", "Jelaskan error ini"],
    }),
  },

  // ── Tips console.log / debugger ──────────────────────────────────────────────
  {
    keywords: ["console.log", "cara debug", "debugger", "cara pakai debugger", "print debug"],
    handler: () => ({
      text: "**Tips Debug dengan console.log:**\n\n1. Log nilai sebelum baris error: `console.log('nilai x:', x)`\n2. Log tipe data: `console.log(typeof data, data)`\n3. Gunakan `console.table(arr)` untuk array/objek\n4. Gunakan `console.error()` untuk error\n\n**DevTools (lebih kuat):** buka F12 → tab **Sources** → klik nomor baris untuk set breakpoint.",
      chips: ["Tips membaca stack trace", "Tips cari error di Google", "Tips debugging umum"],
    }),
  },

  // ── Tips mencari error di Google ────────────────────────────────────────────
  {
    keywords: ["cari di google", "googling", "cara mencari", "search error", "stackoverflow", "stack overflow"],
    handler: () => ({
      text: "**Tips mencari di Google / Stack Overflow:**\n\n1. **Copy pesan error utama** — hapus nama file & nomor baris\n2. **Tambahkan bahasa** — misal: _TypeError cannot read properties of undefined JavaScript_\n3. **Tambahkan library** jika relevan — misal: _CORS error React fetch_\n4. **Cari di SO langsung:** `site:stackoverflow.com [pesan error]`\n5. **Perhatikan tanggal** — pilih jawaban terbaru untuk library aktif",
      chips: ["Tips pakai console.log", "Tips debugging umum", "Jelaskan error ini"],
    }),
  },

  // ── Tips debugging umum ──────────────────────────────────────────────────────
  {
    keywords: ["tips debugging", "tips debug", "saran debugging", "debugging", "debug umum"],
    handler: () => {
      const tips = (typeof GENERAL_DEBUG_TIPS !== "undefined")
        ? GENERAL_DEBUG_TIPS.map((t, i) => `${i + 1}. ${t}`).join("\n")
        : "Baca pesan error, periksa nomor baris, gunakan console.log, cari di Google.";
      return {
        text: `**Tips Debugging Umum:**\n\n${escapeMarkdown(tips)}`,
        chips: ["Tips membaca stack trace", "Tips pakai console.log", "Tips cari error di Google"],
      };
    },
  },

  // ── Ucapan terima kasih / selesai ────────────────────────────────────────────
  {
    keywords: ["makasih", "terima kasih", "thanks", "thank you", "mantap", "sip", "oke", "selesai"],
    handler: () => ({
      text: "Sama-sama! 😊 Semoga kode kamu segera beres. Kalau ada error lain, paste saja ke textarea dan tanya saya lagi ya.",
      chips: ["Jelaskan error ini", "Tips debugging", "Apa yang bisa kamu lakukan?"],
    }),
  },
];

// ─── Mesin pencocokan intent ──────────────────────────────────────────────────

/**
 * Menormalkan input: huruf kecil, hapus tanda baca, trim spasi berlebih.
 * @param {string} text
 * @returns {string}
 */
function normalizeInput(text) {
  return text
    .toLowerCase()
    .replace(/[?.!,;:'"()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mencocokkan input pengguna dengan intent yang paling relevan.
 * Fallback: coba cocokkan nama error langsung, lalu tampilkan pesan tidak dikenal.
 * @param {string} userText - Teks asli dari pengguna
 * @returns {{ text: string, chips?: string[] }}
 */
function matchIntent(userText) {
  const normalized = normalizeInput(userText);

  // Cocokkan dengan intent terdefini
  for (const intent of INTENTS) {
    if (intent.keywords.some((kw) => normalized.includes(kw))) {
      return intent.handler(normalized);
    }
  }

  // Fallback: coba cocokkan nama error secara langsung
  const directRule = findRuleByKeyword(normalized);
  if (directRule) {
    return {
      text: `**${escapeMarkdown(directRule.name)}** _(${directRule.language.toUpperCase()})_\n\n${escapeMarkdown(directRule.explanation)}`,
      chips: ["Cara memperbaikinya?", "Apa penyebabnya?", "Contoh kode"],
    };
  }

  // Tidak ada yang cocok
  return {
    text: "Maaf, saya belum memahami pertanyaan itu. 🤔\n\nCoba tanyakan dengan cara yang berbeda. Berikut beberapa contoh pertanyaan:",
    chips: ["Jelaskan error ini", "Cara memperbaiki", "Tips debugging umum"],
  };
}

// ─── Render pesan di area chat ────────────────────────────────────────────────

/**
 * Membuat elemen gelembung pesan dan menambahkannya ke area chat.
 * @param {'user'|'bot'} role
 * @param {string} text        - Teks asli (user=plain, bot=markdown ringan)
 * @param {string[]} [chips]   - Quick reply chips, hanya untuk pesan bot
 * @param {boolean} [skipSave] - Jika true, tidak disimpan ke localStorage (saat restore)
 */
function appendMessage(role, text, chips, skipSave = false) {
  const wrapper = document.createElement("div");
  wrapper.className = `chat-msg-wrapper chat-msg-${role}`;

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble chat-bubble-${role}`;

  if (role === "user") {
    // textContent = otomatis escape XSS, tidak perlu sanitasi manual
    bubble.textContent = text;
  } else {
    bubble.innerHTML = formatBotText(text);
  }

  wrapper.appendChild(bubble);

  // Quick reply chips — hanya untuk pesan bot
  if (role === "bot" && Array.isArray(chips) && chips.length > 0) {
    const chipsEl = document.createElement("div");
    chipsEl.className = "chat-chips";
    chips.forEach((chipText) => {
      const btn = document.createElement("button");
      btn.className   = "chat-chip";
      btn.textContent = chipText;
      btn.setAttribute("aria-label", `Kirim: ${chipText}`);
      btn.addEventListener("click", () => sendMessage(chipText));
      chipsEl.appendChild(btn);
    });
    wrapper.appendChild(chipsEl);
  }

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Simpan ke localStorage (kecuali saat restore)
  if (!skipSave) saveChatMessage(role, text);
}

/**
 * Menampilkan animasi "bot sedang mengetik..." lalu menghapusnya setelah delay.
 * @returns {Promise<void>}
 */
function showTypingIndicator() {
  return new Promise((resolve) => {
    const indicator = document.createElement("div");
    indicator.id        = "chat-typing-indicator";
    indicator.className = "chat-msg-wrapper chat-msg-bot";
    indicator.innerHTML = `
      <div class="chat-bubble chat-bubble-bot chat-typing" aria-label="Debug Buddy sedang mengetik">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>`;
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    setTimeout(() => {
      indicator.remove();
      resolve();
    }, BOT_TYPING_DELAY_MS);
  });
}

// ─── Pengiriman pesan ────────────────────────────────────────────────────────

/**
 * Memproses dan mengirim pesan dari input atau klik chip.
 * @param {string|null} prefillText - Teks dari chip; null = ambil dari input
 */
async function sendMessage(prefillText = null) {
  const rawText = prefillText !== null ? prefillText : chatInput.value.trim();
  if (!rawText) return; // abaikan input kosong

  chatInput.value = "";

  appendMessage("user", rawText);
  await showTypingIndicator();

  const response = matchIntent(rawText);
  appendMessage("bot", response.text, response.chips);
}

// ─── Manajemen riwayat chat ───────────────────────────────────────────────────

/**
 * Menyimpan satu pesan ke localStorage; menjaga maks. CHAT_MAX_MESSAGES.
 * @param {'user'|'bot'} role
 * @param {string} text
 */
function saveChatMessage(role, text) {
  const history = getChatHistory();
  history.push({ role, text });
  if (history.length > CHAT_MAX_MESSAGES) {
    history.splice(0, history.length - CHAT_MAX_MESSAGES);
  }
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // localStorage penuh — abaikan, tidak mengganggu fungsi utama
  }
}

/**
 * Mengambil riwayat chat dari localStorage.
 * @returns {Array<{role: string, text: string}>}
 */
function getChatHistory() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Memulihkan riwayat chat ke area pesan saat halaman dimuat.
 * Pesan lama ditampilkan tanpa chip (chip tidak disimpan) dan tanpa disimpan ulang.
 */
function restoreChatHistory() {
  const history = getChatHistory();
  history.forEach((msg) => {
    appendMessage(msg.role, msg.text, undefined, /* skipSave */ true);
  });
}

/**
 * Menghapus seluruh riwayat chat dan membersihkan area pesan.
 */
function clearChatHistory() {
  localStorage.removeItem(CHAT_HISTORY_KEY);
  chatMessages.innerHTML = "";
  appendMessage("bot",
    "Riwayat chat dihapus. Halo lagi! 👋 Ada yang bisa saya bantu?",
    ["Jelaskan error ini", "Tips debugging", "Apa yang bisa kamu lakukan?"]
  );
}

// ─── Kontrol panel chat ───────────────────────────────────────────────────────

/** Membuka panel chat */
function openChat() {
  isChatOpen = true;
  chatPanel.classList.remove("chat-panel-hidden");
  chatPanel.setAttribute("aria-hidden", "false");
  chatToggleBtn.setAttribute("aria-expanded", "true");

  // Tukar ikon: sembunyikan ikon chat, tampilkan ikon ×
  document.getElementById("chat-icon-open").classList.add("hidden");
  document.getElementById("chat-icon-close").classList.remove("hidden");

  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatInput.focus();

  // Hapus indikator pesan belum dibaca
  chatUnreadDot.classList.add("hidden");
}

/** Menutup panel chat */
function closeChat() {
  isChatOpen = false;
  chatPanel.classList.add("chat-panel-hidden");
  chatPanel.setAttribute("aria-hidden", "true");
  chatToggleBtn.setAttribute("aria-expanded", "false");

  // Kembalikan ikon ke ikon chat
  document.getElementById("chat-icon-open").classList.remove("hidden");
  document.getElementById("chat-icon-close").classList.add("hidden");

  chatToggleBtn.focus();
}

// ─── Event listeners ──────────────────────────────────────────────────────────

chatToggleBtn.addEventListener("click", () => {
  if (isChatOpen) closeChat(); else openChat();
});

chatCloseBtn.addEventListener("click", closeChat);
chatClearBtn.addEventListener("click", clearChatHistory);
chatSendBtn.addEventListener("click", () => sendMessage());

// Enter kirim, Shift+Enter baris baru
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Esc menutup panel dari mana saja
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isChatOpen) closeChat();
});

// ─── Inisialisasi ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Pulihkan riwayat dari localStorage
  restoreChatHistory();

  // Tampilkan pesan selamat datang hanya jika belum ada riwayat
  if (getChatHistory().length === 0) {
    appendMessage(
      "bot",
      "Halo! Saya **Debug Buddy** 👋 Asisten debugging kamu.\n\nTempel error log di textarea utama lalu klik **Analisis**, kemudian tanya saya tentang hasilnya!",
      ["Apa yang bisa kamu lakukan?", "Tips debugging", "Tips membaca stack trace"]
    );
  }
});
