import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { resolveTenantId } from "@/lib/tenant";

interface ImportMemberRow {
  name: string;
  whatsapp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body tidak valid." }, { status: 400 });
    }

    const { members, tenantSlug, nominal } = body as Record<string, unknown>;

    const resolvedNominal = typeof nominal === "number" && nominal > 0 ? nominal : 200000;

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: "Payload 'members' harus berupa array dan tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (members.length > 500) {
      return NextResponse.json(
        { error: "Maksimal 500 anggota per sekali import." },
        { status: 400 }
      );
    }

    const tenantId = await resolveTenantId(typeof tenantSlug === "string" ? tenantSlug : null);

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant tidak ditemukan." }, { status: 400 });
    }

    // Validate and clean each row
    const validationErrors: string[] = [];
    const cleaned: ImportMemberRow[] = [];

    for (let i = 0; i < members.length; i++) {
      const row = members[i] as Record<string, unknown>;
      const rowLabel = `Baris ${i + 1}`;

      if (!row.name || typeof row.name !== "string" || row.name.trim().length < 2) {
        validationErrors.push(`${rowLabel}: Nama tidak valid (minimum 2 karakter).`);
        continue;
      }
      if (!row.whatsapp || typeof row.whatsapp !== "string") {
        validationErrors.push(`${rowLabel}: Nomor WhatsApp tidak valid.`);
        continue;
      }

      const cleanName = row.name.trim();
      const cleanWA = row.whatsapp.replace(/\D/g, "");

      if (cleanWA.length < 9 || cleanWA.length > 15) {
        validationErrors.push(`${rowLabel}: Nomor "${row.whatsapp}" tidak valid (9–15 digit).`);
        continue;
      }

      cleaned.push({ name: cleanName, whatsapp: cleanWA });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ errors: validationErrors }, { status: 422 });
    }

    // De-duplicate against existing members
    const existingMembers = await db.anggota.findMany({
      where: { tenantId },
      select: { whatsapp: true },
    });
    const existingWASet = new Set(existingMembers.map((m) => m.whatsapp));
    const toInsert = cleaned.filter((m) => !existingWASet.has(m.whatsapp));
    const duplicateCount = cleaned.length - toInsert.length;

    if (toInsert.length === 0) {
      return NextResponse.json({
        message: "Semua anggota sudah terdaftar (duplikat).",
        imported: 0,
        duplicates: duplicateCount,
      });
    }

    // Determine active period
    const latestWinner = await db.pemenang.findFirst({
      where: { tenantId },
      orderBy: { periodeKe: "desc" },
      select: { periodeKe: true },
    });
    const currentPeriod = (latestWinner?.periodeKe ?? 0) + 1;

    // Atomic transaction
    const result = await db.$transaction(async (tx) => {
      const createdMembers = await Promise.all(
        toInsert.map((m) =>
          tx.anggota.create({
            data: { tenantId, nama: m.name, whatsapp: m.whatsapp },
          })
        )
      );

      await tx.setoran.createMany({
        data: createdMembers.map((m) => ({
          tenantId,
          anggotaId: m.id,
          periodeKe: currentPeriod,
          nominal: resolvedNominal,
          status: "BELUM_BAYAR" as const,
        })),
      });

      return createdMembers;
    });

    return NextResponse.json(
      {
        message: `Berhasil mengimpor ${result.length} anggota baru.`,
        imported: result.length,
        duplicates: duplicateCount,
        skipped: members.length - cleaned.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/members/import error:", error);
    return NextResponse.json({ error: "Gagal melakukan import anggota." }, { status: 500 });
  }
}
