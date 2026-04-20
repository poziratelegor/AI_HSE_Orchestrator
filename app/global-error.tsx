"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console — picked up by Vercel log drains
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="ru">
      <body>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Что-то пошло не так</h2>
          <p style={{ color: "#666", margin: "1rem 0" }}>
            Произошла непредвиденная ошибка. Попробуйте обновить страницу.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1.5rem",
              borderRadius: "0.375rem",
              background: "#2563eb",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
