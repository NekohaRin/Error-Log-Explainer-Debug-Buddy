/**
 * rules.js — Error Log Explainer
 * Mesin analisis berbasis aturan (rule-based engine).
 * Setiap aturan memiliki pola regex, metadata error, dan panduan perbaikan.
 */

// ─── Konstanta tingkat keparahan ────────────────────────────────────────────
const SEVERITY = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

// ─── Kumpulan aturan error ───────────────────────────────────────────────────
// Setiap aturan: { id, language, pattern, name, severity, explanation, causes[], steps[], codeExample }
const ERROR_RULES = [

  // ── JavaScript ──────────────────────────────────────────────────────────────
  {
    id: "js_type_error_undefined",
    language: "javascript",
    pattern: /TypeError.*Cannot\s+(read\s+propert(?:y|ies)\s+of\s+undefined|read\s+properties\s+of\s+null)/i,
    name: "TypeError: Cannot read properties of undefined/null",
    severity: SEVERITY.HIGH,
    explanation:
      "Kamu mencoba mengakses properti atau memanggil metode pada variabel yang bernilai `undefined` atau `null`. JavaScript tidak bisa melakukan ini karena tidak ada objek yang sebenarnya di sana.",
    causes: [
      "Variabel belum diinisialisasi sebelum digunakan.",
      "Fungsi mengembalikan `null` atau `undefined` dan hasilnya langsung diakses.",
      "Data dari API belum tiba saat komponen/kode pertama kali dijalankan.",
    ],
    steps: [
      "Periksa apakah variabel sudah diinisialisasi sebelum diakses.",
      "Gunakan optional chaining (`?.`) untuk akses yang aman.",
      "Tambahkan pengecekan `if (variable !== null && variable !== undefined)` sebelum mengakses properti.",
      "Pastikan data async sudah tersedia sebelum dirender.",
    ],
    codeExample: `// ❌ Bermasalah
const user = null;
console.log(user.name); // TypeError!

// ✅ Perbaikan dengan optional chaining
const user = null;
console.log(user?.name); // undefined, tidak error

// ✅ Perbaikan dengan pengecekan
if (user) {
  console.log(user.name);
}`,
  },

  {
    id: "js_reference_error",
    language: "javascript",
    pattern: /ReferenceError.*is not defined/i,
    name: "ReferenceError: Variable is not defined",
    severity: SEVERITY.HIGH,
    explanation:
      "Kamu menggunakan variabel atau fungsi yang belum pernah dideklarasikan. JavaScript tidak dapat menemukan nama tersebut di scope manapun.",
    causes: [
      "Typo pada nama variabel atau fungsi.",
      "Variabel dideklarasikan di dalam blok/fungsi lain (masalah scope).",
      "Lupa mengimpor modul atau file script yang diperlukan.",
      "Variabel `let`/`const` digunakan sebelum deklarasinya (Temporal Dead Zone).",
    ],
    steps: [
      "Periksa ejaan nama variabel — JavaScript bersifat case-sensitive.",
      "Pastikan variabel dideklarasikan di scope yang benar.",
      "Periksa urutan tag `<script>` di HTML atau pernyataan `import`.",
      "Pindahkan deklarasi variabel ke bagian atas scope yang sesuai.",
    ],
    codeExample: `// ❌ Bermasalah
console.log(userName); // ReferenceError!

// ✅ Perbaikan
const userName = "Budi";
console.log(userName);`,
  },

  {
    id: "js_syntax_error",
    language: "javascript",
    pattern: /SyntaxError.*(?:Unexpected token|Unexpected end of input|Invalid or unexpected token|missing \))/i,
    name: "SyntaxError: Unexpected Token",
    severity: SEVERITY.HIGH,
    explanation:
      "JavaScript menemukan karakter atau token yang tidak sesuai dengan aturan sintaksis bahasa. Kode tidak bisa dieksekusi sama sekali.",
    causes: [
      "Tanda kurung, kurung kurawal, atau kurung siku tidak berpasangan.",
      "Tanda koma atau titik koma di tempat yang salah.",
      "Penggunaan kata kunci reserved sebagai nama variabel.",
      "Salah menutup string (tanda kutip tidak cocok).",
    ],
    steps: [
      "Perhatikan baris yang ditunjuk oleh error message.",
      "Periksa keseimbangan tanda kurung `()`, `{}`, `[]`.",
      "Gunakan editor dengan syntax highlighting untuk menemukan masalah lebih cepat.",
      "Gunakan linter seperti ESLint untuk mendeteksi error secara otomatis.",
    ],
    codeExample: `// ❌ Bermasalah
function greet( {   // tanda kurung tidak lengkap
  return "Halo";
}

// ✅ Perbaikan
function greet() {
  return "Halo";
}`,
  },

  {
    id: "js_type_error_not_function",
    language: "javascript",
    pattern: /TypeError.*is not a function/i,
    name: "TypeError: X is not a function",
    severity: SEVERITY.HIGH,
    explanation:
      "Kamu mencoba memanggil sesuatu sebagai fungsi, padahal nilainya bukan fungsi (misalnya string, number, undefined, atau objek biasa).",
    causes: [
      "Nama fungsi salah eja atau belum didefinisikan.",
      "Variabel yang seharusnya fungsi ditimpa dengan nilai lain.",
      "Mencoba memanggil properti objek yang bukan fungsi.",
    ],
    steps: [
      "Pastikan yang dipanggil memang sebuah fungsi dengan `typeof myVar === 'function'`.",
      "Periksa apakah ada variabel dengan nama yang sama yang menimpa fungsi.",
      "Pastikan modul/library sudah diimpor dengan benar.",
    ],
    codeExample: `// ❌ Bermasalah
const result = "hello";
result(); // TypeError: result is not a function

// ✅ Perbaikan
const greet = () => "hello";
const result = greet(); // "hello"`,
  },

  {
    id: "js_uncaught_error",
    language: "javascript",
    pattern: /Uncaught\s+(TypeError|RangeError|EvalError)/i,
    name: "Uncaught Runtime Error",
    severity: SEVERITY.HIGH,
    explanation:
      "Terjadi error saat runtime yang tidak ditangkap oleh blok `try...catch` manapun, sehingga menghentikan eksekusi skrip.",
    causes: [
      "Tidak ada penanganan error (try-catch) di sekitar kode yang berpotensi gagal.",
      "Error terjadi di callback atau Promise yang tidak di-handle.",
    ],
    steps: [
      "Bungkus kode yang berisiko dengan `try { ... } catch (e) { ... }`.",
      "Untuk Promise, tambahkan `.catch()` atau gunakan `async/await` dengan try-catch.",
      "Tambahkan `window.onerror` atau `window.addEventListener('unhandledrejection', ...)` sebagai safety net.",
    ],
    codeExample: `// ✅ Perbaikan dengan try-catch
try {
  const data = JSON.parse(invalidJson);
} catch (error) {
  console.error("Gagal parse JSON:", error.message);
}

// ✅ Perbaikan untuk async
async function fetchData() {
  try {
    const res = await fetch('/api/data');
    return await res.json();
  } catch (error) {
    console.error("Fetch gagal:", error);
  }
}`,
  },

  // ── Python ──────────────────────────────────────────────────────────────────
  {
    id: "py_module_not_found",
    language: "python",
    pattern: /ModuleNotFoundError.*No module named/i,
    name: "ModuleNotFoundError: No module named",
    severity: SEVERITY.MEDIUM,
    explanation:
      "Python tidak bisa menemukan modul/library yang kamu coba impor. Modul tersebut belum terinstal atau nama importnya salah.",
    causes: [
      "Library belum diinstal di environment Python yang aktif.",
      "Virtual environment tidak aktif.",
      "Nama modul salah eja.",
      "Menggunakan Python versi berbeda dari yang diharapkan.",
    ],
    steps: [
      "Instal library dengan `pip install nama_modul`.",
      "Pastikan virtual environment sudah aktif (`source venv/bin/activate` atau `venv\\Scripts\\activate`).",
      "Periksa ejaan nama modul di dokumentasi resminya.",
      "Verifikasi versi Python yang digunakan dengan `python --version`.",
    ],
    codeExample: `# ❌ Bermasalah (library belum diinstal)
import pandas as pd

# ✅ Langkah perbaikan di terminal:
# pip install pandas

# Lalu kode berjalan normal:
import pandas as pd
df = pd.DataFrame({'nama': ['Budi', 'Ani']})`,
  },

  {
    id: "py_indentation_error",
    language: "python",
    pattern: /IndentationError.*(?:unexpected indent|expected an indented block)/i,
    name: "IndentationError: Indentasi Salah",
    severity: SEVERITY.HIGH,
    explanation:
      "Python menggunakan indentasi (spasi/tab di awal baris) untuk mendefinisikan blok kode. Kesalahan indentasi menyebabkan Python tidak bisa memahami struktur kode.",
    causes: [
      "Mencampur penggunaan tab dan spasi untuk indentasi.",
      "Jumlah spasi tidak konsisten dalam satu blok.",
      "Lupa menambahkan isi blok setelah `if`, `for`, `def`, `class`, dll.",
    ],
    steps: [
      "Gunakan hanya spasi (direkomendasikan 4 spasi) ATAU hanya tab, jangan campur keduanya.",
      "Aktifkan fitur 'show whitespace' di editor untuk melihat tab vs spasi.",
      "Gunakan `autopep8` atau `black` untuk memformat kode secara otomatis.",
      "Pastikan setiap blok kode memiliki setidaknya satu pernyataan.",
    ],
    codeExample: `# ❌ Bermasalah
def sapa():
    print("Halo") # 4 spasi
      print("Dunia") # 6 spasi — tidak konsisten!

# ✅ Perbaikan
def sapa():
    print("Halo")   # 4 spasi
    print("Dunia")  # 4 spasi — konsisten!`,
  },

  {
    id: "py_name_error",
    language: "python",
    pattern: /NameError.*name '.*' is not defined/i,
    name: "NameError: Name is not defined",
    severity: SEVERITY.HIGH,
    explanation:
      "Python tidak bisa menemukan variabel atau fungsi dengan nama tersebut. Ini biasanya karena typo atau variabel digunakan sebelum didefinisikan.",
    causes: [
      "Typo pada nama variabel.",
      "Variabel didefinisikan di dalam fungsi dan diakses dari luar (scope).",
      "Lupa mengimpor fungsi/kelas yang diperlukan.",
    ],
    steps: [
      "Periksa ejaan nama variabel secara teliti.",
      "Pastikan variabel didefinisikan sebelum digunakan.",
      "Tambahkan pernyataan `import` yang diperlukan.",
    ],
    codeExample: `# ❌ Bermasalah
print(nma)  # NameError — typo!

# ✅ Perbaikan
nama = "Budi"
print(nama)`,
  },

  {
    id: "py_type_error",
    language: "python",
    pattern: /TypeError.*(?:unsupported operand type|can only concatenate|takes \d+ positional argument)/i,
    name: "TypeError: Operasi Tipe Data Tidak Kompatibel",
    severity: SEVERITY.MEDIUM,
    explanation:
      "Kamu mencoba melakukan operasi pada tipe data yang tidak kompatibel, seperti menggabungkan string dengan integer tanpa konversi.",
    causes: [
      "Menjumlahkan atau menggabungkan tipe data yang berbeda.",
      "Memanggil fungsi dengan jumlah argumen yang salah.",
      "Menggunakan operator yang tidak didukung untuk tipe tersebut.",
    ],
    steps: [
      "Konversi tipe data sebelum melakukan operasi: `str()`, `int()`, `float()`.",
      "Periksa jumlah argumen yang diterima fungsi.",
      "Gunakan f-string untuk menggabungkan string dan angka.",
    ],
    codeExample: `# ❌ Bermasalah
umur = 25
pesan = "Umur saya: " + umur  # TypeError!

# ✅ Perbaikan
umur = 25
pesan = f"Umur saya: {umur}"  # menggunakan f-string
# atau
pesan = "Umur saya: " + str(umur)`,
  },

  {
    id: "py_index_error",
    language: "python",
    pattern: /IndexError.*list index out of range/i,
    name: "IndexError: List Index Out of Range",
    severity: SEVERITY.MEDIUM,
    explanation:
      "Kamu mencoba mengakses elemen list menggunakan indeks yang tidak ada. Misalnya list hanya punya 3 elemen (indeks 0-2), tetapi kamu mengakses indeks ke-5.",
    causes: [
      "Indeks yang digunakan melebihi panjang list.",
      "List kosong dan kamu mencoba mengakses elemennya.",
      "Kesalahan dalam logika perulangan (loop off-by-one).",
    ],
    steps: [
      "Selalu periksa panjang list dengan `len()` sebelum mengakses dengan indeks.",
      "Gunakan `.get()` untuk dictionary, atau cek `if index < len(list)` untuk list.",
      "Gunakan iterasi langsung `for item in list` daripada indeks bila memungkinkan.",
    ],
    codeExample: `# ❌ Bermasalah
buah = ["apel", "mangga"]
print(buah[5])  # IndexError!

# ✅ Perbaikan
buah = ["apel", "mangga"]
if len(buah) > 5:
    print(buah[5])
else:
    print("Indeks tidak ada dalam list")`,
  },

  // ── Java ─────────────────────────────────────────────────────────────────────
  {
    id: "java_null_pointer",
    language: "java",
    pattern: /NullPointerException/i,
    name: "NullPointerException (NPE)",
    severity: SEVERITY.HIGH,
    explanation:
      "Program Java mencoba menggunakan objek yang bernilai `null` — seperti memanggil metode atau mengakses field pada referensi yang tidak menunjuk ke objek manapun.",
    causes: [
      "Variabel objek tidak pernah diinisialisasi (masih `null`).",
      "Metode mengembalikan `null` dan hasilnya langsung digunakan.",
      "Elemen array tidak diinisialisasi.",
    ],
    steps: [
      "Tambahkan pengecekan null sebelum menggunakan objek: `if (obj != null)`.",
      "Gunakan `Optional<T>` (Java 8+) untuk nilai yang mungkin null.",
      "Gunakan anotasi `@NonNull` atau `@Nullable` untuk dokumentasi yang lebih jelas.",
      "Inisialisasi objek dengan nilai default daripada membiarkannya null.",
    ],
    codeExample: `// ❌ Bermasalah
String nama = null;
System.out.println(nama.length()); // NullPointerException!

// ✅ Perbaikan dengan pengecekan null
if (nama != null) {
    System.out.println(nama.length());
}

// ✅ Perbaikan dengan Optional (Java 8+)
Optional<String> optNama = Optional.ofNullable(nama);
optNama.ifPresent(n -> System.out.println(n.length()));`,
  },

  {
    id: "java_class_not_found",
    language: "java",
    pattern: /ClassNotFoundException|NoClassDefFoundError/i,
    name: "ClassNotFoundException / NoClassDefFoundError",
    severity: SEVERITY.HIGH,
    explanation:
      "JVM tidak bisa menemukan kelas yang diperlukan saat runtime. Ini biasanya masalah konfigurasi classpath atau dependency yang hilang.",
    causes: [
      "File JAR dependency tidak ada di classpath.",
      "Nama kelas salah eja atau package-nya berbeda.",
      "Dependency tidak dikonfigurasi di build tool (Maven/Gradle).",
    ],
    steps: [
      "Periksa konfigurasi `pom.xml` (Maven) atau `build.gradle` (Gradle) dan tambahkan dependency yang hilang.",
      "Jalankan `mvn clean install` atau `gradle build` ulang.",
      "Pastikan nama kelas dan package sudah benar.",
    ],
    codeExample: `// Di pom.xml (Maven), tambahkan dependency:
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-lang3</artifactId>
    <version>3.12.0</version>
</dependency>`,
  },

  {
    id: "java_array_index_out_of_bounds",
    language: "java",
    pattern: /ArrayIndexOutOfBoundsException/i,
    name: "ArrayIndexOutOfBoundsException",
    severity: SEVERITY.MEDIUM,
    explanation:
      "Program mencoba mengakses elemen array pada indeks yang tidak valid — indeks negatif atau melebihi ukuran array.",
    causes: [
      "Indeks melebihi panjang array (ingat: indeks dimulai dari 0).",
      "Kesalahan logika dalam loop (kondisi `<=` seharusnya `<`).",
    ],
    steps: [
      "Pastikan kondisi loop menggunakan `< array.length`, bukan `<= array.length`.",
      "Periksa nilai indeks sebelum mengakses array.",
      "Pertimbangkan menggunakan `ArrayList` yang lebih fleksibel.",
    ],
    codeExample: `// ❌ Bermasalah
int[] angka = {1, 2, 3};
System.out.println(angka[3]); // Error! indeks max = 2

// ✅ Perbaikan
int[] angka = {1, 2, 3};
for (int i = 0; i < angka.length; i++) {
    System.out.println(angka[i]);
}`,
  },

  // ── SQL ──────────────────────────────────────────────────────────────────────
  {
    id: "sql_syntax_error",
    language: "sql",
    pattern: /(?:SQL syntax|syntax error|near ".*".*syntax|You have an error in your SQL syntax)/i,
    name: "SQL Syntax Error",
    severity: SEVERITY.HIGH,
    explanation:
      "Query SQL yang kamu tulis mengandung kesalahan sintaksis. Database engine tidak bisa memahami perintah tersebut.",
    causes: [
      "Kata kunci SQL salah eja (misal `SELCT` bukan `SELECT`).",
      "Tanda koma atau tanda kutip tidak lengkap.",
      "Urutan klausa SQL salah (misal `WHERE` sebelum `FROM`).",
      "Nama kolom/tabel menggunakan kata kunci reserved tanpa escape.",
    ],
    steps: [
      "Periksa ejaan semua kata kunci SQL.",
      "Pastikan urutan klausa benar: `SELECT ... FROM ... WHERE ... GROUP BY ... ORDER BY ... LIMIT`.",
      "Gunakan backtick (MySQL) atau tanda kutip ganda (PostgreSQL) untuk nama kolom yang berupa kata kunci.",
      "Uji query di SQL client (phpMyAdmin, DBeaver) untuk feedback lebih cepat.",
    ],
    codeExample: `-- ❌ Bermasalah
SELCT name, age FORM users WERE age > 18;

-- ✅ Perbaikan
SELECT name, age FROM users WHERE age > 18;

-- Untuk nama kolom yang berupa kata kunci reserved:
SELECT \`order\`, \`select\` FROM my_table;`,
  },

  {
    id: "sql_table_not_found",
    language: "sql",
    pattern: /(?:Table '.*' doesn't exist|relation ".*" does not exist|no such table)/i,
    name: "SQL Table Not Found",
    severity: SEVERITY.MEDIUM,
    explanation:
      "Query mencoba mengakses tabel yang tidak ada di database. Mungkin nama tabel salah atau tabel belum dibuat.",
    causes: [
      "Nama tabel salah eja atau menggunakan kapitalisasi yang berbeda.",
      "Tabel ada di database/schema yang berbeda.",
      "Tabel belum dibuat (migrasi belum dijalankan).",
    ],
    steps: [
      "Periksa nama tabel dengan `SHOW TABLES;` (MySQL) atau `\\dt` (PostgreSQL).",
      "Pastikan kamu terhubung ke database yang benar.",
      "Jalankan file migrasi database jika perlu.",
    ],
    codeExample: `-- Cek tabel yang tersedia (MySQL)
SHOW TABLES;

-- Cek tabel yang tersedia (PostgreSQL)
\\dt

-- Pastikan nama tabel sudah benar:
SELECT * FROM users;  -- bukan 'Users' atau 'user'`,
  },

  // ── HTTP / Network ───────────────────────────────────────────────────────────
  {
    id: "http_404",
    language: "http",
    pattern: /(?:404\s*(?:Not Found)?|HTTP\s*404)/i,
    name: "HTTP 404: Not Found",
    severity: SEVERITY.MEDIUM,
    explanation:
      "Server tidak dapat menemukan resource yang diminta di URL tersebut. Resource mungkin telah dipindah, dihapus, atau URL-nya salah.",
    causes: [
      "URL endpoint salah atau ada typo.",
      "Resource telah dihapus atau dipindah.",
      "Konfigurasi routing server tidak tepat.",
      "File statis (gambar, CSS, JS) tidak ada di path yang ditentukan.",
    ],
    steps: [
      "Periksa URL dengan teliti — perhatikan typo, huruf kapital, dan trailing slash.",
      "Cek dokumentasi API untuk memastikan endpoint yang benar.",
      "Konfirmasi resource masih ada di server.",
      "Periksa konfigurasi routing di web server (Nginx/Apache) atau framework.",
    ],
    codeExample: `// Contoh penanganan 404 di JavaScript (fetch)
const response = await fetch('/api/users/123');

if (response.status === 404) {
  console.error('User tidak ditemukan');
  // Tampilkan pesan yang ramah ke pengguna
} else if (response.ok) {
  const data = await response.json();
}`,
  },

  {
    id: "http_500",
    language: "http",
    pattern: /(?:500\s*(?:Internal Server Error)?|HTTP\s*500)/i,
    name: "HTTP 500: Internal Server Error",
    severity: SEVERITY.HIGH,
    explanation:
      "Server mengalami kondisi tak terduga yang mencegahnya memenuhi permintaan. Ini adalah error di sisi server, bukan kesalahan request.",
    causes: [
      "Bug atau exception yang tidak tertangani di kode server.",
      "Kesalahan konfigurasi server (file .env, koneksi database).",
      "Server kehabisan memori atau resource.",
      "Dependency server yang crash atau tidak tersedia.",
    ],
    steps: [
      "Periksa log server (error.log, application.log) untuk detail lengkap.",
      "Pastikan semua variabel environment (`.env`) sudah dikonfigurasi.",
      "Cek koneksi database dan status service pendukung.",
      "Reproduksi error di environment development untuk debugging lebih mudah.",
    ],
    codeExample: `// Penanganan di sisi client
try {
  const response = await fetch('/api/data');
  if (response.status === 500) {
    throw new Error('Server error, silakan coba lagi.');
  }
  return await response.json();
} catch (error) {
  // Tampilkan pesan error yang user-friendly
  showErrorMessage('Terjadi kesalahan server. Tim kami sedang memperbaikinya.');
}`,
  },

  {
    id: "cors_error",
    language: "http",
    pattern: /(?:CORS|Cross-Origin|has been blocked by CORS policy|Access-Control-Allow-Origin)/i,
    name: "CORS Error: Cross-Origin Request Blocked",
    severity: SEVERITY.HIGH,
    explanation:
      "Browser memblokir request karena kebijakan CORS (Cross-Origin Resource Sharing). Request dari satu origin (domain/port) ke origin lain diblokir karena server tidak mengizinkannya.",
    causes: [
      "Server tidak mengirimkan header `Access-Control-Allow-Origin`.",
      "Origin client tidak termasuk dalam daftar yang diizinkan server.",
      "Request menggunakan metode atau header yang tidak diizinkan.",
      "Konfigurasi CORS backend belum diatur.",
    ],
    steps: [
      "Di server, tambahkan header `Access-Control-Allow-Origin: *` (development) atau origin spesifik (production).",
      "Untuk Express.js: instal dan gunakan package `cors` (`npm install cors`).",
      "Untuk development, gunakan proxy di konfigurasi bundler (Vite/webpack).",
      "Jangan pernah menggunakan ekstensi browser untuk bypass CORS di production.",
    ],
    codeExample: `// ✅ Perbaikan di Express.js server
const cors = require('cors');

// Izinkan semua origin (hanya untuk development!)
app.use(cors());

// Untuk production — izinkan origin spesifik:
app.use(cors({
  origin: 'https://app-saya.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));`,
  },

  {
    id: "econnrefused",
    language: "http",
    pattern: /ECONNREFUSED|connect ECONNREFUSED|Connection refused/i,
    name: "ECONNREFUSED: Connection Refused",
    severity: SEVERITY.HIGH,
    explanation:
      "Koneksi ke server/service ditolak secara aktif. Artinya tidak ada service yang mendengarkan (listening) pada port yang dituju.",
    causes: [
      "Server atau service (database, API) belum dijalankan.",
      "Service berjalan di port yang berbeda dari yang dikonfigurasi.",
      "Firewall memblokir koneksi ke port tersebut.",
      "Variabel environment (host/port) salah konfigurasi.",
    ],
    steps: [
      "Pastikan service yang dituju sudah berjalan (database, server API, dll.).",
      "Verifikasi host dan port di file konfigurasi (`.env`) sudah benar.",
      "Cek firewall tidak memblokir port yang diperlukan.",
      "Gunakan `netstat -an | grep PORT` untuk melihat apakah ada service yang listen di port tersebut.",
    ],
    codeExample: `// Pastikan konfigurasi di .env sudah benar:
// DB_HOST=localhost
// DB_PORT=5432

// Di Node.js, tangani error koneksi:
const pool = new Pool({ /* config */ });
pool.connect((err) => {
  if (err) {
    console.error('Gagal koneksi ke database:', err.message);
    // Cek apakah DB server sudah berjalan!
  }
});`,
  },

  {
    id: "enotfound",
    language: "http",
    pattern: /ENOTFOUND|getaddrinfo ENOTFOUND|DNS lookup failed/i,
    name: "ENOTFOUND: DNS Lookup Failed",
    severity: SEVERITY.MEDIUM,
    explanation:
      "Sistem tidak bisa menemukan alamat IP untuk nama domain yang diberikan. Ini adalah masalah resolusi DNS.",
    causes: [
      "Nama domain salah eja.",
      "Tidak ada koneksi internet.",
      "Server DNS tidak merespons.",
      "Domain tidak ada atau sudah expired.",
    ],
    steps: [
      "Periksa ejaan URL/domain — pastikan tidak ada typo.",
      "Cek koneksi internet.",
      "Coba `ping namadomain.com` di terminal untuk menguji resolusi DNS.",
      "Verifikasi variabel environment URL sudah benar.",
    ],
    codeExample: `// Cek variabel environment
console.log(process.env.API_URL); // Pastikan URL benar!

// Penanganan error koneksi
fetch(process.env.API_URL + '/data')
  .then(res => res.json())
  .catch(err => {
    if (err.code === 'ENOTFOUND') {
      console.error('URL tidak dapat ditemukan. Cek koneksi internet dan URL.');
    }
  });`,
  },

  {
    id: "js_promise_rejection",
    language: "javascript",
    pattern: /UnhandledPromiseRejection|UnhandledPromiseRejectionWarning/i,
    name: "UnhandledPromiseRejection",
    severity: SEVERITY.HIGH,
    explanation:
      "Sebuah Promise di-reject tetapi tidak ada handler `.catch()` atau blok `catch` pada `async/await` yang menanganinya. Di Node.js versi baru, ini bisa menghentikan proses.",
    causes: [
      "Lupa menambahkan `.catch()` setelah promise chain.",
      "Menggunakan `async/await` tanpa `try/catch`.",
      "Error terjadi di dalam callback async yang tidak di-wrap.",
    ],
    steps: [
      "Selalu tambahkan `.catch()` di akhir promise chain.",
      "Gunakan `try/catch` di sekitar semua `await`.",
      "Tambahkan global handler: `process.on('unhandledRejection', ...)`.",
    ],
    codeExample: `// ❌ Bermasalah
fetch('/api/data').then(res => res.json()); // tidak ada .catch()!

// ✅ Perbaikan
fetch('/api/data')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error('Fetch error:', err));

// ✅ Dengan async/await
async function getData() {
  try {
    const res = await fetch('/api/data');
    return await res.json();
  } catch (err) {
    console.error('Error:', err);
  }
}`,
  },
];

// ─── Aturan error C++ ────────────────────────────────────────────────────────
// Ditambahkan sebagai array terpisah lalu digabungkan agar mudah dipelihara.
const CPP_ERROR_RULES = [

  // ── Compile errors ──────────────────────────────────────────────────────────
  {
    id: "cpp_not_declared",
    language: "cpp",
    pattern: /was not declared in this scope/i,
    name: "Compile Error: was not declared in this scope",
    severity: SEVERITY.HIGH,
    explanation:
      "Kompiler g++/clang tidak dapat menemukan variabel, fungsi, atau kelas yang kamu gunakan. Nama tersebut tidak ada di scope (lingkup) saat ini.",
    causes: [
      "Variabel atau fungsi belum dideklarasikan sebelum digunakan.",
      "File header yang diperlukan belum di-`#include`.",
      "Typo pada nama variabel atau fungsi (C++ bersifat case-sensitive).",
      "Variabel dideklarasikan di dalam blok `{}` yang berbeda.",
    ],
    steps: [
      "Periksa ejaan nama variabel/fungsi dengan teliti.",
      "Pastikan `#include` untuk header yang diperlukan sudah ada di bagian atas file.",
      "Pindahkan deklarasi variabel ke scope yang tepat, atau gunakan deklarasi forward (`forward declaration`).",
      "Periksa apakah nama ada di namespace tertentu dan gunakan prefix `namespace::` atau `using namespace`.",
    ],
    codeExample: `// ❌ Bermasalah
int main() {
    cout << "Halo";  // error: 'cout' was not declared in this scope
    return 0;
}

// ✅ Perbaikan
#include <iostream>
using namespace std;

int main() {
    cout << "Halo";  // sekarang bekerja
    return 0;
}`,
  },

  {
    id: "cpp_expected_semicolon",
    language: "cpp",
    pattern: /expected\s*[';,)\]}'"].*before/i,
    name: "Compile Error: expected ';' before …",
    severity: SEVERITY.HIGH,
    explanation:
      "Kompiler menemukan token yang tidak terduga karena kamu lupa menulis karakter sintaksis yang wajib ada — paling sering titik koma (`;`) di akhir pernyataan.",
    causes: [
      "Lupa titik koma `;` di akhir pernyataan atau deklarasi.",
      "Tanda kurung atau kurung kurawal tidak berpasangan.",
      "Lupa tanda koma di antara parameter fungsi.",
    ],
    steps: [
      "Perhatikan baris tepat DI ATAS baris yang ditunjuk error — biasanya titik koma yang hilang ada di sana.",
      "Periksa keseimbangan `()`, `{}`, `[]` menggunakan fitur highlight-matching di editor.",
      "Aktifkan linter C++ (clang-tidy) agar error seperti ini terdeteksi lebih awal.",
    ],
    codeExample: `// ❌ Bermasalah
int x = 10   // error: expected ';' before 'int'
int y = 20;

// ✅ Perbaikan
int x = 10;  // titik koma ditambahkan
int y = 20;`,
  },

  {
    id: "cpp_no_matching_function",
    language: "cpp",
    pattern: /no matching function for call to/i,
    name: "Compile Error: no matching function for call to",
    severity: SEVERITY.HIGH,
    explanation:
      "Kamu memanggil fungsi dengan argumen yang tidak cocok dengan deklarasi fungsi manapun yang ada — jumlah argumen salah, tipe data tidak sesuai, atau fungsi tersebut memang tidak ada.",
    causes: [
      "Tipe argumen yang dikirim tidak sesuai dengan parameter fungsi.",
      "Jumlah argumen terlalu banyak atau terlalu sedikit.",
      "Fungsi yang dimaksud belum dideklarasikan atau ada di namespace yang berbeda.",
    ],
    steps: [
      "Cocokkan tipe dan jumlah argumen yang kamu kirim dengan deklarasi fungsi.",
      "Tambahkan konversi tipe eksplisit bila diperlukan: `static_cast<TipeTarget>(nilai)`.",
      "Periksa dokumentasi atau deklarasi fungsi untuk melihat signature yang benar.",
    ],
    codeExample: `// ❌ Bermasalah
void cetak(int angka) { cout << angka; }

int main() {
    cetak("teks");  // error: no matching function — string ≠ int
}

// ✅ Perbaikan: gunakan tipe yang sesuai
void cetak(int angka) { cout << angka; }
void cetak(const string& teks) { cout << teks; }  // overload

int main() {
    cetak(42);       // memanggil cetak(int)
    cetak("teks");   // memanggil cetak(const string&)
}`,
  },

  {
    id: "cpp_invalid_conversion",
    language: "cpp",
    pattern: /invalid conversion from/i,
    name: "Compile Error: invalid conversion from",
    severity: SEVERITY.MEDIUM,
    explanation:
      "Kamu mencoba mengonversi satu tipe data ke tipe lain secara implisit, tetapi C++ tidak mengizinkannya karena konversi tersebut tidak aman atau tidak valid.",
    causes: [
      "Mengisi pointer dengan nilai integer langsung (misal `int* p = 0` bukan `nullptr`).",
      "Mengonversi `const` ke non-`const` secara langsung.",
      "Konversi implisit antar tipe pointer yang tidak kompatibel.",
    ],
    steps: [
      "Gunakan `static_cast<TipeTarget>(nilai)` untuk konversi yang disengaja.",
      "Gunakan `nullptr` (bukan `0` atau `NULL`) untuk pointer null.",
      "Hindari konversi yang membuang `const` — gunakan `const_cast` hanya jika benar-benar perlu.",
    ],
    codeExample: `// ❌ Bermasalah
int nilai = 65;
char* ptr = nilai;  // invalid conversion from 'int' to 'char*'

// ✅ Perbaikan: gunakan cast yang tepat
int nilai = 65;
char c = static_cast<char>(nilai);  // konversi eksplisit ke char`,
  },

  {
    id: "cpp_redefinition",
    language: "cpp",
    pattern: /redefinition of/i,
    name: "Compile Error: redefinition of …",
    severity: SEVERITY.HIGH,
    explanation:
      "Kamu mendefinisikan variabel, fungsi, atau kelas yang sudah pernah didefinisikan sebelumnya dalam scope yang sama. C++ tidak mengizinkan duplikasi definisi.",
    causes: [
      "Header file di-`#include` lebih dari satu kali tanpa include guard.",
      "Fungsi atau variabel didefinisikan di file `.h` yang di-include di beberapa `.cpp`.",
      "Copy-paste kode menyebabkan duplikasi definisi.",
    ],
    steps: [
      "Tambahkan include guard di setiap file header: `#pragma once` atau `#ifndef MY_HEADER_H / #define MY_HEADER_H / #endif`.",
      "Pindahkan definisi fungsi dari `.h` ke `.cpp`, dan biarkan hanya deklarasi di `.h`.",
      "Periksa apakah ada dua file yang sama-sama mendefinisikan simbol yang sama.",
    ],
    codeExample: `// ❌ Bermasalah — header.h tanpa guard:
// int counter = 0;  // diinclude di dua .cpp → redefinition!

// ✅ Perbaikan dengan #pragma once
// header.h
#pragma once
extern int counter;  // hanya deklarasi

// main.cpp
#include "header.h"
int counter = 0;  // definisi hanya di satu tempat`,
  },

  {
    id: "cpp_does_not_name_type",
    language: "cpp",
    pattern: /does not name a type/i,
    name: "Compile Error: does not name a type",
    severity: SEVERITY.HIGH,
    explanation:
      "Kompiler menemukan identifier yang digunakan sebagai tipe data, tetapi identifier tersebut tidak dikenal sebagai tipe yang valid. Biasanya karena header yang diperlukan belum di-include atau urutan deklarasi salah.",
    causes: [
      "Kelas atau struct digunakan sebelum dideklarasikan.",
      "Header yang mendefinisikan tipe tersebut belum di-`#include`.",
      "Typo pada nama tipe.",
    ],
    steps: [
      "Tambahkan `#include` untuk header yang mendefinisikan tipe tersebut.",
      "Gunakan forward declaration: `class NamaKelas;` sebelum menggunakannya.",
      "Pastikan urutan definisi kelas sudah benar (kelas yang dipakai harus dideklarasikan lebih dulu).",
    ],
    codeExample: `// ❌ Bermasalah
class Mobil {
    Mesin* m;  // error: 'Mesin' does not name a type
};

// ✅ Perbaikan dengan forward declaration
class Mesin;  // forward declaration

class Mobil {
    Mesin* m;  // sekarang kompiler mengenali Mesin
};`,
  },

  // ── Linker errors ────────────────────────────────────────────────────────────
  {
    id: "cpp_undefined_reference",
    language: "cpp",
    pattern: /undefined reference to/i,
    name: "Linker Error: undefined reference to",
    severity: SEVERITY.HIGH,
    explanation:
      "Linker tidak dapat menemukan implementasi (definisi) dari fungsi atau variabel yang sudah dideklarasikan. Kode berhasil dikompilasi, tetapi gagal saat penggabungan (linking).",
    causes: [
      "Fungsi dideklarasikan di header tetapi tidak pernah diimplementasikan di file `.cpp`.",
      "File `.cpp` yang berisi implementasi tidak ikut dikompilasi.",
      "Library eksternal belum ditautkan dengan flag `-l` (misal `-lm` untuk math).",
    ],
    steps: [
      "Pastikan semua file `.cpp` ikut dikompilasi: `g++ main.cpp utils.cpp -o program`.",
      "Tambahkan flag library yang diperlukan: `g++ main.cpp -lm` (math), `-lpthread` (thread), dll.",
      "Pastikan implementasi fungsi sudah ada dan nama-nya persis sama dengan deklarasi (termasuk namespace).",
    ],
    codeExample: `// ❌ Bermasalah — fungsi dideklarasikan tapi tidak didefinisikan
// utils.h
int tambah(int a, int b);

// main.cpp — lupa definisi di utils.cpp!
#include "utils.h"
int main() { return tambah(1, 2); }  // linker error!

// ✅ Perbaikan — tambahkan definisi di utils.cpp
// utils.cpp
#include "utils.h"
int tambah(int a, int b) { return a + b; }

// Kompilasi: g++ main.cpp utils.cpp -o program`,
  },

  {
    id: "cpp_multiple_definition",
    language: "cpp",
    pattern: /multiple definition of/i,
    name: "Linker Error: multiple definition of",
    severity: SEVERITY.HIGH,
    explanation:
      "Linker menemukan lebih dari satu definisi untuk simbol yang sama (fungsi atau variabel global). Linker tidak tahu mana yang harus dipakai.",
    causes: [
      "Definisi fungsi ada di file `.h` yang di-include di lebih dari satu `.cpp`.",
      "Variabel global didefinisikan (bukan hanya dideklarasikan) di header.",
    ],
    steps: [
      "Pindahkan definisi fungsi ke file `.cpp`, simpan hanya deklarasi di `.h`.",
      "Untuk variabel global, gunakan `extern` di header dan definisikan satu kali di `.cpp`.",
      "Untuk fungsi helper kecil di header, tandai dengan `inline`.",
    ],
    codeExample: `// ❌ Bermasalah — definisi di header:
// helper.h
void cetak() { cout << "halo"; }  // didefinisikan di .h!

// ✅ Perbaikan — hanya deklarasi di header:
// helper.h
void cetak();  // deklarasi saja

// helper.cpp
void cetak() { cout << "halo"; }  // definisi di .cpp`,
  },

  // ── Missing header ───────────────────────────────────────────────────────────
  {
    id: "cpp_no_such_file",
    language: "cpp",
    pattern: /fatal error:.*No such file or directory/i,
    name: "Fatal Error: No such file or directory (Header tidak ditemukan)",
    severity: SEVERITY.HIGH,
    explanation:
      "Kompiler tidak dapat menemukan file header yang kamu coba `#include`. Program tidak bisa dikompilasi sama sekali.",
    causes: [
      "Nama file header salah eja.",
      "Library pihak ketiga belum terinstal di sistem.",
      "Path ke direktori header tidak dikonfigurasi ke kompiler.",
    ],
    steps: [
      "Periksa ejaan nama file header — perhatikan huruf kapital (case-sensitive di Linux).",
      "Instal library yang diperlukan: `sudo apt install libXXX-dev` (Linux) atau via vcpkg/conan (Windows).",
      "Tambahkan path include ke kompiler: `g++ -I/path/ke/header main.cpp`.",
      "Untuk header standar C++, pastikan flag `--std=c++17` (atau versi lain) sudah dipakai.",
    ],
    codeExample: `// ❌ Bermasalah
#include <boost/algorithm/string.hpp>  // fatal error: file not found

// ✅ Langkah perbaikan:
// 1. Install Boost: sudo apt install libboost-all-dev
// 2. Kompilasi dengan flag:
//    g++ main.cpp -I/usr/include/boost -lboost_system -o program

// Atau untuk header lokal:
// #include "utils.h"  — pastikan utils.h ada di direktori yang sama`,
  },

  // ── Runtime errors ───────────────────────────────────────────────────────────
  {
    id: "cpp_segfault",
    language: "cpp",
    pattern: /Segmentation fault|SIGSEGV|segfault/i,
    name: "Runtime Error: Segmentation Fault (SIGSEGV)",
    severity: SEVERITY.HIGH,
    explanation:
      "Program mencoba mengakses area memori yang tidak diizinkan — misalnya membaca/menulis ke pointer null, pointer yang sudah dibebaskan, atau di luar batas array. OS langsung menghentikan program.",
    causes: [
      "Dereferencing pointer null atau pointer yang tidak diinisialisasi.",
      "Mengakses array di luar batas (buffer overflow).",
      "Menggunakan pointer ke memori yang sudah di-`delete`/`free` (dangling pointer).",
      "Stack overflow akibat rekursi tanpa base case.",
    ],
    steps: [
      "Jalankan program dengan Valgrind: `valgrind --leak-check=full ./program` untuk melacak akses memori ilegal.",
      "Kompilasi dengan AddressSanitizer: `g++ -fsanitize=address -g main.cpp -o program`.",
      "Selalu inisialisasi pointer: `int* p = nullptr;` dan cek sebelum dereference: `if (p != nullptr)`.",
      "Periksa batas array — gunakan `std::vector` dengan `.at()` (melempar exception) daripada akses raw `[]`.",
    ],
    codeExample: `// ❌ Bermasalah
int* p = nullptr;
*p = 42;  // Segmentation fault!

int arr[5] = {1,2,3,4,5};
arr[10] = 0;  // Segmentation fault — out of bounds!

// ✅ Perbaikan
int nilai = 42;
int* p = &nilai;  // pointer ke variabel yang valid
*p = 99;          // aman

// Gunakan vector dengan bounds checking:
#include <vector>
vector<int> v = {1,2,3,4,5};
// v.at(10) = 0;  // melempar std::out_of_range, bukan crash diam-diam`,
  },

  {
    id: "cpp_bad_alloc",
    language: "cpp",
    pattern: /terminate called after throwing an instance of 'std::bad_alloc'|std::bad_alloc/i,
    name: "Runtime Error: std::bad_alloc (Alokasi Memori Gagal)",
    severity: SEVERITY.HIGH,
    explanation:
      "Operator `new` gagal mengalokasikan memori karena sistem kehabisan memori (RAM/heap). Program dihentikan oleh `std::terminate`.",
    causes: [
      "Mengalokasikan objek yang sangat besar sekaligus.",
      "Memory leak — terus mengalokasikan memori tanpa pernah membebaskannya.",
      "Rekursi tak terbatas yang terus mengalokasikan di heap.",
    ],
    steps: [
      "Gunakan `try-catch` untuk menangkap `std::bad_alloc` dan menangani kegagalan alokasi dengan elegan.",
      "Periksa apakah ada memory leak dengan Valgrind.",
      "Gunakan smart pointer (`std::unique_ptr`, `std::shared_ptr`) agar memori otomatis dibebaskan.",
      "Hindari alokasi dalam jumlah besar sekaligus — pertimbangkan alokasi bertahap.",
    ],
    codeExample: `// ❌ Bermasalah — alokasi tanpa batas
int* arr = new int[1000000000];  // std::bad_alloc jika RAM tidak cukup!

// ✅ Perbaikan dengan try-catch
try {
    int* arr = new int[1000000000];
    // ... gunakan arr ...
    delete[] arr;
} catch (const std::bad_alloc& e) {
    cerr << "Alokasi memori gagal: " << e.what() << endl;
}

// ✅ Lebih baik lagi: gunakan smart pointer
#include <memory>
auto arr = make_unique<int[]>(1000);  // otomatis dibebaskan`,
  },

  {
    id: "cpp_out_of_range",
    language: "cpp",
    pattern: /std::out_of_range|out_of_range/i,
    name: "Runtime Error: std::out_of_range",
    severity: SEVERITY.MEDIUM,
    explanation:
      "Program mencoba mengakses elemen dengan indeks atau kunci yang berada di luar jangkauan. Biasanya terjadi saat menggunakan `.at()` pada `std::vector`, `std::string`, atau `std::map`.",
    causes: [
      "Mengakses indeks yang lebih besar atau sama dengan ukuran container.",
      "Mengakses kunci `std::map` dengan `.at()` padahal kunci tidak ada.",
    ],
    steps: [
      "Selalu periksa ukuran container sebelum akses: `if (index < vec.size())`.",
      "Gunakan `find()` untuk `std::map` sebelum mengakses: `if (m.count(key))` atau `m.find(key) != m.end()`.",
      "Tangkap exception dengan `try-catch (const std::out_of_range& e)`.",
    ],
    codeExample: `#include <vector>
#include <stdexcept>
using namespace std;

// ❌ Bermasalah
vector<int> v = {1, 2, 3};
cout << v.at(10);  // throws std::out_of_range!

// ✅ Perbaikan
if (10 < v.size()) {
    cout << v[10];
} else {
    cout << "Indeks di luar batas." << endl;
}

// ✅ Atau tangkap exception-nya:
try {
    cout << v.at(10);
} catch (const out_of_range& e) {
    cerr << "Error: " << e.what() << endl;
}`,
  },

  {
    id: "cpp_double_free",
    language: "cpp",
    pattern: /double free or corruption|free\(\): invalid pointer/i,
    name: "Runtime Error: double free or corruption",
    severity: SEVERITY.HIGH,
    explanation:
      "Program mencoba membebaskan (memanggil `delete` atau `free`) blok memori yang sudah pernah dibebaskan sebelumnya. Ini merusak struktur internal heap dan dapat menyebabkan crash atau celah keamanan.",
    causes: [
      "Memanggil `delete`/`free` lebih dari satu kali pada pointer yang sama.",
      "Dua pointer menunjuk ke blok memori yang sama dan keduanya di-`delete`.",
      "Destruktor kelas yang menyalin pointer tanpa deep copy (pelanggaran Rule of Three/Five).",
    ],
    steps: [
      "Set pointer ke `nullptr` segera setelah `delete`: `delete p; p = nullptr;`",
      "Gunakan smart pointer (`std::unique_ptr`, `std::shared_ptr`) untuk manajemen memori otomatis.",
      "Implementasikan Rule of Three/Five jika kelas memiliki raw pointer: copy constructor, copy assignment operator, dan destructor.",
      "Gunakan AddressSanitizer untuk mendeteksi masalah ini saat development.",
    ],
    codeExample: `// ❌ Bermasalah
int* p = new int(42);
delete p;
delete p;  // double free! undefined behavior

// ✅ Perbaikan: set nullptr setelah delete
int* p = new int(42);
delete p;
p = nullptr;  // aman dari double free

// ✅ Perbaikan terbaik: gunakan smart pointer
#include <memory>
auto p = make_unique<int>(42);
// otomatis dibebaskan saat keluar scope — tidak perlu delete manual`,
  },

  {
    id: "cpp_floating_point_exception",
    language: "cpp",
    pattern: /Floating point exception|SIGFPE/i,
    name: "Runtime Error: Floating Point Exception (SIGFPE)",
    severity: SEVERITY.HIGH,
    explanation:
      "Terjadi kesalahan operasi aritmatika yang tidak valid — paling umum adalah pembagian dengan nol (integer division by zero). OS mengirimkan sinyal SIGFPE dan menghentikan program.",
    causes: [
      "Pembagian integer dengan nol (`a / 0`).",
      "Operasi modulo dengan nol (`a % 0`).",
    ],
    steps: [
      "Selalu validasi pembagi sebelum melakukan pembagian: `if (pembagi != 0)`.",
      "Untuk pembagian floating-point, hasilnya `inf` atau `nan` (tidak crash), tetapi tetap harus ditangani.",
      "Gunakan assertion saat development: `assert(pembagi != 0);`",
    ],
    codeExample: `// ❌ Bermasalah
int a = 10, b = 0;
int hasil = a / b;  // Floating point exception!

// ✅ Perbaikan
int a = 10, b = 0;
if (b != 0) {
    int hasil = a / b;
    cout << hasil;
} else {
    cerr << "Error: pembagi tidak boleh nol!" << endl;
}`,
  },

  // ── Sanitizer output ─────────────────────────────────────────────────────────
  {
    id: "cpp_heap_buffer_overflow",
    language: "cpp",
    pattern: /AddressSanitizer.*heap-buffer-overflow/i,
    name: "AddressSanitizer: heap-buffer-overflow",
    severity: SEVERITY.HIGH,
    explanation:
      "AddressSanitizer (ASan) mendeteksi akses memori di luar batas buffer yang dialokasikan di heap. Ini adalah bug serius yang bisa dieksploitasi sebagai celah keamanan.",
    causes: [
      "Menulis atau membaca melampaui akhir array yang dialokasikan dengan `new`.",
      "Loop berjalan satu iterasi terlalu jauh (off-by-one error).",
    ],
    steps: [
      "Kompilasi dengan ASan untuk menemukan bug ini: `g++ -fsanitize=address -g -O1 main.cpp`.",
      "Periksa semua loop yang mengakses array — pastikan kondisi `< size` bukan `<= size`.",
      "Ganti raw array dengan `std::vector` dan gunakan `.at()` untuk akses yang aman.",
    ],
    codeExample: `// ❌ Bermasalah — heap-buffer-overflow
int* arr = new int[5];
for (int i = 0; i <= 5; i++) {  // seharusnya i < 5 !
    arr[i] = i * 2;              // arr[5] menulis di luar batas!
}
delete[] arr;

// ✅ Perbaikan
int* arr = new int[5];
for (int i = 0; i < 5; i++) {   // kondisi benar: < bukan <=
    arr[i] = i * 2;
}
delete[] arr;`,
  },

  {
    id: "cpp_stack_buffer_overflow",
    language: "cpp",
    pattern: /AddressSanitizer.*stack-buffer-overflow/i,
    name: "AddressSanitizer: stack-buffer-overflow",
    severity: SEVERITY.HIGH,
    explanation:
      "AddressSanitizer mendeteksi akses memori di luar batas array yang dialokasikan di stack. Merusak stack frame dapat menyebabkan crash atau celah keamanan (stack smashing).",
    causes: [
      "Menulis ke indeks di luar batas array lokal.",
      "Fungsi `strcpy`/`gets` tanpa batas panjang buffer.",
    ],
    steps: [
      "Ganti `strcpy` dengan `strncpy` atau gunakan `std::string`.",
      "Pastikan kondisi loop tidak melampaui ukuran array stack.",
      "Gunakan `std::array<T,N>` dengan `.at()` sebagai pengganti C-style array.",
    ],
    codeExample: `// ❌ Bermasalah — stack-buffer-overflow
char nama[10];
strcpy(nama, "NamaPanjangSekaliMelebihiBuffer");  // overflow!

// ✅ Perbaikan dengan std::string
#include <string>
string nama = "NamaPanjangSekaliMelebihiBuffer";  // tidak ada batas ukuran

// ✅ Atau gunakan strncpy jika harus C-style
char nama[10];
strncpy(nama, "NamaPanjang", sizeof(nama) - 1);
nama[sizeof(nama) - 1] = '\\0';  // pastikan null-terminated`,
  },
];

// Gabungkan aturan C++ ke dalam array utama
ERROR_RULES.push(...CPP_ERROR_RULES);

/**
 * Saran umum debugging yang ditampilkan jika tidak ada pola yang cocok.
 */
const GENERAL_DEBUG_TIPS = [
  "Baca pesan error dengan seksama — biasanya pesan error sudah cukup deskriptif.",
  "Periksa nomor baris yang disebutkan dalam error log.",
  "Gunakan `console.log()` / `print()` untuk menelusuri nilai variabel step-by-step.",
  "Cari pesan error di Google atau Stack Overflow — kemungkinan besar sudah ada solusinya.",
  "Periksa dokumentasi resmi library/framework yang sedang kamu gunakan.",
  "Pastikan semua dependency sudah terinstal dan versinya kompatibel.",
  "Coba isolasi bagian kode yang bermasalah di file terpisah untuk debugging lebih fokus.",
];

// Export untuk digunakan di script.js
// (Karena kita menggunakan vanilla JS tanpa bundler, variabel ini bersifat global)
