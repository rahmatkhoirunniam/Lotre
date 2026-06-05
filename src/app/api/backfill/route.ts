import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { resolveTenantId } from "@/lib/tenant";
import { apiCache } from "@/lib/cache";

interface PastWinnerEntry {
  anggotaId: string;
  periodeKe: number;
  totalDiterima: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
    }

    const { tenantSlug, currentPeriod, pastWinners, nominal } = body as Record<string, unknown>;

    const resolvedNominal = typeof nominal === "number" && nominal > 0 ? nominal : 200000;

    // Validate currentPeriod
    const parsedCurrentPeriod = Number(currentPeriod);
    if (!Number.isInteger(parsedCurrentPeriod) || parsedCurrentPeriod < 2) {
      return NextResponse.json(
        { error: "'currentPeriod' harus berupa bilangan bulat ≥ 2." },
        { status: 400 }
      );
    }

    // Validate pastWinners array
    if (!Array.isArray(pastWinners) || pastWinners.length === 0) {
      return NextResponse.json(
        { error: "'pastWinners' harus berupa array tidak kosong." },
        { status: 400 }
      );
    }

    for (const entry of pastWinners as PastWinnerEntry[]) {
      if (!entry.anggotaId || typeof entry.anggotaId !== "string") {
        return NextResponse.json({ error: "Setiap entri harus memiliki anggotaId string." }, { status: 400 });
      }
      if (!Number.isInteger(entry.periodeKe) || entry.periodeKe < 1) {
        return NextResponse.json({ error: "periodeKe harus bilangan bulat positif." }, { status: 400 });
      }
      if (typeof entry.totalDiterima !== "number" || entry.totalDiterima < 0) {
        return NextResponse.json({ error: "totalDiterima harus angka non-negatif." }, { status: 400 });
      }
      if (entry.periodeKe >= parsedCurrentPeriod) {
        return NextResponse.json(
          { error: `periodeKe ${entry.periodeKe} harus < currentPeriod (${parsedCurrentPeriod}).` },
          { status: 400 }
        );
      }
    }

    const tenantId = await resolveTenantId(typeof tenantSlug === "string" ? tenantSlug : null);

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 400 });
    }

    // Verify all anggotaId belong to this tenant
    const uniqueAnggotaIds = [...new Set((pastWinners as PastWinnerEntry[]).map((w) => w.anggotaId))];
    const validAnggota = await db.anggota.findMany({
      where: { tenantId, id: { in: uniqueAnggotaIds } },
      select: { id: true },
    });
    const validIdSet = new Set(validAnggota.map((a) => a.id));
    const invalidIds = uniqueAnggotaIds.filter((id) => !validIdSet.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `anggotaId tidak valid atau bukan milik tenant: ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch all tenant members for Setoran seeding
    const allMembers = await db.anggota.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const allMemberIds = allMembers.map((m) => m.id);
    const pastPeriodes = (pastWinners as PastWinnerEntry[]).map((w) => w.periodeKe);

    // Atomic backfill transaction
    await db.$transaction(async (tx) => {
      // 1. Remove existing records for these periods
      await tx.pemenang.deleteMany({
        where: { tenantId, periodeKe: { in: pastPeriodes } },
      });
      await tx.setoran.deleteMany({
        where: { tenantId, periodeKe: { in: [...pastPeriodes, parsedCurrentPeriod] } },
      });

      // 2. Create Pemenang history
      await tx.pemenang.createMany({
        data: (pastWinners as PastWinnerEntry[]).map((w) => ({
          tenantId,
          anggotaId: w.anggotaId,
          periodeKe: w.periodeKe,
          totalDiterima: w.totalDiterima,
          tanggalMenang: new Date(),
        })),
      });

      // 3. Seed LUNAS Setoran for all past periods
      const pastSetoranData = pastPeriodes.flatMap((periodeKe) =>
        allMemberIds.map((memberId) => ({
          tenantId,
          anggotaId: memberId,
          periodeKe,
          nominal: resolvedNominal,
          status: "LUNAS" as const,
          tanggalBayar: new Date(),
        }))
      );
      await tx.setoran.createMany({ data: pastSetoranData });

      // 4. Seed BELUM_BAYAR Setoran for current period
      await tx.setoran.createMany({
        data: allMemberIds.map((memberId) => ({
          tenantId,
          anggotaId: memberId,
          periodeKe: parsedCurrentPeriod,
          nominal: resolvedNominal,
          status: "BELUM_BAYAR" as const,
        })),
      });
    });

    // Invalidate caches: member data & superadmin aggregate stats
    apiCache.invalidate(`members:${tenantId}`);
    apiCache.invalidate("superadmin:tenants");

    return NextResponse.json({
      message: `Backfill berhasil. ${pastWinners.length} putaran lampau direkonstruksi. Putaran aktif: ${parsedCurrentPeriod}.`,
      backfilledPeriods: [...pastPeriodes].sort((a, b) => a - b),
      activePeriod: parsedCurrentPeriod,
      totalMembersSeeded: allMemberIds.length,
    });
  } catch (error) {
    console.error("POST /api/backfill error:", error);
    return NextResponse.json({ error: "Gagal melakukan backfill data." }, { status: 500 });
  }
}
