import { getAllSubscriptions, updateSubscription, type Subscription } from "./db";

export interface SpendAnalysisResult {
  totalMonthly: number;
  activeCount: number;
  wasteCount: number;
  unusedCount: number;
  potentialSavings: number;
  anomalies: { name: string; detail: string }[];
}

export function analyzeSpend(): SpendAnalysisResult {
  const subs = getAllSubscriptions().filter((s) => s.status !== "cancelled");

  let totalMonthly = 0;
  let activeCount = 0;
  let wasteCount = 0;
  let unusedCount = 0;
  let potentialSavings = 0;
  const anomalies: { name: string; detail: string }[] = [];

  for (const sub of subs) {
    totalMonthly += sub.monthly_cost || 0;
    if (sub.status === "active") activeCount++;
    if (sub.status === "waste") { wasteCount++; potentialSavings += sub.monthly_cost || 0; }
    if (sub.status === "unused") { unusedCount++; potentialSavings += sub.monthly_cost || 0; }
    if (sub.monthly_cost > 500 && sub.status === "active") {
      anomalies.push({ name: sub.name, detail: `High spend: $${sub.monthly_cost.toFixed(2)}/mo` });
    }
  }

  return { totalMonthly, activeCount, wasteCount, unusedCount, potentialSavings, anomalies };
}

export function flagUnusedSubscriptions(): number {
  const subs = getAllSubscriptions().filter((s) => s.status === "active");
  let flagged = 0;
  for (const sub of subs) {
    if (sub.last_used) {
      const daysMatch = sub.last_used.match(/(\d+)d/);
      if (daysMatch && parseInt(daysMatch[1]) > 30) {
        updateSubscription(sub.id, { status: "unused", agent_flag: "Recommend cancel" });
        flagged++;
      }
    }
  }
  return flagged;
}

export function detectDuplicates(): number {
  const subs = getAllSubscriptions().filter((s) => s.status !== "cancelled");
  const byCategory: Record<string, Subscription[]> = {};
  for (const s of subs) {
    const cat = s.category || "uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  }
  let duplicates = 0;
  for (const items of Object.values(byCategory)) {
    if (items.length > 1) {
      items.sort((a, b) => b.monthly_cost - a.monthly_cost);
      for (let i = 1; i < items.length; i++) {
        updateSubscription(items[i].id, { status: "waste", agent_flag: "Duplicate detected" });
        duplicates++;
      }
    }
  }
  return duplicates;
}
