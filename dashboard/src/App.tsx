import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import Admin from "./pages/Admin";
import Vendor from "./pages/Vendor";

export default function App() {
  const loc = useLocation();

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 12 }}>PlugBox Web</h2>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <NavLink to="/admin" active={loc.pathname.startsWith("/admin")} label="Admin" />
        <NavLink to="/vendor" active={loc.pathname.startsWith("/vendor")} label="Vendor" />
      </div>

      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/vendor" element={<Vendor />} />
        <Route path="*" element={<div>404</div>} />
      </Routes>
    </div>
  );
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #ddd",
        background: active ? "#f2f2f2" : "white",
        color: "black",
      }}
    >
      {label}
    </Link>
  );
}
