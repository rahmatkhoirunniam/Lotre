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
