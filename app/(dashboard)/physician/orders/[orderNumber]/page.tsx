import { notFound } from "next/navigation";
import { requirePhysician } from "@/lib/auth/dal";
import { getOwnOrderDetail } from "@/lib/orders/order-detail";
import { OrderDetailView } from "@/components/orders/order-detail-view";

type Props = { params: Promise<{ orderNumber: string }> };

export default async function PhysicianOrderDetailPage({ params }: Props) {
  const session = await requirePhysician();
  const { orderNumber } = await params;
  const detail = await getOwnOrderDetail(orderNumber, { role: "PHYSICIAN", userId: session.userId });
  if (!detail) notFound();

  return (
    <OrderDetailView
      detail={detail}
      viewer="PHYSICIAN"
      backHref="/physician/orders"
      invoiceHref={`/physician/invoice/${orderNumber}`}
    />
  );
}
