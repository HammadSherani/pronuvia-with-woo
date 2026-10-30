import { notFound } from "next/navigation";
import { requireSalesRep } from "@/lib/auth/dal";
import { getOwnOrderDetail } from "@/lib/orders/order-detail";
import { OrderDetailView } from "@/components/orders/order-detail-view";

type Props = { params: Promise<{ orderNumber: string }> };

export default async function SalesOrderDetailPage({ params }: Props) {
  const session = await requireSalesRep();
  const { orderNumber } = await params;
  const detail = await getOwnOrderDetail(orderNumber, { role: "SALES_REP", userId: session.userId });
  if (!detail) notFound();

  return (
    <OrderDetailView
      detail={detail}
      viewer="SALES_REP"
      backHref="/sales/orders"
      invoiceHref={`/api/orders/${orderNumber}/invoice`}
    />
  );
}
