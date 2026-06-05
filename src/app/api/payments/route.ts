import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { resolveTenantId } from "@/lib/tenant";
import { apiCache } from "@/lib/cache";


export async function PUT(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
    }

    const { anggotaId, anggotaIds, periodeKe, status, tenantSlug } = body as Record<string, unknown>;

    const ids = Array.isArray(anggotaIds)
      ? (anggotaIds as string[])
      : (anggotaId && typeof anggotaId === "string" ? [anggotaId] : []);

    if (ids.length === 0) {
      return NextResponse.json({ error: "anggotaId atau anggotaIds wajib diisi." }, { status: 400 });
    }
    if (status !== "LUNAS" && status !== "BELUM_BAYAR") {
      return NextResponse.json({ error: "Status harus 'LUNAS' atau 'BELUM_BAYAR'." }, { status: 400 });
    }

    // After guard, narrow to literal union type for Prisma compatibility
    const validatedStatus = status as "LUNAS" | "BELUM_BAYAR";

    const parsedPeriode = Number(periodeKe);
    if (!Number.isInteger(parsedPeriode) || parsedPeriode < 1) {
      return NextResponse.json({ error: "periodeKe harus bilangan bulat positif." }, { status: 400 });
    }

    const tenantId = await resolveTenantId(typeof tenantSlug === "string" ? tenantSlug : null);

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 400 });
    }

    // Infer nominal from existing setoran for this tenant
    const sampleSetoran = await db.setoran.findFirst({
      where: { tenantId },
      select: { nominal: true },
    });
    const nominal = sampleSetoran?.nominal ?? 200000;

    const isLunas = validatedStatus === "LUNAS";
    const tanggalBayar = isLunas ? new Date() : null;

    const results = await db.$transaction(async (tx) => {
      const updatedList = [];
      for (const id of ids) {
        const existingPayment = await tx.setoran.findFirst({
          where: { tenantId, anggotaId: id, periodeKe: parsedPeriode },
        });

        const updated = existingPayment
          ? await tx.setoran.update({
              where: { id: existingPayment.id },
              data: { status: validatedStatus, tanggalBayar },
            })
          : await tx.setoran.create({
              data: { tenantId, anggotaId: id, periodeKe: parsedPeriode, nominal, status: validatedStatus, tanggalBayar },
            });
        updatedList.push(updated);
      }
      return updatedList;
    });

    // Invalidate member cache for this tenant
    apiCache.invalidate(`members:${tenantId}`);

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    console.error("PUT /api/payments error:", error);
    return NextResponse.json({ error: "Gagal memperbarui status setoran." }, { status: 500 });
  }
}
