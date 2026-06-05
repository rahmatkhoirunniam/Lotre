import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { resolveTenantId } from "@/lib/tenant";
import { apiCache } from "@/lib/cache";

const MEMBERS_TTL = 30_000; // 30 seconds


// ─── GET /api/members ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = await resolveTenantId(searchParams.get("tenantSlug"));

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 400 });
    }

    // ── Cache hit ─────────────────────────────────────────────────────────────
    const cacheKey = `members:${tenantId}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { nominalIuran: true }
    });
    const nominalIuran = tenant?.nominalIuran ?? 200000;

    const members = await db.anggota.findMany({
      where: { tenantId },
      include: { payments: true, winners: true },
      orderBy: { createdAt: "asc" },
    });

    const payload = { members, nominalIuran };

    // ── Store in cache ────────────────────────────────────────────────────────
    apiCache.set(cacheKey, payload, MEMBERS_TTL);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET /api/members error:", error);
    return NextResponse.json({ error: "Gagal memuat data anggota." }, { status: 500 });
  }
}

// ─── POST /api/members ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
    }

    const { name, whatsapp, tenantSlug } = body as Record<string, unknown>;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
    }
    if (!whatsapp || typeof whatsapp !== "string") {
      return NextResponse.json({ error: "Nomor WhatsApp wajib diisi." }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanWA = whatsapp.replace(/\D/g, "");

    if (cleanWA.length < 9 || cleanWA.length > 15) {
      return NextResponse.json({ error: "Nomor WhatsApp tidak valid (9–15 digit)." }, { status: 400 });
    }

    const tenantId = await resolveTenantId(typeof tenantSlug === "string" ? tenantSlug : null);

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 400 });
    }

    // Determine active period from latest winner
    const latestWinner = await db.pemenang.findFirst({
      where: { tenantId },
      orderBy: { periodeKe: "desc" },
      select: { periodeKe: true },
    });
    const activePeriod = (latestWinner?.periodeKe ?? 0) + 1;

    // Infer nominal from existing setoran
    const sampleSetoran = await db.setoran.findFirst({
      where: { tenantId },
      select: { nominal: true },
    });
    const nominal = sampleSetoran?.nominal ?? 200000;

    // Atomic: create member + seed pending setoran
    const newMember = await db.$transaction(async (tx) => {
      const member = await tx.anggota.create({
        data: { nama: cleanName, whatsapp: cleanWA, tenantId },
      });
      await tx.setoran.create({
        data: { tenantId, anggotaId: member.id, periodeKe: activePeriod, nominal, status: "BELUM_BAYAR" as const },
      });
      return member;
    });

    // Invalidate members cache for this tenant so next GET fetches fresh data
    apiCache.invalidate(`members:${tenantId}`);

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    console.error("POST /api/members error:", error);
    return NextResponse.json({ error: "Gagal menyimpan anggota baru." }, { status: 500 });
  }
}

// ─── PUT /api/members ─────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
    }

    const { id, name, whatsapp, tenantSlug } = body as Record<string, unknown>;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID Anggota wajib ditentukan." }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
    }
    if (!whatsapp || typeof whatsapp !== "string") {
      return NextResponse.json({ error: "Nomor WhatsApp wajib diisi." }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanWA = whatsapp.replace(/\D/g, "");

    if (cleanWA.length < 9 || cleanWA.length > 15) {
      return NextResponse.json({ error: "Nomor WhatsApp tidak valid (9–15 digit)." }, { status: 400 });
    }

    const tenantId = await resolveTenantId(typeof tenantSlug === "string" ? tenantSlug : null);

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant tidak ditemukan atau akses ditolak." }, { status: 400 });
    }

    // Verify member exists and belongs to this tenant
    const member = await db.anggota.findUnique({
      where: { id },
      select: { tenantId: true }
    });

    if (!member || member.tenantId !== tenantId) {
      return NextResponse.json({ error: "Anggota tidak ditemukan pada kelompok ini." }, { status: 404 });
    }

    // Update member name and whatsapp
    const updatedMember = await db.anggota.update({
      where: { id },
      data: {
        nama: cleanName,
        whatsapp: cleanWA,
      },
    });

    // Invalidate members cache for this tenant
    apiCache.invalidate(`members:${tenantId}`);

    return NextResponse.json({ member: updatedMember }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/members error:", error);
    return NextResponse.json({ error: "Gagal memperbarui data anggota." }, { status: 500 });
  }
}

// ─── DELETE /api/members ──────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const tenantSlug = searchParams.get("tenantSlug");

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID Anggota wajib ditentukan." }, { status: 400 });
    }

    const tenantId = await resolveTenantId(tenantSlug);

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant tidak ditemukan atau akses ditolak." }, { status: 400 });
    }

    // Verify member exists and belongs to this tenant
    const member = await db.anggota.findUnique({
      where: { id },
      select: { tenantId: true }
    });

    if (!member || member.tenantId !== tenantId) {
      return NextResponse.json({ error: "Anggota tidak ditemukan pada kelompok ini." }, { status: 404 });
    }

    // Delete member (cascade will delete payments and winners automatically)
    await db.anggota.delete({
      where: { id }
    });

    // Invalidate members cache for this tenant
    apiCache.invalidate(`members:${tenantId}`);

    return NextResponse.json({ success: true, message: "Anggota berhasil dihapus." }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/members error:", error);
    return NextResponse.json({ error: "Gagal menghapus data anggota." }, { status: 500 });
  }
}
