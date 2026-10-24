// Re-syncs every rep / approved doctor to their WooCommerce customer (name,
// email, addresses, Login ID). With the "Pronuvia Usernames" plugin active in
// WP, older accounts' usernames then become their Login ID.
//   tsx --conditions=react-server --env-file=.env scripts/woo-sync-customers.mts --dry
import { prisma } from "@/lib/db/prisma";
import { syncAllWooCustomers } from "@/lib/woo/customers";

const dry = process.argv.includes("--dry");
const { totals, results } = await syncAllWooCustomers({ dryRun: dry });
for (const r of results) {
  console.log(`${r.role.padEnd(9)} ${r.email ?? r.userId}  ${r.status}${r.wooCustomerId ? ` #${r.wooCustomerId}` : ""}${r.reason ? ` — ${r.reason}` : ""}`);
}
console.log(JSON.stringify(totals), dry ? "(dry run: nothing changed)" : "");
await prisma.$disconnect();
