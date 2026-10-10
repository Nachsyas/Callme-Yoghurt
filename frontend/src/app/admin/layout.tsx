import type { Metadata } from "next";
import { AdminShell } from "./AdminShell.tsx";

export const metadata: Metadata = {
  title: "Callme ERP Operations Console | Callme Yoghurt",
  description: "Enterprise operations and administrative management console.",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
