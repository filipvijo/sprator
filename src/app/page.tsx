import type { Metadata } from "next";
import DashboardClient from "./dashboard-client";

export const metadata: Metadata = {
  title: "Sprator — Autonomous Cashflow Agent",
  description: "Autonomous business cashflow agent — monitors spend, recovers revenue, executes approved Stripe operations.",
};

export default function Page() {
  return <DashboardClient />;
}
