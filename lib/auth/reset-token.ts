import crypto from "crypto";

export function generateResetToken() {
  const token  = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
  return { token, expiry };
}

export function randomPlaceholderPassword() {
  return crypto.randomBytes(32).toString("base64");
}
