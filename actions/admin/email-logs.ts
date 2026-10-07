"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { EmailLogStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export async function getEmailLogs(opts?: {
  skip?:   number;
  take?:   number;
  status?: EmailLogStatus;
  search?: string; // matches recipient email, subject, or related id
}) {
  await requireAdmin();

  const where: Prisma.EmailLogWhereInput = {
    ...(opts?.status ? { status: opts.status } : {}),
    ...(opts?.search
      ? {
          OR: [
            { recipientEmail: { contains: opts.search, mode: "insensitive" } },
            { subject:        { contains: opts.search, mode: "insensitive" } },
            { relatedId:      { contains: opts.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: opts?.skip,
      take: opts?.take,
    }),
    prisma.emailLog.count({ where }),
  ]);

  return { logs, total };
}

export async function getEmailLogById(id: string) {
  await requireAdmin();
  return prisma.emailLog.findUnique({ where: { id } });
}
