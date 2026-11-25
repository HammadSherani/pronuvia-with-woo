import { redirect } from "next/navigation";

// The old payout requests list: Commission Payout replaces it
export default function PayoutRequestsPage() {
  redirect("/admin/withdrawals");
}
