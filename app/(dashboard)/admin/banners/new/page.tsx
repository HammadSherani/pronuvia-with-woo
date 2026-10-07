import { requireAdmin } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { BannerForm } from "@/components/admin/banner-form";
import { createBanner } from "@/actions/admin/banners";

export const metadata = { title: "New Banner – Pronuvia Admin" };

export default async function NewBannerPage() {
  await requireAdmin();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Add Banner"
        description="Create a new promotional banner"
      />
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <BannerForm action={createBanner} />
      </div>
    </div>
  );
}
