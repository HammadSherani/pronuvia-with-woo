import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// Accounts brought over from the old WordPress site keep the password hash
// WordPress made, so people log in with their old password:
//   $wp$2y$…  WordPress 6.8+: bcrypt of base64(HMAC-SHA384 of the password)
//   $P$ / $H$ phpass (older WordPress)
//   $2y$…     plain bcrypt (some plugins)
//   32 hex    plain MD5 (very old WordPress)
// After the first good login the password is saved again in our own form
// (see needsRehash).

const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** phpass "portable" hash (the encoding of phpass's encode64). */
function phpassHash(plain: string, setting: string): string | null {
  const countLog2 = ITOA64.indexOf(setting[3]);
  if (countLog2 < 7 || countLog2 > 30) return null;
  const salt = setting.slice(4, 12);
  if (salt.length !== 8) return null;
  const pw = Buffer.from(plain, "utf8");
  let h = createHash("md5").update(Buffer.concat([Buffer.from(salt, "binary"), pw])).digest();
  for (let i = 1 << countLog2; i > 0; i--) h = createHash("md5").update(Buffer.concat([h, pw])).digest();

  let out = setting.slice(0, 12);
  let i = 0;
  while (i < 16) {
    let value = h[i++];
    out += ITOA64[value & 0x3f];
    if (i < 16) value |= h[i] << 8;
    out += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= 16) break;
    if (i < 16) value |= h[i] << 16;
    out += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= 16) break;
    out += ITOA64[(value >> 18) & 0x3f];
  }
  return out;
}

const sameText = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** bcryptjs reads the $2b$ form; PHP writes $2y$ (the same thing). */
const asBcrypt = (hash: string) => (hash.startsWith("$2y$") ? "$2b$" + hash.slice(4) : hash);

export async function verifyPassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  if (hashed.startsWith("$wp$2")) {
    const prehashed = createHmac("sha384", "wp-sha384").update(plain, "utf8").digest("base64");
    return bcrypt.compare(prehashed, asBcrypt(hashed.slice(3)));
  }
  if (hashed.startsWith("$P$") || hashed.startsWith("$H$")) {
    const h = phpassHash(plain, hashed);
    return !!h && sameText(h, hashed);
  }
  if (/^[0-9a-f]{32}$/i.test(hashed)) {
    return sameText(createHash("md5").update(plain, "utf8").digest("hex"), hashed.toLowerCase());
  }
  return bcrypt.compare(plain, asBcrypt(hashed));
}

/** True for a hash from the old WordPress site: save the password again in our own form. */
export function needsRehash(hashed: string): boolean {
  return !(hashed.startsWith("$2a$") || hashed.startsWith("$2b$"));
}
