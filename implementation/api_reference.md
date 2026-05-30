# Referensi API — Lotre SaaS

Dokumentasi lengkap semua endpoint API yang tersedia di platform Lotre.

> **Base URL (Development):** `http://localhost:3000`  
> **Base URL (Production):** `https://lotre.com`

---

## Konvensi Umum

### Request Headers
```
Content-Type: application/json
Cookie: next-auth.session-token=...  (otomatis dari browser)
```

### Format Respons Error
```json
{ "error": "Pesan error yang bisa dibaca manusia." }
```

### HTTP Status Codes yang Digunakan

| Code | Arti |
|------|------|
| `200` | Berhasil (GET, PUT) |
| `201` | Berhasil dibuat (POST) |
| `400` | Request tidak valid / tenant tidak ditemukan |
| `401` | Belum login |
| `403` | Tidak punya izin (bukan Superadmin) |
| `404` | Data tidak ditemukan |
| `409` | Konflik data (slug sudah dipakai, pemenang duplikat) |
| `422` | Validasi gagal (bulk import) |
| `500` | Error server internal |

---

## Autentikasi

### `POST /api/auth/register`
Mendaftarkan akun baru sekaligus membuat workspace (Tenant) pertama.

**Auth:** Tidak diperlukan

**Request:**
```json
{
  "namaLengkap": "Budi Santoso",
  "email": "budi@example.com",
  "password": "minimaldelapan",
  "namaGrup": "Arisan Keluarga Cemara",
  "slug": "keluarga-cemara"
}
```

**Validasi:**
- `namaLengkap` min 3 karakter
- `email` format valid dan belum terdaftar
- `password` min 8 karakter
- `namaGrup` min 3 karakter
- `slug` hanya huruf kecil, angka, tanda hubung; min 3 karakter; belum dipakai

**Response `201`:**
```json
{
  "success": true,
  "message": "Akun berhasil dibuat! Silakan masuk.",
  "userId": "uuid-user"
}
```

---

### `POST /api/auth/[...nextauth]`
Handler NextAuth standar. Digunakan oleh library `next-auth` di frontend.

- **Login:** `signIn("credentials", { email, password })`
- **Logout:** `signOut()`
- **Session:** `useSession()` / `getServerSession(authOptions)`

---

## Manajemen Anggota

### `GET /api/members`
Mengambil semua anggota beserta status iuran dan undian pada workspace aktif.

**Auth:** Session diperlukan  
**Query Params:** `tenantSlug` (string, required)

**Response `200`:**
```json
{
  "members": [
    {
      "id": "uuid-anggota",
      "name": "Siti Rahayu",
      "whatsapp": "081234567890",
      "status": "lunas",
      "hasWon": false,
      "payments": [
        {
          "id": "uuid-setoran",
          "periodeKe": 1,
          "nominal": 200000,
          "status": "LUNAS",
          "tanggalBayar": "2026-05-01T00:00:00Z"
        }
      ],
      "winners": []
    }
  ],
  "nominalIuran": 200000
}
```

> **Cache:** Hasil di-cache 30 detik per `tenantId`.

---

### `POST /api/members`
Menambahkan satu anggota baru ke workspace aktif.

**Auth:** Session diperlukan

**Request:**
```json
{
  "name": "Ahmad Rizki",
  "whatsapp": "081298765432",
  "tenantSlug": "keluarga-cemara"
}
```

**Validasi:**
- `name` min 2 karakter
- `whatsapp` 9-15 digit angka (karakter non-angka otomatis dihapus)

**Behavior:**
- Anggota baru otomatis mendapat record `Setoran BELUM_BAYAR` untuk periode aktif saat ini
- Periode aktif = `max(periodeKe dari Pemenang) + 1`, atau `1` jika belum ada pemenang

**Response `201`:**
```json
{
  "member": {
    "id": "uuid-baru",
    "nama": "Ahmad Rizki",
    "whatsapp": "081298765432",
    "tenantId": "uuid-tenant"
  }
}
```

---

### `POST /api/members/import`
Import massal anggota dari array JSON.

**Auth:** Session diperlukan

**Request:**
```json
{
  "members": [
    { "name": "Nama Anggota 1", "whatsapp": "081234567890" },
    { "name": "Nama Anggota 2", "whatsapp": "081298765432" }
  ],
  "tenantSlug": "keluarga-cemara",
  "nominal": 200000
}
```

**Batasan:**
- Maksimal **500 baris** per request
- Duplikat by WhatsApp otomatis di-skip (bukan error)

**Response `201`:**
```json
{
  "message": "Berhasil mengimpor 8 anggota baru.",
  "imported": 8,
  "duplicates": 2,
  "skipped": 0
}
```

**Response `422` (validasi gagal):**
```json
{
  "errors": [
    "Baris 3: Nama tidak valid (minimum 2 karakter).",
    "Baris 7: Nomor \"08abc\" tidak valid (9–15 digit)."
  ]
}
```

---

## Iuran & Pembayaran

### `PUT /api/payments`
Toggle status pembayaran iuran anggota untuk periode tertentu.

**Auth:** Session diperlukan

**Request:**
```json
{
  "anggotaId": "uuid-anggota",
  "periodeKe": 3,
  "status": "LUNAS",
  "tenantSlug": "keluarga-cemara"
}
```

**Behavior:**
- Jika record `Setoran` sudah ada → `UPDATE status`
- Jika belum ada → `CREATE` record baru (upsert)
- `tanggalBayar` otomatis diset ke `now()` saat status `LUNAS`, `null` saat `BELUM_BAYAR`

**Response `200`:**
```json
{
  "payment": {
    "id": "uuid-setoran",
    "status": "LUNAS",
    "tanggalBayar": "2026-05-30T07:00:00Z"
  }
}
```

---

## Undian / Pemenang

### `POST /api/winners`
Mencatat pemenang undian arisan. Sekaligus menyiapkan setoran periode berikutnya untuk semua anggota.

**Auth:** Session diperlukan

**Request:**
```json
{
  "anggotaId": "uuid-anggota-pemenang",
  "periodeKe": 3,
  "totalDiterima": 2000000,
  "tenantSlug": "keluarga-cemara"
}
```

**Validasi:**
- `anggotaId` harus merupakan anggota dari tenant yang sama
- `periodeKe` belum pernah memiliki pemenang (cek duplikat)

**Atomic Transaction:**
1. `INSERT` record `Pemenang`
2. `SELECT` semua anggota `ACTIVE` di tenant
3. `INSERT` `Setoran BELUM_BAYAR` untuk semua anggota di `periodeKe + 1`

**Response `201`:**
```json
{
  "winner": {
    "id": "uuid-pemenang",
    "anggotaId": "uuid-anggota",
    "periodeKe": 3,
    "totalDiterima": 2000000,
    "tanggalMenang": "2026-05-30T07:00:00Z"
  }
}
```

### `DELETE /api/winners`
Membatalkan/menganulir pemenang undian arisan untuk putaran tertentu.

**Auth:** Session diperlukan (harus Admin Tenant)  
**Query Params:**
- `tenantSlug` (string, required): Slug kelompok arisan aktif
- `periodeKe` (integer, required): Periode undian yang ingin dibatalkan

**Atomic Transaction:**
1. `DELETE` record `Pemenang` untuk periode yang ditentukan
2. `DELETE` record `Setoran` pada `periodeKe + 1` yang sebelumnya di-seed secara otomatis oleh transaksi POST

**Response `200`:**
```json
{
  "success": true,
  "message": "Pemenang berhasil dibatalkan."
}
```

**Response `404`:**
```json
{
  "error": "Data pemenang tidak ditemukan."
}
```

---

## Workspace / Tenant

### `GET /api/tenants`
Mengambil semua workspace (tenant) yang dimiliki user yang sedang login.

**Auth:** Session diperlukan

**Response `200`:**
```json
{
  "tenants": [
    {
      "id": "uuid-tenant",
      "namaGrup": "Arisan Keluarga Cemara",
      "slug": "keluarga-cemara",
      "plan": "free",
      "nominalIuran": 200000,
      "status": "ACTIVE",
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### `POST /api/tenants`
Membuat workspace (kelompok arisan) baru untuk user yang login.

**Auth:** Session diperlukan

**Request:**
```json
{
  "namaGrup": "Arisan RT 007",
  "slug": "rt-007",
  "plan": "free",
  "nominalIuran": 300000
}
```

**Atomic Transaction:**
1. `CREATE Tenant`
2. `CREATE Anggota` (admin sebagai anggota pertama)
3. `CREATE Setoran BELUM_BAYAR` periode 1 untuk admin

**Response `201`:**
```json
{
  "success": true,
  "message": "Kelompok arisan baru berhasil dibuat!",
  "tenant": { "id": "...", "slug": "rt-007", ... }
}
```

---

### `PUT /api/tenants`
Mengajukan permintaan upgrade workspace ke paket Premium.

**Auth:** Session diperlukan

**Request:**
```json
{
  "tenantSlug": "keluarga-cemara"
}
```

**Behavior:**
- Status plan diubah ke `"pending_premium"`
- Superadmin perlu menyetujui secara manual via panel `/superadmin`
- Tidak bisa diajukan jika sudah `premium` atau sudah `pending_premium`

**Response `200`:**
```json
{
  "success": true,
  "message": "Permintaan upgrade berhasil diajukan! ...",
  "tenant": { "plan": "pending_premium", ... }
}
```

---

## Pengaturan Tenant

### `PUT /api/tenant/settings`
Mengubah nominal iuran untuk workspace aktif user.

**Auth:** Session diperlukan (harus `TENANT_ADMIN`)

**Request:**
```json
{
  "nominalIuran": 250000
}
```

**Atomic Transaction:**
1. `UPDATE Tenant.nominalIuran`
2. `UPDATE Setoran.nominal` untuk semua setoran `BELUM_BAYAR` pada periode aktif dan seterusnya (periode ≥ current period)

**Response `200`:**
```json
{
  "success": true,
  "message": "Pengaturan iuran berhasil diperbarui.",
  "tenant": { "nominalIuran": 250000, ... }
}
```

---

## Ekspor Data

### `GET /api/export`
Mengunduh seluruh data workspace dalam format JSON.

**Auth:** Session diperlukan  
**Query Params:** `tenantSlug` (string, required)

**Response `200`:** File JSON dengan header `Content-Disposition: attachment`

```json
{
  "meta": {
    "exportedAt": "2026-05-30T07:00:00Z",
    "exportVersion": "1.0",
    "system": "Lotre SaaS"
  },
  "tenant": { "id": "...", "namaGrup": "...", ... },
  "summary": {
    "totalAnggota": 12,
    "totalSetoran": 144,
    "totalPemenang": 3,
    "totalKasTerkumpul": 8400000
  },
  "members": [...],
  "payments": [...],
  "winners": [...]
}
```

---

## Backfill Pemenang Lama

### `POST /api/backfill`
Mengisi riwayat pemenang dari putaran arisan sebelum bergabung ke Lotre.

**Auth:** Session diperlukan

**Request:**
```json
{
  "tenantSlug": "keluarga-cemara",
  "winners": [
    {
      "memberId": "uuid-anggota",
      "periodeKe": 1,
      "totalDiterima": 1200000,
      "tanggalMenang": "2026-01-15"
    }
  ]
}
```

**Behavior:**
- Membuat record `Pemenang` untuk periode yang sudah berlalu
- Menandai anggota sebagai `hasWon = true` (tidak akan muncul di undian berikutnya)

---

## Superadmin API

> ⚠️ Endpoint berikut **hanya bisa diakses** oleh user dengan role `SUPERADMIN`.

### `GET /api/superadmin/tenants`
Mengambil seluruh data tenant di platform beserta statistik agregat global.

**Auth:** SUPERADMIN session

**Response `200`:**
```json
{
  "tenants": [
    {
      "id": "uuid",
      "namaGrup": "Arisan Keluarga Cemara",
      "slug": "keluarga-cemara",
      "plan": "free",
      "status": "ACTIVE",
      "suspendReason": null,
      "createdAt": "2026-01-01T00:00:00Z",
      "owner": {
        "namaLengkap": "Budi Santoso",
        "email": "budi@example.com"
      },
      "_count": {
        "members": 10,
        "winners": 3
      }
    }
  ],
  "stats": {
    "totalTenants": 45,
    "freeTenants": 38,
    "premiumTenants": 5,
    "pendingPremiumTenants": 2,
    "totalMembers": 520,
    "totalWinners": 87,
    "totalPlatformKas": 156000000
  }
}
```

> **Cache:** Hasil di-cache 30 detik dengan key `superadmin:tenants`.

---

### `PUT /api/superadmin/tenants`
Melakukan tindakan administrasi pada tenant tertentu.

**Auth:** SUPERADMIN session

**Request — Setujui Premium:**
```json
{
  "tenantId": "uuid-tenant",
  "action": "togglePlan",
  "plan": "premium"
}
```

**Request — Tolak / Downgrade ke Free:**
```json
{
  "tenantId": "uuid-tenant",
  "action": "togglePlan",
  "plan": "free"
}
```

**Request — Suspend Tenant:**
```json
{
  "tenantId": "uuid-tenant",
  "action": "toggleStatus",
  "status": "SUSPENDED",
  "suspendReason": "Melanggar Ketentuan Layanan"
}
```

**Request — Aktifkan Kembali:**
```json
{
  "tenantId": "uuid-tenant",
  "action": "toggleStatus",
  "status": "ACTIVE"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Paket berhasil diperbarui.",
  "tenant": { ... }
}
```

> Setiap `PUT` ke endpoint ini **menginvalidate** cache `superadmin:tenants`.
