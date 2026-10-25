import QRCode from 'qrcode';

/**
 * Base32 character set (RFC 4648)
 */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a random Base32 secret string (16 characters / 80 bits)
 */
export function generateBase32Secret(length = 16): string {
  let secret = '';
  const cryptoObj = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : (typeof window !== 'undefined' && (window as any).crypto ? (window as any).crypto : null);
  const randomBytes = new Uint8Array(length);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  for (let i = 0; i < length; i++) {
    secret += BASE32_CHARS[randomBytes[i] % 32];
  }
  return secret;
}

/**
 * Decode Base32 string to Uint8Array
 */
export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Standard SHA-1 implementation in pure TypeScript
 */
function sha1(bytes: Uint8Array): Uint8Array {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }

  const bitLength = bytes.length * 8;
  words[bitLength >>> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >>> 9) << 4) + 15] = bitLength;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  let e = -1009589776;

  const w: number[] = new Array(80);

  for (let i = 0; i < words.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;
    const olde = e;

    for (let j = 0; j < 80; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        const t = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
        w[j] = (t << 1) | (t >>> 31);
      }

      let f: number, k: number;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 1518500249;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 1859775393;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = -1894007588;
      } else {
        f = b ^ c ^ d;
        k = -899497514;
      }

      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }

    a = (a + olda) | 0;
    b = (b + oldb) | 0;
    c = (c + oldc) | 0;
    d = (d + oldd) | 0;
    e = (e + olde) | 0;
  }

  const result = new Uint8Array(20);
  const h = [a, b, c, d, e];
  for (let i = 0; i < 5; i++) {
    result[i * 4] = (h[i] >>> 24) & 255;
    result[i * 4 + 1] = (h[i] >>> 16) & 255;
    result[i * 4 + 2] = (h[i] >>> 8) & 255;
    result[i * 4 + 3] = h[i] & 255;
  }
  return result;
}

/**
 * HMAC-SHA1 calculation
 */
function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key;
  const blockSize = 64;

  if (k.length > blockSize) {
    k = sha1(k);
  }

  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(k);

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);

  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  const innerMsg = new Uint8Array(blockSize + message.length);
  innerMsg.set(iKeyPad);
  innerMsg.set(message, blockSize);
  const innerHash = sha1(innerMsg);

  const outerMsg = new Uint8Array(blockSize + innerHash.length);
  outerMsg.set(oKeyPad);
  outerMsg.set(innerHash, blockSize);
  return sha1(outerMsg);
}

/**
 * Generate a 6-digit TOTP code for a given timestamp and Base32 secret (RFC 6238)
 */
export function generateTOTP(secretBase32: string, timeMs: number = Date.now(), stepSeconds = 30): string {
  const counter = Math.floor(timeMs / 1000 / stepSeconds);
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const keyBytes = base32ToBytes(secretBase32);
  const hmac = hmacSha1(keyBytes, counterBytes);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify TOTP with tolerance in seconds.
 * For toleranceSeconds = 60 (1 minute tolerance), with stepSeconds = 30,
 * it checks steps: -2, -1, 0, +1, +2 (from -60s to +60s).
 */
export function verifyTOTPWithTolerance(
  token: string,
  secretBase32: string,
  toleranceSeconds = 60,
  stepSeconds = 30
): { valid: boolean; stepOffset?: number } {
  if (!secretBase32 || typeof secretBase32 !== 'string') {
    return { valid: false };
  }
  const cleanToken = token.trim().replace(/\s+/g, '');
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return { valid: false };
  }

  const maxSteps = Math.ceil(toleranceSeconds / stepSeconds); // 60 / 30 = 2 steps
  const now = Date.now();

  for (let stepOffset = -maxSteps; stepOffset <= maxSteps; stepOffset++) {
    const testTime = now + stepOffset * stepSeconds * 1000;
    const expected = generateTOTP(secretBase32, testTime, stepSeconds);
    if (cleanToken === expected) {
      return { valid: true, stepOffset };
    }
  }

  return { valid: false };
}

/**
 * Construct standard otpauth:// URL for authenticator apps
 */
export function getOtpAuthUrl(userEmail: string, secretBase32: string, issuer = 'CRPD APP'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(userEmail);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Render standard QR Code Data URL from OTP Auth URI
 */
export async function generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpAuthUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 260,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('QR code generation error:', err);
    return '';
  }
}
