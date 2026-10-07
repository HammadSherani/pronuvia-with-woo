import { getCurrentSession } from "@/lib/auth/dal";
import { SiteHeader }        from "./site-header";

const DASHBOARD: Record<string, string> = {
  ADMIN:     "/admin/dashboard",
  SALES_REP: "/sales/dashboard",
  PHYSICIAN: "/physician/dashboard",
};

export async function SiteHeaderWrapper({ variant }: { variant?: "overlay" | "solid" }) {
  const session      = await getCurrentSession();
  const dashboardHref = session?.role ? DASHBOARD[session.role] : undefined;
  return <SiteHeader variant={variant} dashboardHref={dashboardHref} />;
}
