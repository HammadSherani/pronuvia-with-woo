import assert from "node:assert/strict";
import { reconcilePendingPayoutRequest } from "../lib/withdrawals/sync";

const result = reconcilePendingPayoutRequest({
  pending: [
    { id: "old-dup", amount: 541.25, createdAt: "2026-08-01T00:00:00.000Z" },
    { id: "latest", amount: 50, createdAt: "2026-07-24T00:00:00.000Z" },
  ],
  availableBalance: 224.76,
});

assert.equal(result.keepId, "old-dup");
assert.equal(result.amount, 224.76);
assert.deepEqual(result.removedIds, ["latest"]);

console.log("withdrawal-sync regression check passed");
