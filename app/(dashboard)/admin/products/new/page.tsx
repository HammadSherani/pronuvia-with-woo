import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { createProduct } from "@/actions/admin/products";
import { ProductForm } from "../_components/product-form";

export const metadata = { title: "Add Product – Pronuvia Admin" };

export default async function NewProductPage() {
  await requireAdmin();

  const [categories, subCategories] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subCategory.findMany({ where: { isActive: true }, select: { id: true, name: true, categoryId: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Products
      </Link>
      <h1 className="text-xl font-bold text-gray-800 mb-6">Add New Product</h1>
      <ProductForm
        action={createProduct}
        submitLabel="Create Product"
        backHref="/admin/products"
        successRedirect="/admin/products"
        categories={categories}
        subCategories={subCategories}
      />
    </div>
  );
}
