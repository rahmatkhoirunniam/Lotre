# Panduan Deployment Mandiri (Self-Hosted)
### Stack: Proxmox + CasaOS + Cloudflare Tunnel + Docker

Dokumen ini menjelaskan langkah-langkah *deployment* aplikasi arisan SaaS **Lotre** pada infrastruktur mandiri Anda. Menggunakan kombinasi **Proxmox (LXC/VM)**, **CasaOS (Docker Engine)**, dan **Cloudflare Tunnel (Wildcard Subdomain)** adalah arsitektur *homelab* terbaik untuk meluncurkan aplikasi multi-tenant secara aman tanpa perlu membuka port (*port forwarding*) pada router.

---

## 🛠️ Langkah 1: Persiapan Folder di CasaOS

Untuk memudahkan manajemen berkas dan pencadangan database, kita akan memanfaatkan volume persisten yang dipetakan ke direktori penyimpanan utama CasaOS.

1. Buka aplikasi **Files** bawaan di dashboard CasaOS Anda.
2. Navigasikan ke direktori: `/DATA/AppData/`
3. Buat folder baru bernama **`lotre`** di dalam folder `AppData` tersebut.
4. Di dalam `/DATA/AppData/lotre/`, buat sub-folder bernama **`db`** (untuk menyimpan database SQLite secara persisten).

Sehingga strukturnya menjadi:
* `/DATA/AppData/lotre/docker-compose.yml`
* `/DATA/AppData/lotre/Dockerfile`
* `/DATA/AppData/lotre/.dockerignore` (Sangat penting agar cache macOS tidak mengotori container!)
* `/DATA/AppData/lotre/db/` (Kosong terlebih dahulu, database `prod.db` akan terbuat otomatis)

*Catatan: Salin seluruh kode sumber proyek Lotre (termasuk berkas `.dockerignore` bawaan yang sudah kami buat) ke folder `/DATA/AppData/lotre/` tersebut menggunakan SFTP, Git, atau fitur upload berkas di CasaOS. Jangan lupa untuk menyertakan berkas tersembunyi seperti `.dockerignore` dan `.env`.*

---

## 📦 Langkah 2: Build & Deployment via CasaOS

Kami telah menyertakan berkas **`Dockerfile`** (multi-stage) dan **`docker-compose.yml`** di dalam direktori root proyek untuk Anda.

### Opsi A: Melalui Terminal (SSH) - Sangat Direkomendasikan
Jika Anda memiliki akses SSH ke VM/LXC Proxmox yang menjalankan CasaOS:
1. Masuk ke folder aplikasi:
   ```bash
   cd /DATA/AppData/lotre
   ```
2. Jalankan build kontainer secara lokal di server Anda:
   ```bash
   docker compose up -d --build
   ```
3. Kontainer akan di-build secara otomatis, melakukan push skema database secara otomatis (`npx prisma db push`), dan aktif pada port **`3005`** secara instan.

### Opsi B: Melalui Dashboard UI CasaOS (Custom Install)
1. Buka dashboard CasaOS, klik **App Store**.
2. Klik tombol **Custom Install** di pojok kanan atas.
3. Klik tombol **Import** (ikon kertas/dokumen) dan tempelkan (*paste*) seluruh isi berkas `docker-compose.yml` milik kita ke dalamnya, lalu klik **Submit**.
4. Lengkapi form isian:
   * **App Name:** `Lotre`
   * **Icon URL:** Anda bisa menggunakan URL kustom atau kosongkan.
   * **Port:** `3005` -> `3000`
   * **Volumes:** `/DATA/AppData/lotre/db` -> `/app/db`
5. Klik **Install** dan tunggu CasaOS mem-build aplikasi Anda di latar belakang.

---

## 🌐 Langkah 3: Ekspos Domain via Cloudflare Tunnel (Wildcard Subdomain)

Aplikasi Lotre menggunakan arsitektur **Logical Multi-Tenancy** berbasis subdomain (misal: `keluarga-cemara.domain.com` atau `rt05.domain.com`). Agar fitur subdomain ini berfungsi otomatis tanpa perlu mendaftarkan subdomain satu per satu di Cloudflare, ikuti panduan pengaturan **Wildcard Tunnel** berikut:

### 1. Hubungkan Server ke Cloudflare
* Buka **Cloudflare Zero Trust Dashboard** (`one.dash.cloudflare.com`).
* Masuk ke menu **Networks** -> **Tunnels** -> **Create a Tunnel**.
* Pilih nama tunnel (misal: `lotre-homelab-tunnel`) dan salin perintah instalasi konektor (`cloudflared`) untuk dipasang di LXC/VM Proxmox Anda.

### 2. Pengaturan Public Hostname (Wildcard)
Setelah tunnel berstatus **`ACTIVE`**, masuk ke pengaturan Tunnel tersebut dan tambahkan **dua** buah *Hostname*:

#### A. Hostname Utama (Untuk Landing Page & Login)
* **Subdomain:** `arisan` (atau kosong jika ingin menggunakan domain utama)
* **Domain:** `domainanda.com`
* **Path:** (Kosongkan)
* **Service Type:** `HTTP`
* **URL:** `http://localhost:3005` (atau masukkan IP Proxmox/CasaOS Anda: `http://192.168.x.x:3005`)

#### B. Hostname Wildcard (Sangat Penting untuk Tenant Group!)
Agar seluruh tenant kelompok arisan yang mendaftar (seperti `rt05.arisan.domainanda.com`) langsung aktif secara otomatis:
* **Subdomain:** `*.arisan`
* **Domain:** `domainanda.com`
* **Path:** (Kosongkan)
* **Service Type:** `HTTP`
* **URL:** `http://localhost:3005` (arahkan ke port aplikasi yang sama)

---

## 🔒 Langkah 4: Penyetelan Variabel Lingkungan Produksi

Buka berkas `.env` atau menu *Environment* di Docker Compose CasaOS, lalu sesuaikan variabel lingkungan produksi berikut untuk keamanan tinggi:

```env
# 1. Nonaktifkan mode pengembangan Next.js
NODE_ENV=production

# 2. Database URL terarah ke volume Docker persisten kita
DATABASE_URL=file:/app/db/prod.db

# 3. Kunci Rahasia Enkripsi JWT NextAuth (Wajib diganti!)
# Buat kunci acak via terminal menggunakan perintah: openssl rand -base64 32
NEXTAUTH_SECRET=ganti-dengan-kunci-enkripsi-jwt-yang-sangat-aman-homelab

# 4. Domain Utama Aplikasi Anda (Sesuai setelan Cloudflare Hostname Utama)
NEXTAUTH_URL=https://arisan.domainanda.com
```

---

## 💾 Langkah 5: Pemeliharaan & Pencadangan (*Backups*)

Salah satu keunggulan terbesar arsitektur homelab SQLite adalah kemudahan pencadangan dan pengelolaan data langsung:

1. **Cara Backup Database:**
   Anda hanya perlu menyalin satu berkas di lokasi CasaOS ini secara berkala:
   ```bash
   cp /DATA/AppData/lotre/db/prod.db /DATA/AppData/lotre/db/prod_backup_$(date +%F).db
   ```

2. **Cara Mengakses & Mengedit Database Langsung:**
   Karena menggunakan SQLite, seluruh data disimpan dalam satu berkas fisik di `/DATA/AppData/lotre/db/prod.db`. Anda memiliki dua cara terbaik untuk melihat atau mengedit data secara visual:

   * **Metode A: Menggunakan Prisma Studio (GUI Web Bawaan - Sangat Direkomendasikan)**
     *(Catatan: Pastikan Anda sudah memetakan port `"5555:5555"` pada berkas `docker-compose.yml` di server Anda seperti versi terbaru yang sudah kami buat, agar port 5555 dapat diakses dari browser luar kontainer)*

     Anda dapat membuka aplikasi antarmuka database visual langsung melalui web browser dengan mengetikkan perintah ini di terminal server Anda:
     ```bash
     cd /DATA/AppData/lotre
     docker compose exec lotre-app npx prisma studio --port 5555 --hostname 0.0.0.0
     ```
     Setelah perintah berjalan, buka browser dan akses alamat:
     `http://<IP-SERVER-CASAOS>:5555`
     Anda dapat dengan mudah mencari, menambah, memperbarui, atau menghapus baris tabel di sini. Jika sudah selesai, cukup tekan `Ctrl + C` pada terminal server Anda untuk menghentikan Prisma Studio dengan aman.

   * **Metode B: Menggunakan Aplikasi Desktop (DB Browser for SQLite / DBeaver)**
     1. Unduh berkas `/DATA/AppData/lotre/db/prod.db` dari server ke komputer Anda menggunakan aplikasi SFTP (seperti Cyberduck/FileZilla) atau fitur File Manager bawaan CasaOS.
     2. Buka berkas tersebut menggunakan aplikasi visual gratis seperti **[DB Browser for SQLite](https://sqlitebrowser.org/)** di komputer Anda untuk melakukan manipulasi data secara offline.
     3. Simpan perubahan Anda, lalu matikan sementara kontainer di server (`docker compose down`).
     4. Unggah kembali berkas `prod.db` yang telah dimodifikasi untuk menimpa berkas lama di server, kemudian nyalakan kembali kontainer (`docker compose up -d`). *(Penting: Selalu buat cadangan/backup database sebelum menimpa berkas produksi!)*

3. **Cara Melihat Log Kontainer:**
   ```bash
   docker logs -f lotre-arisan-app
   ```

4. **Cara Menerapkan Pembaruan Kode Baru (*Update App*):**
   ```bash
   cd /DATA/AppData/lotre
   git pull
   docker compose down
   docker compose up -d --build
   ```

Aplikasi **Lotre** Anda kini siap melayani kelompok arisan Anda dan kerabat Anda secara lokal, mandiri, dan berkelas dunia! 🛡️✨
