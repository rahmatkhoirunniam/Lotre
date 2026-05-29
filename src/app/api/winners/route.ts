import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { resolveTenantId } from "@/lib/tenant";
import { apiCache } from "@/lib/cache";


export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
    }

    const { anggotaId, periodeKe, totalDiterima, tenantSlug } = body as Record<string, unknown>;

    if (!anggotaId || typeof anggotaId !== "string") {
      return NextResponse.json({ error: "anggotaId wajib diisi." }, { status: 400 });
    }

    const parsedPeriode = Number(periodeKe);
    if (!Number.isInteger(parsedPeriode) || parsedPeriode < 1) {
      return NextResponse.json({ error: "periodeKe harus bilangan bulat positif." }, { status: 400 });
    }

    const parsedTotal = Number(totalDiterima);
    if (isNaN(parsedTotal) || parsedTotal < 0) {
      return NextResponse.json({ error: "totalDiterima harus berupa angka non-negatif." }, { status: 400 });
    }

    const tenantId = await resolveTenantId(typeof tenantSlug === "string" ? tenantSlug : null);

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 400 });
    }

    // Verify anggota belongs to this tenant
    const anggota = await db.anggota.findFirst({
      where: { id: anggotaId, tenantId },
      select: { id: true },
    });

    if (!anggota) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan atau bukan milik tenant ini." },
        { status: 400 }
      );
    }

    // Guard against duplicate winner in the same period
    const existingWinner = await db.pemenang.findFirst({
      where: { tenantId, periodeKe: parsedPeriode },
    });

    if (existingWinner) {
      return NextResponse.json(
        { error: `Putaran ke-${parsedPeriode} sudah memiliki pemenang.` },
        { status: 409 }
      );
    }

    // Atomic Transaction: Create Winner + Seed next period's Setoran for all active members
    const winner = await db.$transaction(async (tx) => {
      // 1. Create winner record
      const newWinner = await tx.pemenang.create({
        data: {
          tenantId,
          anggotaId,
          periodeKe: parsedPeriode,
          totalDiterima: parsedTotal,
        },
      });

      // 2. Fetch tenant to get the active nominalIuran
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { nominalIuran: true },
      });
      const nominal = tenant?.nominalIuran ?? 200000;

      // 3. Fetch all active members of this tenant
      const activeMembers = await tx.anggota.findMany({
        where: { tenantId, status: "ACTIVE" },
        select: { id: true },
      });

      // 4. Create Setoran for next period for all active members
      const nextPeriode = parsedPeriode + 1;
      const setoranPromises = activeMembers.map((member) => 
        tx.setoran.create({
          data: {
            tenantId,
            anggotaId: member.id,
            periodeKe: nextPeriode,
            nominal,
            status: "BELUM_BAYAR",
          },
        })
      );
      await Promise.all(setoranPromises);

      return newWinner;
    });

    // Invalidate caches: member data & superadmin aggregate stats
    apiCache.invalidate(`members:${tenantId}`);
    apiCache.invalidate("superadmin:tenants");

    return NextResponse.json({ winner }, { status: 201 });
  } catch (error) {
    console.error("POST /api/winners error:", error);
    return NextResponse.json({ error: "Gagal menyimpan data pemenang." }, { status: 500 });
  }
}
