"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface FeedItem { id: string; icon: string; description: string; status: string; kind: string; created_at: string; }
interface Subscription { id: string; name: string; monthly_cost: number; status: string; last_used: string; agent_flag: string; }
interface Approval { id: string; type: string; title: string; reason: string; impact: string; savings_monthly: number; status: string; expires_at: string; }
interface FailedPayment { id: string; customer_name: string; amount: number; attempt: number; status: string; agent_action: string; }
interface AuditEntry { id: string; action: string; amount: number | null; stripe_ref: string; status: string; category: string; created_at: string; }
interface Overview {
  monthlyBurn: number; activeSubs: number; wasteCount: number; unusedCount: number;
  potentialSavings: number; savingsFound: number; revenueRecovered: number;
  netImpactAnnual: number; realizedMonthlySavings: number;
  guardrails?: { autoApproveUnder: number; monthlySpendCap: number };
  pendingApprovals: number; anomalies: { name: string; detail: string }[]; feed: FeedItem[];
}

// ── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg: "#0A0B0D", panel: "#0F1116", panel2: "#14171D",
  border: "rgba(255,255,255,0.07)", border2: "rgba(255,255,255,0.11)",
  text: "#E6E8EC", muted: "#7E848F", dim: "#565B66",
  emerald: "#34D399", amber: "#F5B544", red: "#F87171",
  emeraldBg: "rgba(52,211,153,0.10)", amberBg: "rgba(245,181,68,0.10)",
  redBg: "rgba(248,113,113,0.10)", greyBg: "rgba(255,255,255,0.05)",
};
const mono = "'JetBrains Mono',ui-monospace,monospace";
const sans = "'Inter',system-ui,sans-serif";

const sColor = (s: string) => s === "Active" ? C.emerald : s === "Unused" ? C.amber : s === "Waste" ? C.red : s === "Cancelled" ? C.muted : C.muted;
const sBg = (s: string) => s === "Active" ? C.emeraldBg : s === "Unused" ? C.amberBg : s === "Waste" ? C.redBg : s === "Cancelled" ? C.greyBg : C.greyBg;
const capStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const money = (n: number) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n: number) => "$" + Math.round(Number(n || 0)).toLocaleString("en-US");

// ── Status Badge ──────────────────────────────────────────────────────────────

function Badge({ status, kind }: { status: string; kind?: string }) {
  const color = kind === "emerald" ? C.emerald : kind === "amber" ? C.amber : kind === "red" ? C.red : C.muted;
  const bg = kind === "emerald" ? C.emeraldBg : kind === "amber" ? C.amberBg : kind === "red" ? C.redBg : C.greyBg;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, color, background: bg, whiteSpace: "nowrap" }}>{status}</span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, ...style }}>{children}</div>;
}

function SectionHeader({ title, subtitle, accent }: { title: string; subtitle?: string; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 3, height: 15, background: accent, borderRadius: 2 }} />
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.muted, fontFamily: mono }}>{subtitle}</div>}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function CancelModal({ sub, onClose, onConfirm }: {
  sub: Subscription | null; onClose: () => void; onConfirm: () => void;
}) {
  if (!sub) return null;
  const yearly = Math.round(sub.monthly_cost * 12);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(5,6,8,0.74)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 448, maxWidth: "100%", background: "#101216", border: `1px solid ${C.border2}`, borderRadius: 16, padding: 24, boxShadow: "0 28px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.amber, fontWeight: 700 }}>⚠ Approval required</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 12 }}>Cancel {sub.name}</div>
        <div style={{ fontSize: 13, color: C.muted, fontFamily: mono, marginTop: 3 }}>{money(sub.monthly_cost)}/mo recurring</div>
        <div style={{ marginTop: 16, padding: 13, background: "rgba(255,255,255,0.025)", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: "#B6BBC2", lineHeight: 1.55 }}>
          {sub.agent_flag || "Recurring charge flagged by agent."}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: 12, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 10 }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, fontWeight: 600 }}>Saves</span>
          <span style={{ fontSize: 16, fontWeight: 600, fontFamily: mono, color: C.emerald }}>${yearly.toLocaleString("en-US")} / yr</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.5, marginTop: 14 }}>
          This cancels the subscription and writes an entry to the audit trail. The action cannot be undone from this panel.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onConfirm} style={{ flex: 1, background: C.emerald, color: "#06231A", fontWeight: 700, fontSize: 13.5, border: "none", borderRadius: 10, padding: "12px 0", cursor: "pointer", fontFamily: sans }}>Confirm cancellation</button>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", color: "#9AA0A8", fontWeight: 600, fontSize: 13.5, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "12px 0", cursor: "pointer", fontFamily: sans }}>Keep subscription</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [completedApprovals, setCompletedApprovals] = useState<any[]>([]);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [modalSub, setModalSub] = useState<Subscription | null>(null);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [decidedApprovals, setDecidedApprovals] = useState<Record<string, string>>({});
  const [cancelledSubs, setCancelledSubs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [ovRes, subRes, apRes, fpRes, auditRes] = await Promise.all([
        fetch("/api/overview"), fetch("/api/subscriptions"), fetch("/api/approvals"),
        fetch("/api/failed-payments"), fetch("/api/audit"),
      ]);
      const [ov, sd, ap, fp, au] = await Promise.all([
        ovRes.json(), subRes.json(), apRes.json(), fpRes.json(), auditRes.json(),
      ]);
      setOverview(ov);
      setSubs(sd.subscriptions || []);
      setApprovals(ap.pending || []);
      setCompletedApprovals(ap.completed || []);
      setFailedPayments(fp.failedPayments || []);
      setAudit(au.audit || []);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCancel = async (sub: Subscription) => {
    try {
      await fetch("/api/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subId: sub.id, subName: sub.name, monthlyCost: sub.monthly_cost }),
      });
      setCancelledSubs((prev) => ({ ...prev, [sub.name]: Math.round(sub.monthly_cost * 12) }));
      setModalSub(null);
      fetchAll();
    } catch (e) { console.error("Cancel error:", e); }
  };

  const handleApproval = async (id: string, decision: "approve" | "reject") => {
    try {
      await fetch("/api/approvals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId: id, decision }),
      });
      setDecidedApprovals((prev) => ({ ...prev, [id]: decision }));
      fetchAll();
    } catch (e) { console.error("Approval error:", e); }
  };

  const handleDunning = async (fp: FailedPayment) => {
    try {
      await fetch("/api/dunning", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: fp.id, customerName: fp.customer_name, amount: fp.amount }),
      });
      fetchAll();
    } catch (e) { console.error("Dunning error:", e); }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const pendingCount = approvals.filter((a) => !decidedApprovals[a.id]).length;
  const totalSubsCost = subs.reduce((sum, s) => sum + (s.monthly_cost || 0), 0);

  const categories = ["All", "Cancellations", "Recoveries", "Dunning", "Anomalies", "Renewals"];
  const filteredAudit = audit.filter((a) => {
    const matchCat = filter === "All" || a.category === filter;
    const q = query.trim().toLowerCase();
    const matchQ = !q || (a.action + " " + a.stripe_ref + " " + a.status).toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  // ── Chat messages ────────────────────────────────────────────────────────────

  const chatMessages = [
    { u: true, text: "Audit this month" },
    { u: false, text: "On it. Scanning 14 subscriptions and 3 payment sources…" },
    { u: false, text: "Found 3 issues. Sending summary." },
    { u: false, text: `⚠️ Unused: Notion AI ($20/mo, 47d) · Figma Pro ($45/mo, duplicate) · AWS anomaly (+$340)` },
    { u: false, text: "Proposed 2 cancellations + 1 review. Approve?" },
    { u: true, text: "Approve Notion + Figma. Hold AWS." },
    { u: false, text: "✅ Cancelled Notion AI. Savings: $240/yr" },
    { u: false, text: "✅ Cancelled Figma Pro. Savings: $540/yr" },
    { u: false, text: "AWS flagged for manual review. No action taken." },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ background: C.bg, color: C.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans }}>Loading Sprator…</div>;
  }

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: sans, minHeight: "100vh", WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        @keyframes scPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.82)}}
        @keyframes scGlow{0%,100%{box-shadow:0 0 0 0 rgba(245,181,68,0)}50%{box-shadow:0 0 13px 1px rgba(245,181,68,0.40)}}
        ::selection{background:rgba(52,211,153,0.30);color:#fff;}
        ::-webkit-scrollbar{width:10px;height:10px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.09);border-radius:8px;}
        ::-webkit-scrollbar-track{background:transparent;}
        a{color:inherit;}
      `}</style>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(14px)", background: "rgba(10,11,13,0.82)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1460, margin: "0 auto", padding: "12px 26px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(140deg,#3FE0A6,#0FA968)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#06140E", fontFamily: mono, fontSize: 15 }}>S</div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "0.04em" }}>SPRATOR</div>
              <div style={{ fontSize: 9.5, color: C.dim, letterSpacing: "0.16em", textTransform: "uppercase" }}>Autonomous Cashflow Agent</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: mono, fontSize: 11.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", border: `1px solid ${C.border}`, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.emerald, animation: "scPulse 1.8s ease-in-out infinite" }} />
              <span style={{ color: C.muted }}>Stripe</span><span style={{ color: C.emerald, fontWeight: 600 }}>Connected ✓</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", border: `1px solid ${C.border}`, borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.emerald, animation: "scPulse 1.8s ease-in-out infinite" }} />
              <span style={{ color: C.muted }}>Telegram</span><span style={{ color: C.emerald, fontWeight: 600 }}>Active ✓</span>
            </div>
          </div>
          <div style={{ width: 1, height: 30, background: C.border }} />
          <div style={{ textAlign: "right", lineHeight: 1.3 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Fluxora LTD</div>
            <div style={{ fontSize: 10, color: C.dim, fontFamily: mono }}>acct_1Qz · live</div>
          </div>
          <div style={{ textAlign: "right", lineHeight: 1.25 }}>
            <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Cash balance</div>
            <div style={{ fontSize: 20, fontWeight: 600, fontFamily: mono, color: C.emerald }}>{money(12847)}</div>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1460, margin: "0 auto", padding: "22px 26px 90px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ── Net Agent Impact (earn + save) ─────────────────── */}
        <Card style={{ padding: "18px 22px", background: "linear-gradient(110deg,rgba(52,211,153,0.10),rgba(52,211,153,0.02))", borderColor: "rgba(52,211,153,0.22)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: C.emerald, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Net Agent Impact</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 36, fontWeight: 700, fontFamily: mono, color: C.emerald, letterSpacing: "-0.01em" }}>{money0(overview?.netImpactAnnual || 0)}</span>
                <span style={{ fontSize: 13, color: C.dim, fontFamily: mono }}>/yr realized</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                {money0(overview?.revenueRecovered || 0)} recovered + {money0(overview?.savingsFound || 0)}/yr saved
              </div>
            </div>
            <div style={{ flex: 1 }} />
            {overview?.guardrails && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ border: `1px solid ${C.border2}`, borderRadius: 10, padding: "9px 13px", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>🛡 Auto-approve under</div>
                  <div style={{ fontSize: 16, fontWeight: 600, fontFamily: mono, color: C.text, marginTop: 3 }}>{money0(overview.guardrails.autoApproveUnder)}<span style={{ fontSize: 11, color: C.dim }}>/mo</span></div>
                </div>
                <div style={{ border: `1px solid ${C.border2}`, borderRadius: 10, padding: "9px 13px", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>🛡 Spend cap</div>
                  <div style={{ fontSize: 16, fontWeight: 600, fontFamily: mono, color: C.text, marginTop: 3 }}>{money0(overview.guardrails.monthlySpendCap)}<span style={{ fontSize: 11, color: C.dim }}>/mo</span></div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ── Stats Cards ────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(206px,1fr))", gap: 14 }}>
          {[
            { label: "Monthly Burn", val: money0(overview?.monthlyBurn || 8940), unit: "/mo", sub: `↓ 6.2% vs last month`, subColor: C.emerald },
            { label: "Active Subscriptions", val: String(overview?.activeSubs || 12), unit: money(totalSubsCost) + "/mo", sub: "recurring spend monitored", subColor: C.muted },
            { label: "Savings Found", val: money0(overview?.savingsFound || 3720), unit: "", sub: "cumulative, agent-driven", subColor: C.muted, valColor: C.emerald },
            { label: "Revenue Recovered", val: money(overview?.revenueRecovered || 4218), unit: "", sub: "from failed payments, this month", subColor: C.muted, valColor: C.emerald },
            {
              label: "Pending Approvals", val: String(pendingCount), unit: "awaiting you", sub: "Review now ↓", subColor: C.amber, valColor: C.amber,
              border: "rgba(245,181,68,0.28)", glow: true, onClick: () => document.getElementById("approvals")?.scrollIntoView({ behavior: "smooth", block: "start" }),
            },
          ].map((s, i) => (
            <Card key={i} style={{ padding: 18, cursor: s.onClick ? "pointer" : "default", borderColor: s.border || C.border, animation: s.glow ? "scGlow 2.6s ease-in-out infinite" : undefined }} >
              <div onClick={s.onClick}>
                <div style={{ fontSize: 10, color: s.valColor || C.muted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>{s.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 10 }}>
                  <span style={{ fontSize: 30, fontWeight: 600, fontFamily: mono, letterSpacing: "-0.01em", color: s.valColor || C.text }}>{s.val}</span>
                  {s.unit && <span style={{ fontSize: 13, color: C.dim, fontFamily: mono }}>{s.unit}</span>}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: s.subColor, fontFamily: s.subColor !== C.muted ? mono : sans }}>{s.sub}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* ── Activity Feed + Chat ───────────────────────────── */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Card style={{ flex: "1 1 540px", minWidth: 0, padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 3, height: 15, background: C.emerald, borderRadius: 2 }} />
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Agent Activity</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", fontFamily: mono, fontSize: 11, color: C.emerald }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.emerald, animation: "scPulse 1.4s ease-in-out infinite" }} />LIVE
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontFamily: mono }}>recent actions · newest first</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {(overview?.feed || []).map((f, i) => {
                const color = f.kind === "emerald" ? C.emerald : f.kind === "amber" ? C.amber : f.kind === "red" ? C.red : C.muted;
                const bg = f.kind === "emerald" ? C.emeraldBg : f.kind === "amber" ? C.amberBg : f.kind === "red" ? C.redBg : C.greyBg;
                return (
                  <div key={f.id || i} style={{ display: "flex", gap: 13, padding: "13px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ width: 31, height: 31, flexShrink: 0, borderRadius: 9, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, lineHeight: 1 }}>{f.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: mono, fontSize: 11, color: C.dim }}>{f.created_at ? new Date(f.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, color, background: bg }}>{f.status}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#C7CBD2", marginTop: 4, lineHeight: 1.5 }}>{f.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ── Chat ────────────────────────────────────────── */}
          <div style={{ flex: "0 1 358px", minWidth: 300 }}>
            <div style={{ position: "sticky", top: 80, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 16px", borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(140deg,#3FE0A6,#0FA968)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#06140E", fontFamily: mono }}>S</div>
                <div style={{ lineHeight: 1.25 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Sprator Agent</div>
                  <div style={{ fontSize: 11, color: C.emerald, display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.emerald }} />online · Telegram</div>
                </div>
                <div style={{ marginLeft: "auto", fontFamily: mono, fontSize: 10, color: C.dim, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 7px" }}>@sprator_bot</div>
              </div>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, maxHeight: 486, overflowY: "auto", background: "#0A0B0E" }}>
                {chatMessages.map((m, i) => (
                  <div key={i} style={{
                    alignSelf: m.u ? "flex-end" : "flex-start", maxWidth: "88%",
                    background: m.u ? "rgba(52,211,153,0.15)" : "#191C22",
                    color: m.u ? "#C7F4E2" : "#D7DBE0",
                    border: m.u ? "1px solid rgba(52,211,153,0.28)" : "1px solid rgba(255,255,255,0.05)",
                    borderRadius: m.u ? "13px 13px 4px 13px" : "13px 13px 13px 4px",
                    padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5,
                  }}>{m.text}</div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: `1px solid ${C.border}`, background: "rgba(255,255,255,0.01)" }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", color: C.dim, fontSize: 13 }}>Message Sprator…</div>
                <div style={{ width: 38, display: "flex", alignItems: "center", justifyContent: "center", background: C.emerald, color: "#06231A", borderRadius: 10, fontWeight: 700 }}>↑</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Spend Monitor ───────────────────────────────────── */}
        <Card style={{ padding: "20px 22px" }}>
          <SectionHeader title="Spend Monitor" subtitle={`${subs.length} subscriptions · ${money(totalSubsCost)}/mo`} accent={C.emerald} />
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 760 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.6fr) 110px 120px 110px minmax(160px,1.5fr) 100px", gap: 10, padding: "0 4px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: C.muted, fontWeight: 600 }}>
                <div>Service</div><div>Monthly</div><div>Status</div><div>Last used</div><div>Agent flag</div><div></div>
              </div>
              {subs.map((s) => {
                const cancelled = !!cancelledSubs[s.name];
                const status = cancelled ? "Cancelled" : capStatus(s.status);
                const flagColor = cancelled ? C.emerald : s.agent_flag?.includes("Recommend") || s.agent_flag?.includes("Duplicate") ? C.red : s.agent_flag?.includes("Anomaly") ? C.amber : s.agent_flag?.includes("optimized") ? C.emerald : C.muted;
                const flagged = (s.status === "waste" || s.status === "unused") && !cancelled;
                return (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.6fr) 110px 120px 110px minmax(160px,1.5fr) 100px", gap: 10, padding: "11px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 13, fontFamily: mono }}>{money(s.monthly_cost)}</div>
                    <div><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: sColor(status), background: sBg(status) }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: sColor(status) }} />{status}</span></div>
                    <div style={{ fontSize: 12, fontFamily: mono, color: C.muted }}>{cancelled ? "—" : s.last_used || "—"}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: flagColor }}>{cancelled ? `Cancelled · $${cancelledSubs[s.name]}/yr saved` : s.agent_flag || "—"}</div>
                    <div>
                      {flagged ? (
                        <button onClick={() => setModalSub(s)} style={{ fontSize: 11.5, fontWeight: 600, color: C.red, background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontFamily: sans }}>Cancel</button>
                      ) : (
                        <span style={{ color: "#33373F", fontSize: 16 }}>·</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* ── Approval Center ─────────────────────────────────── */}
        <div id="approvals" style={{ background: C.panel, border: "1px solid rgba(245,181,68,0.18)", borderRadius: 14, padding: "20px 22px" }}>
          <SectionHeader title="Approval Center" subtitle="actions proposed by the agent — your call" accent={C.amber} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
            {approvals.map((a) => {
              const decided = decidedApprovals[a.id];
              const accent = a.type === "investigate_anomaly" ? C.amber : C.emerald;
              const saveColor = accent;
              const saveBg = accent === C.amber ? C.amberBg : C.emeraldBg;
              const savingsLabel = a.savings_monthly > 0 ? `$${a.savings_monthly}/mo` : "—";
              return (
                <div key={a.id} style={{ background: C.panel2, border: `1px solid ${C.border2}`, borderLeft: `3px solid ${accent}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{a.title}</div>
                    <span style={{ flexShrink: 0, fontFamily: mono, fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 8, color: saveColor, background: saveBg }}>{savingsLabel}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#A6ABB3", lineHeight: 1.55 }}>{a.reason}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: "rgba(255,255,255,0.025)", borderRadius: 9 }}>
                    <span style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, fontWeight: 600 }}>Impact</span>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: mono, color: accent }}>{a.impact}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 11, color: C.amber }}>⏱ Auto-declines in 24h</div>
                  {!decided ? (
                    <div style={{ display: "flex", gap: 9, marginTop: 2 }}>
                      <button onClick={() => handleApproval(a.id, "approve")} style={{ flex: 1, background: C.emerald, color: "#06231A", fontWeight: 700, fontSize: 13, border: "none", borderRadius: 9, padding: "10px 0", cursor: "pointer", fontFamily: sans }}>
                        {a.type === "investigate_anomaly" ? "Investigate" : "Approve"}
                      </button>
                      <button onClick={() => handleApproval(a.id, "reject")} style={{ flex: 1, background: "transparent", color: "#9AA0A8", fontWeight: 600, fontSize: 13, border: `1px solid ${C.border2}`, borderRadius: 9, padding: "10px 0", cursor: "pointer", fontFamily: sans }}>Reject</button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 2, padding: 10, borderRadius: 9, textAlign: "center", fontWeight: 700, fontSize: 13, color: decided === "approve" ? C.emerald : C.muted, background: decided === "approve" ? C.emeraldBg : C.greyBg, border: `1px solid ${decided === "approve" ? C.emeraldBg : C.greyBg}` }}>
                      {decided === "approve" ? (a.type === "investigate_anomaly" ? "Investigating ✓" : "Approved ✓") : "Rejected"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {completedApprovals.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, fontWeight: 600, marginBottom: 10 }}>Completed approvals</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {completedApprovals.map((l, i) => {
                  const isApprove = l.status === "approve";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12.5 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, color: isApprove ? C.emerald : C.muted, background: isApprove ? C.emeraldBg : C.greyBg, minWidth: 72, textAlign: "center" }}>{isApprove ? "Approved" : "Rejected"}</span>
                      <span style={{ color: "#C7CBD2", flex: 1 }}>{l.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Revenue Recovery ────────────────────────────────── */}
        <Card style={{ padding: "20px 22px" }}>
          <SectionHeader title="Revenue Recovery" subtitle="chasing down failed payments" accent={C.emerald} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ flex: "0 1 240px", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, fontWeight: 600 }}>Recovered this month</div>
              <div style={{ fontSize: 30, fontWeight: 600, fontFamily: mono, color: C.emerald, marginTop: 8 }}>{money(overview?.revenueRecovered || 4218)}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{failedPayments.filter((f) => f.status === "recovered").length} recovered · {failedPayments.filter((f) => f.status === "lost").length} marked lost</div>
            </div>
            <div style={{ flex: "1 1 340px", background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, fontWeight: 600 }}>Active dunning sequence — Soylent Inc <span style={{ fontFamily: mono, color: C.amber }}>$312.00</span></div>
              <div style={{ display: "flex", alignItems: "flex-start", marginTop: 16 }}>
                {[
                  { label: "Auto-retry card", done: true },
                  { label: "Reminder email", done: true },
                  { label: "Final notice + link", done: false },
                ].map((step, i, arr) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: step.done ? C.emeraldBg : C.amberBg, color: step.done ? C.emerald : C.amber, border: `1px solid ${step.done ? C.emerald : C.amber}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 14, fontWeight: 600, animation: !step.done ? "scGlow 2.2s ease-in-out infinite" : "none" }}>{step.done ? "✓" : String(i + 1)}</div>
                      <div style={{ fontSize: 10.5, color: "#9298A1", whiteSpace: "nowrap" }}>{step.label}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: step.done ? C.emerald : "rgba(255,255,255,0.10)", margin: "18px 8px 0", minWidth: 14 }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 700 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.3fr) 110px 90px minmax(130px,1fr) minmax(150px,1.4fr)", gap: 10, padding: "0 4px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: C.muted, fontWeight: 600 }}>
                <div>Customer</div><div>Amount</div><div>Attempt</div><div>Status</div><div>Agent action</div>
              </div>
              {failedPayments.map((f) => {
                const kind = f.status === "recovered" ? "emerald" : f.status === "lost" ? "red" : f.status === "email_sent" ? "amber" : "muted";
                const color = kind === "emerald" ? C.emerald : kind === "red" ? C.red : kind === "amber" ? C.amber : C.muted;
                const bg = kind === "emerald" ? C.emeraldBg : kind === "red" ? C.redBg : kind === "amber" ? C.amberBg : C.greyBg;
                const statusLabel = f.status === "pending_dunning" ? "Pending dunning" : f.status === "email_sent" ? "Email sent" : f.status === "recovered" ? "Recovered" : "Lost";
                return (
                  <div key={f.id} style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.3fr) 110px 90px minmax(130px,1fr) minmax(150px,1.4fr)", gap: 10, padding: "11px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{f.customer_name}</div>
                    <div style={{ fontSize: 13, fontFamily: mono }}>{money(f.amount)}</div>
                    <div style={{ fontSize: 12, fontFamily: mono, color: C.muted }}>#{f.attempt}</div>
                    <div><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color, background: bg }}>{statusLabel}</span></div>
                    <div style={{ fontSize: 12.5, color: "#A6ABB3" }}>{f.agent_action}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* ── Audit Trail ─────────────────────────────────────── */}
        <div id="audit" style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px" }}>
          <SectionHeader title="Audit Trail" subtitle="every action, timestamped & reconciled to Stripe" accent={C.emerald} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220, maxWidth: 360, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px" }}>
              <span style={{ color: C.dim, fontSize: 14 }}>⎚</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, customer, or Stripe ref…" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, fontFamily: sans }} />
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {categories.map((c) => (
                <button key={c} onClick={() => setFilter(c)} style={{
                  fontSize: 11.5, fontWeight: 600, padding: "6px 13px", borderRadius: 999, cursor: "pointer", fontFamily: sans,
                  border: `1px solid ${c === filter ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.09)"}`,
                  background: c === filter ? C.emeraldBg : "transparent",
                  color: c === filter ? C.emerald : C.muted,
                }}>{c}</button>
              ))}
            </div>
            <button style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.border2}`, background: "rgba(255,255,255,0.03)", color: "#C9CDD4", cursor: "pointer", fontFamily: sans }}>⇫ Export CSV</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 720 }}>
              <div style={{ display: "grid", gridTemplateColumns: "110px minmax(180px,1.6fr) 120px 150px 110px", gap: 10, padding: "0 4px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", color: C.muted, fontWeight: 600 }}>
                <div>Time</div><div>Action</div><div>Amount</div><div>Stripe ref</div><div>Status</div>
              </div>
              {filteredAudit.length === 0 ? (
                <div style={{ padding: "26px 4px", textAlign: "center", fontSize: 13, color: C.dim, fontFamily: mono }}>No matching events.</div>
              ) : (
                filteredAudit.map((a) => {
                  const amtColor = a.amount !== null && a.amount > 0 ? C.emerald : a.amount !== null && a.amount < 0 ? C.muted : C.dim;
                  const statusColor = a.status === "completed" ? C.emerald : a.status === "pending" ? C.amber : a.status === "rejected" ? C.red : C.muted;
                  const statusBg = a.status === "completed" ? C.emeraldBg : a.status === "pending" ? C.amberBg : a.status === "rejected" ? C.redBg : C.greyBg;
                  return (
                    <div key={a.id} style={{ display: "grid", gridTemplateColumns: "110px minmax(180px,1.6fr) 120px 150px 110px", gap: 10, padding: "11px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                      <div style={{ fontSize: 12, fontFamily: mono, color: C.muted }}>{a.created_at ? new Date(a.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</div>
                      <div style={{ fontSize: 13, color: "#C7CBD2" }}>{a.action}</div>
                      <div style={{ fontSize: 13, fontFamily: mono, color: amtColor }}>{a.amount !== null ? (a.amount > 0 ? "+" : "") + money(a.amount) : "—"}</div>
                      <div style={{ fontSize: 12, fontFamily: mono, color: C.dim }}>{a.stripe_ref || "—"}</div>
                      <div><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: statusColor, background: statusBg }}>{capStatus(a.status)}</span></div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      <CancelModal sub={modalSub} onClose={() => setModalSub(null)} onConfirm={() => modalSub && handleCancel(modalSub)} />
    </div>
  );
}
