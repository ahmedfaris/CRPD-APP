import { PasswordPolicyResult } from '../types';

/**
 * Validates a password according to ASP.NET Core Identity settings in Program.cs:
 * - Minimum length 12
 * - Requires at least one digit (0-9)
 * - Requires at least one lowercase letter (a-z)
 * - Requires at least one uppercase letter (A-Z)
 * - Requires at least one non-alphanumeric character (!@#$%^&*...)
 * - Requires at least 4 unique characters
 */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const hasLength = password.length >= 12;
  const hasDigit = /\d/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const uniqueCount = new Set(password.split('')).size;
  const hasUniqueChars = uniqueCount >= 4;

  const errors: string[] = [];
  if (!hasLength) errors.push('Password must be at least 12 characters long.');
  if (!hasDigit) errors.push('Password must contain at least one digit (0-9).');
  if (!hasLower) errors.push('Password must contain at least one lowercase letter (a-z).');
  if (!hasUpper) errors.push('Password must contain at least one uppercase letter (A-Z).');
  if (!hasSpecial) errors.push('Password must contain at least one non-alphanumeric character (!@#$%^&*...).');
  if (!hasUniqueChars) errors.push('Password must contain at least 4 distinct characters.');

  return {
    isValid: hasLength && hasDigit && hasLower && hasUpper && hasSpecial && hasUniqueChars,
    hasLength,
    hasDigit,
    hasLower,
    hasUpper,
    hasSpecial,
    hasUniqueChars,
    errors,
  };
}

/**
 * Simulates BCrypt work factor 11 hash format:
 * $2a$11$...
 */
export function simulateBCryptHash(plaintext: string): string {
  // Simple deterministic or pseudo-hash representation matching standard BCrypt signature
  let hashVal = 0;
  for (let i = 0; i < plaintext.length; i++) {
    hashVal = (hashVal << 5) - hashVal + plaintext.charCodeAt(i);
    hashVal |= 0;
  }
  const hexPart = Math.abs(hashVal).toString(36).padEnd(22, 'x');
  return `$2a$11$eK1W.Qj2u3o9${hexPart.slice(0, 22)}`;
}

/**
 * Serilog PiiMaskingEnricher implementation
 * Masks sensitive personal information (emails, session tokens, IPs)
 */
export function maskPii(input: string): string {
  if (!input) return '';
  // Mask email addresses: john.doe@example.com -> j***e@example.com
  let masked = input.replace(/([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*([a-zA-Z0-9_.+-])@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, '$1***$2@$3');
  // Mask IP addresses
  masked = masked.replace(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g, '$1.$2.***.***');
  // Mask potential passwords/secrets
  masked = masked.replace(/(password|secret|token)=([^\s&]+)/gi, '$1=********');
  return masked;
}
