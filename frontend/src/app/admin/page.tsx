import type { Metadata } from "next";
import { AdminDashboardClient } from "./AdminDashboardClient.tsx";

export const metadata: Metadata = {
  title: "Callme ERP Operations Console | Callme Yoghurt",
  description: "Enterprise operations and administrative management console.",
};

export default function AdminPage() {
  return <AdminDashboardClient />;
}
