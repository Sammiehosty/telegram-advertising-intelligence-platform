import crypto from "crypto";

const SECRET = process.env.APP_SECRET || "telead-dev-secret-change-in-production";
const KEY = crypto.scryptSync(SECRET, "telead-salt", 32);

/** AES-256-GCM encryption for storing Telegram credentials at rest. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••••${value.slice(-2)}`;
}
