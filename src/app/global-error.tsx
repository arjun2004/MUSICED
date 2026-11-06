"use client";

/** Last-resort boundary when the root layout itself fails. Keeps styles inline. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#151719", color: "#f5f5f5", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <p style={{ color: "#a3e635", letterSpacing: "0.14em", fontSize: 12, textTransform: "uppercase" }}>MUSICED</p>
            <h1 style={{ fontSize: 28, margin: "12px 0" }}>The record skipped.</h1>
            <p style={{ color: "#a3a3a3", fontSize: 14 }}>
              Something went wrong.{error.digest ? ` Reference: ${error.digest}` : ""}
            </p>
            <button
              onClick={reset}
              style={{ marginTop: 24, background: "#a3e635", color: "#151719", border: 0, borderRadius: 6, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
