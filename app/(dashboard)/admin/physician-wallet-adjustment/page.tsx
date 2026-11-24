import { redirect } from "next/navigation";

// Doctors and reps share one Commission Adjustment page now (adjustments are on orders)
export default function PhysicianWalletAdjustmentPage() {
  redirect("/admin/wallet-adjustment");
}
