/**
 * One-time migration: unified wallet schema
 *
 * Run once with dev server stopped:
 *   node scripts/migrate-wallet.mjs
 *
 * What it does:
 *  1. WithdrawRequest:         salesRepId  → userId  + userRole="SALES_REP"
 *  2. WalletTransaction:       salesRepId  → userId  + userRole="SALES_REP"
 *  3. PhysicianWithdrawRequest collection → merged into WithdrawRequest with userId=physicianId, userRole="PHYSICIAN"
 *  4. PhysicianWalletTransaction collection → merged into WalletTransaction with userId=physicianId, userRole="PHYSICIAN"
 */

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function run() {
  // ── 1. WithdrawRequest: set userId from salesRepId ────────────────────────
  console.log("[1/4] Migrating WithdrawRequest (salesRepId → userId, SALES_REP)...");
  const wr = await prisma.$runCommandRaw({
    update: "WithdrawRequest",
    updates: [
      {
        q: { salesRepId: { $exists: true }, userId: { $exists: false } },
        u: [{ $set: { userId: "$salesRepId", userRole: "SALES_REP" } }],
        multi: true,
      },
    ],
  });
  console.log("   →", JSON.stringify(wr));

  // ── 2. WalletTransaction: set userId from salesRepId ─────────────────────
  console.log("[2/4] Migrating WalletTransaction (salesRepId → userId, SALES_REP)...");
  const wt = await prisma.$runCommandRaw({
    update: "WalletTransaction",
    updates: [
      {
        q: { salesRepId: { $exists: true }, userId: { $exists: false } },
        u: [{ $set: { userId: "$salesRepId", userRole: "SALES_REP" } }],
        multi: true,
      },
    ],
  });
  console.log("   →", JSON.stringify(wt));

  // ── 3. PhysicianWithdrawRequest → WithdrawRequest ────────────────────────
  console.log("[3/4] Merging PhysicianWithdrawRequest → WithdrawRequest (PHYSICIAN)...");
  try {
    const pwr = await prisma.$runCommandRaw({
      aggregate: "PhysicianWithdrawRequest",
      pipeline: [
        { $addFields: { userId: "$physicianId", userRole: "PHYSICIAN" } },
        { $unset: ["physicianId"] },
        {
          $merge: {
            into: "WithdrawRequest",
            on: "_id",
            whenMatched: "keepExisting",
            whenNotMatched: "insert",
          },
        },
      ],
      cursor: {},
    });
    console.log("   →", JSON.stringify(pwr));
  } catch (e) {
    console.log("   (skipped — PhysicianWithdrawRequest collection may not exist)");
  }

  // ── 4. PhysicianWalletTransaction → WalletTransaction ───────────────────
  console.log("[4/4] Merging PhysicianWalletTransaction → WalletTransaction (PHYSICIAN)...");
  try {
    const pwt = await prisma.$runCommandRaw({
      aggregate: "PhysicianWalletTransaction",
      pipeline: [
        { $addFields: { userId: "$physicianId", userRole: "PHYSICIAN" } },
        { $unset: ["physicianId"] },
        {
          $merge: {
            into: "WalletTransaction",
            on: "_id",
            whenMatched: "keepExisting",
            whenNotMatched: "insert",
          },
        },
      ],
      cursor: {},
    });
    console.log("   →", JSON.stringify(pwt));
  } catch (e) {
    console.log("   (skipped — PhysicianWalletTransaction collection may not exist)");
  }

  console.log("\nMigration complete.");
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
