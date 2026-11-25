import { requireSalesRep } from "@/lib/auth/dal";
import { CommissionOverview } from "@/components/shared/commission-overview";

export const metadata = { title: "Commission – Pronuvia" };

export default async function SalesCommissionPage() {
  const session = await requireSalesRep();
  return <CommissionOverview userId={session.userId} role="SALES_REP" />;
}
