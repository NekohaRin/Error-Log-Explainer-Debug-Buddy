/**
 * codeFixer.js — Code Context Fixer
 * Mendeteksi lokasi error dalam kode, menampilkan konteks dengan highlight,
 * dan menawarkan saran perbaikan berbasis aturan.
 *
 * Bergantung pada globals dari script.js  : extractFileInfo, escapeHtml, showToast
 * Bergantung pada globals dari rules.js   : GENERAL_DEBUG_TIPS
 * Bergantung pada globals dari chatbot.js : sendMessage, openChat (opsional)
 */

// ─── Konstanta ───────────────────────────────────────────────────────────────
const CF_CONTEXT_LINES = 3;   // jumlah baris sebelum/sesudah baris error
const CF_MAX_UNDO       = 20;  // maksimum langkah undo

// ─── State ────────────────────────────────────────────────────────────────────
/** @type {string[]} Stack undo — setiap elemen adalah snapshot teks kode */
let cfUndoStack = [];

// ─── Referensi elemen DOM ────────────────────────────────────────────────────
const cfCodeInput    = document.getElementById("cf-code-input");
const cfLogInput     = document.getElementById("cf-log-input");
const cfLangSelect   = document.getElementById("cf-lang-select");
const cfAnalyzeBtn   = document.getElementById("cf-analyze-btn");
const cfClearBtn     = document.getElementById("cf-clear-btn");
const cfUseLastBtn   = document.getElementById("cf-use-last-log");
const cfResultArea   = document.getElementById("cf-result");
const cfContextArea  = document.getElementById("cf-context");
const cfDiffArea     = document.getElementById("cf-diff");
const cfActionsArea  = document.getElementById("cf-actions");
const cfCodeLineNums = document.getElementById("cf-line-numbers");

// ─── Contoh kode + log per bahasa ────────────────────────────────────────────
const CF_EXAMPLES = {
  javascript: {
    code: `function getUserName(user) {
  return user.profile.name;
}

const result = getUserName(null);
console.log(result);`,
    log: `TypeError: Cannot read properties of null (reading 'profile')
    at getUserName (app.js:2:16)
    at Object.<anonymous> (app.js:5:16)`,
  },
  python: {
    code: `import pandas as pd

def proses_data(df):
  hasil = df.groupby('kategori').sum()
  return hasil

data = pd.read_csv('data.csv')
print(proses_data(data))`,
    log: `ModuleNotFoundError: No module named 'pandas'`,
  },
  java: {
    code: `public class OrderService {
    public double hitungTotal(Order order) {
        return order.getItems().stream()
                    .mapToDouble(Item::getHarga)
                    .sum();
    }
}`,
    log: `Exception in thread "main" java.lang.NullPointerException
    at OrderService.hitungTotal(OrderService.java:3)`,
  },
  cpp: {
    code: `#include <string>

int main() {
    cout << "Halo Dunia" << endl;
    int angka = 10
    return 0;
}`,
    log: `main.cpp:4:5: error: 'cout' was not declared in this scope
main.cpp:5:20: error: expected ';' before 'return'`,
  },
};

// ─── Aturan perbaikan ─────────────────────────────────────────────────────────
/**
 * Setiap aturan:
 *   language    : 'javascript' | 'python' | 'java' | 'cpp' | '*'
 *   pattern     : RegExp yang dicocokkan ke teks error log
 *   description : Penjelasan singkat dalam bahasa Indonesia
 *   fix         : function(lines, errorInfo) → { newLines, changedIndices, explanation }
 *                 - lines        : array baris kode (string[])
 *                 - errorInfo    : { lineNum (1-based), col, message, file }
 *                 - newLines     : array baris yang sudah diperbaiki
 *                 - changedIndices : indeks (0-based) baris yang berubah/ditambah
 *                 - explanation  : teks penjelasan perubahan
 */
const CF_FIX_RULES = [

  // ── JavaScript ──────────────────────────────────────────────────────────────

  {
    id: "js_not_defined",
    language: "javascript",
    pattern: /ReferenceError:\s+(\w+)\s+is not defined/i,
    description: "Variabel tidak dideklarasikan — tambahkan deklarasi `const`/`let`",
    fix(lines, errorInfo) {
      const match = errorInfo.message.match(/ReferenceError:\s+(\w+)\s+is not defined/i);
      const varName = match ? match[1] : "variabel";
      const targetLine = Math.max(0, (errorInfo.lineNum || 1) - 1);

      const newLines = [...lines];
      const declaration = `const ${varName} = undefined; // TODO: inisialisasi nilai yang tepat`;
      newLines.splice(targetLine, 0, declaration);

      return {
        newLines,
        changedIndices: [targetLine],
        explanation: `Menambahkan deklarasi \`const ${varName}\` sebelum baris error. Ganti \`undefined\` dengan nilai awal yang sesuai.`,
      };
    },
  },

  {
    id: "js_cannot_read_props",
    language: "javascript",
    pattern: /TypeError:\s+Cannot read propert(?:y|ies) of (?:undefined|null)/i,
    description: "Akses properti pada null/undefined — ubah ke optional chaining `?.`",
    fix(lines, errorInfo) {
      const targetIdx = Math.max(0, (errorInfo.lineNum || 1) - 1);
      if (targetIdx >= lines.length) return null;

      const original = lines[targetIdx];
      // Ubah akses properti a.b menjadi a?.b (heuristik sederhana)
      const fixed = original.replace(/(\w+)\.(\w+)/g, "$1?.$2");

      if (fixed === original) return null; // tidak ada perubahan

      const newLines = [...lines];
      newLines[targetIdx] = fixed;

      return {
        newLines,
        changedIndices: [targetIdx],
        explanation: "Mengganti akses properti langsung (`obj.prop`) dengan optional chaining (`obj?.prop`) agar tidak crash saat nilai `null` atau `undefined`.",
      };
    },
  },

  {
    id: "js_missing_semicolon",
    language: "javascript",
    pattern: /SyntaxError:.*(?:Unexpected token|missing ';'|expected ';')/i,
    description: "Titik koma hilang di akhir pernyataan",
    fix(lines, errorInfo) {
      const targetIdx = Math.max(0, (errorInfo.lineNum || 1) - 1);
      if (targetIdx >= lines.length) return null;

      const original = lines[targetIdx];
      const trimmed  = original.trimEnd();

      // Jangan tambahkan ; jika baris sudah diakhiri dengan ; { } , atau comment
      if (/[;{},\/]$/.test(trimmed) || trimmed.endsWith("*/")) return null;

      const newLines = [...lines];
      newLines[targetIdx] = trimmed + ";";

      return {
        newLines,
        changedIndices: [targetIdx],
        explanation: `Menambahkan titik koma \`;\` di akhir baris ${errorInfo.lineNum || targetIdx + 1}.`,
      };
    },
  },

  {
    id: "js_missing_bracket",
    language: "javascript",
    pattern: /SyntaxError:.*(?:Unexpected end of input|missing \)|expected \))/i,
    description: "Tanda kurung tidak berpasangan — tambahkan penutup yang hilang",
    fix(lines, errorInfo) {
      // Cari baris terakhir yang mengandung ( tanpa pasangan )
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const opens  = (line.match(/\(/g) || []).length;
        const closes = (line.match(/\)/g) || []).length;
        if (opens > closes) {
          const newLines = [...lines];
          newLines[i] = line.trimEnd() + ")".repeat(opens - closes) + ";";
          return {
            newLines,
            changedIndices: [i],
            explanation: `Menambahkan ${opens - closes} kurung tutup \`)\` yang hilang di baris ${i + 1}.`,
          };
        }
      }
      return null;
    },
  },

  // ── Python ──────────────────────────────────────────────────────────────────

  {
    id: "py_indentation",
    language: "python",
    pattern: /IndentationError/i,
    description: "Indentasi tidak konsisten — normalisasi ke 4 spasi",
    fix(lines, errorInfo) {
      const targetIdx = Math.max(0, (errorInfo.lineNum || 1) - 1);
      if (targetIdx >= lines.length) return null;

      const original = lines[targetIdx];
      const leadingMatch = original.match(/^(\s+)/);
      if (!leadingMatch) return null;

      const leadingWs = leadingMatch[1];
      // Hitung kedalaman indentasi (tab = 4 spasi, pertahankan kelipatan 4)
      const depthGuess = Math.max(1, Math.round(leadingWs.replace(/\t/g, "    ").length / 4));
      const normalized = " ".repeat(depthGuess * 4) + original.trimStart();

      if (normalized === original) return null;

      const newLines = [...lines];
      newLines[targetIdx] = normalized;

      return {
        newLines,
        changedIndices: [targetIdx],
        explanation: `Mengganti indentasi campuran pada baris ${errorInfo.lineNum || targetIdx + 1} dengan ${depthGuess * 4} spasi (standar PEP 8).`,
      };
    },
  },

  {
    id: "py_missing_colon",
    language: "python",
    pattern: /SyntaxError:.*(?:expected ':'|invalid syntax)/i,
    description: "Tanda titik dua `:` hilang setelah `if`/`for`/`def`/`class`/`else`/`elif`/`while`/`try`/`except`/`with`",
    fix(lines, errorInfo) {
      const targetIdx = Math.max(0, (errorInfo.lineNum || 1) - 1);
      if (targetIdx >= lines.length) return null;

      const line = lines[targetIdx];
      const blockKeywords = /^\s*(if|elif|else|for|while|def|class|try|except|finally|with)\b/;

      if (!blockKeywords.test(line)) return null;
      if (line.trimEnd().endsWith(":")) return null; // sudah ada

      const newLines = [...lines];
      newLines[targetIdx] = line.trimEnd() + ":";

      return {
        newLines,
        changedIndices: [targetIdx],
        explanation: `Menambahkan \`:\` yang hilang di akhir baris ${errorInfo.lineNum || targetIdx + 1}.`,
      };
    },
  },

  {
    id: "py_module_not_found",
    language: "python",
    pattern: /ModuleNotFoundError:\s+No module named '(\w+)'/i,
    description: "Module tidak terinstal — tambahkan instruksi instalasi sebagai komentar",
    fix(lines, errorInfo) {
      const match = errorInfo.message.match(/No module named '([\w.]+)'/i);
      const modName = match ? match[1] : "module";

      // Cari baris import yang bermasalah
      const importIdx = lines.findIndex((l) =>
        new RegExp(`import\\s+${modName}|from\\s+${modName}\\s+import`, "i").test(l)
      );
      const insertIdx = importIdx >= 0 ? importIdx : 0;

      const comment = `# pip install ${modName}  # jalankan perintah ini di terminal sebelum menjalankan kode`;
      const newLines = [...lines];
      newLines.splice(insertIdx, 0, comment);

      return {
        newLines,
        changedIndices: [insertIdx],
        explanation: `Menambahkan instruksi instalasi \`pip install ${modName}\` sebagai komentar di atas baris import.`,
      };
    },
  },

  // ── C++ ─────────────────────────────────────────────────────────────────────

  {
    id: "cpp_missing_iostream",
    language: "cpp",
    pattern: /(?:cout|cin|endl|cerr).*was not declared in this scope/i,
    description: "Header `<iostream>` dan/atau `using namespace std;` belum ada",
    fix(lines, errorInfo) {
      const newLines = [...lines];
      const changedIndices = [];

      // Cek apakah #include <iostream> sudah ada
      const hasIostream  = lines.some((l) => /#include\s*<iostream>/.test(l));
      const hasNamespace = lines.some((l) => /using\s+namespace\s+std\s*;/.test(l));

      // Cari posisi setelah #include terakhir yang ada, atau di baris 0
      let insertPos = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#include") || lines[i].startsWith("#pragma")) {
          insertPos = i + 1;
        }
      }

      if (!hasIostream) {
        newLines.splice(insertPos, 0, "#include <iostream>");
        changedIndices.push(insertPos);
        insertPos++;
      }
      if (!hasNamespace) {
        // Masukkan setelah semua #include
        let nsPos = insertPos;
        for (let i = 0; i < newLines.length; i++) {
          if (newLines[i].startsWith("#include") || newLines[i].startsWith("#pragma")) nsPos = i + 1;
        }
        newLines.splice(nsPos, 0, "using namespace std;");
        changedIndices.push(nsPos);
      }

      if (changedIndices.length === 0) return null;

      return {
        newLines,
        changedIndices,
        explanation: "Menambahkan `#include <iostream>` dan/atau `using namespace std;` agar `cout`, `cin`, dan `endl` dapat dikenali oleh kompiler.",
      };
    },
  },

  {
    id: "cpp_missing_header_vector",
    language: "cpp",
    pattern: /(?:vector|std::vector).*was not declared|no.*type named 'vector'/i,
    description: "Header `<vector>` belum di-include",
    fix(lines) {
      if (lines.some((l) => /#include\s*<vector>/.test(l))) return null;

      const newLines = [...lines];
      let insertPos = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#include")) insertPos = i + 1;
      }
      newLines.splice(insertPos, 0, "#include <vector>");

      return {
        newLines,
        changedIndices: [insertPos],
        explanation: "Menambahkan `#include <vector>` agar tipe `std::vector` dapat digunakan.",
      };
    },
  },

  {
    id: "cpp_missing_string_header",
    language: "cpp",
    pattern: /(?:string|std::string).*was not declared|no.*type named 'string'/i,
    description: "Header `<string>` belum di-include",
    fix(lines) {
      if (lines.some((l) => /#include\s*<string>/.test(l))) return null;

      const newLines = [...lines];
      let insertPos = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#include")) insertPos = i + 1;
      }
      newLines.splice(insertPos, 0, "#include <string>");

      return {
        newLines,
        changedIndices: [insertPos],
        explanation: "Menambahkan `#include <string>` agar tipe `std::string` dapat digunakan.",
      };
    },
  },

  {
    id: "cpp_missing_semicolon",
    language: "cpp",
    pattern: /expected\s*';'/i,
    description: "Titik koma `;` hilang di akhir pernyataan C++",
    fix(lines, errorInfo) {
      // Error biasanya dilaporkan pada baris BERIKUTNYA dari baris yang bermasalah
      const reportedLine = (errorInfo.lineNum || 1);
      const targetIdx = Math.max(0, reportedLine - 2); // satu baris sebelum baris error

      if (targetIdx >= lines.length) return null;

      const original = lines[targetIdx];
      const trimmed  = original.trimEnd();

      if (/[;{},]$/.test(trimmed) || trimmed.endsWith("*/") || trimmed === "") return null;

      const newLines = [...lines];
      newLines[targetIdx] = trimmed + ";";

      return {
        newLines,
        changedIndices: [targetIdx],
        explanation: `Menambahkan titik koma \`;\` yang hilang di baris ${targetIdx + 1}.`,
      };
    },
  },

  // ── Java ─────────────────────────────────────────────────────────────────────

  {
    id: "java_null_pointer",
    language: "java",
    pattern: /NullPointerException/i,
    description: "NullPointerException — bungkus pemanggilan dengan pengecekan null",
    fix(lines, errorInfo) {
      const targetIdx = Math.max(0, (errorInfo.lineNum || 1) - 1);
      if (targetIdx >= lines.length) return null;

      const original = lines[targetIdx];
      const indent   = original.match(/^(\s*)/)[1];

      // Heuristik: temukan ekspresi .method() pertama pada baris ini
      const methodCallMatch = original.match(/(\w+)\.(\w+)\(/);
      if (!methodCallMatch) return null;

      const objName = methodCallMatch[1];

      const newLines = [...lines];
      // Bungkus baris yang bersangkutan dalam null check
      newLines.splice(targetIdx, 1,
        `${indent}if (${objName} != null) {`,
        `${indent}    ${original.trim()}`,
        `${indent}} else {`,
        `${indent}    // TODO: tangani kasus ${objName} = null`,
        `${indent}}`
      );

      return {
        newLines,
        changedIndices: [targetIdx, targetIdx + 1, targetIdx + 2, targetIdx + 3, targetIdx + 4],
        explanation: `Membungkus pemanggilan pada \`${objName}\` dengan blok pengecekan \`if (${objName} != null)\` untuk mencegah NullPointerException.`,
      };
    },
  },
];

// ─── Fungsi parsing ulang dengan kolom ───────────────────────────────────────

/**
 * Mengekstrak info error dari teks log, termasuk nomor kolom bila ada.
 * Menggunakan ulang extractFileInfo() dari script.js dan menambahkan parsing kolom.
 * @param {string} logText
 * @returns {{ file: string|null, lineNum: number|null, col: number|null, message: string }}
 */
function cfExtractErrorInfo(logText) {
  // Ambil info file dan baris dari fungsi yang sudah ada di script.js
  const base = (typeof extractFileInfo === "function")
    ? extractFileInfo(logText)
    : null;

  let lineNum = base ? parseInt(base.line, 10) : null;
  let file    = base ? base.file : null;
  let col     = null;

  // Coba ekstrak kolom dari format tambahan: file.js:12:5
  const colMatch = logText.match(/[^\s:]+:\d+:(\d+)/);
  if (colMatch) col = parseInt(colMatch[1], 10);

  // Jika tidak ada info dari extractFileInfo, cari pola "line N" secara umum
  if (!lineNum) {
    const lineMatch = logText.match(/(?:line\s+|:)(\d+)/i);
    if (lineMatch) lineNum = parseInt(lineMatch[1], 10);
  }

  // Ambil pesan error utama (baris pertama non-kosong dari log)
  const message = logText.split(/\r?\n/).find((l) => l.trim()) || logText;

  return { file, lineNum, col, message };
}

/**
 * Mencari baris yang paling mungkin mengandung error berdasarkan nama variabel/simbol
 * yang disebut dalam pesan error (fallback bila tidak ada nomor baris).
 * @param {string[]} lines - Baris kode
 * @param {string} errorMessage - Pesan error
 * @returns {number|null} Indeks baris (0-based) atau null
 */
function cfGuessErrorLine(lines, errorMessage) {
  // Cari nama simbol yang disebut dalam pesan error
  const symbolMatch = errorMessage.match(/'([\w.]+)'|"([\w.]+)"/);
  if (!symbolMatch) return null;

  const symbol = (symbolMatch[1] || symbolMatch[2]).split(".")[0];
  if (!symbol || symbol.length < 2) return null;

  // Temukan baris yang menggunakan simbol tersebut
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(symbol)) return i;
  }
  return null;
}

// ─── Fungsi escape (local, tidak bergantung pada script.js saat inisialisasi) ─
/**
 * Escape HTML untuk mencegah XSS. Sama dengan escapeHtml() di script.js.
 * Didefinisikan lokal agar codeFixer.js mandiri.
 */
function cfEscape(str) {
  const m = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, (c) => m[c]);
}

// ─── Tampilan konteks kode ────────────────────────────────────────────────────

/**
 * Merender blok kode dengan nomor baris dan highlight baris error.
 * @param {string[]} lines       - Semua baris kode
 * @param {number}   errorLineIdx - Indeks baris error (0-based)
 * @param {number|null} col      - Nomor kolom (1-based) atau null
 * @returns {string} HTML string
 */
function cfRenderContext(lines, errorLineIdx, col) {
  const start = Math.max(0, errorLineIdx - CF_CONTEXT_LINES);
  const end   = Math.min(lines.length - 1, errorLineIdx + CF_CONTEXT_LINES);

  const rendered = [];
  for (let i = start; i <= end; i++) {
    const lineNum = i + 1;
    const isError = i === errorLineIdx;
    const lineContent = cfEscape(lines[i]);

    let colMarker = "";
    if (isError && col && col > 0) {
      // Penanda posisi kolom: baris ^ di bawah baris error
      const spaces = " ".repeat(Math.max(0, col - 1));
      colMarker = `\n<span class="cf-col-marker">${cfEscape(spaces)}^</span>`;
    }

    rendered.push(
      `<span class="cf-line${isError ? " cf-line-error" : ""}">` +
      `<span class="cf-line-num">${String(lineNum).padStart(4)}</span>` +
      `<span class="cf-line-code">${lineContent}</span>` +
      `${colMarker}</span>`
    );
  }

  return rendered.join("\n");
}

// ─── Diff renderer ────────────────────────────────────────────────────────────

/**
 * Membuat tampilan diff sederhana (removed/added) antara dua versi kode.
 * @param {string[]} oldLines
 * @param {string[]} newLines
 * @param {number[]} changedIndices - Indeks baris (0-based) yang berubah/ditambah
 * @returns {string} HTML string
 */
function cfRenderDiff(oldLines, newLines, changedIndices) {
  if (!changedIndices || changedIndices.length === 0) return "";

  const lines = [];
  const indexSet = new Set(changedIndices);

  // Tampilkan 2 baris konteks di sekitar setiap perubahan
  const toShow = new Set();
  for (const idx of changedIndices) {
    for (let d = -2; d <= 2; d++) {
      const i = idx + d;
      if (i >= 0 && i < Math.max(oldLines.length, newLines.length)) toShow.add(i);
    }
  }

  const sortedShow = [...toShow].sort((a, b) => a - b);
  let lastShown = -1;

  for (const i of sortedShow) {
    if (lastShown >= 0 && i > lastShown + 1) {
      lines.push(`<span class="cf-diff-sep">  ···</span>`);
    }
    lastShown = i;

    const isAdded   = indexSet.has(i) && i < newLines.length;
    const isRemoved = indexSet.has(i) && i < oldLines.length && oldLines[i] !== newLines[i];

    if (isRemoved && oldLines[i] !== undefined) {
      lines.push(
        `<span class="cf-diff-line cf-diff-removed">` +
        `<span class="cf-diff-sign">-</span>` +
        `<span class="cf-line-num">${String(i + 1).padStart(4)}</span>` +
        `<span>${cfEscape(oldLines[i])}</span></span>`
      );
    }
    if (isAdded && newLines[i] !== undefined) {
      lines.push(
        `<span class="cf-diff-line cf-diff-added">` +
        `<span class="cf-diff-sign">+</span>` +
        `<span class="cf-line-num">${String(i + 1).padStart(4)}</span>` +
        `<span>${cfEscape(newLines[i])}</span></span>`
      );
    }
    // Baris konteks (tidak berubah)
    if (!indexSet.has(i) && i < oldLines.length) {
      lines.push(
        `<span class="cf-diff-line cf-diff-ctx">` +
        `<span class="cf-diff-sign"> </span>` +
        `<span class="cf-line-num">${String(i + 1).padStart(4)}</span>` +
        `<span>${cfEscape(oldLines[i])}</span></span>`
      );
    }
  }

  return lines.join("\n");
}

// ─── Fungsi analisis utama ────────────────────────────────────────────────────

/**
 * Titik masuk utama: analisis kode + log, tampilkan konteks dan saran.
 */
function cfAnalyze() {
  const code    = cfCodeInput.value;
  const logText = cfLogInput.value.trim();
  const lang    = cfLangSelect.value;

  // Validasi input
  if (!code.trim()) {
    cfShowMessage("Mohon masukkan kode terlebih dahulu.", "warn");
    return;
  }
  if (!logText) {
    cfShowMessage("Mohon masukkan error log terlebih dahulu.", "warn");
    return;
  }

  const lines    = code.split(/\r?\n/);
  const errInfo  = cfExtractErrorInfo(logText);

  // Resolusi baris error
  let errorLineIdx = errInfo.lineNum !== null ? errInfo.lineNum - 1 : null;

  // Validasi indeks
  if (errorLineIdx !== null && (errorLineIdx < 0 || errorLineIdx >= lines.length)) {
    errorLineIdx = null;
  }

  // Fallback: cari lewat pola simbolik bila tidak ada nomor baris
  if (errorLineIdx === null) {
    const guessed = cfGuessErrorLine(lines, errInfo.message);
    errorLineIdx = guessed;
  }

  // ── Tampilkan konteks kode ─────────────────────────────────────────────────
  cfContextArea.parentElement.classList.remove("hidden");
  if (errorLineIdx !== null) {
    cfContextArea.innerHTML = cfRenderContext(lines, errorLineIdx, errInfo.col);
    const lineInfo = errInfo.lineNum
      ? `baris ${errInfo.lineNum}${errInfo.col ? `, kolom ${errInfo.col}` : ""}` +
        (errInfo.file ? ` di <code class="cf-filename">${cfEscape(errInfo.file)}</code>` : "")
      : "baris yang diperkirakan";
    document.getElementById("cf-context-label").innerHTML =
      `📍 Konteks kode — error ditemukan di ${lineInfo}`;
  } else {
    cfContextArea.innerHTML =
      `<span class="cf-line"><span class="cf-line-num">   ?</span>` +
      `<span class="cf-line-code cf-no-line-info">Nomor baris tidak tersedia dalam log ini.</span></span>`;
    document.getElementById("cf-context-label").textContent = "📍 Konteks kode";
  }

  // ── Cocokkan aturan perbaikan ──────────────────────────────────────────────
  const relevantRules = CF_FIX_RULES.filter(
    (r) => r.language === lang || r.language === "*"
  );
  const matched = relevantRules.filter((r) => r.pattern.test(logText));

  if (matched.length === 0) {
    // Tidak ada aturan cocok — tampilkan pesan jujur + tips umum
    cfRenderNoFix(logText);
    return;
  }

  // Jalankan semua aturan yang cocok dan kumpulkan hasil
  const suggestions = matched
    .map((rule) => {
      try {
        const result = rule.fix(lines, errInfo);
        if (!result) return null;
        return { rule, result };
      } catch {
        return null; // aturan gagal diterapkan, lewati
      }
    })
    .filter(Boolean);

  if (suggestions.length === 0) {
    cfRenderNoFix(logText);
    return;
  }

  cfRenderSuggestions(lines, suggestions, errInfo);
}

// ─── Render saran perbaikan ───────────────────────────────────────────────────

/**
 * Merender daftar saran perbaikan yang bisa dipilih pengguna.
 * @param {string[]} originalLines
 * @param {Array} suggestions
 * @param {Object} errInfo
 */
function cfRenderSuggestions(originalLines, suggestions, errInfo) {
  cfResultArea.classList.remove("hidden");

  // Simpan saran ke dataset untuk diakses tombol Terapkan
  window.cfCurrentSuggestions   = suggestions;
  window.cfOriginalLines        = originalLines;
  window.cfActiveSuggestionIdx  = 0;

  let html = `<div class="cf-suggestions-header">
    <span class="cf-badge cf-badge-green">✓ ${suggestions.length} saran perbaikan ditemukan</span>
  </div>`;

  if (suggestions.length > 1) {
    html += `<div class="cf-suggestion-tabs">`;
    suggestions.forEach((s, i) => {
      html += `<button class="cf-suggestion-tab${i === 0 ? " active" : ""}"
                       onclick="cfSelectSuggestion(${i})"
                       aria-label="Pilih saran ${i + 1}: ${cfEscape(s.rule.description)}">
                 Saran ${i + 1}: ${cfEscape(s.rule.description)}
               </button>`;
    });
    html += `</div>`;
  }

  html += `<div id="cf-suggestion-detail"></div>`;
  cfResultArea.innerHTML = html;

  // Tampilkan saran pertama
  cfSelectSuggestion(0);
}

/**
 * Menampilkan detail saran yang dipilih (diff + penjelasan + tombol aksi).
 * @param {number} idx
 */
function cfSelectSuggestion(idx) {
  const suggestions  = window.cfCurrentSuggestions;
  const originalLines = window.cfOriginalLines;
  if (!suggestions || idx >= suggestions.length) return;

  window.cfActiveSuggestionIdx = idx;

  // Update tab active state
  document.querySelectorAll(".cf-suggestion-tab").forEach((btn, i) => {
    btn.classList.toggle("active", i === idx);
  });

  const { rule, result } = suggestions[idx];
  const diffHtml = cfRenderDiff(originalLines, result.newLines, result.changedIndices);

  const detail = document.getElementById("cf-suggestion-detail");
  if (!detail) return;

  detail.innerHTML = `
    <div class="cf-explanation">
      <span class="cf-explanation-icon">💡</span>
      <span>${cfEscape(result.explanation)}</span>
    </div>
    <div class="cf-diff-block">
      <div class="cf-diff-header">
        <span>Perbandingan perubahan</span>
        <span class="cf-diff-legend">
          <span class="cf-legend-removed">− dihapus</span>
          <span class="cf-legend-added">+ ditambah</span>
        </span>
      </div>
      <pre class="cf-diff-pre" aria-label="Diff perubahan kode">${diffHtml}</pre>
    </div>
    <div class="cf-action-row">
      <button class="btn-primary" onclick="cfApply()" aria-label="Terapkan perbaikan ke textarea kode">
        ✅ Terapkan Perbaikan
      </button>
      <button class="btn-secondary" onclick="cfUndo()" id="cf-undo-btn"
              aria-label="Urungkan perbaikan terakhir">
        ↩ Urungkan
      </button>
      <button class="btn-secondary" onclick="cfCopyCode()" aria-label="Salin kode hasil perbaikan">
        📋 Salin Kode
      </button>
      <button class="btn-secondary" onclick="cfAskBuddy()" aria-label="Tanya Debug Buddy tentang error ini">
        🤖 Tanya Debug Buddy
      </button>
    </div>`;

  cfUpdateUndoBtn();
}

/**
 * Merender tampilan "tidak ada perbaikan otomatis" dengan tips debugging.
 * @param {string} logText
 */
function cfRenderNoFix(logText) {
  cfResultArea.classList.remove("hidden");

  // Ambil tips umum dari GENERAL_DEBUG_TIPS (rules.js) bila tersedia
  const tips = (typeof GENERAL_DEBUG_TIPS !== "undefined")
    ? GENERAL_DEBUG_TIPS.slice(0, 5).map((t, i) =>
        `<li class="result-step"><span class="step-num">${i + 1}</span><span>${cfEscape(t)}</span></li>`
      ).join("")
    : "";

  cfResultArea.innerHTML = `
    <div class="cf-no-fix">
      <div class="cf-badge cf-badge-orange">⚠ Perbaikan otomatis tidak tersedia</div>
      <p class="cf-no-fix-msg">
        Pola error ini belum memiliki aturan perbaikan otomatis. Konteks kode di atas tetap ditampilkan
        agar kamu bisa memeriksa baris yang dimaksud.
      </p>
      ${tips ? `<h4 class="lp-subsection-title mt-3">🛠️ Tips Debugging Umum</h4><ol class="steps-list">${tips}</ol>` : ""}
      <div class="cf-action-row mt-3">
        <button class="btn-secondary" onclick="cfAskBuddy()" aria-label="Tanya Debug Buddy tentang error ini">
          🤖 Tanya Debug Buddy
        </button>
      </div>
    </div>`;
}

// ─── Aksi tombol ─────────────────────────────────────────────────────────────

/**
 * Menerapkan saran perbaikan yang aktif ke textarea kode.
 */
function cfApply() {
  const suggestions = window.cfCurrentSuggestions;
  const idx         = window.cfActiveSuggestionIdx ?? 0;
  if (!suggestions || !suggestions[idx]) return;

  // Simpan snapshot sebelum perubahan ke undo stack
  cfPushUndo(cfCodeInput.value);

  // Terapkan perubahan
  const newCode = suggestions[idx].result.newLines.join("\n");
  cfCodeInput.value = newCode;
  cfUpdateLineNumbers();

  if (typeof showToast === "function") showToast("✅ Perbaikan diterapkan!");

  // Refresh tampilan setelah apply
  cfAnalyze();
}

/**
 * Urungkan satu langkah perubahan.
 */
function cfUndo() {
  if (cfUndoStack.length === 0) return;
  cfCodeInput.value = cfUndoStack.pop();
  cfUpdateLineNumbers();
  cfUpdateUndoBtn();
  if (typeof showToast === "function") showToast("↩ Perubahan diurungkan.");
}

/**
 * Menyimpan snapshot kode ke undo stack.
 * @param {string} code
 */
function cfPushUndo(code) {
  cfUndoStack.push(code);
  if (cfUndoStack.length > CF_MAX_UNDO) cfUndoStack.shift();
  cfUpdateUndoBtn();
}

/**
 * Memperbarui state disabled tombol Undo.
 */
function cfUpdateUndoBtn() {
  const btn = document.getElementById("cf-undo-btn");
  if (btn) btn.disabled = cfUndoStack.length === 0;
}

/**
 * Menyalin kode yang ada di textarea ke clipboard.
 */
function cfCopyCode() {
  const code = cfCodeInput.value;
  if (!code.trim()) return;

  navigator.clipboard.writeText(code).then(() => {
    if (typeof showToast === "function") showToast("📋 Kode berhasil disalin!");
  }).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = code;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    if (typeof showToast === "function") showToast("📋 Kode berhasil disalin!");
  });
}

/**
 * Membuka chatbot Debug Buddy dengan konteks error dan baris kode.
 * Menggunakan sendMessage() dan openChat() dari chatbot.js.
 */
function cfAskBuddy() {
  const logText = cfLogInput.value.trim();
  if (!logText) return;

  const errorLine = cfLogInput.value.split(/\r?\n/)[0];
  const message   = `Tolong jelaskan error ini dan cara memperbaikinya:\n${errorLine}`;

  if (typeof openChat === "function")   openChat();
  if (typeof sendMessage === "function") sendMessage(message);
}

/**
 * Mengisi textarea error log dari hasil analisis terakhir (window.lastAnalysis).
 */
function cfUseLastAnalysis() {
  const analysis = window.lastAnalysis;
  if (!analysis || !analysis.rawLog) {
    cfShowMessage("Belum ada analisis yang dijalankan. Analisis error log terlebih dahulu di tab utama.", "warn");
    return;
  }
  cfLogInput.value = analysis.rawLog;

  // Coba sesuaikan bahasa jika terdeteksi
  const detectedLang = (analysis.detectedLang || "").toLowerCase();
  const langMap = { javascript: "javascript", python: "python", java: "java", "c++": "cpp" };
  if (langMap[detectedLang]) cfLangSelect.value = langMap[detectedLang];

  if (typeof showToast === "function") showToast("Log dari analisis terakhir dimuat!");
}

/**
 * Menampilkan pesan sederhana di area hasil.
 * @param {string} msg
 * @param {'warn'|'info'} type
 */
function cfShowMessage(msg, type = "info") {
  cfResultArea.classList.remove("hidden");
  const cls = type === "warn" ? "cf-badge cf-badge-orange" : "cf-badge cf-badge-blue";
  cfResultArea.innerHTML = `<div class="${cls}">⚠ ${cfEscape(msg)}</div>`;
}

// ─── Nomor baris pada textarea kode ──────────────────────────────────────────

/**
 * Memperbarui tampilan nomor baris di samping textarea kode.
 */
function cfUpdateLineNumbers() {
  if (!cfCodeLineNums) return;
  const lines = cfCodeInput.value.split(/\r?\n/);
  cfCodeLineNums.textContent = lines.map((_, i) => i + 1).join("\n");
  // Sinkronkan scroll
  cfCodeLineNums.scrollTop = cfCodeInput.scrollTop;
}

// ─── Tab switching ─────────────────────────────────────────────────────────────

/**
 * Beralih ke tab yang dipilih.
 * @param {'analyzer'|'fixer'} tabId
 */
function cfSwitchTab(tabId) {
  const tabs    = document.querySelectorAll(".app-tab-btn");
  const panels  = document.querySelectorAll(".app-tab-panel");

  tabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
    btn.setAttribute("aria-selected", btn.dataset.tab === tabId ? "true" : "false");
  });

  panels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === tabId;
    panel.classList.toggle("hidden", !isActive);
    panel.setAttribute("aria-hidden", isActive ? "false" : "true");
  });
}

// ─── Muat contoh ─────────────────────────────────────────────────────────────

/**
 * Mengisi textarea kode dan log dengan contoh untuk bahasa yang dipilih.
 */
function cfLoadExample() {
  const lang    = cfLangSelect.value;
  const example = CF_EXAMPLES[lang];
  if (!example) return;

  cfPushUndo(cfCodeInput.value); // simpan state sebelumnya
  cfCodeInput.value = example.code;
  cfLogInput.value  = example.log;
  cfUpdateLineNumbers();
  if (typeof showToast === "function") showToast(`Contoh ${lang} dimuat!`);
}

// ─── Reset ───────────────────────────────────────────────────────────────────

/**
 * Membersihkan seluruh input dan hasil di Code Fixer.
 */
function cfClear() {
  cfCodeInput.value = "";
  cfLogInput.value  = "";
  cfResultArea.classList.add("hidden");
  cfContextArea.parentElement.classList.add("hidden");
  cfUndoStack = [];
  cfUpdateLineNumbers();
  if (typeof showToast === "function") showToast("Code Fixer dibersihkan.");
}

// ─── Event listeners ─────────────────────────────────────────────────────────
cfAnalyzeBtn.addEventListener("click", cfAnalyze);
cfClearBtn.addEventListener("click", cfClear);
cfUseLastBtn.addEventListener("click", cfUseLastAnalysis);

cfCodeInput.addEventListener("input", () => {
  cfUpdateLineNumbers();
  // Sembunyikan hasil lama saat kode berubah
  cfResultArea.classList.add("hidden");
});

// Sinkronkan scroll nomor baris dengan textarea
cfCodeInput.addEventListener("scroll", () => {
  if (cfCodeLineNums) cfCodeLineNums.scrollTop = cfCodeInput.scrollTop;
});

// Analisis dengan Ctrl+Enter di dalam textarea kode atau log
[cfCodeInput, cfLogInput].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      cfAnalyze();
    }
  });
});

// ─── Inisialisasi ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  cfUpdateLineNumbers();
  cfUpdateUndoBtn();
});
