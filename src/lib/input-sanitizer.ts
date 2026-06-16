/**
 * input-sanitizer.ts — Server-side input sanitization utilities
 *
 * Prevents script injection, HTML injection, and malformed input
 * before data reaches LLM prompts, storage, or export systems.
 */

/**
 * Maximum length for any single user input field
 */
const MAX_FIELD_LENGTH = 5000;

/**
 * Maximum length for multi-line text (descriptions, summaries)
 */
const MAX_TEXT_LENGTH = 50000;

/**
 * Strips HTML tags and script content from a string.
 * Prevents XSS and HTML injection.
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;script&gt;/gi, '')
    .replace(/&lt;\/script&gt;/gi, '');
}

/**
 * Removes common script injection patterns
 */
export function stripScriptPatterns(value: string): string {
  return value
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["']?[^"'\s>]+/gi, '')
    .replace(/data:\s*text\/html/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/expression\s*\(/gi, '');
}

/**
 * Removes control characters (except newlines and tabs) to prevent
 * binary/malformed input injection
 */
export function stripControlChars(value: string): string {
  // Remove control characters (except newlines and tabs) to prevent
  // binary/malformed input injection
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Trims and truncates a string field to maxLength.
 * Returns empty string for null/undefined inputs.
 */
export function sanitizeField(value: unknown, maxLength: number = MAX_FIELD_LENGTH): string {
  if (typeof value !== 'string') return '';
  return stripControlChars(stripScriptPatterns(stripHtml(value.trim()))).slice(0, maxLength);
}

/**
 * Sanitizes longer text content (descriptions, summaries)
 */
export function sanitizeText(value: unknown, maxLength: number = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string') return '';
  return stripControlChars(stripScriptPatterns(stripHtml(value.trim()))).slice(0, maxLength);
}

/**
 * Validates an email address format
 */
export function isValidEmail(value: string): boolean {
  if (!value) return true; // optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) && value.length <= 254;
}

/**
 * Validates a phone number (basic — allows international formats)
 */
export function isValidPhone(value: string): boolean {
  if (!value) return true; // optional field
  // Allow +, digits, spaces, hyphens, parentheses — max 20 chars
  const cleaned = value.replace(/[\s\-\(\)]/g, '');
  return /^\+?\d{5,20}$/.test(cleaned);
}

/**
 * Sanitizes an array field
 */
export function sanitizeArray<T>(
  value: unknown,
  validator: (item: unknown) => item is T,
): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(validator);
}

/**
 * Sanitizes an object field with a schema-like approach
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  value: unknown,
  sanitizers: Record<keyof T, (v: unknown) => T[keyof T]>,
): Partial<T> {
  if (!value || typeof value !== 'object') return {};
  const obj = value as Record<string, unknown>;
  const result: Partial<T> = {};
  for (const key of Object.keys(sanitizers) as Array<keyof T>) {
    const sanitizer = sanitizers[key];
    result[key] = sanitizer(obj[key as string]);
  }
  return result;
}

export { MAX_FIELD_LENGTH, MAX_TEXT_LENGTH };
