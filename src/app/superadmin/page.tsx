"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";


interface TenantData {
  id: string;
  namaGrup: string;
  slug: string;
  plan: "free" | "premium" | "pending_premium";
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  suspendReason: string | null;
  createdAt: string;
  owner: {
    namaLengkap: string;
    email: string;
  };
  _count: {
    members: number;
    winners: number;
  };
}

interface StatsData {
  totalTenants: number;
  freeTenants: number;
  premiumTenants: number;
  pendingPremiumTenants?: number;
  totalMembers: number;
  totalWinners: number;
  totalPlatformKas: number;
}

export default function SuperadminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalTenants: 0,
    freeTenants: 0,
    premiumTenants: 0,
    pendingPremiumTenants: 0,
    totalMembers: 0,
    totalWinners: 0,
    totalPlatformKas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const router = useRouter();


  // Load Superadmin dataset (memoized to use as useEffect dependency)
  const fetchAdminData = useCallback(async () => {
    try {
      const res = await fetch("/api/superadmin/tenants");
      if (!res.ok) {
        if (res.status === 403) {
          router.push("/auth/login");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json() as { tenants: TenantData[]; stats: StatsData };
      setTenants(data.tenants ?? []);
      setStats(data.stats ?? {
        totalTenants: 0, freeTenants: 0, premiumTenants: 0,
        totalMembers: 0, totalWinners: 0, totalPlatformKas: 0,
      });
    } catch (err) {
      console.error("Superadmin failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login");
    } else if (sessionStatus === "authenticated") {
      if (session.user.role !== "SUPERADMIN") {
        router.push("/");
      } else {
        fetchAdminData();
      }
    }
  }, [sessionStatus, session, fetchAdminData, router]);

  // ── Client-side filtered tenant list (zero API calls, instant search) ────────
  const filteredTenants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      t.namaGrup.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      t.owner.namaLengkap.toLowerCase().includes(q) ||
      t.owner.email.toLowerCase().includes(q) ||
      t.plan.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q)
    );
  }, [tenants, searchQuery]);

  // Plan Toggler
  const handleTogglePlan = async (tenantId: string, currentPlan: "free" | "premium" | "pending_premium") => {
    setUpdatingId(tenantId);
    const nextPlan = currentPlan === "premium" ? "free" : "premium";

    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "togglePlan",
          plan: nextPlan,
        }),
      });

      if (res.ok) {
        await fetchAdminData();
      } else {
        alert("Gagal memperbarui paket langganan.");
      }
    } catch (err) {
      console.error("Plan swap failed:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Suspension Toggler
  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const isSuspended = currentStatus === "SUSPENDED";
    const nextStatus = isSuspended ? "ACTIVE" : "SUSPENDED";
    let reason = null;

    if (!isSuspended) {
      reason = prompt("Masukkan alasan penangguhan (Suspensi) untuk grup lotre ini:");
      if (reason === null) return; // User canceled
      if (!reason.trim()) reason = "Melanggar Ketentuan Layanan";
    }

    setUpdatingId(tenantId);
    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          action: "toggleStatus",
          status: nextStatus,
          suspendReason: reason,
        }),
      });

      if (res.ok) {
        await fetchAdminData();
      } else {
        alert("Gagal merubah status penangguhan.");
      }
    } catch (err) {
      console.error("Status toggle failed:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100dvh",
        background: "var(--bg-primary)",
        color: "var(--text-secondary)",
        fontSize: "1.1rem"
      }}>
        Memuat Panel Pemantauan Superadmin...
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto" }}>
      
      {/* Superadmin Header Panel */}
      <header className="dashboard-header" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 24px",
        borderRadius: "18px",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid var(--border-glass)",
        marginBottom: "32px",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="badge badge-primary" style={{ padding: "4px 8px", fontSize: "0.65rem" }}>SUPERADMIN</span>
            <h1 style={{ fontSize: "1.45rem", fontWeight: "700", color: "#fff", letterSpacing: "-0.02em" }}>
              Lotre SaaS Control Center
            </h1>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Pusat pemantauan grup, lisensi tenant, dan kas arisan digital global
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: "600", color: "#fff" }}>
              {session?.user?.name || "Super Administrator"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              {session?.user?.email}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="btn btn-secondary"
            style={{
              padding: "8px 16px",
              minHeight: "38px",
              borderRadius: "10px",
              fontSize: "0.85rem"
            }}
          >
            Keluar Panel
          </button>
        </div>
      </header>

      {/* Global SaaS Aggregates cards row */}
      <div className="stats-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "20px",
        marginBottom: "32px"
      }}>
        {/* Card 1: Total Tenants */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600", letterSpacing: "0.02em" }}>
            TOTAL GRUP (TENANTS)
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "2.2rem", fontWeight: "700", color: "#fff" }}>{stats.totalTenants}</span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Kelompok</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Premium: <strong style={{ color: "#fbbf24" }}>{stats.premiumTenants}</strong> | Pending: <strong style={{ color: "#3b82f6" }}>{stats.pendingPremiumTenants ?? 0}</strong> | Free: <strong>{stats.freeTenants}</strong>
          </span>
        </div>

        {/* Card 2: Total Platform Members */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600", letterSpacing: "0.02em" }}>
            PENGGUNA AKTIF GLOBAL
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "2.2rem", fontWeight: "700", color: "#fff" }}>{stats.totalMembers}</span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Orang</span>
          </div>
          <span className="badge badge-success" style={{ alignSelf: "flex-start", fontSize: "0.65rem", padding: "2px 6px" }}>
            Terisolasi Terjaga
          </span>
        </div>

        {/* Card 3: Total Money Pool Flow */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600", letterSpacing: "0.02em" }}>
            KAS PLATFORM TERKUMPUL
          </span>
          <div style={{ marginTop: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "1.7rem", fontWeight: "700", color: "#34d399" }}>
              Rp {stats.totalPlatformKas.toLocaleString("id-ID")}
            </span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Akumulasi transaksi Lunas seluruh grup
          </span>
        </div>

        {/* Card 4: Total Platform Winners */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600", letterSpacing: "0.02em" }}>
            TOTAL PEMENANG DIUNDIAN
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "2.2rem", fontWeight: "700", color: "#fbbf24" }}>{stats.totalWinners}</span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Crowned</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            Raffle kocokan digital sah berhasil diputar
          </span>
        </div>
      </div>

      {/* Pending Premium Requests Notification Banner */}
      {stats.pendingPremiumTenants !== undefined && stats.pendingPremiumTenants > 0 && (
        <div style={{
          background: "rgba(245, 158, 11, 0.12)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          borderRadius: "14px",
          padding: "16px 20px",
          marginBottom: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          boxShadow: "0 4px 15px rgba(245, 158, 11, 0.08)",
          animation: "pulse 2s infinite alternate"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.4rem" }}>🔔</span>
            <div>
              <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.9rem" }}>
                Permintaan Upgrade Premium Baru
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Ada {stats.pendingPremiumTenants} kelompok arisan sedang mengajukan upgrade premium dan menunggu verifikasi pembayaran manual.
              </div>
            </div>
          </div>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: "700",
            background: "#f59e0b",
            color: "#000",
            padding: "4px 10px",
            borderRadius: "20px"
          }}>
            TINDAKAN DIBUTUHKAN
          </span>
        </div>
      )}

      {/* Main SaaS Tenants Grid Card */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{
          paddingBottom: "20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          marginBottom: "16px"
        }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#fff" }}>Daftar Penyewa Jasa SaaS (Tenant Groups)</h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Kelola lisensi keanggotaan paket premium, audit data workspace, atau tangguhkan tenant yang bermasalah.
          </p>
        </div>

        {/* Tenant Table Grid */}
        {/* ── Search Bar ────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}>
          <div style={{
            position: "relative",
            flex: 1,
            minWidth: "240px",
            maxWidth: "480px",
          }}>
            <span style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "1rem",
              color: "var(--text-secondary)",
              pointerEvents: "none",
            }}>🔍</span>
            <input
              id="superadmin-search"
              type="text"
              placeholder="Cari nama kelompok, slug, pemilik, email, atau status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 40px 10px 40px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(0,0,0,0.25)",
                color: "#fff",
                fontSize: "0.9rem",
                outline: "none",
                transition: "border-color 0.2s",
                minHeight: "44px",
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: "4px",
                }}
              >✕</button>
            )}
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
            {searchQuery
              ? <><span style={{ color: "#fff", fontWeight: "600" }}>{filteredTenants.length}</span> dari {tenants.length} tenant</>
              : <><span style={{ color: "#fff", fontWeight: "600" }}>{tenants.length}</span> total tenant</>}
          </div>

        </div>

        <div className="table-responsive table-responsive-tablet" style={{ overflowX: "auto", width: "100%" }}>
          <table className="custom-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Nama Kelompok (Tenant)</th>
                <th>Subdomain URL</th>
                <th>Pemilik (Tenant Admin)</th>
                <th style={{ textAlign: "center" }}>Anggota / Menang</th>
                <th style={{ textAlign: "center" }}>Paket Langganan</th>
                <th style={{ textAlign: "center" }}>Status Platform</th>
                <th style={{ textAlign: "center" }}>Tindakan Administrasi</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "24px" }}>
                    Belum ada penyewa (tenant) terdaftar di sistem database.
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "32px 24px" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🔍</div>
                    <div style={{ fontWeight: "600", color: "#fff", marginBottom: "4px" }}>Tidak ada hasil ditemukan</div>
                    <div style={{ fontSize: "0.8rem" }}>Coba kata kunci lain atau <button onClick={() => setSearchQuery("")} style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.8rem" }}>hapus pencarian</button></div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.id} style={{ opacity: t.status === "SUSPENDED" ? 0.6 : 1 }}>
                    <td data-label="Kelompok">
                      <div style={{ fontWeight: "600", fontSize: "0.95rem", color: "#fff" }}>{t.namaGrup}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                        Daftar: {new Date(t.createdAt).toLocaleDateString("id-ID")}
                      </div>
                    </td>
                    <td data-label="Subdomain">
                      <code style={{ fontSize: "0.8rem", color: "var(--primary)" }}>{t.slug}.lotre.com</code>
                    </td>
                    <td data-label="Pemilik">
                      <div style={{ fontSize: "0.85rem", fontWeight: "500" }}>{t.owner.namaLengkap}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{t.owner.email}</div>
                    </td>
                    <td data-label="Anggota/Menang" style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>{t._count.members}</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}> / {t._count.winners}</span>
                    </td>
                    <td data-label="Paket" style={{ textAlign: "center" }}>
                      {t.plan === "premium" ? (
                        <span className="badge badge-warning" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#fff", boxShadow: "0 0 8px rgba(245, 158, 11, 0.4)", display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px" }}>
                          👑 Premium
                        </span>
                      ) : t.plan === "pending_premium" ? (
                        <span className="badge badge-warning" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", color: "#fff", boxShadow: "0 0 8px rgba(59, 130, 246, 0.4)", display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px" }}>
                          ⏳ Pending Approval
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ padding: "4px 8px" }}>
                          Free Tier
                        </span>
                      )}
                    </td>
                    <td data-label="Status" style={{ textAlign: "center" }}>
                      {t.status === "ACTIVE" ? (
                        <span className="badge badge-success">Aktif</span>
                      ) : (
                        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
                          <span className="badge badge-danger">Ditangguhkan</span>
                          {t.suspendReason && (
                            <span style={{ fontSize: "0.65rem", color: "#fca5a5", marginTop: "2px", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.suspendReason}>
                              ({t.suspendReason})
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td data-label="" className="td-actions">
                      <div className="admin-actions-group" style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        {/* Plan switcher or approval */}
                        {t.plan === "pending_premium" ? (
                          <>
                            <button
                              onClick={() => handleTogglePlan(t.id, "pending_premium")}
                              disabled={updatingId !== null}
                              className="btn"
                              style={{
                                minHeight: "38px",
                                padding: "4px 12px",
                                fontSize: "0.75rem",
                                borderRadius: "6px",
                                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                color: "#fff",
                                border: "none",
                                fontWeight: "700",
                                cursor: "pointer",
                                boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)"
                              }}
                            >
                              Setujui Premium 👑
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Apakah Anda yakin ingin menolak / mendowngrade kelompok "${t.namaGrup}" kembali ke Free?`)) {
                                  setUpdatingId(t.id);
                                  fetch("/api/superadmin/tenants", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      tenantId: t.id,
                                      action: "togglePlan",
                                      plan: "free",
                                    }),
                                  }).then(async (res) => {
                                    if (res.ok) await fetchAdminData();
                                    setUpdatingId(null);
                                  });
                                }
                              }}
                              disabled={updatingId !== null}
                              className="btn"
                              style={{
                                minHeight: "38px",
                                padding: "4px 10px",
                                fontSize: "0.75rem",
                                borderRadius: "6px",
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#f87171",
                                border: "1px solid rgba(239, 68, 68, 0.3)"
                              }}
                            >
                              Tolak
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleTogglePlan(t.id, t.plan)}
                            disabled={updatingId !== null}
                            className="btn"
                            style={{
                              minHeight: "38px",
                              padding: "4px 10px",
                              fontSize: "0.75rem",
                              borderRadius: "6px",
                              background: "rgba(255,255,255,0.05)",
                              color: "#fff",
                              border: "1px solid rgba(255,255,255,0.08)"
                            }}
                          >
                            Ubah Paket
                          </button>
                        )}

                        {/* Suspension button */}
                        <button
                          onClick={() => handleToggleStatus(t.id, t.status)}
                          disabled={updatingId !== null}
                          className="btn"
                          style={{
                            minHeight: "38px",
                            padding: "4px 10px",
                            fontSize: "0.75rem",
                            borderRadius: "6px",
                            background: t.status === "SUSPENDED" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                            color: t.status === "SUSPENDED" ? "#34d399" : "#f87171",
                            border: t.status === "SUSPENDED" ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(239,68,68,0.3)"
                          }}
                        >
                          {t.status === "SUSPENDED" ? "Aktifkan" : "Tangguhkan"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
