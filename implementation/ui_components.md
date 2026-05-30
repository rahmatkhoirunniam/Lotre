# Panduan UI, Desain Sistem, & Responsivitas Mobile

> Panduan lengkap mengenai Desain Sistem (Vanilla CSS), Komponen UI Premium, Arsitektur Responsivitas Mobile/Tablet, dan Konsistensi Estetika untuk Pengembang Lotre.
> Terakhir diperbarui: Mei 2026

---

## 1. Token Desain & Tema Warna (CSS Variables)

Estetika visual Lotre mengusung tema **Sleek Dark Mode & Glassmorphism** secara default (Obsidian Theme), dan kini mendukung penuh **Sleek Light Mode** yang dapat diganti secara dinamis oleh pengguna. Seluruh token warna didefinisikan menggunakan variabel CSS di dalam [globals.css](file:///Users/mm/Product/lotre/lotre/src/app/globals.css):

### A. Tema Gelap Obsidian (Default `:root`)
```css
:root {
  --font-sans: 'Outfit', sans-serif;
  --bg-primary: #080b11;                      /* Biru Gelap Obsidian */
  --bg-surface: rgba(13, 20, 35, 0.45);       /* Permukaan Glassmorphism */
  --border-glass: rgba(255, 255, 255, 0.08);  /* Border Transparan Halus */
  --border-glow: rgba(139, 92, 246, 0.2);     /* Violet Glow Border */
  --text-primary: #ffffff;
  --text-secondary: #94a3b8;                  /* Slate Blue */
  --primary: #8b5cf6;                         /* Royal Violet */
  --primary-glow: rgba(139, 92, 246, 0.4);
  --success: #10b981;                         /* Emerald Green */
  --success-glow: rgba(16, 185, 129, 0.3);
  --warning: #f59e0b;                         /* Amber (Kuning Emas) */
  --error: #ef4444;                           /* Crimson Red */
  
  --bg-ambient-1: rgba(139, 92, 246, 0.15);
  --bg-ambient-2: rgba(16, 185, 129, 0.1);
  --option-bg: #0d1423;
  --card-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
}
```

### B. Tema Terang Sleek (`.light-mode`)
```css
.light-mode {
  --bg-primary: #f8fafc;                      /* Slate 50 */
  --bg-surface: rgba(255, 255, 255, 0.75);    /* Permukaan Glassmorphism Terang */
  --border-glass: rgba(15, 23, 42, 0.08);     /* Border Gelap Halus */
  --border-glow: rgba(139, 92, 246, 0.12);
  --text-primary: #0f172a;                    /* Slate 900 */
  --text-secondary: #475569;                  /* Slate 600 */
  --primary: #7c3aed;                         /* Deep Violet */
  --primary-glow: rgba(124, 58, 237, 0.25);
  --success: #059669;                         /* Darker Emerald */
  --success-glow: rgba(5, 150, 105, 0.15);
  --warning: #d97706;
  --error: #dc2626;
  
  --bg-ambient-1: rgba(124, 58, 237, 0.06);
  --bg-ambient-2: rgba(5, 150, 105, 0.05);
  --option-bg: #ffffff;
  --card-shadow: 0 8px 32px 0 rgba(15, 23, 42, 0.06);
}
```

### Efek Ambient Glow (Latar Belakang Bergerak)
Latar belakang sistem menggunakan dua partikel glowing raksasa (`::before` dan `::after` pada tag `body`) yang bergerak lambat secara asinkron menggunakan animasi `@keyframes glowShift1` dan `glowShift2` untuk menghasilkan efek visual premium berkedalaman tinggi. Seluruh intensitas dan warna partikel ini terikat pada variabel `--bg-ambient-1` dan `--bg-ambient-2` yang akan meredup secara otomatis saat beralih ke mode terang guna menjaga kenyamanan mata pembaca.

---

## 2. Pustaka Komponen UI Global

Setiap komponen UI baru yang dibuat **wajib** menggunakan kelas utilitas bawaan untuk mempertahankan konsistensi visual:

### A. Glassmorphism Card (`.glass-card`)
Menghasilkan kartu transparan melayang dengan filter blur latar belakang (`backdrop-filter`).
*   **Aturan Penggunaan:**
    ```html
    <div class="glass-card">
      <h3>Judul Konten</h3>
      <p>Deskripsi teks...</p>
    </div>
    ```
*   **Efek Hover:** Border otomatis menjadi sedikit lebih terang (`rgba(255, 255, 255, 0.15)`) disertai bayangan violet glow yang halus.

### B. Sistem Tombol (`.btn`)
Tombol dirancang ramah sentuhan (*touch-friendly*) dengan tinggi minimal 44-48 piksel.
*   **Primary Button (`.btn .btn-primary`):** Gradien Violet-Indigo glowing. Menghasilkan animasi terangkat (*translateY*) saat hover dan menekan kembali saat diklik.
*   **Success Button (`.btn .btn-success`):** Gradien Hijau Emerald. Digunakan untuk aksi bernilai positif seperti undian, pembayaran lunas, dan simpan.
*   **Secondary Button (`.btn .btn-secondary`):** Transparan dengan outline halus. Digunakan untuk aksi sekunder seperti import, batal, atau bersihkan filter.

### C. Lencana Status (`.badge`)
badge kecil berbentuk melingkar untuk menandai status entitas.
*   `.badge-success`: Status `LUNAS` atau `ACTIVE` (Hijau Emerald).
*   `.badge-danger`: Status `BELUM_BAYAR` atau `SUSPENDED` (Merah Crimson).
*   `.badge-warning`: Status `pending_premium` (Oranye Amber) — dilengkapi dengan animasi denyut (`animation: pulse`) untuk menarik perhatian.
*   `.badge-primary`: Menandai paket `Premium` (Ungu Violet).

---

## 3. Sistem Responsivitas Mobile & Tablet (Kunci Utama)

Semua halaman di Lotre dirancang dengan prinsip **Mobile-First**. Responsivitas diatur secara rapi menggunakan media query di dalam `globals.css` untuk mencegah antarmuka rusak pada layar kecil.

### A. Pencegahan Zoom Layar Otomatis iOS
Pada perangkat Apple (iPhone/iPad), peramban Safari akan memperbesar layar secara otomatis ketika pengguna memfokuskan kursor ke dalam kolom input jika ukuran font di bawah 16px. Hal ini diatasi secara global:
```css
input, select, textarea {
  font-size: 16px; /* Mencegah iOS Zoom-on-Focus */
  min-height: 44px; /* Tinggi minimum sesuai panduan Apple HIG */
  touch-action: manipulation;
}
```

### B. Pola Tabel Bertumpuk / Card-Stacking (`.table-responsive`)
Ini adalah bagian terpenting dari responsivitas Lotre. Di layar ponsel (≤ 640px), tabel data yang memiliki kolom lebar diubah menjadi tumpukan kartu vertikal yang rapi.

```
Tampilan Desktop (Tabel Melebar)
┌──────────────────────────────────────────────┐
│ Nama Anggota  │ Status Iuran │ Periode Ke    │
├───────────────┼──────────────┼───────────────┤
│ Budi Santoso  │ LUNAS        │ Putaran 5     │
└───────────────┴──────────────┴───────────────┘

Tampilan Ponsel (Card Stacking)
┌──────────────────────────────┐
│ Budi Santoso                 │ (Card Container)
├──────────────────────────────┤
│ STATUS IURAN:          LUNAS │ (Baris Flex)
│ PERIODE KE:        Putaran 5 │
└──────────────────────────────┘
```

#### Cara Penggunaan di HTML / JSX:
Untuk merender tabel yang responsif, developer **wajib** mengikuti struktur berikut:
1.  Bungkus elemen `<table>` di dalam `<div className="table-responsive">`.
2.  Setiap elemen `<td>` **wajib** memiliki atribut `data-label` yang nilainya sama dengan teks header kolom.
3.  Untuk tombol aksi di akhir baris, gunakan kelas khusus `td-actions`.

```tsx
<div className="table-responsive">
  <table className="custom-table">
    <thead>
      <tr>
        <th>Nama Anggota</th>
        <th>Status</th>
        <th>Aksi</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td data-label="Nama Anggota">Budi Santoso</td>
        <td data-label="Status">
          <span className="badge badge-success">Lunas</span>
        </td>
        <td className="td-actions">
          <button className="btn btn-secondary">Edit</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

#### Cara Kerja di CSS (`globals.css`):
Saat lebar layar di bawah `640px`, CSS melakukan override:
*   `table`, `thead`, `tbody`, `tr`, `td` diubah menjadi `display: block`.
*   Header asli (`<thead>`) disembunyikan (`display: none`).
*   Setiap `<td>` diubah menjadi flexbox (`display: flex`) dengan `justify-content: space-between` untuk menaruh label di kiri dan value di kanan.
*   Label diambil secara dinamis dari atribut HTML menggunakan selektor CSS: `content: attr(data-label)`.

---

### C. Bottom-Sheet Modal pada Layar Ponsel
Pada resolusi desktop, elemen modal konfirmasi dirender di tengah layar. Namun, pada layar HP (≤ 640px), modal secara dinamis berubah menjadi **Bottom-Sheet** (muncul dari bawah dan menempel ke bawah layar) untuk memberikan pengalaman terbaik seperti aplikasi native di Android/iOS.

*   **Pola CSS:**
    ```css
    @media (max-width: 640px) {
      .modal-overlay {
        align-items: flex-end !important; /* Dorong ke dasar layar */
        padding: 12px !important;
      }
      .modal-content {
        border-radius: 20px 20px 0 0 !important; /* Sudut melengkung atas saja */
        max-height: 92dvh !important; /* Cegah modal melebihi tinggi layar HP */
        overflow-y: auto !important;
      }
    }
    ```

---

### D. Grid Statistik Mobile (`.stats-grid`)
Untuk menghemat ruang di layar HP, grid informasi statistik dashboard dikompres menjadi tata letak **2 Kolom** yang rapi:
```css
@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr !important;
    gap: 12px !important;
  }
}
```

---

## 4. Pola State Penyimpanan Lokal (Persistent Workspace)

Agar Admin tidak kehilangan kelompok arisan aktif saat memuat ulang halaman browser (*page reload*), Lotre menggunakan pola sinkronisasi state React dengan **`localStorage`**:

### Logika Implementasi di `src/app/page.tsx`:

1.  **Inisialisasi State Awal:**
    ```typescript
    const [activeWorkspace, setActiveWorkspace] = useState<string>("");
    ```
2.  **Pemulihan State Saat Mount (useEffect):**
    Sistem membaca kunci `lotre_active_workspace` dari penyimpanan lokal browser. Jika ada, gunakan kunci tersebut. Jika kosong, biarkan fallback pertama dari API.
    ```typescript
    useEffect(() => {
      const savedSlug = localStorage.getItem("lotre_active_workspace");
      if (savedSlug) {
        setActiveWorkspace(savedSlug);
      }
    }, []);
    ```
3.  **Penyimpanan Otomatis Saat Berpindah Workspace:**
    Setiap kali pengguna memicu dropdown switcher atau menyelesaikan pendaftaran grup baru, panggil fungsi pengubah state sekaligus perbarui `localStorage`:
    ```typescript
    const handleSwitchWorkspace = (slug: string) => {
      setActiveWorkspace(slug);
      localStorage.setItem("lotre_active_workspace", slug);
    };
    ```

### B. Pola Persistent Theme State (Light/Dark Mode Switching)
Sistem menyimpan preferensi tema pengguna ke `localStorage` dengan kunci `lotre_theme` agar pilihan tema tetap bertahan meskipun browser dimuat ulang.

1.  **Inisialisasi Tema Tingkat Global (`layout.tsx`):**
    Untuk mencegah terjadinya kedipan visual (*flash of unthemed content*) saat berpindah halaman atau pertama kali membuka web, naskah blocking inline script kecil ditambahkan pada tag `<head>` di dalam **[layout.tsx](file:///Users/mm/Product/lotre/lotre/src/app/layout.tsx)**:
    ```html
    <script dangerouslySetInnerHTML={{__html: `
      try {
        const savedTheme = localStorage.getItem('lotre_theme');
        if (savedTheme === 'light') {
          document.documentElement.classList.add('light-mode');
        } else {
          document.documentElement.classList.remove('light-mode');
        }
      } catch (_) {}
    `}} />
    ```

2.  **Inisialisasi State Komponen (React `useEffect`):**
    ```typescript
    const [theme, setTheme] = useState<"dark" | "light">("dark");

    useEffect(() => {
      if (typeof window !== "undefined") {
        const savedTheme = localStorage.getItem("lotre_theme") as "dark" | "light" | null;
        const currentTheme = savedTheme || "dark";
        setTheme(currentTheme);
        if (currentTheme === "light") {
          document.documentElement.classList.add("light-mode");
        } else {
          document.documentElement.classList.remove("light-mode");
        }
      }
    }, []);
    ```
2.  **Fungsi Toggle Tema:**
    Menukar nilai state, memperbarui kelas pada elemen root HTML (`document.documentElement`), dan menyimpannya ke `localStorage`.
    ```typescript
    const toggleTheme = () => {
      const nextTheme = theme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
      localStorage.setItem("lotre_theme", nextTheme);
      if (nextTheme === "light") {
        document.documentElement.classList.add("light-mode");
      } else {
        document.documentElement.classList.remove("light-mode");
      }
    };
    ```
3.  **Tombol Pemicu UI (`.theme-toggle`):**
    Tombol interaktif melayang dengan efek transisi transparan glassmorphism yang menampilkan icon matahari (saat mode gelap aktif) atau icon bulan (saat mode terang aktif) secara dinamis menggunakan SVG.
    *   **Landing Page (`page.tsx`):** Terintegrasi di header navigasi utama sebelah tombol "Masuk" saat pengguna belum terautentikasi.
    *   **Dashboard Admin (`page.tsx`):** Terintegrasi di header sebelah tombol keluar saat pengguna telah masuk.
    *   **Control Center Superadmin (`superadmin/page.tsx`):** Terintegrasi di header sebelah tombol keluar panel.
    *   **Halaman Registrasi & Login (`auth/layout.tsx`):** Terintegrasi melayang (*floating*) di pojok kanan atas layar agar mudah diakses saat berada pada halaman login maupun formulir wizard pendaftaran.

---

## 5. Komponen Dropdown Premium Terpadu (`.custom-select`)
Untuk memastikan seluruh pilihan dropdown memiliki tampilan premium yang seragam (konsisten dengan tema obsidian maupun mode terang), Lotre menyembunyikan panah bawaan peramban (*browser default select arrow*) dan mendesain ulang elemen dropdown dengan spesifikasi:
*   **Struktur CSS:**
    ```css
    .custom-select {
      font-family: var(--font-sans);
      padding: 8px 36px 8px 14px;
      border-radius: 10px;
      border: 1px solid var(--border-glass);
      background: rgba(0, 0, 0, 0.35);
      color: var(--text-primary);
      font-size: 0.85rem;
      cursor: pointer;
      min-height: 42px;
      outline: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      appearance: none;
      /* Custom Arrow SVG Icon */
      background-image: url("data:image/svg+xml;...");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 16px;
    }
    ```
*   **Keuntungan:** Memberikan transisi outline glowing ungu saat fokus (`:focus`), perubahan latar belakang interaktif saat kursor melayang (`:hover`), serta perataan visual dropdown yang 100% identik di seluruh halaman (seperti Workspace Switcher dan formulir Backfill).

---

## 6. Penanganan Kontras Tinggi Mode Terang (High Contrast Overrides)
Karena banyak halaman Lotre menggunakan gaya inline yang memaksakan teks berwarna putih (`color: "#fff"`), sistem menerapkan **High Contrast Overrides** secara global di dalam `globals.css` saat kelas `.light-mode` aktif. Ini memastikan teks, isian form, dan tata letak modal tetap terbaca dengan kontras sempurna:

1.  **Pemberlakuan Force Color (Selektor Cerdas):**
    CSS secara otomatis mendeteksi elemen apa pun yang memiliki inline style putih keras, kemudian memaksanya mengikuti variabel `--text-primary` (yaitu Slate 900 gelap di mode terang, tetapi tetap putih di mode gelap).
    ```css
    .light-mode [style*="color: #fff"]:not(.btn):not(.badge):not(button):not(.badge *):not(.btn *):not(option) {
      color: var(--text-primary) !important;
    }
    ```
    *Pengecualian:* Aksi ini mengecualikan tombol (`.btn`) dan lencana (`.badge`) agar teks di dalamnya tetap kontras dengan latar belakang berwarna terang (seperti ungu atau hijau).
2.  **Kontras Input Form & Placeholder:**
    Semua kolom input, select, dan textarea dipaksa menggunakan latar belakang putih bersih (`#ffffff`), teks gelap, dan border Slate tipis yang terlihat jelas. Placeholder diubah menjadi Slate 500 yang kontras.
3.  **Tabel & Kartu:**
    *   `.glass-card` diubah menjadi kartu solid putih dengan bayangan *soft shadow* tipis.
    *   Baris tabel (`<tr>`) yang dilintasi kursor mendapatkan latar belakang ungu muda transparan (`rgba(124, 58, 237, 0.02)`) agar baris data mudah dilacak mata.
4.  **Teks Strong & Heading:**
    *   Seluruh tag `h1`-`h6`, `strong`, dan `b` dipaksa menggunakan warna utama `--text-primary` agar memiliki ketebalan visual yang ideal.
    *   *Heading Utama Landing Page (`main h1`):* Menghapus properti gradien linear putih transparan (`WebkitTextFillColor: "transparent"`) dan menimpanya ke warna gelap solid `var(--text-primary)` agar judul utama SaaS terbaca sangat tajam di atas latar belakang terang.
5.  **Tombol & Aset Halaman:**
    *   *Tombol Demo (`.landing-ctas button`):* Warna teks hijau terang `#34d399` diubah menjadi warna hijau Emerald gelap `#047857` yang memiliki rasio kontras tinggi, didukung background hijau transparan halus yang diperjelas.
    *   *Tombol Masuk Header:* Dipaksa menggunakan latar belakang Slate terang dengan outline tipis yang jelas di Light Mode.
    *   *Fitur Grid:* Seluruh kartu fitur di dalam grid Landing Page dipaksa beralih menjadi kartu solid putih kontras tinggi dengan border abu-abu gelap halus, mengesampingkan gaya inline default yang bernilai transparan tipis.
    *   *Footer:* Pembatas atas footer (`border-top-color`) diubah menjadi abu-abu Slate tipis yang terlihat jelas.
    *   *Tombol Status Lunas Anggota:* Tombol hijau terang `#6ee7b7` (Tandai Lunas) dipaksa beralih menjadi hijau Emerald gelap kontras `#059669`. Tombol merah muda terang `#fca5a5` (Batalkan Lunas) dipaksa beralih menjadi merah Crimson kontras `#dc2626` disertai warna border dan background yang disesuaikan.
    *   *Trek Progress Bar Kas:* Latar belakang track progress bar iuran yang sebelumnya menggunakan warna transparan kusam `rgba(255, 255, 255, 0.05)` dipaksa beralih menggunakan warna abu-abu Slate transparan gelap yang sangat terlihat jelas di Light Mode.
    *   *Tab Switcher Migrasi & Portabilitas:* Latar belakang kontainer tab diubah menjadi abu-abu Slate transparan tipis. Tombol tab yang tidak aktif secara otomatis diubah menjadi teks Slate gelap (`var(--text-secondary)`) untuk membuang teks putih kusam bawaan mode gelap.
    *   *Tombol Akordeon Panel Migrasi:* Tombol utama akordeon (`#toggle-migration-panel`) dipaksa menggunakan latar belakang ungu muda transparan elegan (`rgba(139, 92, 246, 0.06)`), border ungu kontras halus (`rgba(139, 92, 246, 0.15)`), dan teks gelap utama (`var(--text-primary)`) di Light Mode untuk menyajikan visual premium berdaya kontras tinggi.
    *   *Card Ringkasan Backup Data (Tab 3):* Kontainer grid ringkasan data backup (Tenant Info, Anggota, Setoran, Pemenang) dipaksa di-render dengan latar belakang abu-abu terang Slate (`rgba(15, 23, 42, 0.03)`) dengan border tipis Slate yang jelas, dan memaksa seluruh teks di dalamnya (termasuk label span dan nama workspace aktif dengan aksen ungu brand utama) agar berdaya kontras tinggi di Light Mode.

---

## 7. Checklist Validasi Desain UI (Bagi Pengembang Selanjutnya)

Sebelum melakukan *push* kode UI baru ke repositori, pastikan Anda mencentang checklist berikut:

- [ ] **iOS Zoom Check:** Apakah semua input/select memiliki ukuran font minimal `16px`?
- [ ] **Touch Target Check:** Apakah semua tombol interaktif memiliki tinggi area klik minimal `44px`?
- [ ] **Responsive Table Check:** Apakah elemen `<table>` dibungkus `.table-responsive` dan setiap `<td>` di dalamnya sudah memiliki atribut `data-label` yang sesuai?
- [ ] **Glassmorphism Check:** Apakah komponen box menggunakan kelas `.glass-card` alih-alih background polos?
- [ ] **Performance Check:** Apakah pencarian client-side sudah memanfaatkan `useMemo` untuk memfilter data lokal tanpa memicu request API berulang?
