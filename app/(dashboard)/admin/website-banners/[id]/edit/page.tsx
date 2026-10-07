import { notFound }            from "next/navigation";
import { prisma }              from "@/lib/db/prisma";
import { requireAdmin }        from "@/lib/auth/dal";
import { PageHeader }          from "@/components/admin/page-header";
import { WebsiteBannerForm }   from "@/components/admin/website-banner-form";
import { updateWebsiteBanner } from "@/actions/admin/website-banners";

export const metadata = { title: "Edit Website Banner – Pronuvia Admin" };

export default async function EditWebsiteBannerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const banner = await prisma.websiteBanner.findUnique({ where: { id } });
  if (!banner) notFound();

  const boundAction = updateWebsiteBanner.bind(null, id);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit Website Banner" description="Update banner details" />
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <WebsiteBannerForm
          action={boundAction}
          defaultValues={{
            imageUrl:    banner.imageUrl,
            isPublished: banner.isPublished,
            sortOrder:   banner.sortOrder,
          }}
        />
      </div>
    </div>
  );
}
