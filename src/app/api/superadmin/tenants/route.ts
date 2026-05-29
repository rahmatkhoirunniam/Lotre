import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import db from "@/lib/db";
import { apiCache } from "@/lib/cache";

const CACHE_KEY = "superadmin:tenants";
const CACHE_TTL = 30_000; // 30 seconds


// ─── Superadmin Guard ─────────────────────────────────────────────────────────

async function requireSuperadmin(): Promise<true | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERADMIN") {
    return NextResponse.json(
      { error: "Akses ditolak. Hak akses khusus Superadmin." },
      { status: 403 }
    );
  }
  return true;
}

// ─── GET /api/superadmin/tenants ──────────────────────────────────────────────

export async function GET() {
  try {
    const guard = await requireSuperadmin();
    if (guard !== true) return guard;

    // ── Cache hit ─────────────────────────────────────────────────────────────
    const cached = apiCache.get<object>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const tenants = await db.tenant.findMany({
      include: {
        owner: { select: { namaLengkap: true, email: true } },
        _count: { select: { members: true, winners: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Aggregate stats in parallel
    const [totalMembers, totalWinners, paidPayments] = await Promise.all([
      db.anggota.count(),
      db.pemenang.count(),
      db.setoran.findMany({
        where: { status: "LUNAS" },
        select: { nominal: true },
      }),
    ]);

    const totalPlatformKas = paidPayments.reduce((sum, p) => sum + Number(p.nominal), 0);

    const payload = {
      tenants,
      stats: {
        totalTenants: tenants.length,
        freeTenants: tenants.filter((t) => t.plan === "free").length,
        premiumTenants: tenants.filter((t) => t.plan === "premium").length,
        pendingPremiumTenants: tenants.filter((t) => t.plan === "pending_premium").length,
        totalMembers,
        totalWinners,
        totalPlatformKas,
      },
    };

    // ── Store in cache ────────────────────────────────────────────────────────
    apiCache.set(CACHE_KEY, payload, CACHE_TTL);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET /api/superadmin/tenants error:", error);
    return NextResponse.json({ error: "Gagal memuat data pemantauan global." }, { status: 500 });
  }
}

// ─── PUT /api/superadmin/tenants ──────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireSuperadmin();
    if (guard !== true) return guard;

    // Invalidate cache immediately on any mutation
    apiCache.invalidate(CACHE_KEY);

    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
    }

    const { tenantId, action, plan, status, suspendReason } = body as Record<string, unknown>;

    if (!tenantId || typeof tenantId !== "string") {
      return NextResponse.json({ error: "tenantId wajib diisi." }, { status: 400 });
    }
    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "action wajib diisi." }, { status: 400 });
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 404 });
    }

    if (action === "togglePlan") {
      if (plan !== "free" && plan !== "premium" && plan !== "pending_premium") {
        return NextResponse.json({ error: "Plan harus 'free', 'premium', atau 'pending_premium'." }, { status: 400 });
      }
      const updated = await db.tenant.update({
        where: { id: tenantId },
        data: { plan: plan as string },
      });
      return NextResponse.json({ success: true, message: "Paket berhasil diperbarui.", tenant: updated });
    }

    if (action === "toggleStatus") {
      if (status !== "ACTIVE" && status !== "SUSPENDED") {
        return NextResponse.json({ error: "Status harus 'ACTIVE' atau 'SUSPENDED'." }, { status: 400 });
      }
      const updated = await db.tenant.update({
        where: { id: tenantId },
        data: {
          status: status as string,
          suspendReason:
            status === "SUSPENDED"
              ? typeof suspendReason === "string" && suspendReason.trim()
                ? suspendReason.trim()
                : "Melanggar Ketentuan Layanan"
              : null,
        },
      });
      return NextResponse.json({ success: true, message: "Status berhasil diperbarui.", tenant: updated });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error) {
    console.error("PUT /api/superadmin/tenants error:", error);
    return NextResponse.json({ error: "Gagal memperbarui data tenant." }, { status: 500 });
  }
}
