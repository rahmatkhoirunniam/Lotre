"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";


interface Member {
  id: string;
  name: string;
  whatsapp: string;
  status: "lunas" | "belum-bayar";
  hasWon: boolean;
}

interface Winner {
  period: number;
  name: string;
  amount: number;
  date: string;
}

interface Workspace {
  id: string;
  namaGrup: string;
  slug: string;
  plan: string;
  nominalIuran: number;
}


export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const [showDemo, setShowDemo] = useState<boolean>(false);
  const router = useRouter();

  // Shielding & Redirecting Superadmin users to their management portal
  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user?.role === "SUPERADMIN") {
      router.push("/superadmin");
    }
  }, [sessionStatus, session, router]);

  // SaaS Workspace states
  const [activeWorkspace, setActiveWorkspace] = useState<string>("keluarga-cemara");
  const [userWorkspaces, setUserWorkspaces] = useState<Workspace[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  // New Workspace Form states
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState<boolean>(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState<string>("");
  const [newWorkspaceSlug, setNewWorkspaceSlug] = useState<string>("");
  const [newWorkspacePlan, setNewWorkspacePlan] = useState<"free" | "premium">("free");
  const [newWorkspaceNominal, setNewWorkspaceNominal] = useState<string>("200000");

  // Premium Upgrade Form states
  const [isUpgradingWorkspace, setIsUpgradingWorkspace] = useState<boolean>(false);
  const [agreedToPremiumTerms, setAgreedToPremiumTerms] = useState<boolean>(false);
  const [selectedPremiumPlanType, setSelectedPremiumPlanType] = useState<"monthly" | "yearly">("monthly");

  // Database-backed states
  const [members, setMembers] = useState<Member[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [nominalIuran, setNominalIuran] = useState<number>(200000);

  // Member Form Form states
  const [isAddingMember, setIsAddingMember] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>("");
  const [newMemberWhatsapp, setNewMemberWhatsapp] = useState<string>("");

  // Member Search state
  const [memberSearch, setMemberSearch] = useState<string>("");

  // Edit Member states
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editMemberName, setEditMemberName] = useState<string>("");
  const [editMemberWhatsapp, setEditMemberWhatsapp] = useState<string>("");
  const [isSavingEditMember, setIsSavingEditMember] = useState<boolean>(false);
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);

  // Filter & Pagination states
  const [statusFilter, setStatusFilter] = useState<"all" | "lunas" | "belum_bayar">("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Settings Form states
  const [inputNominal, setInputNominal] = useState<string>("200000");
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Theme Switching state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Load persistent theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("lotre_theme") as "dark" | "light" | null;
      const currentTheme = savedTheme || "dark";
      setTheme(currentTheme);
      if (currentTheme === "light") {
        document.documentElement.classList.add("light-mode");
      } else {
        document.documentElement.classList.remove("light-mode");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("lotre_theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("light-mode");
    } else {
      document.documentElement.classList.remove("light-mode");
    }
  };

  // Load persistent active workspace from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lotre_active_workspace");
      if (saved) {
        setActiveWorkspace(saved);
      }
    }
  }, []);

  // Close actions dropdown menu when clicking anywhere else
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenuMemberId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  // Save active workspace to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined" && activeWorkspace) {
      localStorage.setItem("lotre_active_workspace", activeWorkspace);
    }
  }, [activeWorkspace]);

  // Iuran per workspace (uses active workspace nominal from database)
  const itemContribution = nominalIuran;

  // Calculate metrics
  const totalMembers = members.length;
  const lunasMembersCount = members.filter((m) => m.status === "lunas").length;
  const collectedCash = lunasMembersCount * itemContribution;
  const targetCash = totalMembers * itemContribution;
  const currentPeriod = winners.length + 1;

  // Kocokan (Draw) states
  const eligibleList = members.filter((m) => m.status === "lunas" && !m.hasWon);
  const [rolledName, setRolledName] = useState<string>("SIAPA PEMENANGNYA?");
  const [isDrawing, setIsDrawing] = useState(false);
  const [winnerFound, setWinnerFound] = useState<Member | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [shareAlert, setShareAlert] = useState<string | null>(null);
  const [showIuranPreview, setShowIuranPreview] = useState(false);
  const [showWinnerPreview, setShowWinnerPreview] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<{
    id: number;
    left: string;
    delay: string;
    color: string;
    size: string;
    duration: string;
    rotation: string;
  }[]>([]);

  // Load data from multi-tenant backend (memoized to use as useEffect dependency)
  const fetchData = useCallback(async (targetWorkspaceSlug?: string) => {
    try {
      let resolvedWorkspace = targetWorkspaceSlug || activeWorkspace;

      if (sessionStatus === "authenticated") {
        const tenantsRes = await fetch("/api/tenants");
        if (tenantsRes.ok) {
          const tenantsData = await tenantsRes.json() as { tenants: Workspace[] };
          const workspaces = tenantsData.tenants || [];
          setUserWorkspaces(workspaces);

          if (workspaces.length > 0) {
            const querySlug = targetWorkspaceSlug || activeWorkspace;
            // Match strictly by slug if querySlug is specified
            let matched = workspaces.find((w) => w.slug === querySlug);

            // Stale-resistant fallback to activeTenantId only if slug is not matched
            if (!matched && activeTenantId) {
              matched = workspaces.find((w) => w.id === activeTenantId);
            }

            const selected = matched || workspaces[0];
            resolvedWorkspace = selected.slug;

            if (activeWorkspace !== selected.slug) {
              setActiveWorkspace(selected.slug);
            }
            if (activeTenantId !== selected.id) {
              setActiveTenantId(selected.id);
            }
          }
        }
      }

      const response = await fetch(`/api/members?tenantSlug=${resolvedWorkspace}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as {
        nominalIuran?: number;
        members: Array<{
          id: string;
          nama: string;
          whatsapp: string;
          payments: Array<{ periodeKe: number; status: string }>;
          winners: Array<{ periodeKe: number; totalDiterima: number; tanggalMenang: string }>;
        }>;
      };
      if (data.members) {
        if (typeof data.nominalIuran === "number") {
          setNominalIuran(data.nominalIuran);
        }

        const mappedMembers: Member[] = data.members.map((m) => {
          // Use the most recent payment period for status display
          const latestPayment = m.payments.sort((a, b) => b.periodeKe - a.periodeKe)[0];
          return {
            id: m.id,
            name: m.nama,
            whatsapp: m.whatsapp,
            status: latestPayment?.status === "LUNAS" ? "lunas" : "belum-bayar",
            hasWon: m.winners.length > 0,
          };
        });

        const mappedWinners: Winner[] = [];
        data.members.forEach((m) => {
          m.winners.forEach((w) => {
            mappedWinners.push({
              period: w.periodeKe,
              name: m.nama,
              amount: w.totalDiterima,
              date: new Date(w.tanggalMenang).toISOString().split("T")[0],
            });
          });
        });
        mappedWinners.sort((a, b) => b.period - a.period);

        setMembers(mappedMembers);
        setWinners(mappedWinners);

        // Pre-populate backfill wizard with existing winners from database
        const maxWinnerPeriod = mappedWinners.length > 0 ? Math.max(...mappedWinners.map((w) => w.period)) : 0;
        const initialBackfillPeriod = Math.max(2, maxWinnerPeriod + 1);

        const initialBackfillWinners = Array.from({ length: initialBackfillPeriod - 1 }, (_, i) => {
          const period = i + 1;
          const winnerMember = data.members.find((m) => m.winners.some((w) => w.periodeKe === period));
          return {
            periodeKe: period,
            anggotaId: winnerMember?.id ?? "",
          };
        });

        setBackfillNominal(data.nominalIuran ?? 200000);
        setBackfillCurrentPeriod(initialBackfillPeriod);
        setBackfillWinners(initialBackfillWinners);
      }
    } catch (err) {
      console.error("Fetch database error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, activeTenantId, sessionStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setInputNominal(nominalIuran.toString());
  }, [nominalIuran]);

  useEffect(() => {
    setRolledName("SIAPA PEMENANGNYA?");
    setWinnerFound(null);
    setShowConfetti(false);
    setMemberSearch(""); // Reset search when workspace changes
    setStatusFilter("all"); // Reset status filter when workspace changes
    setSelectedMemberIds([]); // Reset bulk selections when workspace changes
    setShowAllWinners(false); // Reset collapsed winners list when workspace changes
  }, [members]);

  // ── Client-side filtered member list (instant, zero API calls) ──────────────
  const filteredMembers = useMemo(() => {
    let result = members;

    // 1. Filter by iuran status
    if (statusFilter === "lunas") {
      result = result.filter((m) => m.status === "lunas");
    } else if (statusFilter === "belum_bayar") {
      result = result.filter((m) => m.status === "belum-bayar");
    }

    // 2. Filter by search query
    const q = memberSearch.trim().toLowerCase();
    if (q) {
      result = result.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.whatsapp.includes(q)
      );
    }

    return result;
  }, [members, statusFilter, memberSearch]);

  // ── Paginated member list ──────────────────────────────────────────────────
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredMembers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredMembers, currentPage, itemsPerPage]);

  // Reset page when filters or limits change to avoid showing empty pages
  useEffect(() => {
    setCurrentPage(1);
  }, [memberSearch, statusFilter, itemsPerPage]);

  // Cancel a winner in the database
  const handleCancelWinner = async (period: number, name: string) => {
    const confirmCancel = window.confirm(
      `Apakah Anda yakin ingin membatalkan pemenang Periode ${period} (${name})?\n\nTindakan ini akan:\n1. Menghapus status pemenang untuk anggota tersebut di periode ini.\n2. Menghapus seluruh tagihan iuran otomatis yang telah di-seed untuk periode berikutnya (${period + 1}).`
    );
    if (!confirmCancel) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/winners?tenantSlug=${activeWorkspace}&periodeKe=${period}`, {
        method: "DELETE",
      });

      const data = await res.json() as { success?: boolean; error?: string; message?: string };
      if (res.ok && data.success) {
        alert(data.message || "Pemenang berhasil dibatalkan!");
        await fetchData();
      } else {
        alert(data.error || "Gagal membatalkan pemenang.");
      }
    } catch (err) {
      console.error("handleCancelWinner error:", err);
      alert("Terjadi kesalahan sistem saat membatalkan pemenang.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle paid status in the database with Optimistic updates
  const handleTogglePayment = async (memberId: string) => {
    if (isDrawing) return;

    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    const originalStatus = member.status;
    const nextStatus = originalStatus === "lunas" ? "BELUM_BAYAR" : "LUNAS";

    // Optimistic UI state switch
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, status: nextStatus === "LUNAS" ? "lunas" : "belum-bayar" } : m))
    );

    try {
      const res = await fetch("/api/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anggotaId: memberId,
          periodeKe: currentPeriod,
          status: nextStatus,
          tenantSlug: activeWorkspace,
        })
      });

      if (!res.ok) throw new Error();
      await fetchData(); // Force sync
    } catch (error) {
      console.error("Failed toggle payment:", error);
      // Revert state on network failures
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, status: originalStatus } : m))
      );
      alert("Gagal memperbarui status setoran di database.");
    }
  };

  // Handle adding a new member to the database
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberWhatsapp.trim() || isAddingMember) return;

    setIsAddingMember(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMemberName,
          whatsapp: newMemberWhatsapp,
          tenantSlug: activeWorkspace
        })
      });

      const data = await res.json() as { error?: string };
      if (res.ok) {
        setNewMemberName("");
        setNewMemberWhatsapp("");
        await fetchData();
      } else {
        alert(data.error || "Gagal menyimpan anggota baru.");
      }
    } catch (err) {
      console.error("Add member error:", err);
    } finally {
      setIsAddingMember(false);
    }
  };

  // Handle editing an existing member in the database
  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editMemberName.trim() || !editMemberWhatsapp.trim() || isSavingEditMember) return;

    setIsSavingEditMember(true);
    try {
      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingMember.id,
          name: editMemberName,
          whatsapp: editMemberWhatsapp,
          tenantSlug: activeWorkspace
        })
      });

      const data = await res.json() as { error?: string };
      if (res.ok) {
        setEditingMember(null);
        setEditMemberName("");
        setEditMemberWhatsapp("");
        await fetchData();
      } else {
        alert(data.error || "Gagal memperbarui data anggota.");
      }
    } catch (err) {
      console.error("handleEditMember error:", err);
      alert("Terjadi kesalahan sistem saat memperbarui data anggota.");
    } finally {
      setIsSavingEditMember(false);
    }
  };

  // Handle deleting a member
  const handleDeleteMember = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus anggota "${name}" secara permanen?\n\n` +
      `Semua data riwayat pembayaran dan kemenangan anggota ini akan ikut terhapus secara permanen!`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/members?id=${id}&tenantSlug=${activeWorkspace}`, {
        method: "DELETE",
      });

      const data = await res.json() as { error?: string };
      if (res.ok) {
        await fetchData();
      } else {
        alert(data.error || "Gagal menghapus data anggota.");
      }
    } catch (err) {
      console.error("handleDeleteMember error:", err);
      alert("Terjadi kesalahan sistem saat menghapus data anggota.");
    }
  };

  // Toggle single selection
  const handleToggleSelectMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle Select All for paginated members on the current page
  const handleSelectAll = () => {
    const pageIds = paginatedMembers.map((m) => m.id);
    const allSelectedOnPage = pageIds.every((id) => selectedMemberIds.includes(id));

    if (allSelectedOnPage) {
      setSelectedMemberIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedMemberIds((prev) => {
        const next = [...prev];
        pageIds.forEach((id) => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Handle bulk update of payment status
  const handleBulkPaymentStatus = async (status: "LUNAS" | "BELUM_BAYAR") => {
    if (selectedMemberIds.length === 0 || isDrawing) return;

    const confirmMsg =
      status === "LUNAS"
        ? `Apakah Anda yakin ingin menandai LUNAS iuran untuk ${selectedMemberIds.length} anggota terpilih?`
        : `Apakah Anda yakin ingin membatalkan status Lunas iuran untuk ${selectedMemberIds.length} anggota terpilih?`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anggotaIds: selectedMemberIds,
          periodeKe: currentPeriod,
          status,
          tenantSlug: activeWorkspace,
        }),
      });

      if (res.ok) {
        setSelectedMemberIds([]);
        await fetchData();
      } else {
        const data = await res.json() as { error?: string };
        alert(data.error || "Gagal memperbarui status iuran anggota terpilih.");
      }
    } catch (err) {
      console.error("handleBulkPaymentStatus error:", err);
      alert("Terjadi kesalahan sistem saat memperbarui status iuran.");
    } finally {
      setLoading(false);
    }
  };

  // Handle creating a new workspace
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || !newWorkspaceSlug.trim()) {
      alert("Nama Kelompok dan Slug/Subdomain wajib diisi.");
      return;
    }

    const cleanSlug = newWorkspaceSlug
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);

    if (cleanSlug.length < 3) {
      alert("Slug minimal 3 karakter (hanya huruf, angka, tanda hubung).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaGrup: newWorkspaceName.trim(),
          slug: cleanSlug,
          plan: newWorkspacePlan,
          nominalIuran: Number(newWorkspaceNominal) || 200000,
        }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string; tenant?: { id: string; slug: string } };

      if (res.ok && data.success && data.tenant) {
        // Reset form
        setNewWorkspaceName("");
        setNewWorkspaceSlug("");
        setNewWorkspacePlan("free");
        setNewWorkspaceNominal("200000");
        setIsCreatingWorkspace(false);

        // Instant switch to the newly created workspace
        setActiveWorkspace(data.tenant.slug);
        setActiveTenantId(data.tenant.id);

        // Alert success
        alert(data.message || "Kelompok arisan baru berhasil dibuat!");

        // Refetch to sync all states
        await fetchData(data.tenant.slug);
      } else {
        alert(data.error || "Gagal membuat kelompok arisan baru.");
      }
    } catch (err) {
      console.error("Create workspace error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle upgrading the active workspace to premium
  const handleUpgradeWorkspace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sessionStatus !== "authenticated" || !activeWorkspace) return;
    if (!agreedToPremiumTerms) {
      alert("Anda harus menyetujui syarat & ketentuan pengaktifan layanan Premium.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: activeWorkspace }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (res.ok && data.success) {
        alert(data.message || "Upgrade sukses!");
        setIsUpgradingWorkspace(false);
        setAgreedToPremiumTerms(false);
        triggerConfetti(); // Celebrate with confetti!
        await fetchData(); // Refetch to sync state
      } else {
        alert(data.error || "Gagal melakukan upgrade.");
      }
    } catch (err) {
      console.error("Upgrade workspace error:", err);
      alert("Koneksi gagal saat memproses upgrade.");
    } finally {
      setLoading(false);
    }
  };

  // Confetti generator
  const triggerConfetti = () => {
    setShowConfetti(true);
    const pieces = [];
    const colors = ["#8b5cf6", "#10b981", "#fbbf24", "#ef4444", "#3b82f6", "#ec4899"];
    for (let i = 0; i < 120; i++) {
      pieces.push({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 2.5}s`,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: `${Math.random() * 8 + 6}px`,
        duration: `${Math.random() * 2 + 1.5}s`,
        rotation: `${Math.random() * 360}deg`
      });
    }
    setConfettiPieces(pieces);
  };

  // Web Audio API Sound Effects
  const playTickSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.error("Audio error:", e);
    }
  }, [soundEnabled]);

  const playWinSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const playNote = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

        gain.gain.setValueAtTime(0.12, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration - 0.02);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Major chord fanfare sequence (C5 -> E5 -> G5 -> C6)
      playNote(523.25, 0, 0.12);
      playNote(659.25, 0.12, 0.12);
      playNote(783.99, 0.24, 0.12);
      playNote(1046.50, 0.36, 0.45);
    } catch (e) {
      console.error("Audio error:", e);
    }
  }, [soundEnabled]);

  const getIuranStatusText = useCallback(() => {
    const lunasList = members.filter((m) => m.status === "lunas");
    const belumLunasList = members.filter((m) => m.status !== "lunas");
    const workspaceName = userWorkspaces.find((w) => w.slug === activeWorkspace)?.namaGrup || activeWorkspace;

    let text = `📢 *LAPORAN IURAN ARISAN* 📢\n`;
    text += `*Grup:* _${workspaceName}_\n`;
    text += `*Putaran Ke:* _${currentPeriod}_\n`;
    text += `*Nominal Iuran:* _Rp ${itemContribution.toLocaleString("id-ID")}/orang_\n\n`;

    text += `-------------------------------------------\n`;
    text += `🟢 *SUDAH LUNAS (${lunasList.length} Orang)*\n`;
    text += `-------------------------------------------\n`;
    if (lunasList.length === 0) {
      text += `(Belum ada)\n`;
    } else {
      lunasList.forEach((m, idx) => {
        text += `${idx + 1}. ✅ ${m.name}\n`;
      });
    }

    text += `\n-------------------------------------------\n`;
    text += `🔴 *BELUM BAYAR (${belumLunasList.length} Orang)*\n`;
    text += `-------------------------------------------\n`;
    if (belumLunasList.length === 0) {
      text += `(Semua sudah lunas)\n`;
    } else {
      belumLunasList.forEach((m, idx) => {
        text += `${idx + 1}. ❌ ${m.name}\n`;
      });
    }

    text += `\n-------------------------------------------\n`;
    text += `💵 *Total Kas Terkumpul:* Rp ${collectedCash.toLocaleString("id-ID")} / Rp ${targetCash.toLocaleString("id-ID")}\n`;
    text += `-------------------------------------------\n`;
    text += `_Dibuat otomatis oleh Aplikasi Lotre Arisan Digital_ 📦`;
    return text;
  }, [members, userWorkspaces, activeWorkspace, currentPeriod, itemContribution, collectedCash, targetCash]);

  const getWinnerStatusText = useCallback(() => {
    const sortedWinners = [...winners].sort((a, b) => a.period - b.period);
    const winnerNames = new Set(sortedWinners.map((w) => w.name));
    const belumMenangList = members.filter((m) => !winnerNames.has(m.name));
    const workspaceName = userWorkspaces.find((w) => w.slug === activeWorkspace)?.namaGrup || activeWorkspace;

    let text = `🏆 *STATUS PEMENANG ARISAN* 🏆\n`;
    text += `*Grup:* _${workspaceName}_\n`;
    text += `*Total Putaran:* _${winners.length} dari ${totalMembers} Periode_\n\n`;

    text += `-------------------------------------------\n`;
    text += `👑 *SUDAH PERNAH MENANG (${sortedWinners.length})*\n`;
    text += `-------------------------------------------\n`;
    if (sortedWinners.length === 0) {
      text += `(Belum ada)\n`;
    } else {
      sortedWinners.forEach((w, idx) => {
        text += `${idx + 1}. ${w.name}\n`;
      });
    }

    text += `\n-------------------------------------------\n`;
    text += `👥 *BELUM PERNAH MENANG (${belumMenangList.length})*\n`;
    text += `-------------------------------------------\n`;
    if (belumMenangList.length === 0) {
      text += `(Semua anggota sudah pernah menang)\n`;
    } else {
      belumMenangList.forEach((m, idx) => {
        text += `${idx + 1}. ${m.name}\n`;
      });
    }

    text += `\n-------------------------------------------\n`;
    text += `_Dibuat otomatis oleh Aplikasi Lotre Arisan Digital_ 📦`;
    return text;
  }, [winners, members, userWorkspaces, activeWorkspace, totalMembers]);

  const handleCopyIuranStatus = () => {
    try {
      const text = getIuranStatusText();
      navigator.clipboard.writeText(text);
      setShareAlert("Laporan iuran disalin ke clipboard!");
      setTimeout(() => setShareAlert(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Gagal menyalin teks.");
    }
  };

  const handleCopyWinnerStatus = () => {
    try {
      const text = getWinnerStatusText();
      navigator.clipboard.writeText(text);
      setShareAlert("Status pemenang disalin ke clipboard!");
      setTimeout(() => setShareAlert(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Gagal menyalin teks.");
    }
  };

  // Kocok (Lottery Draw) main logic
  const handleKocokLotre = () => {
    console.log("handleKocokLotre clicked!");
    console.log("isDrawing:", isDrawing);
    console.log("eligibleList:", eligibleList);

    if (isDrawing) return;
    if (eligibleList.length === 0) {
      alert("Tidak ada anggota eligible! Pastikan anggota sudah membayar LUNAS dan belum pernah menang lotre.");
      return;
    }

    setIsDrawing(true);
    setWinnerFound(null);
    setShowConfetti(false);

    let speed = 40; // Initial shuffle speed
    let duration = 0;
    const maxDuration = 3000; // total 3 seconds

    const performShuffle = () => {
      console.log("performShuffle frame:", duration, speed);
      const randomIndex = Math.floor(Math.random() * eligibleList.length);
      setRolledName(eligibleList[randomIndex].name);
      playTickSound();

      duration += speed;
      if (duration < maxDuration) {
        // Dynamic easing (slowing down elastic curve)
        if (duration > maxDuration * 0.8) {
          speed = 250;
        } else if (duration > maxDuration * 0.6) {
          speed = 120;
        } else if (duration > maxDuration * 0.3) {
          speed = 70;
        }
        setTimeout(performShuffle, speed);
      } else {
        // Finalize winner
        const selectedWinner = eligibleList[Math.floor(Math.random() * eligibleList.length)];
        console.log("Winner selected:", selectedWinner);
        setRolledName(selectedWinner.name);
        setWinnerFound(selectedWinner);
        setIsDrawing(false);
        triggerConfetti();
        playWinSound();
      }
    };

    setTimeout(performShuffle, speed);
  };

  // Confirm winner and commit to database
  const handleSahkanPemenang = async () => {
    if (!winnerFound) return;

    try {
      const res = await fetch("/api/winners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anggotaId: winnerFound.id,
          periodeKe: currentPeriod,
          totalDiterima: collectedCash,
          tenantSlug: activeWorkspace
        })
      });

      if (res.ok) {
        setWinnerFound(null);
        setRolledName("SIAPA PEMENANGNYA?");
        setShowConfetti(false);
        await fetchData();
      } else {
        alert("Gagal mensahkan pemenang di database.");
      }
    } catch (error) {
      console.error("Sahkan pemenang error:", error);
      alert("Gagal menghubungi server database.");
    }
  };

  // ── Migration & Portability Panel State ──────────────────────────────────
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);
  const [migrationTab, setMigrationTab] = useState<"import" | "backfill" | "export">("import");
  const [showAllWinners, setShowAllWinners] = useState<boolean>(false);

  // Bulk Import
  const [importText, setImportText] = useState("");
  const [importNominal, setImportNominal] = useState(200000);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Backfill Wizard
  const [backfillCurrentPeriod, setBackfillCurrentPeriod] = useState(2);
  const [backfillNominal, setBackfillNominal] = useState(200000);
  const [backfillWinners, setBackfillWinners] = useState<{ periodeKe: number; anggotaId: string }[]>([]);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  // Export
  const [exportLoading, setExportLoading] = useState(false);

  // Parse bulk import textarea into array of { name, whatsapp }
  const parseBulkImportText = (text: string) => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split(",").map((p) => p.trim());
        return { name: parts[0] || "", whatsapp: parts[1] || "" };
      })
      .filter((m) => m.name && m.whatsapp);
  };

  const handleBulkImport = async () => {
    const members = parseBulkImportText(importText);
    if (members.length === 0) {
      setImportResult("❌ Tidak ada data valid yang bisa di-parse. Gunakan format: Nama, 081234567890");
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members, tenantSlug: activeWorkspace, nominal: importNominal }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(`✅ ${data.message} (Duplikat dilewati: ${data.duplicates ?? 0})`);
        setImportText("");
        await fetchData();
      } else if (res.status === 422) {
        setImportResult(`❌ Validasi gagal:\n${(data.errors as string[]).join("\n")}`);
      } else {
        setImportResult(`❌ Error: ${data.error}`);
      }
    } catch {
      setImportResult("❌ Koneksi gagal. Periksa server.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleBackfill = async () => {
    if (backfillWinners.length === 0) {
      setBackfillResult("❌ Tentukan minimal 1 pemenang putaran lampau.");
      return;
    }
    const hasMissingWinner = backfillWinners.some((w) => !w.anggotaId);
    if (hasMissingWinner) {
      setBackfillResult("❌ Semua putaran lampau harus memiliki pemenang yang dipilih.");
      return;
    }
    setBackfillLoading(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: activeWorkspace,
          currentPeriod: backfillCurrentPeriod,
          pastWinners: backfillWinners.map((w) => ({
            anggotaId: w.anggotaId,
            periodeKe: w.periodeKe,
            totalDiterima: backfillNominal * members.length,
          })),
          nominal: backfillNominal,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBackfillResult(`✅ ${data.message}`);
        await fetchData();
      } else {
        setBackfillResult(`❌ Error: ${data.error}`);
      }
    } catch {
      setBackfillResult("❌ Koneksi gagal. Periksa server.");
    } finally {
      setBackfillLoading(false);
    }
  };

  const handleExportBackup = async () => {
    setExportLoading(true);
    try {
      const res = await fetch(`/api/export?tenantSlug=${activeWorkspace}`);
      if (!res.ok) throw new Error("Export gagal.");
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `lotre_backup_${activeWorkspace}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Gagal mengekspor data. Coba lagi.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(inputNominal);
    if (isNaN(val) || val <= 0) {
      alert("Masukkan nominal iuran yang valid (angka positif).");
      return;
    }

    if (sessionStatus === "unauthenticated") {
      setNominalIuran(val);
      alert("Mode Demo: Nominal iuran lokal diperbarui secara sementara.");
      return;
    }

    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nominalIuran: val }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("Pengaturan nominal iuran arisan berhasil disimpan!");
        await fetchData();
      } else {
        alert(`Gagal menyimpan pengaturan: ${data.error}`);
      }
    } catch (err) {
      console.error("Save settings error:", err);
      alert("Koneksi gagal saat menghubungi server pengaturan.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Sync backfill winners array when currentPeriod changes
  const syncBackfillWinners = (period: number) => {
    setBackfillCurrentPeriod(period);
    const pastCount = period - 1;
    setBackfillWinners(
      Array.from({ length: pastCount }, (_, i) => ({
        periodeKe: i + 1,
        anggotaId: backfillWinners.find((w) => w.periodeKe === i + 1)?.anggotaId ?? "",
      }))
    );
  };

  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && loading && members.length === 0 && !showDemo)) {
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
        Memuat Dashboard Arisan...
      </div>
    );
  }

  // ─── PREMIUM SAAS LANDING PAGE (IF NOT AUTHENTICATED & NOT IN DEMO) ───
  if (sessionStatus === "unauthenticated" && !showDemo) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "radial-gradient(circle at top right, rgba(139, 92, 246, 0.15), transparent 400px), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.08), transparent 400px), var(--bg-primary)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "24px 16px",
      }}>
        {/* Header */}
        <header style={{
          maxWidth: "1100px",
          width: "100%",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              className="brand-logo-icon"
              style={{
                background: "linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%)",
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "1.1rem",
                boxShadow: "0 4px 12px var(--primary-glow)",
                color: "#ffffff"
              }}
            >
              L
            </div>
            <span style={{ fontSize: "1.2rem", fontWeight: "700", letterSpacing: "-0.01em" }}>Lotre SaaS</span>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              style={{
                padding: "0",
                minHeight: "36px",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--text-primary)"
              }}
              title={theme === "dark" ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
            >
              {theme === "dark" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <Link href="/auth/login" style={{
              minHeight: "36px",
              padding: "0 16px",
              fontSize: "0.85rem",
              borderRadius: "8px",
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-primary)",
              fontWeight: "600",
              cursor: "pointer"
            }}>
              Masuk
            </Link>
            <Link href="/auth/register" className="btn-primary" style={{
              minHeight: "36px",
              padding: "0 16px",
              fontSize: "0.85rem",
              borderRadius: "8px",
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              background: "var(--primary)",
              color: "#fff",
              fontWeight: "600",
              boxShadow: "0 4px 12px var(--primary-glow)",
              cursor: "pointer"
            }}>
              Daftar Kelompok
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <main style={{
          maxWidth: "1100px",
          width: "100%",
          margin: "80px auto",
          textAlign: "center",
          flex: "1 0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span className="badge badge-primary" style={{
            padding: "6px 12px",
            fontSize: "0.75rem",
            marginBottom: "24px",
            borderRadius: "30px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: "600"
          }}>
            ✨ Platform Arisan Digital SaaS Modern
          </span>

          <h1 style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: "800",
            lineHeight: "1.15",
            letterSpacing: "-0.03em",
            maxWidth: "800px",
            margin: "0 auto 20px",
            background: "linear-gradient(to right, #fff 30%, rgba(255,255,255,0.7) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            Ubah Arisan Tradisional Menjadi Kocokan Digital Interaktif
          </h1>

          <p style={{
            fontSize: "clamp(0.95rem, 2vw, 1.15rem)",
            color: "var(--text-secondary)",
            maxWidth: "640px",
            margin: "0 auto 40px",
            lineHeight: "1.6",
          }}>
            Lotre menghadirkan sistem kas transparan, pencatatan iuran lunas sekali klik, dan undian visual premium dengan efek 3D slot-machine & perayaan konfeti megah.
          </p>

          {/* Action CTAs */}
          <div className="landing-ctas" style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: "64px"
          }}>
            <Link href="/auth/register" className="btn-primary" style={{
              padding: "14px 28px",
              fontSize: "0.95rem",
              borderRadius: "12px",
              fontWeight: "600",
              textDecoration: "none",
              background: "var(--primary)",
              color: "#fff",
              boxShadow: "0 6px 20px rgba(139, 92, 246, 0.4)",
              transition: "transform 0.2s"
            }}>
              Mulai Kelompok Baru (Daftar)
            </Link>

            <button
              onClick={() => {
                setShowDemo(true);
                setLoading(true);
                fetchData();
              }}
              style={{
                padding: "14px 28px",
                fontSize: "0.95rem",
                borderRadius: "12px",
                fontWeight: "600",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#34d399",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(16, 185, 129, 0.05)",
                transition: "all 0.2s"
              }}
            >
              Coba Demo Interaktif →
            </button>
          </div>

          {/* Features Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
            width: "100%",
            marginTop: "20px"
          }}>
            {/* Feature 1 */}
            <div className="glass-card" style={{
              padding: "24px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              textAlign: "left"
            }}>
              <div style={{
                width: "42px",
                height: "42px",
                background: "rgba(139,92,246,0.15)",
                color: "var(--primary)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                marginBottom: "16px"
              }}>
                🎰
              </div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "600", color: "#fff", marginBottom: "8px" }}>Undian Visual Premium</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Efek kocokan slot-machine digital dinamis dan perayaan partikel konfeti otomatis yang memukau anggota arisan Anda.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card" style={{
              padding: "24px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              textAlign: "left"
            }}>
              <div style={{
                width: "42px",
                height: "42px",
                background: "rgba(16,185,129,0.15)",
                color: "#34d399",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                marginBottom: "16px"
              }}>
                🏢
              </div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "600", color: "#fff", marginBottom: "8px" }}>Isolasi Multi-Tenant</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Setiap grup memiliki isolasi data yang aman dan alamat slug workspace tersendiri (cth: <code>keluarga-cemara.lotre.com</code>).
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card" style={{
              padding: "24px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              textAlign: "left"
            }}>
              <div style={{
                width: "42px",
                height: "42px",
                background: "rgba(251,191,36,0.15)",
                color: "#fbbf24",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                marginBottom: "16px"
              }}>
                💰
              </div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "600", color: "#fff", marginBottom: "8px" }}>Manajemen Kas & Setoran</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Status grid iuran per putaran. Tandai status bayar sekali klik (Fast-check) oleh admin dan catat histori pemenang otomatis.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer style={{
          maxWidth: "1100px",
          width: "100%",
          margin: "40px auto 0",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          padding: "24px 0 10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "0.8rem",
          color: "var(--text-secondary)"
        }}>
          <div>
            © 2026 Lotre SaaS. Sistem Informasi Arisan Digital Premium.
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <Link href="/superadmin" style={{ color: "var(--text-secondary)", textDecoration: "none", transition: "color 0.2s" }}>
              Superadmin Portal
            </Link>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto", position: "relative" }}>

      {/* Interactive Demo Banner Warning */}
      {showDemo && (
        <div style={{
          background: "rgba(16, 185, 129, 0.15)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          color: "#34d399",
          padding: "12px 20px",
          borderRadius: "12px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "0.88rem",
          fontWeight: "500",
          boxShadow: "0 4px 15px rgba(16, 185, 129, 0.1)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📢</span>
            <span>
              <strong>Mode Demo Interaktif:</strong> Anda sedang menjelajahi simulasi arisan. Data di bawah ini bersifat sementara.
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Link href="/auth/register" style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              padding: "6px 14px",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "0.8rem",
              boxShadow: "0 2px 6px var(--primary-glow)"
            }}>
              Daftar Sekarang
            </Link>
            <button
              onClick={() => setShowDemo(false)}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                color: "#fff",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                padding: "6px 14px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.8rem"
              }}
            >
              Keluar Demo
            </button>
          </div>
        </div>
      )}

      {/* Confetti Rain Container */}
      {showConfetti && (
        <div className="confetti-container">
          {confettiPieces.map((piece) => (
            <div
              key={piece.id}
              className="confetti-piece"
              style={{
                left: piece.left,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                backgroundColor: piece.color,
                width: piece.size,
                height: piece.size,
                transform: `rotate(${piece.rotation})`,
              }}
            />
          ))}
        </div>
      )}

      {/* SaaS Workspace Header Banner */}
      <header className="dashboard-header" style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderRadius: "18px",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid var(--border-glass)",
        marginBottom: "24px",
        gap: "12px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "1.2rem",
            boxShadow: "0 4px 12px var(--primary-glow)"
          }}>
            LT
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "700", letterSpacing: "-0.02em" }}>Lotre SaaS</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Multi-Tenant Management Platform</p>
          </div>
        </div>

        {/* User Session Info or Tenant Selector */}
        {sessionStatus === "authenticated" && session ? (
          <div className="dashboard-header-controls" style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            {/* Workspace Switcher & Creator */}
            <div className="workspace-switcher-row" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>Grup Aktif:</span>
                <select
                  id="workspace-switcher"
                  value={activeWorkspace}
                  onChange={(e) => {
                    if (!isDrawing) {
                      const selectedSlug = e.target.value;
                      setActiveWorkspace(selectedSlug);
                      const found = userWorkspaces.find((w) => w.slug === selectedSlug);
                      if (found) {
                        setActiveTenantId(found.id);
                      }
                      fetchData(selectedSlug);
                    }
                  }}
                  className="custom-select"
                  disabled={isDrawing}
                  style={{
                    minHeight: "36px",
                    fontSize: "0.85rem",
                    padding: "6px 36px 6px 14px",
                  }}
                >
                  {userWorkspaces.map((w) => (
                    <option key={w.id} value={w.slug}>
                      {w.namaGrup}
                    </option>
                  ))}
                </select>
              </div>

              <button
                id="btn-trigger-create-workspace"
                onClick={() => setIsCreatingWorkspace(true)}
                className="btn btn-primary"
                style={{
                  padding: "6px 14px",
                  minHeight: "36px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-glow) 100%)",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px var(--primary-glow)"
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Buat Kelompok Baru
              </button>
            </div>

            {/* Admin Info & Sign Out */}
            <div className="user-info-row" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff" }}>
                  {session.user.name || "Tenant Admin"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {session.user.email}
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="theme-toggle"
                style={{
                  padding: "0",
                  minHeight: "36px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--text-primary)"
                }}
                title={theme === "dark" ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
              >
                {theme === "dark" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="btn btn-secondary"
                style={{
                  padding: "6px 14px",
                  minHeight: "36px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--text-primary)",
                  cursor: "pointer"
                }}
              >
                Keluar
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>Pilih Tenant:</span>
            <div style={{
              background: "rgba(0, 0, 0, 0.3)",
              padding: "4px",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              gap: "4px"
            }}>
              <button
                onClick={() => { if (!isDrawing) setActiveWorkspace("keluarga-cemara"); }}
                className="btn"
                style={{
                  minHeight: "36px",
                  padding: "4px 14px",
                  fontSize: "0.8rem",
                  borderRadius: "8px",
                  background: activeWorkspace === "keluarga-cemara" ? "var(--primary)" : "transparent",
                  color: "#fff",
                  boxShadow: activeWorkspace === "keluarga-cemara" ? "0 2px 8px var(--primary-glow)" : "none"
                }}
              >
                Keluarga Cemara
              </button>
              <button
                onClick={() => { if (!isDrawing) setActiveWorkspace("rt-05"); }}
                className="btn"
                style={{
                  minHeight: "36px",
                  padding: "4px 14px",
                  fontSize: "0.8rem",
                  borderRadius: "8px",
                  background: activeWorkspace === "rt-05" ? "var(--primary)" : "transparent",
                  color: "#fff",
                  boxShadow: activeWorkspace === "rt-05" ? "0 2px 8px var(--primary-glow)" : "none"
                }}
              >
                RT 05 Digital
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main SaaS Workspace Indicator */}
      <div className="workspace-indicator" style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span className="badge badge-primary">
          {sessionStatus === "authenticated" ? "Kelompok Anda" : "SaaS Workspace"}
        </span>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "600", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          {sessionStatus === "authenticated"
            ? (userWorkspaces.find((w) => w.slug === activeWorkspace)?.namaGrup || "Memuat Kelompok...")
            : activeWorkspace === "keluarga-cemara"
              ? "Lotre Keluarga Cemara"
              : "RT 05 Lotre Digital"}
        </h2>

        {/* Plan Status & Upgrade Trigger */}
        {sessionStatus === "authenticated" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {userWorkspaces.find((w) => w.slug === activeWorkspace)?.plan === "premium" ? (
              <span className="badge badge-warning" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", color: "#fff", boxShadow: "0 0 10px rgba(245, 158, 11, 0.4)", display: "flex", alignItems: "center", gap: "4px" }}>
                👑 Premium
              </span>
            ) : userWorkspaces.find((w) => w.slug === activeWorkspace)?.plan === "pending_premium" ? (
              <span className="badge badge-warning" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", color: "#fff", boxShadow: "0 0 10px rgba(59, 130, 246, 0.4)", display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", animation: "pulse 1.5s infinite alternate" }}>
                ⏳ Menunggu Persetujuan
              </span>
            ) : (
              <>
                <span className="badge badge-secondary" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  🆓 Gratis (Free)
                </span>
                <button
                  id="btn-upgrade-workspace"
                  onClick={() => setIsUpgradingWorkspace(true)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(109, 40, 217, 0.15) 100%)",
                    color: "#a78bfa",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.background = "linear-gradient(135deg, var(--primary) 0%, var(--primary-glow) 100%)";
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.boxShadow = "0 0 8px var(--primary-glow)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(109, 40, 217, 0.15) 100%)";
                    e.currentTarget.style.color = "#a78bfa";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  Upgrade 👑
                </button>
              </>
            )}
          </div>
        )}

        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginLeft: "4px" }}>
          (Subdomain: <code>{activeWorkspace}.lotre.com</code>)
        </span>
      </div>

      {/* Grid: Stats Overview Cards */}
      <div className="stats-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "20px",
        marginBottom: "32px"
      }}>
        {/* Card 1: Total Anggota */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>TOTAL ANGGOTA</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "2.2rem", fontWeight: "700" }}>{totalMembers}</span>
            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Orang</span>
          </div>
          <span className="badge badge-primary" style={{ alignSelf: "flex-start", fontSize: "0.7rem" }}>
            Aktif & Terdaftar
          </span>
        </div>

        {/* Card 2: Uang Kas Terkumpul */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>KAS PERIODE INI</span>
          <div style={{ marginTop: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: "700", color: "#34d399" }}>
              Rp {collectedCash.toLocaleString("id-ID")}
            </span>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
              Target: Rp {targetCash.toLocaleString("id-ID")}
            </div>
          </div>
          {/* Custom elegant Progress Bar */}
          <div style={{ width: "100%", background: "rgba(255, 255, 255, 0.05)", height: "6px", borderRadius: "3px", overflow: "hidden", display: "flex" }}>
            <div style={{
              width: `${(collectedCash / (targetCash || 1)) * 100}%`,
              background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
              transition: "width 0.5s ease"
            }} />
          </div>
        </div>

        {/* Card 3: Periode & Kocokan */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>PUTARAN LOTRE</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "2.2rem", fontWeight: "700" }}>{currentPeriod}</span>
            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>dari {totalMembers} Periode</span>
          </div>
          <span className="badge badge-warning" style={{ alignSelf: "flex-start", fontSize: "0.7rem" }}>
            Periode Berjalan
          </span>
        </div>

        {/* Card 4: Status Kelayakan */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>ELIGIBLE KOCOK</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "12px", marginBottom: "8px" }}>
            <span style={{ fontSize: "2.2rem", fontWeight: "700" }}>{eligibleList.length}</span>
            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Peserta</span>
          </div>
          <span className="badge badge-success" style={{ alignSelf: "flex-start", fontSize: "0.7rem" }}>
            Lunas & Belum Menang
          </span>
        </div>
      </div>

      {/* Main Split Content: Draw Machine (Left) & Member List (Right) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "32px",
      }} className="responsive-split">


        {/* Left Column: Premium Kocokan Draw Machine */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <div className="glass-card" style={{
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "40px 24px",
            border: "1px solid var(--border-glow)",
            boxShadow: "0 0 25px rgba(139, 92, 246, 0.15)",
            background: "radial-gradient(circle at center, rgba(13, 20, 35, 0.9) 0%, rgba(8, 11, 17, 0.9) 100%)"
          }}>
            {/* Sound Toggle Button */}
            <button
              onClick={() => setSoundEnabled(prev => !prev)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#fff",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "1rem",
                transition: "all 0.2s",
                zIndex: 10
              }}
              title={soundEnabled ? "Matikan Suara" : "Aktifkan Suara"}
              className="sound-toggle-btn"
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>

            {/* Ambient inner glow */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "150px",
              height: "150px",
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: "50%",
              filter: "blur(40px)",
              pointerEvents: "none",
              zIndex: 0
            }} />

            <div style={{ zIndex: 1, textAlign: "center", width: "100%" }}>
              <span className="badge badge-primary" style={{ marginBottom: "20px" }}>Digital Kocokan Machine</span>

              {/* Raffle Window Display */}
              <div style={{
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "16px",
                padding: "24px 16px",
                minHeight: "130px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "28px",
                position: "relative"
              }}>
                {isDrawing && (
                  <div style={{
                    position: "absolute",
                    top: "10px",
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    color: "var(--primary)",
                    letterSpacing: "0.2em",
                    animation: "pulse 1s infinite alternate"
                  }}>
                    MENGUNDI PEMENANG...
                  </div>
                )}

                <h3 style={{
                  fontSize: rolledName.length > 18 ? "1.25rem" : "1.75rem",
                  fontWeight: "700",
                  letterSpacing: "-0.01em",
                  color: isDrawing ? "var(--primary)" : winnerFound ? "#34d399" : "#fff",
                  textShadow: winnerFound ? "0 0 15px rgba(52, 211, 153, 0.3)" : "none",
                  transition: "color 0.3s ease",
                  textAlign: "center"
                }}>
                  {rolledName}
                </h3>
              </div>

              {/* Action Button: Kocok */}
              {!winnerFound ? (
                <button
                  onClick={handleKocokLotre}
                  disabled={isDrawing || eligibleList.length === 0}
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    fontSize: "1.1rem",
                    padding: "16px 24px",
                    borderRadius: "14px"
                  }}
                >
                  {isDrawing ? "Sedang Mengocok..." : "Mulai Acak Nama"}
                </button>
              ) : (
                /* Action Button: Confirm Winner */
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  <div style={{
                    fontSize: "0.85rem",
                    color: "#34d399",
                    fontWeight: "600",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    padding: "10px",
                    borderRadius: "8px",
                    marginBottom: "8px"
                  }}>
                    🎉 Selamat kepada pemenang periode ini!
                  </div>
                  <button
                    onClick={handleSahkanPemenang}
                    className="btn btn-success"
                    style={{
                      width: "100%",
                      fontSize: "1.1rem",
                      padding: "16px 24px",
                      borderRadius: "14px"
                    }}
                  >
                    Sahkan Pemenang Lotre
                  </button>
                  <button
                    onClick={() => {
                      setWinnerFound(null);
                      setRolledName("SIAPA PEMENANGNYA?");
                      setShowConfetti(false);
                    }}
                    className="btn btn-secondary"
                    style={{ width: "100%" }}
                  >
                    Batal / Kocok Ulang
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Past Winners History Card */}
          <div className="glass-card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--primary)", borderRadius: "50%" }} />
              Riwayat Pemenang Lotre
            </h3>

            {winners.length === 0 ? (
              <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", textAlign: "center", padding: "16px" }}>
                Belum ada riwayat pemenang di putaran lotre ini.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {(showAllWinners ? winners : winners.slice(0, 3)).map((win) => {
                    const isLatest = winners.indexOf(win) === 0;
                    return (
                      <div
                        key={win.period}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          borderRadius: "10px",
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.04)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {isLatest && (
                            <button
                              onClick={() => handleCancelWinner(win.period, win.name)}
                              title="Batalkan Pemenang Putaran Ini"
                              style={{
                                background: "rgba(239, 68, 68, 0.1)",
                                border: "1px solid rgba(239, 68, 68, 0.25)",
                                color: "#ef4444",
                                width: "28px",
                                height: "28px",
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                transition: "all 0.2s",
                                flexShrink: 0
                              }}
                              className="btn-cancel-winner"
                            >
                              🗑️
                            </button>
                          )}
                          <div>
                            <div style={{ fontSize: "0.7rem", color: "var(--primary)", fontWeight: "600" }}>PERIODE {win.period}</div>
                            <div style={{ fontSize: "0.95rem", fontWeight: "600", marginTop: "2px" }}>{win.name}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "0.9rem", color: "#34d399", fontWeight: "600" }}>
                            Rp {win.amount.toLocaleString("id-ID")}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "2px" }}>{win.date}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {winners.length > 3 && (
                  <button
                    onClick={() => setShowAllWinners((prev) => !prev)}
                    className="btn btn-secondary"
                    style={{
                      width: "100%",
                      marginTop: "16px",
                      fontSize: "0.82rem",
                      minHeight: "34px",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      cursor: "pointer"
                    }}
                  >
                    {showAllWinners ? (
                      <>
                        <span>Sembunyikan</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><polyline points="18 15 12 9 6 15"></polyline></svg>
                      </>
                    ) : (
                      <>
                        <span>Lihat Selengkapnya ({winners.length - 3} lagi)</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Settings Panel: Pengaturan Iuran & Kelompok ── */}
          <div className="glass-card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", background: "var(--primary)", borderRadius: "50%" }} />
              Pengaturan Kas & Iuran
            </h3>

            <form onSubmit={handleUpdateSettings} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                  Nominal Iuran per Putaran
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: "14px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Rp</span>
                  <input
                    type="number"
                    placeholder="200000"
                    value={inputNominal}
                    onChange={(e) => setInputNominal(e.target.value)}
                    required
                    style={{
                      padding: "10px 14px 10px 38px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      background: "rgba(0, 0, 0, 0.25)",
                      color: "#fff",
                      fontSize: "0.85rem",
                      outline: "none",
                      width: "100%"
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.75rem", color: "#34d399", marginTop: "2px" }}>
                  Preview: <strong>Rp {(Number(inputNominal) || 0).toLocaleString("id-ID")}</strong>
                </span>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="btn btn-primary"
                style={{
                  width: "100%",
                  fontSize: "0.85rem",
                  minHeight: "38px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center"
                }}
              >
                {isSavingSettings ? "Menyimpan Pengaturan..." : "Simpan Pengaturan"}
              </button>

              <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: "1.4", margin: 0 }}>
                💡 Pembaruan nominal iuran akan otomatis menyesuaikan nilai iuran anggota yang belum membayar pada putaran berjalan agar kalkulasi target kas tetap sinkron.
              </p>
            </form>
          </div>

          {/* Share Arisan Status Card */}
          <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", background: "#3b82f6", borderRadius: "50%" }} />
              Bagikan Status Arisan
            </h3>

            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0, lineHeight: "1.4" }}>
              Salin data ke clipboard dalam format yang rapi untuk dibagikan langsung ke grup WhatsApp kelompok Anda.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Option 1: Status Iuran */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.04)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "0.88rem", color: "#fff" }}>Status Lunas Iuran</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Lunas: {lunasMembersCount} · Belum: {totalMembers - lunasMembersCount}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setShowIuranPreview(!showIuranPreview)}
                      className={`btn ${showIuranPreview ? "btn-primary" : "btn-secondary"}`}
                      style={{
                        width: "32px",
                        height: "32px",
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.95rem",
                        borderRadius: "8px"
                      }}
                      title={showIuranPreview ? "Tutup Preview" : "Tampilkan Preview"}
                    >
                      👁️
                    </button>
                    <button
                      onClick={handleCopyIuranStatus}
                      className="btn btn-primary"
                      style={{
                        width: "32px",
                        height: "32px",
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.95rem",
                        borderRadius: "8px"
                      }}
                      title="Salin Data"
                    >
                      📋
                    </button>
                  </div>
                </div>

                {showIuranPreview && (
                  <div style={{
                    marginTop: "8px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "8px",
                    padding: "10px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    fontSize: "0.72rem",
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    color: "rgba(255, 255, 255, 0.7)",
                    textAlign: "left"
                  }}>
                    {getIuranStatusText()}
                  </div>
                )}
              </div>

              {/* Option 2: Status Pemenang */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.04)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "0.88rem", color: "#fff" }}>Status Pemenang</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Sudah: {winners.length} · Belum: {totalMembers - winners.length}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setShowWinnerPreview(!showWinnerPreview)}
                      className={`btn ${showWinnerPreview ? "btn-primary" : "btn-secondary"}`}
                      style={{
                        width: "32px",
                        height: "32px",
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.95rem",
                        borderRadius: "8px"
                      }}
                      title={showWinnerPreview ? "Tutup Preview" : "Tampilkan Preview"}
                    >
                      👁️
                    </button>
                    <button
                      onClick={handleCopyWinnerStatus}
                      className="btn btn-primary"
                      style={{
                        width: "32px",
                        height: "32px",
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.95rem",
                        borderRadius: "8px"
                      }}
                      title="Salin Data"
                    >
                      📋
                    </button>
                  </div>
                </div>

                {showWinnerPreview && (
                  <div style={{
                    marginTop: "8px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "8px",
                    padding: "10px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    fontSize: "0.72rem",
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    color: "rgba(255, 255, 255, 0.7)",
                    textAlign: "left"
                  }}>
                    {getWinnerStatusText()}
                  </div>
                )}
              </div>
            </div>

            {/* Notification alert inside the card */}
            {shareAlert && (
              <div style={{
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                color: "#34d399",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                textAlign: "center",
                animation: "fadeIn 0.3s"
              }}>
                ✅ {shareAlert}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Member list & Contribution grid */}
        <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 5 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600" }}>Kelola Iuran & Anggota</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Tandai lunas setoran iuran anggota sebelum melaksanakan kocokan lotre
              </p>
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", gap: "12px" }}>
              <div>Lunas: <span style={{ color: "#34d399", fontWeight: "600" }}>{lunasMembersCount}</span></div>
              <div>Belum: <span style={{ color: "#fbbf24", fontWeight: "600" }}>{totalMembers - lunasMembersCount}</span></div>
            </div>
          </div>

          {/* Form Tambah Anggota Baru */}
          <form onSubmit={handleAddMember} className="member-add-form" style={{
            display: "flex",
            gap: "12px",
            padding: "16px 0",
            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
            flexWrap: "wrap",
            alignItems: "center"
          }}>
            <input
              type="text"
              placeholder="Nama Anggota Baru"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              required
              style={{
                flex: 2,
                minWidth: "160px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(0, 0, 0, 0.2)",
                color: "#fff",
                fontSize: "0.85rem"
              }}
            />
            <input
              type="text"
              placeholder="WhatsApp (cth: 0812...)"
              value={newMemberWhatsapp}
              onChange={(e) => setNewMemberWhatsapp(e.target.value)}
              required
              style={{
                flex: 2,
                minWidth: "160px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(0, 0, 0, 0.2)",
                color: "#fff",
                fontSize: "0.85rem"
              }}
            />
            <button
              type="submit"
              disabled={isAddingMember}
              className="btn btn-primary"
              style={{
                minHeight: "36px",
                padding: "4px 16px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                flex: 1,
                minWidth: "100px"
              }}
            >
              {isAddingMember ? "Menyimpan..." : "Tambah Anggota"}
            </button>
          </form>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 0 4px",
            flexWrap: "wrap",
          }}>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <span style={{
                position: "absolute", left: "12px", top: "50%",
                transform: "translateY(-50%)", fontSize: "0.9rem",
                color: "var(--text-secondary)", pointerEvents: "none",
              }}>🔍</span>
              <input
                id="member-search"
                type="text"
                placeholder="Cari nama atau nomor WhatsApp..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 36px 8px 34px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.2)",
                  color: "#fff",
                  fontSize: "0.85rem",
                  outline: "none",
                  transition: "border-color 0.2s",
                  minHeight: "40px",
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
              />
              {memberSearch && (
                <button
                  onClick={() => setMemberSearch("")}
                  style={{
                    position: "absolute", right: "10px", top: "50%",
                    transform: "translateY(-50%)", background: "transparent",
                    border: "none", color: "var(--text-secondary)", cursor: "pointer",
                    fontSize: "0.9rem", padding: "4px",
                  }}
                >✕</button>
              )}
            </div>

            <select
              className="custom-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                minWidth: "140px",
                minHeight: "40px",
                height: "40px",
                paddingTop: "0",
                paddingBottom: "0",
              }}
            >
              <option value="all" style={{ background: "var(--option-bg)", color: "var(--text-primary)" }}>Semua Status</option>
              <option value="lunas" style={{ background: "var(--option-bg)", color: "var(--text-primary)" }}>Sudah Lunas</option>
              <option value="belum_bayar" style={{ background: "var(--option-bg)", color: "var(--text-primary)" }}>Belum Lunas</option>
            </select>
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.78rem",
            color: "var(--text-secondary)",
            padding: "2px 4px 10px",
            flexWrap: "wrap",
            gap: "8px"
          }}>
            <div>
              {memberSearch || statusFilter !== "all" ? (
                <>
                  Menemukan <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>{filteredMembers.length}</span> dari <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>{members.length}</span> anggota berdasarkan filter
                </>
              ) : (
                <>
                  Total anggota: <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>{members.length}</span> orang
                </>
              )}
            </div>

            {/* Select All shortcut for Mobile viewports */}
            <div className="mobile-only">
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "600", color: "var(--primary)" }}>
                <input
                  type="checkbox"
                  checked={paginatedMembers.length > 0 && paginatedMembers.every((m) => selectedMemberIds.includes(m.id))}
                  onChange={handleSelectAll}
                  style={{ cursor: "pointer", width: "15px", height: "15px", verticalAlign: "middle" }}
                />
                Pilih Semua
              </label>
            </div>
          </div>

          {selectedMemberIds.length > 0 && (
            <div className="bulk-actions-toolbar">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--primary)", fontWeight: "700" }}>⚡ Tindakan Massal:</span>
                <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>{selectedMemberIds.length} terpilih</span>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={() => handleBulkPaymentStatus("LUNAS")}
                  className="btn btn-success"
                  style={{
                    minHeight: "32px",
                    padding: "4px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer"
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Tandai Lunas
                </button>
                <button
                  onClick={() => handleBulkPaymentStatus("BELUM_BAYAR")}
                  className="btn btn-secondary"
                  style={{
                    minHeight: "32px",
                    padding: "4px 12px",
                    fontSize: "0.78rem",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer"
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                  Batalkan Lunas
                </button>
                <button
                  onClick={() => setSelectedMemberIds([])}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    padding: "4px 8px"
                  }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="table-responsive" style={{ overflow: "visible", width: "100%" }}>
            <table className="custom-table member-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={paginatedMembers.length > 0 && paginatedMembers.every((m) => selectedMemberIds.includes(m.id))}
                      onChange={handleSelectAll}
                      style={{ cursor: "pointer", width: "16px", height: "16px", verticalAlign: "middle" }}
                      title="Pilih Semua di Halaman Ini"
                    />
                  </th>
                  <th>Nama Anggota</th>
                  <th className="desktop-only">Kontak</th>
                  <th>Status Iuran</th>
                  <th className="desktop-only">Status Undian</th>
                  <th style={{ textAlign: "center" }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 && members.length > 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "28px 16px", color: "var(--text-secondary)" }}>
                      <div style={{ fontSize: "1.5rem", marginBottom: "6px" }}>🔍</div>
                      <div style={{ fontWeight: "600", color: "#fff", marginBottom: "4px" }}>Tidak ada anggota yang cocok</div>
                      <button onClick={() => setMemberSearch("")} style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.82rem" }}>Hapus pencarian</button>
                    </td>
                  </tr>
                ) : paginatedMembers.map((member) => (
                  <tr key={member.id} className={selectedMemberIds.includes(member.id) ? "row-selected" : ""}>
                    <td style={{ textAlign: "center", width: "40px" }} className="td-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={() => handleToggleSelectMember(member.id)}
                        style={{ cursor: "pointer", width: "16px", height: "16px", verticalAlign: "middle" }}
                      />
                    </td>
                    <td data-label="Nama" className="td-name">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span className="member-name" style={{ fontWeight: "600", fontSize: "0.95rem" }}>{member.name}</span>
                        {member.hasWon && (
                          <span className="won-badge" style={{ fontSize: "1rem" }} title="Sudah Menang">👑</span>
                        )}
                      </div>
                      <div className="mobile-contact" style={{ display: "none" }}>
                        {member.whatsapp}
                      </div>
                    </td>
                    <td data-label="Kontak" className="desktop-only">
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{member.whatsapp}</span>
                    </td>
                    <td data-label="Iuran" className="td-iuran">
                      <span className={`badge ${member.status === "lunas" ? "badge-success" : "badge-warning"}`}>
                        {member.status === "lunas" ? "Lunas" : "Belum Bayar"}
                      </span>
                    </td>
                    <td data-label="Undian" className="desktop-only">
                      <span className={`badge ${member.hasWon ? "badge-primary" : "badge-secondary"}`}>
                        {member.hasWon ? "Sudah Menang" : "Belum Menang"}
                      </span>
                    </td>
                    <td data-label="Tindakan" className="td-actions" style={{ position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuMemberId(activeMenuMemberId === member.id ? null : member.id);
                          }}
                          className={`btn-icon ${activeMenuMemberId === member.id ? "active" : ""}`}
                          disabled={isDrawing}
                          title="Pilihan Tindakan"
                          style={{
                            width: "36px",
                            height: "36px",
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                        </button>

                        {activeMenuMemberId === member.id && (
                          <div
                            className="actions-dropdown-menu"
                            style={{
                              position: "absolute",
                              right: "12px",
                              top: "46px",
                              background: "rgba(15, 15, 20, 0.95)",
                              backdropFilter: "blur(12px)",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              borderRadius: "10px",
                              padding: "6px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                              zIndex: 100,
                              minWidth: "160px",
                              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                              textAlign: "left"
                            }}
                          >
                            <button
                              onClick={() => {
                                setActiveMenuMemberId(null);
                                handleTogglePayment(member.id);
                              }}
                              className="dropdown-item"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                width: "100%",
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                borderRadius: "6px",
                                color: "var(--text-primary)",
                                fontSize: "0.85rem",
                                cursor: "pointer",
                                transition: "background 0.2s"
                              }}
                            >
                              {member.status === "lunas" ? (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
                                  <div style={{ flex: 1, textAlign: "left" }}>Batalkan Lunas</div>
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                                  <div style={{ flex: 1, textAlign: "left" }}>Tandai Lunas</div>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                setActiveMenuMemberId(null);
                                setEditingMember(member);
                                setEditMemberName(member.name);
                                setEditMemberWhatsapp(member.whatsapp);
                              }}
                              className="dropdown-item"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                width: "100%",
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                borderRadius: "6px",
                                color: "var(--text-primary)",
                                fontSize: "0.85rem",
                                cursor: "pointer",
                                transition: "background 0.2s"
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                              <div style={{ flex: 1, textAlign: "left" }}>Ubah Data</div>
                            </button>

                            <button
                              onClick={() => {
                                setActiveMenuMemberId(null);
                                handleDeleteMember(member.id, member.name);
                              }}
                              className="dropdown-item"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                width: "100%",
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                borderRadius: "6px",
                                color: "var(--text-primary)",
                                fontSize: "0.85rem",
                                cursor: "pointer",
                                transition: "background 0.2s"
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                              <div style={{ flex: 1, textAlign: "left" }}>Hapus Anggota</div>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Pagination Controls ────────────────────────────────────────────── */}
            {filteredMembers.length > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 12px 8px",
                marginTop: "8px",
                borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                flexWrap: "wrap",
                gap: "12px",
                fontSize: "0.82rem",
                color: "var(--text-secondary)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Tampilkan:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(0, 0, 0, 0.25)",
                      color: "#fff",
                      outline: "none",
                      fontSize: "0.8rem",
                      cursor: "pointer"
                    }}
                  >
                    <option value="5" style={{ background: "var(--option-bg)", color: "var(--text-primary)" }}>5</option>
                    <option value="10" style={{ background: "var(--option-bg)", color: "var(--text-primary)" }}>10</option>
                    <option value="20" style={{ background: "var(--option-bg)", color: "var(--text-primary)" }}>20</option>
                    <option value="50" style={{ background: "var(--option-bg)", color: "var(--text-primary)" }}>50</option>
                    <option value="100" style={{ background: "var(--option-bg)", color: "var(--text-primary)" }}>100</option>
                  </select>
                  <span>entri</span>
                </div>

                <div>
                  Halaman {currentPage} dari {Math.ceil(filteredMembers.length / itemsPerPage) || 1} ({filteredMembers.length} anggota)
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-secondary"
                    style={{
                      minHeight: "30px",
                      padding: "4px 10px",
                      fontSize: "0.78rem",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredMembers.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredMembers.length / itemsPerPage)}
                    className="btn btn-secondary"
                    style={{
                      minHeight: "30px",
                      padding: "4px 10px",
                      fontSize: "0.78rem",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Migration & Portability Panel ──────────────────────────────── */}
      <div
        className="glass-card"
        style={{ marginTop: "32px", padding: 0, overflow: "hidden" }}
      >
        {/* Collapsible Header */}
        <button
          id="toggle-migration-panel"
          onClick={() => setShowMigrationPanel((v) => !v)}
          style={{
            width: "100%",
            background: "rgba(139, 92, 246, 0.08)",
            border: "none",
            borderBottom: showMigrationPanel ? "1px solid rgba(255,255,255,0.08)" : "none",
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderRadius: showMigrationPanel ? "18px 18px 0 0" : "18px",
            transition: "background 0.2s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.1rem", flexShrink: 0,
            }}>📦</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: "700", fontSize: "1rem" }}>Migrasi &amp; Portabilitas Data</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Import massal · Backfill putaran · Backup JSON
              </div>
            </div>
          </div>
          <span style={{
            fontSize: "1.2rem",
            transform: showMigrationPanel ? "rotate(180deg)" : "none",
            transition: "transform 0.3s ease",
            color: "var(--text-secondary)"
          }}>▾</span>
        </button>

        {/* Panel Content */}
        {showMigrationPanel && (
          <div style={{ padding: "24px" }}>

            {/* Tab Switcher */}
            <div className="migration-tabs" style={{
              display: "flex", gap: "8px", marginBottom: "24px",
              background: "rgba(0,0,0,0.2)", padding: "4px",
              borderRadius: "12px", width: "fit-content",
            }}>
              {(["import", "backfill", "export"] as const).map((tab) => (
                <button
                  key={tab}
                  id={`migration-tab-${tab}`}
                  onClick={() => { setMigrationTab(tab); setImportResult(null); setBackfillResult(null); }}
                  className={`btn ${migrationTab === tab ? "active-migration-tab" : ""}`}
                  style={{
                    minHeight: "36px",
                    padding: "4px 18px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: migrationTab === tab ? "600" : "400",
                    background: migrationTab === tab ? "var(--primary)" : "transparent",
                    color: migrationTab === tab ? "#fff" : "var(--text-secondary)",
                    boxShadow: migrationTab === tab ? "0 2px 8px var(--primary-glow)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  {tab === "import" ? "📥 Import Massal" : tab === "backfill" ? "🔄 Backfill Putaran" : "💾 Backup Data"}
                </button>
              ))}
            </div>

            {/* ── TAB 1: Bulk Import ── */}
            {migrationTab === "import" && (
              <div>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Tempel daftar anggota dengan format satu baris per orang: <code style={{
                    background: "rgba(255,255,255,0.07)", padding: "2px 8px", borderRadius: "6px"
                  }}>Nama Lengkap, 081234567890</code>
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "12px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Iuran per Orang (Rp)
                    <input
                      id="import-nominal"
                      type="number"
                      value={importNominal}
                      onChange={(e) => setImportNominal(Number(e.target.value))}
                      min={1000}
                      step={1000}
                      style={{
                        display: "block", marginTop: "6px", width: "100%",
                        padding: "8px 12px", borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.9rem",
                      }}
                    />
                  </label>
                </div>
                <textarea
                  id="import-textarea"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={"Budi Santoso, 081234567890\nAni Rahayu, 085987654321\nJoko Widodo, 0812111222"}
                  rows={8}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.2)",
                    color: "#fff",
                    fontSize: "0.85rem",
                    fontFamily: "monospace",
                    resize: "vertical",
                    lineHeight: "1.6",
                    marginBottom: "12px",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {parseBulkImportText(importText).length > 0
                      ? `Terdeteksi: ${parseBulkImportText(importText).length} baris valid`
                      : "Belum ada data"}
                  </div>
                  <button
                    id="btn-bulk-import"
                    onClick={handleBulkImport}
                    disabled={importLoading || importText.trim().length === 0}
                    className="btn btn-primary"
                    style={{ minHeight: "40px", padding: "8px 24px", borderRadius: "10px", marginLeft: "auto" }}
                  >
                    {importLoading ? "Mengimpor..." : "Jalankan Import"}
                  </button>
                </div>
                {importResult && (
                  <div style={{
                    marginTop: "12px", padding: "12px 16px", borderRadius: "10px",
                    background: importResult.startsWith("✅") ? "rgba(52, 211, 153, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${importResult.startsWith("✅") ? "rgba(52, 211, 153, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    fontSize: "0.85rem", whiteSpace: "pre-line", lineHeight: "1.6",
                  }}>
                    {importResult}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: Backfill Wizard ── */}
            {migrationTab === "backfill" && (
              <div>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Rekonstruksi putaran lotre yang sudah berjalan sebelum sistem ini dipakai. Tentukan putaran aktif saat ini, lalu pilih pemenang tiap putaran lampau.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Putaran Aktif Saat Ini (No.)
                    <input
                      id="backfill-period"
                      type="number"
                      value={backfillCurrentPeriod}
                      min={2}
                      max={50}
                      onChange={(e) => syncBackfillWinners(Number(e.target.value))}
                      style={{
                        display: "block", marginTop: "6px", width: "100%",
                        padding: "8px 12px", borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.9rem",
                      }}
                    />
                  </label>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Iuran per Putaran (Rp)
                    <input
                      id="backfill-nominal"
                      type="number"
                      value={backfillNominal}
                      min={1000}
                      step={1000}
                      onChange={(e) => setBackfillNominal(Number(e.target.value))}
                      style={{
                        display: "block", marginTop: "6px", width: "100%",
                        padding: "8px 12px", borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.9rem",
                      }}
                    />
                  </label>
                </div>

                {backfillCurrentPeriod >= 2 && (
                  <div style={{ marginBottom: "20px" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "10px", fontWeight: "600" }}>
                      Pemenang Putaran Lampau ({backfillCurrentPeriod - 1} Putaran):
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {Array.from({ length: backfillCurrentPeriod - 1 }, (_, i) => i + 1).map((p) => (
                        <div key={p} style={{
                          display: "grid", gridTemplateColumns: "120px 1fr",
                          alignItems: "center", gap: "12px",
                        }}>
                          <span style={{
                            fontSize: "0.85rem", fontWeight: "600",
                            padding: "6px 12px", borderRadius: "8px",
                            background: "rgba(139, 92, 246, 0.15)",
                            textAlign: "center",
                          }}>Putaran {p}</span>
                          <select
                            id={`backfill-winner-${p}`}
                            value={backfillWinners.find((w) => w.periodeKe === p)?.anggotaId ?? ""}
                            onChange={(e) => {
                              setBackfillWinners((prev) =>
                                prev.map((w) =>
                                  w.periodeKe === p ? { ...w, anggotaId: e.target.value } : w
                                )
                              );
                            }}
                            className="custom-select"
                            style={{
                              minHeight: "36px",
                              fontSize: "0.85rem",
                              padding: "6px 36px 6px 14px"
                            }}
                          >
                            <option value="">— Pilih Pemenang —</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  id="btn-run-backfill"
                  onClick={handleBackfill}
                  disabled={backfillLoading || members.length === 0}
                  className="btn btn-primary"
                  style={{ minHeight: "40px", padding: "8px 24px", borderRadius: "10px" }}
                >
                  {backfillLoading ? "Memproses Backfill..." : "Jalankan Backfill"}
                </button>
                {members.length === 0 && (
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "8px" }}>
                    ⚠️ Tambahkan anggota terlebih dahulu sebelum menjalankan backfill.
                  </p>
                )}
                {backfillResult && (
                  <div style={{
                    marginTop: "12px", padding: "12px 16px", borderRadius: "10px",
                    background: backfillResult.startsWith("✅") ? "rgba(52, 211, 153, 0.1)" : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${backfillResult.startsWith("✅") ? "rgba(52, 211, 153, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    fontSize: "0.85rem", whiteSpace: "pre-line", lineHeight: "1.6",
                  }}>
                    {backfillResult}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: Export Backup ── */}
            {migrationTab === "export" && (
              <div>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Unduh seluruh data workspace <strong style={{ color: "var(--primary)", fontWeight: "700" }}>{activeWorkspace}</strong> sebagai file JSON terstruktur.
                  File ini dapat digunakan untuk backup, audit, atau migrasi ke sistem lain.
                </p>
                <div style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(0,0,0,0.15)",
                  padding: "16px 20px",
                  marginBottom: "20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "12px",
                }}>
                  {[
                    { label: "Tenant Info", desc: "Nama grup, slug, status", icon: "🏢" },
                    { label: "Anggota", desc: `${members.length} orang terdaftar`, icon: "👥" },
                    { label: "Setoran", desc: "Semua riwayat setoran", icon: "💰" },
                    { label: "Pemenang", desc: "Semua riwayat undian", icon: "🏆" },
                  ].map((item) => (
                    <div key={item.label} style={{
                      display: "flex", flexDirection: "column", gap: "4px"
                    }}>
                      <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
                      <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>{item.label}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{item.desc}</span>
                    </div>
                  ))}
                </div>
                <button
                  id="btn-export-backup"
                  onClick={handleExportBackup}
                  disabled={exportLoading}
                  className="btn btn-primary"
                  style={{
                    minHeight: "44px", padding: "10px 28px", borderRadius: "10px",
                    fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px",
                  }}
                >
                  <span>{exportLoading ? "Menyiapkan file..." : "⬇️ Unduh Backup JSON"}</span>
                </button>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Premium Upgrade & Pricing Modal */}
      {isUpgradingWorkspace && (
        <div className="modal-overlay" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div className="modal-content" style={{
            background: "rgba(20, 15, 45, 0.9)",
            backdropFilter: "blur(20px)",
            border: "1px solid #f59e0b",
            borderRadius: "24px",
            padding: "32px",
            maxWidth: "520px",
            width: "100%",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(245, 158, 11, 0.25)",
            boxSizing: "border-box",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "150px",
              height: "150px",
              background: "rgba(245, 158, 11, 0.15)",
              filter: "blur(50px)",
              borderRadius: "50%"
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.8rem" }}>👑</span>
                <h3 style={{ fontSize: "1.35rem", fontWeight: "800", margin: 0, color: "#fff", letterSpacing: "-0.01em" }}>
                  Tingkatkan ke Paket Premium
                </h3>
              </div>
              <button
                id="btn-close-upgrade-modal"
                onClick={() => {
                  setIsUpgradingWorkspace(false);
                  setAgreedToPremiumTerms(false);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px"
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "20px" }}>
              Tingkatkan kelompok arisan <strong style={{ color: "#fff" }}>&ldquo;{userWorkspaces.find((w) => w.slug === activeWorkspace)?.namaGrup}&rdquo;</strong> ke tingkat profesional dengan akses fitur terlengkap.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              <div
                onClick={() => setSelectedPremiumPlanType("monthly")}
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  border: `2px solid ${selectedPremiumPlanType === "monthly" ? "#f59e0b" : "rgba(255, 255, 255, 0.05)"}`,
                  background: selectedPremiumPlanType === "monthly" ? "rgba(245, 158, 11, 0.08)" : "rgba(0, 0, 0, 0.2)",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "all 0.2s"
                }}
              >
                <div>
                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.95rem" }}>Paket Bulanan</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>Billed monthly, cancel anytime</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: "800", color: "#f59e0b" }}>Rp 49.000</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>/ bulan</div>
                </div>
              </div>

              <div
                onClick={() => setSelectedPremiumPlanType("yearly")}
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  border: `2px solid ${selectedPremiumPlanType === "yearly" ? "#f59e0b" : "rgba(255, 255, 255, 0.05)"}`,
                  background: selectedPremiumPlanType === "yearly" ? "rgba(245, 158, 11, 0.08)" : "rgba(0, 0, 0, 0.2)",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "all 0.2s",
                  position: "relative"
                }}
              >
                <span style={{
                  position: "absolute",
                  top: "-10px",
                  right: "12px",
                  background: "#10b981",
                  color: "#fff",
                  fontSize: "0.65rem",
                  fontWeight: "700",
                  padding: "2px 8px",
                  borderRadius: "20px",
                  boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)"
                }}>
                  HEMAT 20%
                </span>
                <div>
                  <div style={{ fontWeight: "700", color: "#fff", fontSize: "0.95rem" }}>Paket Tahunan</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>Billed annually (Rp 470.000)</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: "800", color: "#f59e0b" }}>Rp 39.160</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>/ bulan ekivalen</div>
                </div>
              </div>
            </div>

            <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "14px",
              padding: "16px 20px",
              marginBottom: "24px",
              border: "1px solid rgba(255, 255, 255, 0.04)"
            }}>
              <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#fff", marginBottom: "10px" }}>Fitur Premium yang Didapatkan:</div>
              <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <li>🚀 <strong style={{ color: "#fff" }}>WhatsApp Gateway</strong>: Pengiriman tagihan, bukti lunas, dan pemenang otomatis.</li>
                <li>👥 <strong style={{ color: "#fff" }}>Anggota Tanpa Batas</strong>: Kelola grup arisan skala besar tanpa batasan.</li>
                <li>📊 <strong style={{ color: "#fff" }}>Analitik & Laporan Keuangan</strong>: Cetak PDF/Excel siap untuk rapat kelompok.</li>
                <li>💾 <strong style={{ color: "#fff" }}>Cloud Auto-Backup</strong>: Perlindungan data jangka panjang anti hilang.</li>
              </ul>
            </div>

            <form onSubmit={handleUpgradeWorkspace}>
              <label style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                cursor: "pointer",
                userSelect: "none",
                marginBottom: "24px"
              }}>
                <input
                  id="checkbox-premium-consent"
                  type="checkbox"
                  required
                  checked={agreedToPremiumTerms}
                  onChange={(e) => setAgreedToPremiumTerms(e.target.checked)}
                  style={{
                    marginTop: "2px",
                    cursor: "pointer",
                    accentColor: "#f59e0b"
                  }}
                />
                <span>
                  Saya selaku <strong>Admin Kelompok</strong> menyetujui pengaktifan paket Premium dan bertanggung jawab atas pengelolaan pembayaran kas kelompok ini.
                </span>
              </label>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  id="btn-cancel-upgrade"
                  type="button"
                  onClick={() => {
                    setIsUpgradingWorkspace(false);
                    setAgreedToPremiumTerms(false);
                  }}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    cursor: "pointer"
                  }}
                >
                  Batal
                </button>
                <button
                  id="btn-confirm-upgrade-submit"
                  type="submit"
                  disabled={!agreedToPremiumTerms || loading}
                  className="btn"
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    cursor: agreedToPremiumTerms ? "pointer" : "not-allowed",
                    background: agreedToPremiumTerms ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "rgba(255,255,255,0.05)",
                    border: "none",
                    color: agreedToPremiumTerms ? "#fff" : "rgba(255,255,255,0.3)",
                    boxShadow: agreedToPremiumTerms ? "0 4px 12px rgba(245, 158, 11, 0.3)" : "none",
                    fontWeight: "700",
                    transition: "all 0.2s"
                  }}
                >
                  Setujui & Aktifkan 👑
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workspace Creator Modal */}
      {isCreatingWorkspace && (
        <div className="modal-overlay" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div className="modal-content" style={{
            background: "rgba(30, 27, 75, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(139, 92, 246, 0.25)",
            borderRadius: "20px",
            padding: "28px",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px var(--primary-glow)",
            boxSizing: "border-box"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.5rem" }}>🎪</span>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "700", margin: 0, color: "#fff" }}>Buat Kelompok Arisan Baru</h3>
              </div>
              <button
                id="btn-close-create-workspace"
                onClick={() => setIsCreatingWorkspace(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px"
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Nama Kelompok Arisan
                </label>
                <input
                  id="new-workspace-name"
                  type="text"
                  required
                  value={newWorkspaceName}
                  onChange={(e) => {
                    setNewWorkspaceName(e.target.value);
                    // Auto-slugify
                    setNewWorkspaceSlug(e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9-]/g, "")
                      .slice(0, 50)
                    );
                  }}
                  placeholder="Arisan RT 06, Arisan Keluarga..."
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(0, 0, 0, 0.2)",
                    color: "#fff",
                    fontSize: "0.9rem",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Subdomain Slug (Isolasi Link)
                </label>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    id="new-workspace-slug"
                    type="text"
                    required
                    value={newWorkspaceSlug}
                    onChange={(e) => setNewWorkspaceSlug(e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9-]/g, "")
                      .slice(0, 50)
                    )}
                    placeholder="nama-arisan"
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px 0 0 8px",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRight: "none",
                      background: "rgba(0, 0, 0, 0.2)",
                      color: "#fff",
                      fontSize: "0.9rem",
                      flex: 1,
                      outline: "none"
                    }}
                  />
                  <span style={{
                    padding: "10px 12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "0 8px 8px 0",
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)"
                  }}>
                    .lotre.com
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Link khusus workspace: <code>{newWorkspaceSlug || "slug"}.lotre.com</code>
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Nominal Iuran per Putaran (Rp)
                </label>
                <input
                  id="new-workspace-nominal"
                  type="number"
                  required
                  min={1000}
                  step={1000}
                  value={newWorkspaceNominal}
                  onChange={(e) => setNewWorkspaceNominal(e.target.value)}
                  placeholder="200000"
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(0, 0, 0, 0.2)",
                    color: "#fff",
                    fontSize: "0.9rem",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Paket Layanan Workspace
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    id="plan-free"
                    type="button"
                    onClick={() => setNewWorkspacePlan("free")}
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      border: `1px solid ${newWorkspacePlan === "free" ? "var(--primary)" : "rgba(255, 255, 255, 0.08)"}`,
                      background: newWorkspacePlan === "free" ? "rgba(139, 92, 246, 0.1)" : "rgba(0, 0, 0, 0.2)",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: newWorkspacePlan === "free" ? "600" : "400",
                      textAlign: "center",
                      transition: "all 0.2s"
                    }}
                  >
                    🆓 Gratis (Free)
                  </button>
                  <button
                    id="plan-premium"
                    type="button"
                    onClick={() => setNewWorkspacePlan("premium")}
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      border: `1px solid ${newWorkspacePlan === "premium" ? "#f59e0b" : "rgba(255, 255, 255, 0.08)"}`,
                      background: newWorkspacePlan === "premium" ? "rgba(245, 158, 11, 0.1)" : "rgba(0, 0, 0, 0.2)",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: newWorkspacePlan === "premium" ? "600" : "400",
                      textAlign: "center",
                      transition: "all 0.2s"
                    }}
                  >
                    👑 Premium
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  id="btn-cancel-workspace"
                  type="button"
                  onClick={() => setIsCreatingWorkspace(false)}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    cursor: "pointer"
                  }}
                >
                  Batal
                </button>
                <button
                  id="btn-submit-workspace"
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-glow) 100%)",
                    boxShadow: "0 2px 8px var(--primary-glow)",
                    border: "none",
                    color: "#fff"
                  }}
                >
                  Buat Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="modal-overlay" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div className="modal-content" style={{
            background: "rgba(30, 27, 75, 0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(139, 92, 246, 0.25)",
            borderRadius: "20px",
            padding: "28px",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px var(--primary-glow)",
            boxSizing: "border-box"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.5rem" }}>✍️</span>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "700", margin: 0, color: "#fff" }}>Ubah Data Anggota</h3>
              </div>
              <button
                id="btn-close-edit-member"
                onClick={() => setEditingMember(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px"
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditMember} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Nama Anggota
                </label>
                <input
                  id="edit-member-name"
                  type="text"
                  required
                  value={editMemberName}
                  onChange={(e) => setEditMemberName(e.target.value)}
                  placeholder="Nama Anggota"
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(0, 0, 0, 0.2)",
                    color: "#fff",
                    fontSize: "0.9rem",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  WhatsApp (cth: 0812...)
                </label>
                <input
                  id="edit-member-whatsapp"
                  type="text"
                  required
                  value={editMemberWhatsapp}
                  onChange={(e) => setEditMemberWhatsapp(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    background: "rgba(0, 0, 0, 0.2)",
                    color: "#fff",
                    fontSize: "0.9rem",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  id="btn-cancel-edit-member"
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    cursor: "pointer"
                  }}
                >
                  Batal
                </button>
                <button
                  id="btn-submit-edit-member"
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingEditMember}
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    borderRadius: "10px",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-glow) 100%)",
                    boxShadow: "0 2px 8px var(--primary-glow)",
                    border: "none",
                    color: "#fff"
                  }}
                >
                  {isSavingEditMember ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer style={{
        marginTop: "48px",
        textAlign: "center",
        padding: "24px 16px",
        borderTop: "1px solid rgba(255, 255, 255, 0.04)",
        fontSize: "0.85rem",
        color: "var(--text-secondary)"
      }}>
        <p>© 2026 Lotre SaaS Digital. Built with Next.js & Custom Vanilla CSS.</p>
        <p style={{ fontSize: "0.75rem", marginTop: "4px" }}>
          SaaS Engine: Multi-tenant, Subdomain isolation middleware configured. PWA installation enabled.
        </p>
      </footer>
    </div>
  );
}
