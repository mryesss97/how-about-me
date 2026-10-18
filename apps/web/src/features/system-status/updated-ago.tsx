"use client";

import { useEffect, useState } from "react";

export function updatedAgoText(updatedAt: number, now: number): string {
  const s = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (s < 60) return `Cập nhật ${s} giây trước`;
  return `Cập nhật ${Math.floor(s / 60)} phút trước`;
}

/** "Cập nhật N giây trước" ticking every second (FR-170, TC-SYS-001). Not a live region on purpose. */
export function UpdatedAgo({ updatedAt }: { updatedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!updatedAt) return null;
  return (
    <p aria-live="off" className="text-sm text-tertiary">
      {updatedAgoText(updatedAt, now)}
    </p>
  );
}
