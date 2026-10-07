"use client";

import { Toaster } from "react-hot-toast";

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      gutter={8}
      toastOptions={{
        duration: 3500,
        style: {
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 500,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        },
        success: {
          style: { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
          iconTheme: { primary: "#22c55e", secondary: "#fff" },
        },
        error: {
          style: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
          iconTheme: { primary: "#ef4444", secondary: "#fff" },
        },
      }}
    />
  );
}
