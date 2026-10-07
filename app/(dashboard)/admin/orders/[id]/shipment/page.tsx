import { notFound }            from "next/navigation";
import { requireAdmin }         from "@/lib/auth/dal";
import { getOrderById }         from "@/actions/admin/manage-orders";
import { getOrderShipments }    from "@/actions/admin/shipping";
import { ShippingPageClient }   from "@/components/admin/shipping-page-client";
import type { OrderItem }       from "@/actions/admin/manage-orders";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> };

export default async function OrderShipmentPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { mode } = await searchParams;
  const shipmentMode: "outbound" | "return" = mode === "return" ? "return" : "outbound";

  const [order, shipments] = await Promise.all([
    getOrderById(id),
    getOrderShipments(id),
  ]);

  if (!order) notFound();

  const items = order.items as unknown as OrderItem[];

  const recipientName = order.physician
    ? ` ${order.physician.firstName} ${order.physician.lastName}`
    : order.salesRep
    ? `${order.salesRep.firstName} ${order.salesRep.lastName}`
    : null;

  return (
    <ShippingPageClient
      orderId={order.id}
      orderNumber={order.orderNumber}
      shipments={shipments}
      items={items}
      shipTo={{
        name:    recipientName,
        address: order.shippingAddress ?? null,
      }}
      shipFrom={{
        name:    process.env.SHIP_FROM_NAME    ?? "Pronuvia",
        street:  process.env.SHIP_FROM_STREET  ?? process.env.FEDEX_SHIPPER_ADDRESS ?? "",
        city:    process.env.SHIP_FROM_CITY    ?? process.env.FEDEX_SHIPPER_CITY    ?? "",
        state:   process.env.SHIP_FROM_STATE   ?? process.env.FEDEX_SHIPPER_STATE   ?? "",
        zip:     process.env.SHIP_FROM_ZIP     ?? process.env.FEDEX_SHIPPER_ZIP     ?? "",
        country: "US",
      }}
      orderValue={order.total}
      subtotal={order.subtotal}
      shippingRate={order.shippingRate}
      shippingCarrier={order.shippingCarrier ?? null}
      shippingMethod={order.shippingMethod ?? null}
      testModeCarriers={{
        ups:   (process.env.UPS_API_URL   ?? "").includes("wwwcie"),
        fedex: (process.env.FEDEX_API_URL ?? "").includes("sandbox"),
        usps:  (process.env.USPS_BASE_URL ?? "").includes("tem"),
      }}
      mode={shipmentMode}
    />
  );
}
