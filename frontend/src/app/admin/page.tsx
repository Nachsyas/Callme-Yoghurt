import type { Metadata } from "next";
import { DashboardOverview } from "./DashboardOverview.tsx";

export const metadata: Metadata = {
  title: "Dashboard Overview | Callme ERP Operations Console",
  description: "Executive operational overview for Callme Yoghurt ERP.",
};

export default function AdminDashboardPage() {
  return <DashboardOverview />;
}
