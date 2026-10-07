import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { createSalesRep } from "@/actions/admin/manage-sales-reps";
import { SalesRepForm } from "@/components/admin/sales-rep-form";

export const metadata = { title: "Add Medical Rep – Pronuvia Admin" };

export default async function NewSalesRepPage() {
  await requireAdmin();

  return (
    <div className="">
      <Link href="/admin/sales-reps"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Medical Representatives
      </Link>
      <h1 className="text-xl font-bold text-gray-800 mb-6">Add Medical Representative</h1>

      <SalesRepForm
        action={createSalesRep}
        submitLabel="Create Account"
        backHref="/admin/sales-reps"
        successRedirect="/admin/sales-reps"
      />
    </div>
  );
}
