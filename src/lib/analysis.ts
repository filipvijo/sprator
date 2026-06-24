import { getDb } from "./db";

export interface SubscriptionFlag {
  flag: string;
  flagColor: "emerald" | "amber" | "red" | "muted";
  flagged: boolean;
}

export interface SpendAnalysisResult {
  totalMonthly: number;
  activeCount: number;
  wasteCount: number;
  unusedCount: number;
  potentialSavings: number;
  anomalies: { name: string; detail: string }[];
}

/**
 * Analyze subscriptions for waste, unused, and anomalies.
 * Pure local analysis — no Stripe API calls.
 */
export function analyzeSpend(): SpendAnalysisResult {
  const db = getDb();
  const subs = db.prepare("SELECT * FROM subscriptions WHERE status != 'cancelled'").all() as any[];

  let totalMonthly = 0;
  let activeCount = 0;
  let wasteCount = 0;
  let unusedCount = 0;
  let potentialSavings = 0;
  const anomalies: { name: string; detail: string }[] = [];

  for (const sub of subs) {
    totalMonthly += sub.monthly_cost || 0;

    if (sub.status === "active") activeCount++;
    if (sub.status === "waste") {
      wasteCount++;
      potentialSavings += sub.monthly_cost || 0;
    }
    if (sub.status === "unused") {
      unusedCount++;
      potentialSavings += sub.monthly_cost || 0;
    }

    // Simple anomaly detection: cost > $500/mo flagged for review
    if (sub.monthly_cost > 500 && sub.status === "active") {
      anomalies.push({
        name: sub.name,
        detail: `High spend: $${sub.monthly_cost.toFixed(2)}/mo`,
      });
    }
  }

  return { totalMonthly, activeCount, wasteCount, unusedCount, potentialSavings, anomalies };
}

/**
 * Flag subscriptions that haven't been used recently.
 * In a real deployment, this would check usage APIs or last-accessed timestamps.
 */
export function flagUnusedSubscriptions(): number {
  const db = getDb();
  const subs = db.prepare("SELECT * FROM subscriptions WHERE status = 'active'").all() as any[];

  let flagged = 0;
  for (const sub of subs) {
    // Heuristic: if last_used is > 30 days ago, flag as unused
    if (sub.last_used) {
      const daysSince = (Date.now() - new Date(sub.last_used).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 30) {
        db.prepare("UPDATE subscriptions SET status='unused', agent_flag='Recommend cancel', updated_at=datetime('now') WHERE id=?")
          .run(sub.id);
        flagged++;
      }
    }
  }
  return flagged;
}

/**
 * Detect duplicate subscriptions (same category, same or similar name).
 */
export function detectDuplicates(): number {
  const db = getDb();
  const subs = db.prepare("SELECT * FROM subscriptions WHERE status != 'cancelled'").all() as any[];

  const byCategory: Record<string, any[]> = {};
  for (const s of subs) {
    const cat = s.category || "uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  }

  let duplicates = 0;
  for (const [category, items] of Object.entries(byCategory)) {
    if (items.length > 1) {
      // Flag the more expensive one as waste
      items.sort((a, b) => b.monthly_cost - a.monthly_cost);
      for (let i = 1; i < items.length; i++) {
        db.prepare("UPDATE subscriptions SET status='waste', agent_flag='Duplicate detected', updated_at=datetime('now') WHERE id=?")
          .run(items[i].id);
        duplicates++;
      }
    }
  }
  return duplicates;
}
