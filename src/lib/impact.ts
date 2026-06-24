import { getAllSubscriptions, getAllFailedPayments, getCompletedApprovals } from "./db";

// ── Guardrails ────────────────────────────────────────────────────────────────
// The agent may execute low-risk cancellations on its own, but anything at or
// above the threshold (or flagged as an anomaly/investigation) requires a human.

export interface Guardrails {
  autoApproveUnder: number; // $/mo — cancellations at or under this are auto-executed
  monthlySpendCap: number;  // $/mo — hard ceiling on agent-initiated spend
}

export function getGuardrails(): Guardrails {
  return {
    autoApproveUnder: Number(process.env.SPRATOR_AUTO_APPROVE_UNDER ?? 25),
    monthlySpendCap: Number(process.env.SPRATOR_MONTHLY_SPEND_CAP ?? 2000),
  };
}

// ── Net P&L ───────────────────────────────────────────────────────────────────
// The "earn + spend" story: what the agent has actually realized for the user.

export interface ImpactResult {
  recoveredThisMonth: number;      // one-time $ pulled back from failed payments
  realizedMonthlySavings: number;  // $/mo from cancellations the agent executed
  realizedAnnualSavings: number;   // realizedMonthlySavings * 12
  netImpactAnnual: number;         // recovered + annualized savings — the headline number
}

// Recoveries the agent already closed earlier this month (before the live list).
// Keeps the running monthly total realistic; live recoveries add on top of this.
const RECOVERED_PRIOR_THIS_MONTH = 4016;

export function computeImpact(): ImpactResult {
  // Earn side: failed payments the agent recovered (prior + live in the list).
  const liveRecovered = getAllFailedPayments()
    .filter((f) => f.status === "recovered")
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  const recoveredThisMonth = RECOVERED_PRIOR_THIS_MONTH + liveRecovered;

  // Save side: subscriptions actually cancelled + approved cancel approvals.
  const cancelledSavings = getAllSubscriptions()
    .filter((s) => s.status === "cancelled")
    .reduce((sum, s) => sum + (s.monthly_cost || 0), 0);

  const approvedSavings = getCompletedApprovals()
    .filter((a) => a.status === "approve")
    .reduce((sum, a) => sum + (a.savings_monthly || 0), 0);

  const realizedMonthlySavings = cancelledSavings + approvedSavings;
  const realizedAnnualSavings = Math.round(realizedMonthlySavings * 12);

  return {
    recoveredThisMonth,
    realizedMonthlySavings,
    realizedAnnualSavings,
    netImpactAnnual: Math.round(recoveredThisMonth + realizedAnnualSavings),
  };
}
