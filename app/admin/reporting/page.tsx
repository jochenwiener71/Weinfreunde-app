"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Criterion = {
  id: string;
  label: string;
  order: number;
  scaleMin?: number;
  scaleMax?: number;
};

type Row = {
  wineId: string;
  blindNumber: number | null;
  isActive: boolean;
  displayName: string | null;
  winery: string | null;
  grape: string | null;
  vintage: string | null;
  ownerName?: string | null;
  imageUrl?: string | null;
  nRatings: number;
  overallAvg: number | null;
  perCriteriaAvg: Record<string, number | null>;
};

type ApiResp = {
  ok: true;
  publicSlug: string;
  tasting: {
    id: string;
    title: string | null;
    hostName: string | null;
    status: string | null;
    wineCount: number | null;
  };
  criteria: Criterion[];
  rows: Row[];
  ratingCount: number;
};

function encode(s: string) {
  return encodeURIComponent(s);
}

function wineTitle(r: Row) {
  const parts = [r.winery, r.displayName, r.grape, r.vintage].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return `Wein #${r.blindNumber ?? "?"}`;
}

function scoreText(v: number | null, digits = 2) {
  if (v === null || typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

function emojiRank(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "🏅";
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `HTTP ${res.status}` };
  }
}

export default function AdminReportingPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [data, setData] = useState<ApiResp | null>(null);
  const [expandedWineId, setExpandedWineId] = useState<string | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshMs, setRefreshMs] = useState(5000);

  // Restore secret
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("WF_ADMIN_SECRET")
        : null;
    if (saved) setAdminSecret(saved);
  }, []);

  useEffect(() => {
    if (adminSecret.trim()) {
      window.localStorage.setItem("WF_ADMIN_SECRET", adminSecret.trim());
    }
  }, [adminSecret]);

  const canLoad = useMemo(
    () => adminSecret.trim().length > 0 && publicSlug.trim().length > 0,
    [adminSecret, publicSlug]
  );

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/report-live?publicSlug=${encode(publicSlug.trim())}`,
        {
          method: "GET",
          headers: { "x-admin-secret": adminSecret.trim() },
          cache: "no-store",
        }
      );

      const json = await readJson(res);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);

      setData(json as ApiResp);
      setMsg("Live-Ranking geladen ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto refresh
