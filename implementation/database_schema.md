# Skema Database Lotre

> Dokumentasi Lengkap Struktur Database, Relasi, Indeks, dan Panduan Migrasi untuk Platform SaaS Arisan Lotre.  
> Terakhir diperbarui: Mei 2026

---

## 1. Arsitektur Database & Relasi

Aplikasi **Lotre** dirancang dengan pendekatan **Multi-Tenancy menggunakan model database bersama (Shared Database, Shared Schema)**. Setiap baris data milik tenant diisolasi secara logis menggunakan kolom `tenantId` pada tabel-tabel utama (`Anggota`, `Setoran`, `Pemenang`).

Berikut adalah diagram **Entity-Relationship (ER)** yang memetakan seluruh model database dan keterhubungannya:

```mermaid
erDiagram
    User ||--o{ Tenant : "owns (ownerId -> id)"
    User ||--o| Anggota : "profile (userId -> id)"
    Tenant ||--o{ Anggota : "contains (tenantId -> id)"
    Tenant ||--o{ Setoran : "contains (tenantId -> id)"
    Tenant ||--o{ Pemenang : "contains (tenantId -> id)"
    Anggota ||--o{ Setoran : "pays (anggotaId -> id)"
    Anggota ||--o{ Pemenang : "wins (anggotaId -> id)"
```

---

## 2. Kamus Data (Data Dictionary)

Lotre saat ini menggunakan **SQLite** via **Prisma ORM** untuk repositori development dan production skala kecil. Tipe data yang tercantum di bawah ini merepresentasikan tipe data Prisma beserta padanannya dalam engine database SQLite.

### A. Tabel `User`
Menyimpan kredensial login, data profil dasar, serta hak akses (role) pengguna platform.

| Nama Kolom | Tipe Data (Prisma) | Tipe SQLite | Atribut / Constraint | Deskripsi & Validasi |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | `TEXT` | `PRIMARY KEY`, UUID | ID unik pengguna (dihasilkan otomatis oleh UUID v4). |
| `email` | `String` | `TEXT` | `UNIQUE` | Email unik pengguna untuk login sistem. |
| `passwordHash` | `String` | `TEXT` | - | Hash sandi satu arah yang dienkripsi menggunakan `bcrypt`. |
| `namaLengkap` | `String` | `TEXT` | - | Nama lengkap pengguna untuk keperluan display. |
| `role` | `String` | `TEXT` | `DEFAULT 'TENANT_ADMIN'` | Opsi role: `"SUPERADMIN"`, `"TENANT_ADMIN"`, atau `"MEMBER"`. |
| `createdAt` | `DateTime` | `NUMERIC` | `DEFAULT now()` | Waktu saat akun dibuat. |
| `updatedAt` | `DateTime` | `NUMERIC` | `UPDATED_AT` | Waktu pembaruan data terakhir secara otomatis. |

---

### B. Tabel `Tenant`
Menyimpan informasi kelompok arisan (workspace) yang dikelola oleh `User` dengan role `TENANT_ADMIN`.

| Nama Kolom | Tipe Data (Prisma) | Tipe SQLite | Atribut / Constraint | Deskripsi & Validasi |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | `TEXT` | `PRIMARY KEY`, UUID | ID unik workspace arisan. |
| `namaGrup` | `String` | `TEXT` | - | Nama kelompok arisan (misal: "Arisan Keluarga Cemara"). |
| `slug` | `String` | `TEXT` | `UNIQUE` | Identifier unik subdomain / URL path (misal: `keluarga-cemara`). |
| `plan` | `String` | `TEXT` | `DEFAULT 'free'` | Paket keanggotaan tenant: `"free"`, `"premium"`, atau `"pending_premium"`. |
| `nominalIuran` | `Float` | `REAL` | `DEFAULT 200000` | Besaran iuran per periode putaran arisan. |
| `status` | `String` | `TEXT` | `DEFAULT 'ACTIVE'` | Status operasional tenant: `"ACTIVE"` atau `"SUSPENDED"`. |
| `suspendReason` | `String?` | `TEXT` | `NULLABLE` | Catatan penjelasan dari Superadmin apabila tenant ditangguhkan. |
| `ownerId` | `String` | `TEXT` | `FOREIGN KEY` | Merujuk ke `User.id` (Relasi: `TenantOwner`). Aksi: `onDelete: Cascade`. |
| `createdAt` | `DateTime` | `NUMERIC` | `DEFAULT now()` | Waktu pembuatan kelompok arisan pertama kali. |
| `updatedAt` | `DateTime` | `NUMERIC` | `UPDATED_AT` | Waktu pembaruan properti kelompok. |

---

### C. Tabel `Anggota`
Menyimpan profil anggota yang berpartisipasi dalam suatu kelompok arisan.

| Nama Kolom | Tipe Data (Prisma) | Tipe SQLite | Atribut / Constraint | Deskripsi & Validasi |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | `TEXT` | `PRIMARY KEY`, UUID | ID unik anggota arisan. |
| `tenantId` | `String` | `TEXT` | `FOREIGN KEY`, `INDEX` | Merujuk ke `Tenant.id`. Aksi: `onDelete: Cascade`. |
| `nama` | `String` | `TEXT` | - | Nama anggota arisan. |
| `whatsapp` | `String` | `TEXT` | - | Nomor WhatsApp aktif untuk notifikasi (misal: `081234567890`). |
| `status` | `String` | `TEXT` | `DEFAULT 'ACTIVE'` | Status keaktifan: `"ACTIVE"` (ikut kocokan) atau `"INACTIVE"` (ditangguhkan). |
| `userId` | `String?` | `TEXT` | `UNIQUE`, `FOREIGN KEY` | Opsional, tautan ke akun login `User.id` (Aksi: `onDelete: SetNull`). |
| `createdAt` | `DateTime` | `NUMERIC` | `DEFAULT now()` | Waktu pendaftaran anggota. |
| `updatedAt` | `DateTime` | `NUMERIC` | `UPDATED_AT` | Waktu pembaruan informasi profil anggota. |

---

### D. Tabel `Setoran`
Mencatat status pembayaran iuran masing-masing anggota per periode putaran arisan.

| Nama Kolom | Tipe Data (Prisma) | Tipe SQLite | Atribut / Constraint | Deskripsi & Validasi |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | `TEXT` | `PRIMARY KEY`, UUID | ID unik bukti setoran. |
| `tenantId` | `String` | `TEXT` | `FOREIGN KEY`, `INDEX` | Merujuk ke `Tenant.id`. Aksi: `onDelete: Cascade`. |
| `anggotaId` | `String` | `TEXT` | `FOREIGN KEY`, `INDEX` | Merujuk ke `Anggota.id`. Aksi: `onDelete: Cascade`. |
| `periodeKe` | `Int` | `INTEGER` | `INDEX` | Putaran keberapa pembayaran dilakukan (1, 2, 3, dst). |
| `nominal` | `Float` | `REAL` | - | Nominal iuran yang wajib atau telah dibayarkan. |
| `status` | `String` | `TEXT` | `DEFAULT 'BELUM_BAYAR'` | Status pembayaran: `"LUNAS"` atau `"BELUM_BAYAR"`. |
| `tanggalBayar` | `DateTime?` | `NUMERIC` | `NULLABLE` | Tanggal persis pembayaran diselesaikan (null jika belum lunas). |
| `createdAt` | `DateTime` | `NUMERIC` | `DEFAULT now()` | Waktu pencatatan setoran. |
| `updatedAt` | `DateTime` | `NUMERIC` | `UPDATED_AT` | Waktu pembaruan status setoran (misal saat ditandai lunas). |

---

### E. Tabel `Pemenang`
Mencatat riwayat pemenang undian kocokan arisan yang sukses untuk setiap periode putaran.

| Nama Kolom | Tipe Data (Prisma) | Tipe SQLite | Atribut / Constraint | Deskripsi & Validasi |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `String` | `TEXT` | `PRIMARY KEY`, UUID | ID unik transaksi pemenang. |
| `tenantId` | `String` | `TEXT` | `FOREIGN KEY`, `INDEX` | Merujuk ke `Tenant.id`. Aksi: `onDelete: Cascade`. |
| `anggotaId` | `String` | `TEXT` | `FOREIGN KEY`, `INDEX` | Merujuk ke `Anggota.id`. Aksi: `onDelete: Cascade`. |
| `periodeKe` | `Int` | `INTEGER` | `INDEX` | Putaran keberapa undian dimenangkan (1, 2, 3, dst). |
| `tanggalMenang` | `DateTime` | `NUMERIC` | `DEFAULT now()` | Tanggal dan waktu kocokan arisan dilaksanakan. |
| `totalDiterima` | `Float` | `REAL` | - | Total uang kas arisan yang ditarik/diterima pemenang. |
| `createdAt` | `DateTime` | `NUMERIC` | `DEFAULT now()` | Waktu log pemenang tercatat ke database. |
| `updatedAt` | `DateTime` | `NUMERIC` | `UPDATED_AT` | Pembaruan data riwayat (jika ada koreksi). |

---

## 3. Strategi Indexing & Performa

Dalam arsitektur SaaS Multi-Tenant, hampir semua query database memotong tabel secara vertikal berdasarkan `tenantId`. Oleh karena itu, Lotre menggunakan indeks komposit di tingkat tabel untuk memastikan responsivitas data tetap optimal meskipun jumlah baris bertambah signifikan.

### Indeks pada Tabel `Anggota`
*   `@@index([tenantId, id])`
    *   **Kegunaan:** Mempercepat validasi dan pengambilan profil anggota tertentu di bawah tenant yang bersangkutan.
*   `@@index([tenantId, status])`
    *   **Kegunaan:** Mempercepat penyaringan anggota aktif (`ACTIVE`) yang akan dimasukkan ke dalam daftar undian kocokan arisan.

### Indeks pada Tabel `Setoran`
*   `@@index([tenantId, anggotaId])`
    *   **Kegunaan:** Mempercepat pelacakan riwayat setoran/tunggakan untuk satu anggota tertentu di workspace bersangkutan (misal untuk audit/kartu iuran anggota).
*   `@@index([tenantId, periodeKe])`
    *   **Kegunaan:** Mempercepat rendering laporan bulanan/periode tertentu serta agregasi total uang yang terkumpul pada putaran berjalan.

### Indeks pada Tabel `Pemenang`
*   `@@index([tenantId, anggotaId])`
    *   **Kegunaan:** Mempercepat pemeriksaan kelayakan undian (memastikan anggota yang ditarik belum pernah menang pada putaran sebelumnya).
*   `@@index([tenantId, periodeKe])`
    *   **Kegunaan:** Mempercepat pelaporan riwayat pemenang secara periodik dan validasi putaran aktif.

---

## 4. Integritas Data & Siklus cascade

Sistem Lotre menerapkan aturan integritas referensial yang ketat untuk mencegah data sampah (**orphaned records**) di database.

```mermaid
graph TD
    User(Tabel User)
    Tenant(Tabel Tenant)
    Anggota(Tabel Anggota)
    Setoran(Tabel Setoran)
    Pemenang(Tabel Pemenang)

    User -->|On Delete: CASCADE| Tenant
    User -->|On Delete: SET NULL| Anggota
    Tenant -->|On Delete: CASCADE| Anggota
    Tenant -->|On Delete: CASCADE| Setoran
    Tenant -->|On Delete: CASCADE| Pemenang
    Anggota -->|On Delete: CASCADE| Setoran
    Anggota -->|On Delete: CASCADE| Pemenang
```

*   **User Dihapus (`onDelete: Cascade` pada `TenantOwner`):** Jika akun seorang Admin didelete, seluruh Kelompok Arisan (Tenant) miliknya beserta seluruh relasi data di dalamnya otomatis terhapus bersih.
*   **User Dihapus (`onDelete: SetNull` pada `UserMember`):** Apabila data `User` terhapus, profil `Anggota` terkait tidak ikut terhapus, melainkan field `userId` di set menjadi `null`.
*   **Tenant Dihapus (`onDelete: Cascade`):** Menghapus workspace tenant otomatis melenyapkan data seluruh `Anggota`, `Setoran`, dan `Pemenang` yang tergabung di workspace tersebut.
*   **Anggota Dihapus (`onDelete: Cascade`):** Jika seorang anggota dihapus dari kelompok, riwayat `Setoran` dan `Pemenang` yang terikat pada ID anggota tersebut akan dibersihkan agar database tetap konsisten.

---

## 5. Panduan Perintah Prisma (Development Workflow)

Berikut adalah ringkasan perintah esensial untuk memanipulasi dan memantau skema database selama proses development:

### 1. Sinkronisasi Model ke Prisma Client
Harus dijalankan setiap kali ada perubahan pada file `prisma/schema.prisma`:
```bash
npx prisma generate
```

### 2. Membuat dan Menjalankan Migrasi Lokal
Untuk membuat file migrasi SQL baru dan menerapkannya pada database lokal (`prisma/dev.db`):
```bash
npx prisma migrate dev --name deskripsi_perubahan
```

### 3. Mereset Database dan Seed Ulang
Menghapus seluruh data, menerapkan ulang migrasi, dan menjalankan skrip seed (`prisma/seed.ts`):
```bash
npx prisma migrate reset
```

### 4. Menjalankan Prisma Studio (GUI Browser)
Membuka aplikasi web lokal di `http://localhost:5555` untuk melihat dan mengedit isi tabel secara langsung:
```bash
npx prisma studio
```

### 5. Memeriksa Struktur File Database SQLite
Database disimpan secara lokal di path `prisma/dev.db`. Anda bisa melakukan inspeksi langsung via CLI SQLite:
```bash
sqlite3 prisma/dev.db
```

---

## 6. Jalur Migrasi ke PostgreSQL (Production Ready)

Jika di masa mendatang aplikasi ini dideploy ke lingkungan server terdistribusi dengan beban tinggi, Anda disarankan untuk beralih dari **SQLite** ke **PostgreSQL**.

Berikut adalah langkah-langkah transisi skema tanpa merusak arsitektur data:

### Langkah 1: Modifikasi Datasource di `prisma/schema.prisma`
Ubah baris penyedia database dari `sqlite` ke `postgresql`:

```prisma
// Sebelum
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// Sesudah
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Langkah 2: Sesuaikan Tipe Data Khusus (Bila Ada)
*   SQLite tidak mendukung tipe data `Enum` bawaan database, sehingga pada skema saat ini `role`, `status`, dan `plan` dipetakan sebagai `String`.
*   Pada PostgreSQL, Anda dapat mempertahankan tipe `String` tersebut atau mendefinisikannya ulang menggunakan `enum` Prisma asli untuk pengetikan data yang lebih kuat:

```prisma
enum Role {
  SUPERADMIN
  TENANT_ADMIN
  MEMBER
}

model User {
  // ...
  role Role @default(TENANT_ADMIN)
}
```

### Langkah 3: Update Variabel `.env`
Ganti koneksi string database dengan URI PostgreSQL yang valid:
```env
DATABASE_URL="postgresql://postgres:mysecurepassword@localhost:5432/lotredb?schema=public"
```

### Langkah 4: Regenerasi Migrasi Baru
Buat folder riwayat migrasi baru yang disesuaikan dengan sintaks PostgreSQL:
```bash
# Hapus folder migrations lama (SQLite) jika ingin memulai histori segar
rm -rf prisma/migrations

# Buat migrasi PostgreSQL pertama
npx prisma migrate dev --name init_postgresql
```

---

## 7. Kebijakan Pencadangan & Keamanan Data (Production Checklist)

1.  **Pencadangan SQLite Berkala:** Selama masih menggunakan SQLite di staging/production skala kecil, lakukan backup otomatis pada file `prisma/dev.db` setiap hari menggunakan cron job ke cloud storage terpisah (seperti AWS S3 atau Google Cloud Storage).
2.  **Keamanan String Koneksi:** Pastikan file `.env` tidak pernah ikut terkomit ke repositori Git (sudah dilindungi via `.gitignore`).
3.  **Audit Multi-Tenant:** Ketika membuat API route baru, selalu pastikan baris kode diawali dengan pemanggilan `resolveTenantId()` untuk menjamin pengguna tidak dapat menyusup atau melihat data milik tenant lain.
