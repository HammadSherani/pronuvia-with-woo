import { requireAdmin } from "@/lib/auth/dal";
import { listShippingRates } from "@/actions/admin/shipping-rates";
import { ShippingRatesClient } from "@/components/admin/shipping-rates-client";

export const metadata = { title: "Shipping Rates – Admin" };

export default async function ShippingRatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [, params] = await Promise.all([requireAdmin(), searchParams]);

  const rates = await listShippingRates({
    continent: params.continent || undefined,
    country:   params.country   || undefined,
    method:    params.method    || undefined,
  });

  return <ShippingRatesClient initialRates={rates} />;
}
