import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard | Callme Yoghurt",
  description: "Enterprise operations and administrative console.",
};

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b border-gray-200 pb-5 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Callme Yoghurt — Operations Console</h1>
            <p className="text-sm text-gray-500">Authorized Administrative Management Portal</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            Authenticated Session Active
          </span>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-sm font-medium text-gray-500">Authoritative Catalog</h2>
            <p className="mt-2 text-2xl font-semibold text-gray-900">7 Active SKUs</p>
            <p className="text-xs text-gray-400 mt-1">Managed via ERP Domain Core</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-sm font-medium text-gray-500">Cold Chain Logistics</h2>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">2°C – 4°C Nominal</p>
            <p className="text-xs text-gray-400 mt-1">FEFO Allocation Active</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-sm font-medium text-gray-500">Security Gate Status</h2>
            <p className="mt-2 text-2xl font-semibold text-blue-600">Gate 0A–0E Verified</p>
            <p className="text-xs text-gray-400 mt-1">Phase 1.2A Access Boundary</p>
          </div>
        </section>
      </div>
    </main>
  );
}
