// Commission lines, end to end on a TEST database (never the live one):
// approve, modify, reject, partial refund before / after payout, cancellation
// after payout, payout again with the deduction, rejected payout, adjustments,
// a changed amount at approval, double approval.
//
//   DATABASE_URL=<test db url> WOO_URL=http://127.0.0.1:9 tsx --conditions=react-server --env-file=.env scripts/commission-lines.spec.mts --db=<test db>
//
// It creates its own doctor, rep and orders (emails ending in @e2e-test.example.invalid)
// and removes them at the end.
import { prisma } from "@/lib/db/prisma";
import { applyCommissionReview } from "@/lib/orders/commission-review";
import { creditReviewedOrder } from "@/lib/withdrawals/credit-order";
import { applyCommissionRefunds } from "@/lib/withdrawals/commission-refund";
import { applyStatusLocally } from "@/lib/orders/order-woo";
import { reconcileOrderCommission } from "@/lib/commission/lines";
import { approvePayout, rejectPayout } from "@/lib/commission/payout";
import { addCommissionAdjustment, removeCommissionAdjustment } from "@/lib/commission/adjustments";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dbName = new URL(process.env.DATABASE_URL!).pathname.replace(/^\//, "");
if (arg("db") !== dbName || dbName === "pronuvia") { console.error("Run on a test database, named with --db (never pronuvia)."); process.exit(1); }

const TAG = "@e2e-test.example.invalid";
let failed = 0;
const check = (name: string, pass: boolean, detail: unknown = "") => { if (!pass) failed++; console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail)); };
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

// ── fixtures ──
const bank = { bankName: "Test Bank", bankAccountNumber: "123456789", bankAccountName: "Test", bankAccountType: "CHECKING" as const, bankOwnershipType: "PERSONAL" as const };
// leftovers of an interrupted run
await prisma.partneringPhysician.deleteMany({ where: { email: `spec-doc${TAG}` } });
await prisma.salesRepresentative.deleteMany({ where: { email: `spec-rep${TAG}` } });
const rep = await prisma.salesRepresentative.create({ data: { firstName: "Spec", lastName: "Rep", name: "Spec Rep", email: `spec-rep${TAG}`, password: "x", commission: 10, ...bank } });
const doc = await prisma.partneringPhysician.create({ data: { firstName: "Spec", lastName: "Doctor", email: `spec-doc${TAG}`, password: "x", isApproved: "APPROVED", addedByRole: "ADMIN", commission: 25, uplineCommission: 10, salesRepId: rep.id, ...bank } });
let seq = 0;
async function newOrder(date: string, subtotal = 400) {
  return prisma.order.create({
    data: {
      orderNumber: `SPEC-${Date.now()}-${++seq}`, physicianId: doc.id, salesRepId: rep.id, items: [], subtotal, total: subtotal,
      physicianCommissionRate: 25, physicianCommissionAmount: subtotal * 0.25, salesRepCommissionRate: 10, salesRepCommissionAmount: subtotal * 0.1,
      physicianCommissionReview: "AWAITING", salesRepCommissionReview: "AWAITING", status: "PROCESSING", createdAt: new Date(date),
    },
  });
}
const review = (doctor: [string, number], salesRep: [string, number], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ physician: { status: doctor[0], amount: doctor[1], original: doctor[1] }, sales_rep: { status: salesRep[0], amount: salesRep[1], original: salesRep[1] }, ...extra });
const lines = (userId: string, status?: string) => prisma.commissionLine.findMany({ where: { userId, ...(status && { status: status as never }) }, orderBy: { createdAt: "asc" } });
const pendingReqs = (userId: string) => prisma.withdrawRequest.findMany({ where: { userId, status: "PENDING" }, orderBy: { periodKey: "asc" } });
const sum = (ls: { amount: number }[]) => Math.round(ls.reduce((s, l) => s + l.amount, 0) * 100) / 100;

try {
  // 1. Approve on the order page → lines in the order's month (Oct 2026)
  const o1 = await newOrder("2026-10-10T15:00:00Z");
  await applyCommissionReview(o1.id, review(["approved", 100], ["approved", 40]));
  await creditReviewedOrder(o1.id);
  let dl = await lines(doc.id, "PENDING");
  check("1 approve → doctor line $100 in 2026-10", dl.length === 1 && near(dl[0].amount, 100) && dl[0].periodKey === "2026-10", dl);
  let dr = await pendingReqs(doc.id);
  check("1 one payout request for October, $100", dr.length === 1 && dr[0].periodKey === "2026-10" && near(dr[0].amount, 100), dr);
  check("1 rep line $40", near(sum(await lines(rep.id, "PENDING")), 40));

  // 2. Modify before payout → the line follows (no second line)
  await applyCommissionReview(o1.id, review(["approved", 80], ["approved", 40]));
  dl = await lines(doc.id, "PENDING");
  check("2 modify to $80 → one line $80", dl.length === 1 && near(dl[0].amount, 80), dl);
  check("2 request follows ($80)", near((await pendingReqs(doc.id))[0]?.amount ?? 0, 80));

  // 3. Partial order refund before payout (25% of the items) → line goes down
  await prisma.order.update({ where: { id: o1.id }, data: { physicianClawback: 20, salesRepClawback: 10 } });
  await reconcileOrderCommission(o1.id);
  check("3 partial refund before payout → $60", near(sum(await lines(doc.id, "PENDING")), 60));
  check("3 rep → $30", near(sum(await lines(rep.id, "PENDING")), 30));

  // 4. Approval refused when the amount changed since the admin looked
  const req = (await pendingReqs(doc.id))[0];
  let refused = "";
  try { await approvePayout(req.id, { expectedAmount: 80 }); } catch (e) { refused = (e as Error).message; }
  check("4 changed amount → refused, nothing paid", /changed/.test(refused) && (await lines(doc.id, "PAID")).length === 0, refused);

  // 5. Approve the payout → its lines PAID; a second click pays nothing
  const paid = await approvePayout(req.id, { expectedAmount: 60 });
  const again = await approvePayout(req.id, { expectedAmount: 60 }).catch(() => null);
  check("5 payout approved $60", near(paid?.amount ?? 0, 60), paid);
  check("5 double approval pays nothing", again === null);
  check("5 line PAID, nothing pending", (await lines(doc.id, "PAID")).length === 1 && (await lines(doc.id, "PENDING")).length === 0);
  check("5 order marked paid out for the doctor", !!(await prisma.order.findUnique({ where: { id: o1.id } }))?.physicianCommissionPaidOutAt);

  // 6. Partial refund AFTER payout → deduction (−$15) waiting for the next payout
  await prisma.order.update({ where: { id: o1.id }, data: { physicianClawback: 35 } });
  await reconcileOrderCommission(o1.id);
  dl = await lines(doc.id, "PENDING");
  check("6 refund after payout → deduction −$15", dl.length === 1 && dl[0].kind === "DEDUCTION" && near(dl[0].amount, -15), dl);
  dr = await pendingReqs(doc.id);
  check("6 nothing to pay yet: a −$15 request that can't be approved", dr.length === 1 && near(dr[0].amount, -15), dr);
  let noPay = "";
  try { await approvePayout(dr[0].id, { expectedAmount: -15 }); } catch (e) { noPay = (e as Error).message; }
  check("6 approving a deduction-only request is refused", /Nothing to pay/.test(noPay), noPay);

  // 7. Next month's commission → the payout nets the deduction (payout again, correct amount)
  const o2 = await newOrder("2026-11-05T15:00:00Z", 200);
  await applyCommissionReview(o2.id, review(["approved", 50], ["approved", 20]));
  await creditReviewedOrder(o2.id);
  dr = await pendingReqs(doc.id);
  check("7 one request (Nov) = $50 − $15 = $35", dr.length === 1 && dr[0].periodKey === "2026-11" && near(dr[0].amount, 35), dr);
  const p2 = await approvePayout(dr[0].id, { expectedAmount: 35 });
  check("7 paid $35; deduction settled", near(p2?.amount ?? 0, 35) && (await lines(doc.id, "PENDING")).length === 0);

  // 8. Cancellation after payout → the rest of the paid commission comes off the next payout
  await applyStatusLocally(o2.id, "CANCELLED");
  dl = await lines(doc.id, "PENDING");
  check("8 cancelled after payout → deduction −$50", dl.length === 1 && near(dl[0].amount, -50), dl);
  // …and un-cancelling gives it back
  await applyStatusLocally(o2.id, "PROCESSING");
  check("8 un-cancelled → deduction gone", (await lines(doc.id, "PENDING")).length === 0);
  await applyStatusLocally(o2.id, "CANCELLED");

  // 9. Cancellation before payout → the pending line just goes
  const o3 = await newOrder("2026-11-12T15:00:00Z", 400);
  await applyCommissionReview(o3.id, review(["approved", 100], ["approved", 40]));
  await creditReviewedOrder(o3.id);
  check("9 o3 approved: Nov request $100 − $50 = $50", near((await pendingReqs(doc.id))[0]?.amount ?? 0, 50));
  await applyStatusLocally(o3.id, "CANCELLED");
  dr = await pendingReqs(doc.id);
  check("9 cancelled before payout → only the −$50 deduction is left", near(sum(await lines(doc.id, "PENDING")), -50) && dr.length === 1, dr);

  // 10. WP "Refund commission" after payout (rep, order o1): −$10 off the rep's next payout
  const repReq = (await pendingReqs(rep.id))[0];
  await approvePayout(repReq.id, { expectedAmount: repReq.amount });
  await applyCommissionRefunds(o1.id, review(["approved", 80], ["approved", 40], {}).replace('"sales_rep":{"status":"approved","amount":40,"original":40}', '"sales_rep":{"status":"approved","amount":40,"original":40,"refunds":[{"id":"r1","amount":10,"note":"spec"}]}'));
  const rl = await lines(rep.id, "PENDING");
  check("10 refund commission after payout → rep deduction −$10", rl.some((l) => l.kind === "DEDUCTION" && near(l.amount, -10)), rl);
  await applyCommissionRefunds(o1.id, review(["approved", 80], ["approved", 40]).replace('"sales_rep":{"status":"approved","amount":40,"original":40}', '"sales_rep":{"status":"approved","amount":40,"original":40,"refunds":[{"id":"r1","amount":10,"note":"spec"}]}'));
  check("10 the same refund again changes nothing", near(sum(await lines(rep.id, "PENDING")), sum(rl)));

  // 11. Adjustment on an order: in that order's month; removable while unpaid
  const adj = await addCommissionAdjustment({ userId: doc.id, userRole: "PHYSICIAN", orderId: o1.id, amount: 25, reason: "spec bonus" });
  check("11 adjustment +$25 in 2026-10", adj.periodKey === "2026-10");
  dr = await pendingReqs(doc.id);
  check("11 October request $25; the −$50 deduction moves onto it (next payout) → −$25", dr.length === 1 && dr[0].periodKey === "2026-10" && near(dr[0].amount, -25), dr);
  check("11 adjustment removed while unpaid", await removeCommissionAdjustment(adj.id));
  let wrong = "";
  try { await addCommissionAdjustment({ userId: rep.id, userRole: "SALES_REP", orderId: (await newOrder("2026-11-20T15:00:00Z")).id.replace(/.$/, "0"), amount: 5, reason: "x" }); } catch (e) { wrong = (e as Error).message; }
  check("11 adjustment on someone else's / unknown order refused", wrong.length > 0, wrong);

  // 12. Rejected payout: positive lines cancelled (not paid, not recreated); deductions carry on
  const o4 = await newOrder("2026-12-02T15:00:00Z", 800);
  await applyCommissionReview(o4.id, review(["approved", 200], ["approved", 80]));
  await creditReviewedOrder(o4.id);
  dr = await pendingReqs(doc.id);
  const dec = dr.find((r) => r.amount > 0)!;
  check("12 December request $200 − $50 = $150", near(dec.amount, 150), dr);
  await rejectPayout(dec.id, { adminNote: "spec reject" });
  check("12 rejected: the $200 line is CANCELLED", (await lines(doc.id, "CANCELLED")).some((l) => near(l.amount, 200)));
  await reconcileOrderCommission(o4.id);
  check("12 not recreated by a refresh", !(await lines(doc.id, "PENDING")).some((l) => l.orderId === o4.id && l.amount > 0));
  check("12 the −$50 deduction is still waiting", near(sum(await lines(doc.id, "PENDING")), -50));

  // 13. A rejected commission on WP before payout → no line
  const o5 = await newOrder("2026-12-05T15:00:00Z", 400);
  await applyCommissionReview(o5.id, review(["rejected", 100], ["approved", 40]));
  await creditReviewedOrder(o5.id);
  check("13 rejected doctor commission → no doctor line", !(await lines(doc.id)).some((l) => l.orderId === o5.id));
  check("13 approved rep commission → rep line $40", (await lines(rep.id, "PENDING")).some((l) => l.orderId === o5.id && near(l.amount, 40)));
} finally {
  // clean up everything this run made
  const ids = [doc.id, rep.id];
  const orderIds = (await prisma.order.findMany({ where: { orderNumber: { startsWith: "SPEC-" } }, select: { id: true } })).map((o) => o.id);
  await prisma.commissionLine.deleteMany({ where: { userId: { in: ids } } });
  await prisma.withdrawRequest.deleteMany({ where: { userId: { in: ids } } });
  await prisma.commissionEvent.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.commissionRefund.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.partneringPhysician.deleteMany({ where: { id: doc.id } });
  await prisma.salesRepresentative.deleteMany({ where: { id: rep.id } });
  await prisma.$disconnect();
}
console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
