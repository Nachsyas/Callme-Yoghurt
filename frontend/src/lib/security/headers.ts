/**
 * Canonical Security Headers Configuration for Next.js.
 * 
 * Complies with Gate 0B baseline requirements:
 * - Content-Security-Policy (with frame-ancestors 'none')
 * - X-Content-Type-Options (nosniff)
 * - Referrer-Policy (strict-origin-when-cross-origin)
 * - Permissions-Policy (restricts camera, microphone, geolocation, etc.)
 * - Strict-Transport-Security (HSTS, enabled only in production HTTPS)
 * - X-Frame-Options (DENY for legacy browsers)
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

export function buildContentSecurityPolicy(isProduction: boolean): string {
  // Conservative baseline allowing Next.js hydration and static assets
  const scriptSrc = isProduction
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

export function getSecurityHeaders(isProduction = process.env.NODE_ENV === 'production'): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy(isProduction),
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
  ];

  // HSTS is only appropriate for production HTTPS environments
  if (isProduction || process.env.ENABLE_HSTS === 'true') {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}
