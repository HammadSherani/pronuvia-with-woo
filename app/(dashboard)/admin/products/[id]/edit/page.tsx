import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { getProductById, updateProduct } from "@/actions/admin/products";
import { ProductForm } from "../../_components/product-form";

export const metadata = { title: "Edit Product – Pronuvia Admin" };

type Props = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const [product, categories, subCategories] = await Promise.all([
    getProductById(id),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subCategory.findMany({ select: { id: true, name: true, categoryId: true }, orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  const boundUpdate = updateProduct.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Products
      </Link>
      <h1 className="text-xl font-bold text-gray-800 mb-6">Edit Product</h1>
      <ProductForm
        action={boundUpdate}
        submitLabel="Save Changes"
        backHref="/admin/products"
        successRedirect="/admin/products"
        categories={categories}
        subCategories={subCategories}
        defaults={{
          title:        product.title,
          description:  product.description ?? undefined,
          image:        product.image        ?? undefined,
          imageGallery: product.imageGallery,
          tags:         product.tags,
          status:       product.status,
          categoryId:   product.categoryId,
          subCategoryId: product.subCategoryId,
          variants: (product.variants as {
            size: string; sku?: string; gtin?: string; image?: string;
            costPrice?: number; salePrice?: number; stock?: number; weight?: number;
          }[]) ?? [],
        }}
      />
    </div>
  );
}
