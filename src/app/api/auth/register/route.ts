import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// ─── POST /api/auth/register ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
    }

    const { email, password, namaLengkap, namaGrup, slug, plan, nominalIuran } = body as Record<string, unknown>;

    // Core field validation
    if (
      !email || typeof email !== "string" ||
      !password || typeof password !== "string" ||
      !namaLengkap || typeof namaLengkap !== "string" ||
      !namaGrup || typeof namaGrup !== "string" ||
      !slug || typeof slug !== "string"
    ) {
      return NextResponse.json(
        { error: "Semua kolom pendaftaran wajib diisi secara lengkap." },
        { status: 400 }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }

    // Password minimum length
    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter." }, { status: 400 });
    }

    // Slugify: lowercase, strip non-alphanumeric-hyphen, max 50 chars
    const safeSlug = slug
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);

    if (safeSlug.length < 3) {
      return NextResponse.json(
        { error: "Nama workspace minimal 3 karakter (hanya huruf, angka, dan tanda hubung)." },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan gunakan email lain." },
        { status: 409 }
      );
    }

    // Check slug uniqueness
    const existingTenant = await db.tenant.findUnique({ where: { slug: safeSlug } });
    if (existingTenant) {
      return NextResponse.json(
        { error: "Subdomain workspace sudah digunakan. Silakan pilih nama lain." },
        { status: 409 }
      );
    }

    const resolvedPlan = plan === "premium" ? "premium" : "free";
    const parsedNominal = typeof nominalIuran === "number" && nominalIuran > 0
      ? nominalIuran
      : resolvedPlan === "premium" ? 100000 : 200000;

    // Atomic transaction: User → Tenant → Anggota → Setoran
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          // NOTE: In production, replace with bcrypt hash: bcrypt.hashSync(password, 12)
          passwordHash: password,
          namaLengkap: namaLengkap.trim(),
          role: "TENANT_ADMIN",
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          namaGrup: namaGrup.trim(),
          slug: safeSlug,
          plan: resolvedPlan,
          nominalIuran: parsedNominal,
          ownerId: user.id,
        },
      });

      const member = await tx.anggota.create({
        data: {
          nama: namaLengkap.trim(),
          whatsapp: "08123456789",
          tenantId: tenant.id,
          userId: user.id,
        },
      });

      await tx.setoran.create({
        data: {
          tenantId: tenant.id,
          anggotaId: member.id,
          periodeKe: 1,
          nominal: parsedNominal,
          status: "BELUM_BAYAR" as const,
        },
      });

      return { userId: user.id, tenantSlug: tenant.slug };
    });

    return NextResponse.json(
      {
        success: true,
        message: "Registrasi Lotre SaaS berhasil!",
        tenantSlug: result.tenantSlug,
        redirectUrl: "/",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
