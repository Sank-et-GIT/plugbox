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

type HoldResp = {
  ok: boolean;
  booking: { id: number; expiresAt: string };
};

type StartResp = {
  ok: boolean;
  sessionId: number;
  commandId: number;
};

type StopResp = {
  ok: boolean;
};

export default function Vendor() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [chargers, setChargers] = useState<Charger[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [holdText, setHoldText] = useState<string>("—");
  const [startText, setStartText] = useState<string>("—");
  const [stopText, setStopText] = useState<string>("—");

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [working, setWorking] = useState<"hold" | "start" | "stop" | null>(null);

  // demo userId: keep fixed for now
  const userId = "rashi";

  const selected = useMemo(
    () => chargers.find((c) => c.id === selectedId) || null,
    [chargers, selectedId]
  );

  async function loadChargers() {
    setLoading(true);
    setError("");
    try {
      // public chargers endpoint (not /admin)
      const res = await api.get<{ chargers: Charger[] }>("/chargers");
      const list = res.data.chargers || [];
      setChargers(list);
      if (selectedId == null && list.length > 0) setSelectedId(list[0].id);
    } catch (e: unknown) {
      setError(readErr(e) ?? "Failed to load chargers");
      setChargers([]);
    } finally {
      setLoading(false);
    }
  }

  async function hold() {
    if (!selected) return;
    setWorking("hold");
    setError("");
    setHoldText("Working...");
    try {
      const res = await api.post<HoldResp>("/bookings/hold", {
        chargerId: selected.id,
        userId,
      });
      setHoldText(
        `Hold OK ✅ bookingId=${res.data.booking.id} (expiresAt=${res.data.booking.expiresAt})`
      );
      await loadChargers();
    } catch (e: unknown) {
      setHoldText(`Hold ERROR: ${readErr(e)}`);
    } finally {
      setWorking(null);
    }
  }

  async function start() {
    if (!selected) return;
    setWorking("start");
    setError("");
    setStartText("Working...");
    try {
      const res = await api.post<StartResp>("/sessions/start", {
        chargerId: selected.id,
        userId,
      });
      setSessionId(res.data.sessionId);
      setStartText(`Start OK ✅ sessionId=${res.data.sessionId}`);
      await loadChargers();
    } catch (e: unknown) {
      setStartText(`Start ERROR: ${readErr(e)}`);
    } finally {
      setWorking(null);
    }
  }

  async function stop() {
    if (!sessionId) return;
    setWorking("stop");
    setError("");
    setStopText("Working...");
    try {
      const res = await api.post<StopResp>("/sessions/stop", {
        sessionId,
      });
      if (res.data.ok) {
        setStopText(`Stop OK ✅ sessionId=${sessionId}`);
      } else {
        setStopText(`Stop FAIL ❌ sessionId=${sessionId}`);
      }
      await loadChargers();
    } catch (e: unknown) {
      setStopText(`Stop ERROR: ${readErr(e)}`);
    } finally {
      setWorking(null);
    }
  }

  useEffect(() => {
    loadChargers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={page}>
      <div style={headerRow}>
        <div>
          <h1 style={h1}>Vendor Dashboard</h1>
          <p style={sub}>
            Choose a charging point and run Hold → Start → Stop using VPS APIs.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadChargers} disabled={loading} style={primaryBtn}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div style={errorBox}>⚠ {error}</div> : null}

      <div style={grid2}>
        {/* LEFT: Charger Selection */}
        <div style={card}>
          <div style={cardTitle}>Charging Points</div>
          <div style={cardHint}>
            Data source: <code>/chargers</code>
          </div>

          <div style={{ marginTop: 12 }}>
            {chargers.length === 0 ? (
              <div style={{ color: "var(--muted)" }}>
                {loading ? "Loading..." : "No chargers found"}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {chargers.map((c) => {
                  const isSelected = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{
                        ...chargerCard,
                        borderColor: isSelected
                          ? "rgba(79,70,229,0.35)"
                          : "var(--border)",
                        boxShadow: isSelected
                          ? "0 10px 18px rgba(79,70,229,0.10)"
                          : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ fontWeight: 750 }}>{c.name}</div>
                        <StatusPill status={c.status} />
                      </div>
                      <div style={monoMuted}>
                        id={c.id} • lat={c.lat} • lng={c.lng}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Actions + Results */}
        <div style={card}>
          <div style={cardTitle}>Actions</div>
          <div style={cardHint}>
            APIs: <code>/bookings/hold</code>, <code>/sessions/start</code>,{" "}
            <code>/sessions/stop</code>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={rowBetween}>
              <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 650 }}>
                Selected
              </div>
              <div style={monoStrong}>
                {selected ? `${selected.name} (id=${selected.id})` : "None"}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <button
                onClick={hold}
                disabled={!selected || working !== null}
                style={{
                  ...actionBtn,
                  ...(working === "hold" ? disabledBtn : {}),
                }}
              >
                {working === "hold" ? "Holding..." : "Hold"}
              </button>

              <button
                onClick={start}
                disabled={!selected || working !== null}
                style={{
                  ...actionBtn,
                  ...(working === "start" ? disabledBtn : {}),
                }}
              >
                {working === "start" ? "Starting..." : "Start"}
              </button>

              <button
                onClick={stop}
                disabled={!sessionId || working !== null}
                style={{
                  ...actionBtn,
                  ...(working === "stop" ? disabledBtn : {}),
                }}
              >
                {working === "stop" ? "Stopping..." : "Stop"}
              </button>
            </div>

            <div style={divider} />

            <div style={cardTitleSmall}>Results</div>

            <div style={resultLine}>
              <span style={resultLabel}>Hold</span>
              <span style={resultValue}>{holdText}</span>
            </div>

            <div style={resultLine}>
              <span style={resultLabel}>Start</span>
              <span style={resultValue}>{startText}</span>
            </div>

            <div style={resultLine}>
              <span style={resultLabel}>Stop</span>
              <span style={resultValue}>{stopText}</span>
            </div>

            <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
              Tip: Hold expires in ~2 minutes. If Start says “no active hold”, press
              Hold then Start quickly.
              <br />
              SessionId stored:{" "}
              <span style={monoStrong}>{sessionId ?? "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function cleanStatus(s: string) {
  return (s || "").trim().toUpperCase();
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

function readErr(e: unknown): string {
  // axios-ish error: prefer response body
  const error = e as { response?: { data?: unknown }; message?: string };
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null && "error" in data) {
    return String((data as Record<string, unknown>).error);
  }
  return error?.message ?? "Unknown error";
}

/* ---------------- styles ---------------- */

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

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.1fr 0.9fr",
  gap: 12,
};

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
};

const cardTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
};

const cardTitleSmall: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  marginBottom: 8,
};

const cardHint: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  marginTop: 4,
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

const chargerCard: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: 12,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "white",
  cursor: "pointer",
};

const monoMuted: React.CSSProperties = {
  marginTop: 6,
  color: "var(--muted)",
  fontSize: 12,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const monoStrong: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontWeight: 800,
  fontSize: 13,
};

const rowBetween: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const actionBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const disabledBtn: React.CSSProperties = {
  opacity: 0.7,
  cursor: "not-allowed",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "var(--border)",
  margin: "16px 0 12px 0",
};

const resultLine: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px 1fr",
  gap: 10,
  padding: "6px 0",
};

const resultLabel: React.CSSProperties = {
  color: "var(--muted)",
  fontWeight: 800,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const resultValue: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.35,
};
