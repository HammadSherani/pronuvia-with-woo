// EMAIL_ALLOWLIST: who gets email on the test site. Run with no email
// provider set and a throwaway database (sendMail writes the Email Log):
//   DATABASE_URL=<test db> SENDGRID_API_KEY= SMTP_USER= SMTP_PASS= EMAIL_ALLOWLIST="info@aictherapy.com, @pronuvia.com" \
//     tsx --conditions=react-server --env-file=.env scripts/email-allowlist.spec.mts --db=<test db>
import { prisma } from "@/lib/db/prisma";
import { allowedRecipients, isEmailAllowed } from "@/lib/email/allowlist";
import { sendMail } from "@/lib/email/mailer";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dbName = new URL(process.env.DATABASE_URL!).pathname.replace(/^\//, "");
if (arg("db") !== dbName || dbName === "pronuvia") { console.error("Run on a throwaway database (--db, never pronuvia)."); process.exit(1); }
if (process.env.SENDGRID_API_KEY || process.env.SMTP_USER) { console.error("Unset the email provider first: nothing may really be sent."); process.exit(1); }

let failed = 0;
const check = (name: string, pass: boolean, detail: unknown = "") => { if (!pass) failed++; console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail)); };

check("exact address allowed", isEmailAllowed("info@aictherapy.com"));
check("case and display name ignored", isEmailAllowed('"Dr X" <INFO@AICtherapy.com>'));
check("whole domain allowed", isEmailAllowed("someone@pronuvia.com"));
check("real doctor blocked", !isEmailAllowed("docmilisen@gmail.com"));
check("look-alike domain blocked", !isEmailAllowed("x@notpronuvia.com.evil.io"));
const g = allowedRecipients("docmilisen@gmail.com", ["admin@pronuvia.com"], ["x@gmail.com"]);
check("blocked main recipient, allowed CC becomes the recipient", g.to === "admin@pronuvia.com" && g.cc.length === 0 && g.bcc.length === 0 && g.blocked.length === 2, g);
check("nobody allowed → no recipient", allowedRecipients("a@gmail.com", [], []).to === null);

await prisma.emailLog.deleteMany({});
const r = await sendMail({ to: "docmilisen@gmail.com", subject: "Spec: real doctor", html: "<p>x</p>", type: "Spec" });
check("email to a real doctor is not sent", (r as { blocked?: boolean }).blocked === true, r);
let err = "";
try { await sendMail({ to: "info@aictherapy.com", subject: "Spec: test doctor", html: "<p>x</p>", type: "Spec" }); } catch (e) { err = (e as Error).message; }
check("email to an allowed address goes to the provider (none set here → failed)", /No email provider/.test(err), err);
const logs = await prisma.emailLog.findMany({ orderBy: { createdAt: "asc" }, select: { recipientEmail: true, status: true } });
check("Email Log: BLOCKED for the doctor, FAILED (no provider) for the test address",
  logs.some((l) => l.recipientEmail === "docmilisen@gmail.com" && l.status === "BLOCKED") && logs.some((l) => l.recipientEmail === "info@aictherapy.com" && l.status === "FAILED"), logs);
await prisma.$disconnect();
console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
