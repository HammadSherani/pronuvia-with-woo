// Edge-runtime safe: no "server-only", no Prisma, no next/headers
// Used exclusively by proxy.ts (middleware)
import { jwtVerify } from "jose";

export type EdgeSession = {
  userId: string;
  role: string;
  email: string;
  expiresAt: Date;
};

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) return new TextEncoder().encode("");
  return new TextEncoder().encode(s);
}

export async function decryptEdge(token: string): Promise<EdgeSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return {
      userId:    payload.userId    as string,
      role:      payload.role      as string,
      email:     payload.email     as string,
      expiresAt: new Date((payload.exp as number) * 1000),
    };
  } catch {
    return null;
  }
}
