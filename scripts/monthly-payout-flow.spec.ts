import assert from "node:assert/strict";
import { commissionPayoutEmail } from "../lib/email/templates";
import { generateCommissionStatementPdf } from "../lib/pdf/commission-statement";
import {
  buildMonthlyPayoutPlan,
  getPayoutLocalDateParts,
  getPreviousMonthPayoutPeriod,
} from "../lib/withdrawals/monthly";

async function main() {
const period = getPreviousMonthPayoutPeriod(new Date("2026-08-01T00:01:00.000Z"));
assert.equal(period.key, "2026-07");
assert.equal(period.label, "July 2026");
assert.equal(period.note, "Auto withdrawal - July 2026");
assert.deepEqual(
  getPayoutLocalDateParts(new Date("2026-07-31T19:01:00.000Z"), "Asia/Karachi"),
  { year: 2026, month: 8, day: 1, hour: 0, minute: 1 },
);
assert.equal(
  getPreviousMonthPayoutPeriod(new Date("2026-07-31T19:01:00.000Z"), "Asia/Karachi").key,
  "2026-07",
);

const users = [
  { id: "rep-1", userRole: "SALES_REP" as const, walletBalance: 105.5, hasBankAccount: true },
  { id: "doctor-1", userRole: "PHYSICIAN" as const, walletBalance: 250, hasBankAccount: true },
  { id: "no-bank", userRole: "PHYSICIAN" as const, walletBalance: 90, hasBankAccount: false },
];

const firstRun = buildMonthlyPayoutPlan({ users, requests: [], period });
assert.equal(firstRun.create.length, 2);
assert.equal(firstRun.update.length, 0);

const pendingRequests = firstRun.create.map((request, index) => ({
  ...request,
  id: `pending-${index}`,
  status: "PENDING" as const,
  createdAt: new Date("2026-08-01T00:01:00.000Z"),
}));
const secondRun = buildMonthlyPayoutPlan({
  users,
  requests: [
    ...pendingRequests.map((request) => ({ ...request, periodKey: period.key })),
    { ...pendingRequests[0], id: "stale-duplicate", periodKey: period.key, createdAt: new Date("2026-07-31T00:00:00.000Z") },
  ],
  period,
});
assert.equal(secondRun.update.length, 0, "monthly snapshots must not be recalculated on retry");
assert.deepEqual(secondRun.remove, ["stale-duplicate"]);
assert.equal(secondRun.create.length, 0);

const approvedRun = buildMonthlyPayoutPlan({
  users,
  requests: pendingRequests.map((request) => request.userId === "rep-1"
    ? { ...request, status: "APPROVED" as const, note: period.note }
    : request),
  period,
});
assert.deepEqual(approvedRun.skipApproved, ["rep-1"]);
assert.equal(approvedRun.update.length, 0);

const pdf = await generateCommissionStatementPdf({
  recipientName: "Test Recipient",
  role: "Medical Representative",
  period: period.label,
  orders: [{ orderNumber: "ORD-TEST-001", createdAt: "2026-07-15T00:00:00.000Z", amount: 105.5, rate: 5 }],
  totalAmount: 105.5,
});
assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");

const email = commissionPayoutEmail({ firstName: "Test", amount: 105.5, period: period.label, orderCount: 1 });
assert.match(email.subject, /July 2026/);
assert.match(email.html, /A detailed commission statement is attached/);
assert.ok(pdf.length > 500, "statement PDF should contain a real document");

console.log("monthly payout flow simulation passed");
console.log(JSON.stringify({
  scheduledPeriod: period.label,
  firstRun: { created: firstRun.create.length },
  idempotentRun: { updated: secondRun.update.length, removed: secondRun.remove.length },
  approvedRun: { skipped: approvedRun.skipApproved.length, updated: approvedRun.update.length },
  email: { subject: email.subject, attachmentBytes: pdf.length },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
