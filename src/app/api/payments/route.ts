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

    const { anggotaId, periodeKe, status, tenantSlug } = body as Record<string, unknown>;

    if (!anggotaId || typeof anggotaId !== "string") {
      return NextResponse.json({ error: "anggotaId wajib diisi." }, { status: 400 });
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

    const existingPayment = await db.setoran.findFirst({
      where: { tenantId, anggotaId, periodeKe: parsedPeriode },
    });

    const updatedPayment = existingPayment
      ? await db.setoran.update({
          where: { id: existingPayment.id },
          data: { status: validatedStatus, tanggalBayar },
        })
      : await db.setoran.create({
          data: { tenantId, anggotaId, periodeKe: parsedPeriode, nominal, status: validatedStatus, tanggalBayar },
        });

    // Invalidate member cache for this tenant
    apiCache.invalidate(`members:${tenantId}`);

    return NextResponse.json({ payment: updatedPayment });
  } catch (error) {
    console.error("PUT /api/payments error:", error);
    return NextResponse.json({ error: "Gagal memperbarui status setoran." }, { status: 500 });
  }
}
