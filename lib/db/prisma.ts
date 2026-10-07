import { PrismaClient } from "@/generated/prisma/client";
import path from "path";

// On Vercel (Lambda), Prisma's engine search misses the /prisma subdir.
// outputFileTracingIncludes deploys the binary to /var/task/generated/prisma/
// so we point Prisma there explicitly before the client is instantiated.
if (process.env.VERCEL && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(
    process.cwd(),
    "generated/prisma/libquery_engine-rhel-openssl-3.0.x.so.node"
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
