"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterWizardPage() {
  const [step, setStep] = useState(1);
  
  // Step 1: Admin User Account details
  const [namaLengkap, setNamaLengkap] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Step 2: Tenant Workspace details
  const [namaGrup, setNamaGrup] = useState("");
  const [slug, setSlug] = useState("");
  
  // Step 3: Subscription Plan details
  const [plan, setPlan] = useState<"free" | "premium">("free");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const router = useRouter();

  // Real-time slug generator
  const handleNamaGrupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNamaGrup(val);
    // Convert to lowercase, replace spaces with dashes, remove special chars
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    setSlug(generatedSlug);
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleanedSlug = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(cleanedSlug);
  };

  // Navigations
  const nextStep = () => {
    if (step === 1) {
      if (!namaLengkap.trim() || !email.trim() || !password.trim()) {
        setError("Silakan isi semua data admin terlebih dahulu.");
        return;
      }
      if (password.length < 6) {
        setError("Kata sandi harus minimal berisi 6 karakter.");
        return;
      }
    }
    if (step === 2) {
      if (!namaGrup.trim() || !slug.trim()) {
        setError("Nama grup lotre dan alamat slug wajib ditentukan.");
        return;
      }
    }
    setError(null);
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setError(null);
    setStep((prev) => prev - 1);
  };

  // Final submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          namaLengkap,
          namaGrup,
          slug,
          plan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal melakukan registrasi.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/auth/login");
      }, 2500);
    } catch (err) {
      console.error("Register wizard failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan sistem saat mendaftar.";
      setError(errorMessage);
      // Go back to the step where the error likely occurred
      if (errorMessage.includes("Email")) {
        setStep(1);
      } else if (errorMessage.includes("Subdomain") || errorMessage.includes("Slug")) {
        setStep(2);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="glass-card" style={{
        padding: "48px 32px",
        borderRadius: "20px",
        border: "1px solid rgba(16, 185, 129, 0.3)",
        background: "var(--bg-surface)",
        textAlign: "center",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(16, 185, 129, 0.15)",
          border: "2px solid var(--success)",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          marginBottom: "24px",
          color: "var(--success)",
          fontSize: "2rem",
          animation: "scaleUp 0.4s ease-out"
        }}>
          ✓
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#fff" }}>Registrasi Berhasil!</h2>
        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "10px", lineHeight: "1.5" }}>
          Workspace arisan digital **{namaGrup}** telah sukses disiapkan.<br />
          Anda akan dialihkan ke halaman masuk dalam beberapa detik...
        </p>
        
        <style jsx>{`
          @keyframes scaleUp {
            from { transform: scale(0.6); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{
      padding: "40px 32px",
      borderRadius: "20px",
      border: "1px solid var(--border-glass)",
      background: "var(--bg-surface)",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
    }}>
      {/* Brand & Progress Bar */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.45rem", fontWeight: "700", color: "#fff", letterSpacing: "-0.01em" }}>
          Daftar Kelompok Lotre SaaS
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
          Langkah {step} dari 3: {step === 1 ? "Admin Sistem" : step === 2 ? "Detail Workspace" : "Pilih Paket"}
        </p>

        {/* Custom Premium Wizard Step Indicator */}
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "center" }}>
          <div style={{
            height: "4px",
            width: "36px",
            borderRadius: "2px",
            background: step >= 1 ? "var(--primary)" : "rgba(255,255,255,0.08)",
            boxShadow: step >= 1 ? "0 0 6px var(--primary)" : "none",
            transition: "all 0.3s ease"
          }} />
          <div style={{
            height: "4px",
            width: "36px",
            borderRadius: "2px",
            background: step >= 2 ? "var(--primary)" : "rgba(255,255,255,0.08)",
            boxShadow: step >= 2 ? "0 0 6px var(--primary)" : "none",
            transition: "all 0.3s ease"
          }} />
          <div style={{
            height: "4px",
            width: "36px",
            borderRadius: "2px",
            background: step >= 3 ? "var(--primary)" : "rgba(255,255,255,0.08)",
            boxShadow: step >= 3 ? "0 0 6px var(--primary)" : "none",
            transition: "all 0.3s ease"
          }} />
        </div>
      </div>

      {/* Error Message Box */}
      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          color: "#fca5a5",
          padding: "10px 14px",
          borderRadius: "8px",
          fontSize: "0.82rem",
          marginBottom: "20px"
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Multi-Step Forms Wrapper */}
      <form onSubmit={handleSubmit}>
        
        {/* STEP 1: Admin Account */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", animation: "fadeIn 0.3s" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                Nama Lengkap Admin
              </label>
              <input
                type="text"
                placeholder="cth: Abah Cemara"
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                Alamat Email
              </label>
              <input
                type="email"
                placeholder="cth: cemara@lotre.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                Kata Sandi (min 6 karakter)
              </label>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Sandi Rahasia"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, width: "100%", paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "1rem",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title={showPassword ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="btn btn-primary"
              style={{ ...btnStyle, marginTop: "12px" }}
            >
              Lanjutkan Ke Detail Grup →
            </button>
          </div>
        )}

        {/* STEP 2: Tenant Workspace Slug */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", animation: "fadeIn 0.3s" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                Nama Kelompok Arisan / Lotre
              </label>
              <input
                type="text"
                placeholder="cth: Lotre Keluarga Cemara"
                value={namaGrup}
                onChange={handleNamaGrupChange}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                Subdomain Workspace / Slug URL
              </label>
              <input
                type="text"
                placeholder="cth: keluarga-cemara"
                value={slug}
                onChange={handleSlugChange}
                required
                style={inputStyle}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Preview Domain: <code>{slug || "your-slug"}.lotre.com</code>
              </span>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={prevStep}
                className="btn btn-secondary"
                style={{ ...btnStyle, flex: 1 }}
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={nextStep}
                className="btn btn-primary"
                style={{ ...btnStyle, flex: 2 }}
              >
                Pilih Paket →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Subscriptions selection */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", animation: "fadeIn 0.3s" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>
              Pilih Paket Langganan Grup Anda
            </span>

            {/* Plans Toggle */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              
              {/* Free Card */}
              <div
                onClick={() => setPlan("free")}
                style={{
                  ...planCardStyle,
                  borderColor: plan === "free" ? "var(--primary)" : "rgba(255,255,255,0.06)",
                  background: plan === "free" ? "rgba(139, 92, 246, 0.05)" : "rgba(0,0,0,0.15)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: "700", color: "#fff", fontSize: "0.95rem" }}>Paket Gratis (Free)</span>
                  <span style={{ fontSize: "0.85rem", color: "#34d399", fontWeight: "700" }}>Rp 0 / bln</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "6px" }}>
                  Maksimal 10 anggota arisan. Kocokan digital dasar & Riwayat 3 putaran terakhir.
                </p>
              </div>

              {/* Premium Card */}
              <div
                onClick={() => setPlan("premium")}
                style={{
                  ...planCardStyle,
                  borderColor: plan === "premium" ? "var(--primary)" : "rgba(255,255,255,0.06)",
                  background: plan === "premium" ? "rgba(139, 92, 246, 0.05)" : "rgba(0,0,0,0.15)",
                  boxShadow: plan === "premium" ? "0 4px 15px rgba(139, 92, 246, 0.15)" : "none"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: "700", color: "#fff", fontSize: "0.95rem" }}>Paket Premium</span>
                    <span className="badge badge-primary" style={{ fontSize: "0.6rem", padding: "2px 6px" }}>POPULER</span>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#34d399", fontWeight: "700" }}>Rp 49.000 / bln</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "6px" }}>
                  Anggota tanpa batas (Unlimited). Kocokan visual premium (efek konfeti), riwayat penuh, & ekspor data Excel.
                </p>
              </div>

            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={prevStep}
                disabled={loading}
                className="btn btn-secondary"
                style={{ ...btnStyle, flex: 1 }}
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ ...btnStyle, flex: 2, boxShadow: "0 4px 12px var(--primary-glow)" }}
              >
                {loading ? "Menyimpan Data..." : "Selesaikan Pendaftaran"}
              </button>
            </div>
          </div>
        )}

      </form>

      {/* Navigation Footer */}
      <div style={{ textAlign: "center", marginTop: "24px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        Sudah memiliki kelompok?{" "}
        <Link href="/auth/login" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>
          Masuk Aplikasi
        </Link>
      </div>

      {/* Animations CSS */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// Inline Styles
const inputStyle = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  background: "rgba(0, 0, 0, 0.25)",
  color: "#fff",
  fontSize: "0.85rem",
  outline: "none",
  transition: "border-color 0.2s"
};

const btnStyle = {
  minHeight: "40px",
  fontSize: "0.9rem",
  fontWeight: "600",
  borderRadius: "8px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};

const planCardStyle = {
  padding: "16px",
  borderRadius: "10px",
  border: "1px solid",
  cursor: "pointer",
  transition: "all 0.2s ease"
};
