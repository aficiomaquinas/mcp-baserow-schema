/**
 * TOTP (Time-based One-Time Password) generation using node:crypto.
 * Implements RFC 6238 compatible TOTP with HMAC-SHA1.
 */
import { createHmac } from "node:crypto";

/**
 * Decode a base32-encoded string to a Buffer.
 * Handles standard base32 (A-Z, 2-7) with optional padding.
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  // Remove whitespace and convert to uppercase
  const cleaned = encoded.replace(/\s/g, "").toUpperCase();
  // Remove padding
  const padded = cleaned.replace(/=+$/, "");

  let bits = "";
  for (const char of padded) {
    const val = alphabet.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    bits += val.toString(2).padStart(5, "0");
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
  }
  return Buffer.from(bytes);
}

/**
 * Generate a TOTP code for a given base32 secret.
 * @param secret - Base32-encoded shared secret
 * @param timeStep - Time step in seconds (default 30)
 * @param digits - Number of digits in the code (default 6)
 * @returns The TOTP code as a string, zero-padded
 */
export function generateTOTP(
  secret: string,
  timeStep: number = 30,
  digits: number = 6,
): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);

  // Convert counter to big-endian 8-byte buffer
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter & 0xffffffff, 4);

  // HMAC-SHA1
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();

  // Dynamic truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}
