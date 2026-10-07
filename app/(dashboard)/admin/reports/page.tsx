import { requireAdmin } from "@/lib/auth/dal";
import { getReportFilterOptions } from "@/actions/admin/reports";
import { ReportsClient } from "@/components/admin/reports-client";

export const metadata = { title: "Reports – Pronuvia Admin" };

export default async function ReportsPage() {
  await requireAdmin();
  const { doctors, salesReps, products } = await getReportFilterOptions();

  return (
    <div className="space-y-0">
      <ReportsClient doctors={doctors} salesReps={salesReps} products={products} />
    </div>
  );
}
