import { requirePhysician } from "@/lib/auth/dal";
import { CommissionOverview } from "@/components/shared/commission-overview";

export const metadata = { title: "Commission – Pronuvia" };

export default async function PhysicianCommissionPage() {
  const session = await requirePhysician();
  return <CommissionOverview userId={session.userId} role="PHYSICIAN" />;
}
