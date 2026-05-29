import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100dvh",
      width: "100%",
      padding: "24px",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Background ambient glowing lights specific to auth */}
      <div style={{
        position: "absolute",
        top: "20%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "350px",
        height: "350px",
        background: "radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0
      }} />

      <div style={{
        width: "100%",
        maxWidth: "460px",
        zIndex: 1,
        animation: "fadeInUp 0.6s ease-out"
      }}>
        {children}
      </div>
    </div>
  );
}
