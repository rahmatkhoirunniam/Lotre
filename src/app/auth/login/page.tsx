"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email atau sandi salah. Pastikan kredensial Anda benar.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      console.error("Login unexpected error:", err);
      setError("Terjadi kendala koneksi dengan server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{
      padding: "40px 32px",
      borderRadius: "20px",
      border: "1px solid var(--border-glass)",
      background: "var(--bg-surface)",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
    }}>
      {/* Brand Logo Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%)",
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          marginBottom: "16px",
          boxShadow: "0 4px 15px var(--primary-glow)",
        }}>
          <span style={{ fontSize: "1.5rem", fontWeight: "700", color: "#fff" }}>L</span>
        </div>
        <h2 style={{ fontSize: "1.6rem", fontWeight: "700", letterSpacing: "-0.02em", color: "#fff" }}>
          Masuk ke Lotre
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "6px" }}>
          Kelola arisan digital kelompok Anda secara transparan
        </p>
      </div>

      {/* Error Alert Box */}
      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          color: "#fca5a5",
          padding: "12px 16px",
          borderRadius: "10px",
          fontSize: "0.85rem",
          marginBottom: "20px",
          animation: "shake 0.4s ease"
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>
            Alamat Email
          </label>
          <input
            type="email"
            placeholder="admin@lotre.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(0, 0, 0, 0.25)",
              color: "#fff",
              fontSize: "0.9rem",
              transition: "border-color 0.2s",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>
              Kata Sandi
            </label>
          </div>
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                padding: "12px 48px 12px 16px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(0, 0, 0, 0.25)",
                color: "#fff",
                fontSize: "0.9rem",
                transition: "border-color 0.2s",
                outline: "none",
                width: "100%",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "1.05rem",
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
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{
            minHeight: "44px",
            fontSize: "0.95rem",
            fontWeight: "600",
            borderRadius: "10px",
            marginTop: "10px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxShadow: "0 4px 12px var(--primary-glow)"
          }}
        >
          {loading ? "Menghubungkan..." : "Masuk Aplikasi"}
        </button>
      </form>

      {/* Navigation Footer */}
      <div style={{ textAlign: "center", marginTop: "24px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        Belum memiliki kelompok?{" "}
        <Link href="/auth/register" style={{ color: "var(--primary)", fontWeight: "600", textDecoration: "none" }}>
          Daftar SaaS Baru
        </Link>
      </div>

      {/* Animation helpers */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
