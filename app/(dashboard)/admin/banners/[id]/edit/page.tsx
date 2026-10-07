import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { BannerForm } from "@/components/admin/banner-form";
import { updateBanner } from "@/actions/admin/banners";

type Props = { params: Promise<{ id: string }> };

export const metadata = { title: "Edit Banner – Pronuvia Admin" };

export default async function EditBannerPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) notFound();

  const boundAction = updateBanner.bind(null, id);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Edit Banner"
        description="Update this promotional banner"
      />
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <BannerForm
          action={boundAction}
          defaultValues={{
            title:       banner.title,
            imageUrl:    banner.imageUrl,
            linkUrl:     banner.linkUrl ?? "",
            isPublished: banner.isPublished,
            sortOrder:   banner.sortOrder,
          }}
        />
      </div>
    </div>
  );
}
