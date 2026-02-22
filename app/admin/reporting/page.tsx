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

function scoreText(v: number | null) {
  if (v === null || typeof v !== "number") return "—";
  return v.toFixed(2);
}

function emojiRank(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return "🏅";
}

export default function AdminReportingPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("WF_ADMIN_SECRET");
    if (saved) setAdminSecret(saved);
  }, []);

  useEffect(() => {
    if (adminSecret.trim()) {
      localStorage.setItem("WF_ADMIN_SECRET", adminSecret.trim());
    }
  }, [adminSecret]);

  async function load() {
    if (!adminSecret || !publicSlug) return;

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch(
        `/api/admin/report-live?publicSlug=${encode(publicSlug)}`,
        {
          headers: { "x-admin-secret": adminSecret.trim() },
          cache: "no-store",
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Fehler");

      setData(json);
      setMsg("Live-Ranking geladen ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Fehler");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const sortedRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows
      .slice()
      .sort((a, b) => {
        if (a.overallAvg == null) return 1;
        if (b.overallAvg == null) return -1;
        return b.overallAvg - a.overallAvg;
      });
  }, [data]);

  const top3 = sortedRows.slice(0, 3);

  return (
    <div style={pageStyle}>
      <main style={wrapStyle}>
        <div style={cardStyle}>
          <h1>📊 Admin · Live Reporting</h1>

          <input
            placeholder="ADMIN_SECRET"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="publicSlug"
            value={publicSlug}
            onChange={(e) => setPublicSlug(e.target.value)}
            style={inputStyle}
          />

          <button onClick={load} disabled={loading} style={btnStyle}>
            {loading ? "Lade…" : "Laden"}
          </button>

          {msg && <p>{msg}</p>}

          {data && (
            <>
              <hr />

              <h2>🏆 Top 3</h2>
              {top3.map((r, i) => (
                <div key={r.wineId} style={topCard}>
                  <div>
                    <strong>
                      {emojiRank(i)} Wein #{r.blindNumber}
                    </strong>
                    <div>{scoreText(r.overallAvg)}</div>
                  </div>
                  {r.imageUrl && (
                    <img src={r.imageUrl} style={{ width: 60, borderRadius: 10 }} />
                  )}
                </div>
              ))}

              <h2>📋 Ranking</h2>
              {sortedRows.map((r, i) => (
                <div key={r.wineId} style={rowStyle}>
                  #{i + 1} · Wein #{r.blindNumber} ·{" "}
                  <strong>{scoreText(r.overallAvg)}</strong>
                </div>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111",
  color: "white",
};

const wrapStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  background: "#1b1b1b",
  padding: 20,
  borderRadius: 16,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 10,
  border: "none",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#c0392b",
  color: "white",
  fontWeight: 700,
};

const topCard: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 10,
  padding: 10,
  background: "#222",
  borderRadius: 12,
};

const rowStyle: React.CSSProperties = {
  padding: 8,
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};
