import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Charger = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  status: string;
  lastSeen: string | null;
};

const allowedStatuses = ["ONLINE", "OFFLINE"] as const;

export default function Admin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Dropdown local state (id -> selected status)
  const [draftStatus, setDraftStatus] = useState<Record<number, string>>({});

  const onlineCount = useMemo(
    () => chargers.filter((c) => cleanStatus(c.status) === "ONLINE").length,
    [chargers]
  );

  const offlineCount = useMemo(
    () => chargers.filter((c) => cleanStatus(c.status) === "OFFLINE").length,
    [chargers]
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<{ chargers: Charger[] }>("/admin/chargers");
      const list = res.data.chargers || [];
      setChargers(list);

      // Initialize dropdown values from backend
      const map: Record<number, string> = {};
      for (const c of list) map[c.id] = cleanStatus(c.status);
      setDraftStatus(map);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load chargers");
      setChargers([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(chargerId: number) {
    const next = cleanStatus(draftStatus[chargerId] || "");
    if (!allowedStatuses.includes(next as typeof allowedStatuses[number])) {
      setError(`Invalid status "${next}". Use ONLINE or OFFLINE.`);
      return;
    }

    setUpdatingId(chargerId);
    setError("");
    try {
      await api.patch(`/admin/chargers/${chargerId}/status`, { status: next });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={page}>
      <div style={headerRow}>
        <div>
          <h1 style={h1}>Admin Dashboard</h1>
          <p style={sub}>
            Manage charger availability and monitor charging points.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={load} disabled={loading} style={primaryBtn}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div style={errorBox}>⚠ {error}</div> : null}

      {/* Summary cards */}
      <div style={cardsRow}>
        <StatCard label="Total Chargers" value={chargers.length} />
        <StatCard label="ONLINE" value={onlineCount} tone="success" />
        <StatCard label="OFFLINE" value={offlineCount} tone="danger" />
      </div>

      {/* Table */}
      <div style={card}>
        <div style={cardTopRow}>
          <div>
            <div style={cardTitle}>Charging Points</div>
            <div style={cardHint}>
              Data source: <code>/admin/chargers</code> +{" "}
              <code>/admin/chargers/:id/status</code> on VPS
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr style={theadRow}>
                <th style={th}>ID</th>
                <th style={th}>Name</th>
                <th style={th}>Status</th>
                <th style={th}>Admin Control</th>
                <th style={th}>Last Seen</th>
                <th style={thRight}>Lat</th>
                <th style={thRight}>Lng</th>
              </tr>
            </thead>

            <tbody>
              {chargers.length === 0 ? (
                <tr>
                  <td style={td} colSpan={7}>
                    {loading ? "Loading..." : "No chargers found"}
                  </td>
                </tr>
              ) : (
                chargers.map((c) => {
                  const current = cleanStatus(c.status);
                  const draft = cleanStatus(draftStatus[c.id] ?? current);
                  const isUpdating = updatingId === c.id;

                  return (
                    <tr key={c.id} style={tbodyRow}>
                      <td style={tdMono}>{c.id}</td>
                      <td style={tdName}>{c.name}</td>

                      <td style={td}>
                        <StatusPill status={current} />
                      </td>

                      <td style={td}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <select
                            value={draft}
                            onChange={(e) =>
                              setDraftStatus((prev) => ({
                                ...prev,
                                [c.id]: e.target.value,
                              }))
                            }
                            disabled={isUpdating}
                            style={select}
                          >
                            {allowedStatuses.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => updateStatus(c.id)}
                            disabled={isUpdating || draft === current}
                            style={{
                              ...outlineBtn,
                              ...(draft !== current ? enabledOutline : disabledOutline),
                            }}
                            title={draft === current ? "No change" : "Update status"}
                          >
                            {isUpdating ? "Updating..." : "Update"}
                          </button>
                        </div>
                      </td>

                      <td style={tdMuted}>{c.lastSeen ?? "—"}</td>
                      <td style={tdRight}>{c.lat}</td>
                      <td style={tdRight}>{c.lng}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Small UI components -------------------- */

function StatCard(props: { label: string; value: number; tone?: "success" | "danger" }) {
  const tone = props.tone;

  const valueStyle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 800,
    marginTop: 6,
    color: tone === "success" ? "var(--success)" : tone === "danger" ? "var(--danger)" : "var(--text)",
  };

  return (
    <div style={statCard}>
      <div style={statLabel}>{props.label}</div>
      <div style={valueStyle}>{props.value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = cleanStatus(status);

  const isOnline = s === "ONLINE";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${isOnline ? "#bbf7d0" : "#fecaca"}`,
        background: isOnline ? "#dcfce7" : "#fee2e2",
        color: isOnline ? "#065f46" : "#7f1d1d",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: isOnline ? "var(--success)" : "var(--danger)",
          display: "inline-block",
        }}
      />
      {s}
    </span>
  );
}

function cleanStatus(s: string) {
  return (s || "").trim().toUpperCase();
}

/* -------------------- Styles -------------------- */

const page: React.CSSProperties = {
  maxWidth: 1150,
  margin: "40px auto",
  padding: "0 18px",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 16,
};

const h1: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  letterSpacing: -0.3,
};

const sub: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: "var(--muted)",
};

const errorBox: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  padding: "10px 12px",
  borderRadius: 12,
  marginBottom: 14,
};

const cardsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 10px 25px rgba(0,0,0,0.04)",
};

const statLabel: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 600,
};

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
};

const cardTopRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const cardTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
};

const cardHint: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  marginTop: 4,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 950,
};

const theadRow: React.CSSProperties = {
  background: "#f9fafb",
  borderBottom: "1px solid var(--border)",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  fontSize: 12,
  color: "var(--muted)",
  fontWeight: 800,
  letterSpacing: 0.3,
};

const thRight: React.CSSProperties = { ...th, textAlign: "right" };

const tbodyRow: React.CSSProperties = {
  borderBottom: "1px solid var(--border)",
};

const td: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: 14,
  verticalAlign: "middle",
};

const tdName: React.CSSProperties = {
  ...td,
  fontWeight: 650,
};

const tdMono: React.CSSProperties = {
  ...td,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 13,
};

const tdMuted: React.CSSProperties = {
  ...td,
  color: "var(--muted)",
  fontSize: 13,
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 13,
};

const select: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "white",
  fontWeight: 600,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "var(--primary)",
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 10px 18px rgba(79,70,229,0.18)",
};

const outlineBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const enabledOutline: React.CSSProperties = {
  border: "1px solid rgba(79,70,229,0.35)",
  boxShadow: "0 8px 14px rgba(79,70,229,0.10)",
};

const disabledOutline: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};
