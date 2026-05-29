import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { resolveTenant } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolveTenant(searchParams.get("tenantSlug"));

    if (!resolved) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 400 });
    }

    const { id: tenantId, slug: tenantSlugLabel } = resolved;

    // Parallel queries for maximum performance
    const [tenant, members, payments, winners] = await Promise.all([
      db.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, namaGrup: true, slug: true, plan: true, status: true, createdAt: true },
      }),
      db.anggota.findMany({
        where: { tenantId },
        orderBy: { createdAt: "asc" },
        select: { id: true, nama: true, whatsapp: true, status: true, createdAt: true },
      }),
      db.setoran.findMany({
        where: { tenantId },
        orderBy: [{ periodeKe: "asc" }, { createdAt: "asc" }],
        select: { id: true, anggotaId: true, periodeKe: true, nominal: true, status: true, tanggalBayar: true, createdAt: true },
      }),
      db.pemenang.findMany({
        where: { tenantId },
        orderBy: { periodeKe: "asc" },
        select: { id: true, anggotaId: true, periodeKe: true, tanggalMenang: true, totalDiterima: true, createdAt: true },
      }),
    ]);

    const exportPayload = {
      meta: {
        exportedAt: new Date().toISOString(),
        exportVersion: "1.0",
        system: "Lotre SaaS",
      },
      tenant,
      summary: {
        totalAnggota: members.length,
        totalSetoran: payments.length,
        totalPemenang: winners.length,
        totalKasTerkumpul: payments
          .filter((p) => p.status === "LUNAS")
          .reduce((sum, p) => sum + Number(p.nominal), 0),
      },
      members,
      payments,
      winners,
    };

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `lotre_backup_${tenantSlugLabel}_${dateStr}.json`;

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache",
      },
    });
  } catch (error) {
    console.error("GET /api/export error:", error);
    return NextResponse.json({ error: "Gagal mengekspor data." }, { status: 500 });
  }
}
