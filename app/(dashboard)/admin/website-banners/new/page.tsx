import { requireAdmin }       from "@/lib/auth/dal";
import { PageHeader }          from "@/components/admin/page-header";
import { WebsiteBannerForm }   from "@/components/admin/website-banner-form";
import { createWebsiteBanner } from "@/actions/admin/website-banners";

export const metadata = { title: "New Website Banner – Pronuvia Admin" };

export default async function NewWebsiteBannerPage() {
  await requireAdmin();

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add Website Banner" description="Create a new banner for the public home page" />
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <WebsiteBannerForm action={createWebsiteBanner} />
      </div>
    </div>
  );
}
