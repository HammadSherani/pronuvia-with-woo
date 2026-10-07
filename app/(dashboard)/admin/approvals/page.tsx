import { requireAdmin } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/prisma";
import { ApprovalsClient } from "@/components/admin/approvals-client";
import { Pagination } from "@/components/shared/pagination";
import { parsePagination } from "@/lib/pagination";
import { Suspense } from "react";

export const metadata = { title: "Pending Approvals – Pronuvia Admin" };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  const [physicians, total] = await Promise.all([
    prisma.partneringPhysician.findMany({
      where:   { isApproved: "PENDING" },
      select: {
        id: true,
        firstName: true, lastName: true, email: true, loginId: true,
        nameOfPractice: true, credential: true, city: true, state: true,
        salesRepNote: true,
        salesRep: { select: { firstName: true, lastName: true, email: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.partneringPhysician.count({ where: { isApproved: "PENDING" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="text-sm text-gray-400 mt-0.5">Physician accounts awaiting review</p>
        </div>
        {total > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            {total} pending
          </span>
        )}
      </div>

      <ApprovalsClient physicians={physicians} />

      <Suspense>
        <Pagination total={total} page={page} pageSize={pageSize} />
      </Suspense>
    </div>
  );
}
