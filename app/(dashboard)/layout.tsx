import { redirect }         from "next/navigation";
import { getCurrentSession } from "@/lib/auth/dal";
import { prisma }            from "@/lib/db/prisma";
import { MainHeader }        from "@/components/dashboard/main-header";
import { SubHeader }         from "@/components/dashboard/sub-header";
import { ToastProvider }     from "@/components/toast-provider";
import { CartProviderWrapper } from "@/components/cart-provider-wrapper";
import { BankNotifyGate }    from "@/components/dashboard/bank-notify-gate";
import { HideStripeBadge }   from "@/components/shared/hide-stripe-badge";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  // Check if this physician/sales-rep has been asked to add bank details
  let showBankGate = false;

  if (session.role === "PHYSICIAN") {
    const doc = await prisma.partneringPhysician.findUnique({
      where:  { id: session.userId },
      select: { bankNotifyRequested: true, bankName: true },
    });
    if (doc?.bankNotifyRequested && !doc.bankName) {
      showBankGate = true;
    }
  } else if (session.role === "SALES_REP") {
    const rep = await prisma.salesRepresentative.findUnique({
      where:  { id: session.userId },
      select: { bankNotifyRequested: true, bankName: true },
    });
    if (rep?.bankNotifyRequested && !rep.bankName) {
      showBankGate = true;
    }
  }

  return (
    <CartProviderWrapper userId={session.userId}>
      <div className="min-h-screen flex flex-col bg-[#f9fafb]">
        <ToastProvider />
        <HideStripeBadge />
        <MainHeader role={session.role} />
        <SubHeader role={session.role} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
          {children}
        </main>
        {showBankGate && <BankNotifyGate role={session.role as "PHYSICIAN" | "SALES_REP"} />}
      </div>
    </CartProviderWrapper>
  );
}
