"use client";
import { useState } from "react";

// Thumbs up/down on any insight. insightId may be null (e.g. drafts not yet
// persisted as their own row) — in that case the control hides itself.
export default function Feedback({ insightId, initial }: { insightId?: string | null; initial?: "up" | "down" | null }) {
  const [rating, setRating] = useState<"up" | "down" | null>(initial ?? null);
  if (!insightId) return null;

  async function vote(r: "up" | "down") {
    const next = rating === r ? null : r; // click again to keep; we still send the last value
    setRating(r);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId, rating: r }),
    });
    void next;
  }

  return (
    <span style={{ float: "right", display: "inline-flex", gap: 6 }}>
      <button
        onClick={() => vote("up")}
        title="Good"
        style={{
          border: "none", background: "none", cursor: "pointer", fontSize: 14,
          opacity: rating === "up" ? 1 : 0.4, color: rating === "up" ? "var(--green)" : "inherit",
        }}
      >
        ▲
      </button>
      <button
        onClick={() => vote("down")}
        title="Needs work"
        style={{
          border: "none", background: "none", cursor: "pointer", fontSize: 14,
          opacity: rating === "down" ? 1 : 0.4, color: rating === "down" ? "var(--red)" : "inherit",
        }}
      >
        ▼
      </button>
    </span>
  );
}
