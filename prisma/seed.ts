import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed database...");

  // 1. CLEAR EXISTING DATA
  console.log("🧹 Clearing old database records...");
  await prisma.pemenang.deleteMany({});
  await prisma.setoran.deleteMany({});
  await prisma.anggota.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. CREATE SUPERADMIN
  console.log("👤 Seeding Superadmin...");
  await prisma.user.create({
    data: {
      email: "superadmin@lotre.com",
      passwordHash: "superpassword",
      namaLengkap: "Global Superadmin",
      role: "SUPERADMIN",
    },
  });

  // 3. SEED TENANT 1: Keluarga Cemara
  console.log("🏢 Seeding Tenant: Keluarga Cemara...");
  const userAdmin1 = await prisma.user.create({
    data: {
      email: "cemara@lotre.com",
      passwordHash: "password123",
      namaLengkap: "Abah Cemara",
      role: "TENANT_ADMIN",
    },
  });

  const tenant1 = await prisma.tenant.create({
    data: {
      namaGrup: "Lotre Keluarga Cemara",
      slug: "keluarga-cemara",
      plan: "free",
      ownerId: userAdmin1.id,
    },
  });

  // Seed Members for Keluarga Cemara
  const membersCemaraData = [
    { nama: "Abah Cemara", whatsapp: "081234567890", isOwner: true, userId: userAdmin1.id },
    { nama: "Emak Cemara", whatsapp: "081234567891", isOwner: false },
    { nama: "Euis", whatsapp: "081234567892", isOwner: false },
    { nama: "Ara", whatsapp: "081234567893", isOwner: false },
    { nama: "Agil", whatsapp: "081234567894", isOwner: false },
  ];

  const membersCemara = [];
  for (const m of membersCemaraData) {
    const anggota = await prisma.anggota.create({
      data: {
        nama: m.nama,
        whatsapp: m.whatsapp,
        tenantId: tenant1.id,
        userId: m.userId || null,
      },
    });
    membersCemara.push(anggota);
  }

  // Seed Setoran for Keluarga Cemara (Periode 1)
  console.log("💰 Seeding Setoran for Keluarga Cemara...");
  const nominalCemara = 200000;
  
  // Abah, Emak, Euis, Ara are paid (LUNAS), Agil is unpaid (BELUM_BAYAR)
  const paymentsCemara = [
    { nama: "Abah Cemara", status: "LUNAS", tanggalBayar: new Date() },
    { nama: "Emak Cemara", status: "LUNAS", tanggalBayar: new Date() },
    { nama: "Euis", status: "LUNAS", tanggalBayar: new Date() },
    { nama: "Ara", status: "LUNAS", tanggalBayar: new Date() },
    { nama: "Agil", status: "BELUM_BAYAR", tanggalBayar: null },
  ];

  for (const p of paymentsCemara) {
    const matchedAnggota = membersCemara.find((m) => m.nama === p.nama);
    if (matchedAnggota) {
      await prisma.setoran.create({
        data: {
          tenantId: tenant1.id,
          anggotaId: matchedAnggota.id,
          periodeKe: 1,
          nominal: nominalCemara,
          status: p.status,
          tanggalBayar: p.tanggalBayar,
        },
      });
    }
  }


  // 4. SEED TENANT 2: RT 05 Lotre Digital
  console.log("🏢 Seeding Tenant: RT 05 Lotre Digital...");
  const userAdmin2 = await prisma.user.create({
    data: {
      email: "rt05@lotre.com",
      passwordHash: "passwordrt",
      namaLengkap: "Pak RT Bambang",
      role: "TENANT_ADMIN",
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      namaGrup: "RT 05 Lotre Digital",
      slug: "rt-05",
      plan: "premium",
      ownerId: userAdmin2.id,
    },
  });

  // Seed Members for RT 05
  const membersRTData = [
    { nama: "Pak RT Bambang", whatsapp: "085234567890", userId: userAdmin2.id },
    { nama: "Bu RT Bambang", whatsapp: "085234567891" },
    { nama: "Pak Budi", whatsapp: "085234567892" },
    { nama: "Bu Budi", whatsapp: "085234567893" },
    { nama: "Pak Joko", whatsapp: "085234567894" },
    { nama: "Bu Joko", whatsapp: "085234567895" },
    { nama: "Mas Adi", whatsapp: "085234567896" },
    { nama: "Mbak Dwi", whatsapp: "085234567897" },
  ];

  const membersRT = [];
  for (const m of membersRTData) {
    const anggota = await prisma.anggota.create({
      data: {
        nama: m.nama,
        whatsapp: m.whatsapp,
        tenantId: tenant2.id,
        userId: m.userId || null,
      },
    });
    membersRT.push(anggota);
  }

  // Seed Setoran for RT 05 (Periode 1)
  console.log("💰 Seeding Setoran for RT 05...");
  const nominalRT = 100000;
  
  // Paid: Pak RT, Bu RT, Pak Budi, Pak Joko, Mas Adi. Unpaid: Bu Budi, Bu Joko, Mbak Dwi.
  const paymentsRT = [
    { nama: "Pak RT Bambang", status: "LUNAS", tanggalBayar: new Date() },
    { nama: "Bu RT Bambang", status: "LUNAS", tanggalBayar: new Date() },
    { nama: "Pak Budi", status: "LUNAS", tanggalBayar: new Date() },
    { nama: "Bu Budi", status: "BELUM_BAYAR", tanggalBayar: null },
    { nama: "Pak Joko", status: "LUNAS", tanggalBayar: new Date() },
    { nama: "Bu Joko", status: "BELUM_BAYAR", tanggalBayar: null },
    { nama: "Mas Adi", status: "LUNAS", tanggalBayar: new Date() },
    { nama: "Mbak Dwi", status: "BELUM_BAYAR", tanggalBayar: null },
  ];

  for (const p of paymentsRT) {
    const matchedAnggota = membersRT.find((m) => m.nama === p.nama);
    if (matchedAnggota) {
      await prisma.setoran.create({
        data: {
          tenantId: tenant2.id,
          anggotaId: matchedAnggota.id,
          periodeKe: 1,
          nominal: nominalRT,
          status: p.status,
          tanggalBayar: p.tanggalBayar,
        },
      });
    }
  }

  console.log("✅ Seed database completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
