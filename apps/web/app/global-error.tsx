"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary. Renders its own <html>/<body> because the root
 * layout itself may have crashed. Keep this file dependency-free.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Send to server log channel; structured JSON in prod.
    if (typeof window !== "undefined") {
      fetch("/api/error-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          digest: error.digest,
          stack: error.stack,
          fatal: true,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        /* swallow — fallback console.error already happened */
      });
    }
    console.error("Global fatal error:", error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              height: 64,
              width: 64,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              background: "rgba(244,63,94,0.1)",
              color: "#f43f5e",
              fontSize: 28,
              marginBottom: 24,
            }}
          >
            !
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
            Beklenmeyen Bir Hata
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 24px" }}>
            Uygulama beklenmedik şekilde durdu. Tekrar denemek için aşağıdaki butonu kullanın.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                opacity: 0.5,
                fontFamily: "monospace",
                margin: "0 0 16px",
              }}
            >
              Referans: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              background: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  );
}
