// Prints the current 6-digit authenticator code for a base32 TOTP secret
// (RFC 6238: SHA-1, 30-second steps). For local development and tests with the
// seeded admins' dev-only secret:
//
//   node scripts/totp.mjs JBSWY3DPEHPK3PXP
//
// Also importable: import { totp } from './totp.mjs'.

import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(secret) {
  const clean = secret.replace(/[\s=-]/g, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) throw new Error(`Not a base32 secret: ${secret}`);
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(secret, time = Date.now(), step = 30, digits = 6) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / step)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const secret = process.argv[2];
  if (!secret) {
    console.error('Usage: node scripts/totp.mjs <base32 secret>');
    process.exit(2);
  }
  console.log(totp(secret));
}
