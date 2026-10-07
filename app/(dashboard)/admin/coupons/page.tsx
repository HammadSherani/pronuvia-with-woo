import { requireAdmin }  from "@/lib/auth/dal";
import { getCoupons }    from "@/actions/admin/coupons";
import { CouponsClient } from "@/components/admin/coupons-client";

export default async function AdminCouponsPage() {
  await requireAdmin();
  const coupons = await getCoupons();
  return <CouponsClient coupons={coupons} />;
}
