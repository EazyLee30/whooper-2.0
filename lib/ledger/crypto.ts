import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
function key() {
  const source = Buffer.from(
    process.env.TOKEN_ENCRYPTION_KEY_BASE64 ?? "",
    "base64",
  );
  if (source.length !== 32) throw Error("Asset encryption key unavailable");
  return Buffer.from(
    hkdfSync("sha256", source, "whooper-assets", "ledger-art-v1", 32),
  );
}
export function encryptArtwork(bytes: Buffer) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), nonce);
  return Buffer.concat([
    nonce,
    cipher.update(bytes),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}
export function decryptArtwork(bytes: Buffer) {
  if (bytes.length < 28) throw Error("Invalid encrypted artwork");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([
    decipher.update(bytes.subarray(12, -16)),
    decipher.final(),
  ]);
}
