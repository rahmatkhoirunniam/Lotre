import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import db from "@/lib/db";

// ─── GET /api/tenants (List owned workspaces) ──────────────────────────────────
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const tenants = await db.tenant.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error("GET /api/tenants error:", error);
    return NextResponse.json({ error: "Gagal memuat daftar kelompok arisan." }, { status: 500 });
  }
}

// ─── POST /api/tenants (Create new workspace) ─────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    const { namaGrup, slug, plan, nominalIuran } = body as Record<string, unknown>;

    if (!namaGrup || typeof namaGrup !== "string" || namaGrup.trim().length < 3) {
      return NextResponse.json({ error: "Nama kelompok arisan minimal 3 karakter." }, { status: 400 });
    }

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Slug/Subdomain tidak valid." }, { status: 400 });
    }

    const safeSlug = slug
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);

    if (safeSlug.length < 3) {
      return NextResponse.json({ error: "Slug minimal 3 karakter (hanya huruf, angka, tanda hubung)." }, { status: 400 });
    }

    // Check slug uniqueness
    const existingTenant = await db.tenant.findUnique({ where: { slug: safeSlug } });
    if (existingTenant) {
      return NextResponse.json({ error: "Subdomain/slug sudah digunakan. Silakan gunakan nama lain." }, { status: 409 });
    }

    const resolvedPlan = plan === "premium" ? "premium" : "free";
    const parsedNominal = typeof nominalIuran === "number" && nominalIuran > 0 ? nominalIuran : 200000;

    // Atomic transaction: Tenant -> Anggota -> Setoran
    const newTenant = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          namaGrup: namaGrup.trim(),
          slug: safeSlug,
          plan: resolvedPlan,
          nominalIuran: parsedNominal,
          ownerId: session.user.id,
        },
      });

      // Create Admin as first member of the new group
      const member = await tx.anggota.create({
        data: {
          nama: session.user.name || "Admin Kelompok",
          whatsapp: "08123456789", // Default template phone
          tenantId: tenant.id,
        },
      });

      // Create Setoran 1 for first member
      await tx.setoran.create({
        data: {
          tenantId: tenant.id,
          anggotaId: member.id,
          periodeKe: 1,
          nominal: parsedNominal,
          status: "BELUM_BAYAR",
        },
      });

      return tenant;
    });

    return NextResponse.json({
      success: true,
      message: "Kelompok arisan baru berhasil dibuat!",
      tenant: newTenant,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tenants error:", error);
    return NextResponse.json({ error: "Gagal membuat kelompok arisan baru." }, { status: 500 });
  }
}

// ─── PUT /api/tenants (Upgrade workspace plan to premium) ──────────────────────
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Silakan masuk terlebih dahulu." }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    const { tenantSlug } = body as Record<string, unknown>;

    if (!tenantSlug || typeof tenantSlug !== "string") {
      return NextResponse.json({ error: "tenantSlug wajib diisi." }, { status: 400 });
    }

    // Verify tenant exists and is owned by the user
    const tenant = await db.tenant.findFirst({
      where: { slug: tenantSlug, ownerId: session.user.id }
    });

    if (!tenant) {
      return NextResponse.json({ error: "Workspace tidak ditemukan atau Anda tidak memiliki akses pemilik." }, { status: 404 });
    }

    if (tenant.plan === "premium") {
      return NextResponse.json({ error: "Workspace ini sudah berada di paket Premium." }, { status: 400 });
    }

    if (tenant.plan === "pending_premium") {
      return NextResponse.json({ error: "Workspace ini sudah dalam proses upgrade (menunggu persetujuan Superadmin)." }, { status: 400 });
    }

    const updatedTenant = await db.tenant.update({
      where: { id: tenant.id },
      data: { plan: "pending_premium" }
    });

    return NextResponse.json({
      success: true,
      message: `Permintaan upgrade kelompok arisan "${tenant.namaGrup}" berhasil diajukan! Silakan hubungi Superadmin untuk konfirmasi pembayaran. Layanan Premium akan langsung aktif setelah disetujui Superadmin. ⏳`,
      tenant: updatedTenant
    });
  } catch (error) {
    console.error("PUT /api/tenants upgrade error:", error);
    return NextResponse.json({ error: "Gagal memproses pengajuan upgrade kelompok arisan." }, { status: 500 });
  }
}
