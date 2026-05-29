import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import db from "@/lib/db";
import { apiCache } from "@/lib/cache";


export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Hanya Admin Kelompok yang dapat mengubah pengaturan ini." }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant tidak terasosiasi dengan akun Anda." }, { status: 400 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    const { nominalIuran } = body as Record<string, unknown>;
    const parsedNominal = Number(nominalIuran);

    if (isNaN(parsedNominal) || parsedNominal <= 0) {
      return NextResponse.json({ error: "Nominal iuran harus berupa angka positif." }, { status: 400 });
    }

    // Atomic transaction: Update Tenant + Update all unpaid Setoran
    const updatedTenant = await db.$transaction(async (tx) => {
      // 1. Update nominal iuran in Tenant
      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { nominalIuran: parsedNominal },
      });

      // 2. Determine latest winner period to know current period
      const latestWinner = await tx.pemenang.findFirst({
        where: { tenantId },
        orderBy: { periodeKe: "desc" },
        select: { periodeKe: true },
      });
      const currentPeriod = (latestWinner?.periodeKe ?? 0) + 1;

      // 3. Update nominal for all BELUM_BAYAR payments on or after the current period
      await tx.setoran.updateMany({
        where: {
          tenantId,
          status: "BELUM_BAYAR",
          periodeKe: { gte: currentPeriod },
        },
        data: {
          nominal: parsedNominal,
        },
      });

      return tenant;
    });

    // Invalidate member cache so next fetch reflects updated nominalIuran
    apiCache.invalidate(`members:${tenantId}`);

    return NextResponse.json({
      success: true,
      message: "Pengaturan iuran berhasil diperbarui.",
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error("PUT /api/tenant/settings error:", error);
    return NextResponse.json({ error: "Gagal memperbarui pengaturan iuran." }, { status: 500 });
  }
}
