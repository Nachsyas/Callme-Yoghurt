/**
 * Canonical Security Headers Configuration for Next.js (Gate 0B.1 Hardening).
 * 
 * Complies with Gate 0B.1 baseline requirements:
 * - Content-Security-Policy (with frame-ancestors 'none')
 * - X-Content-Type-Options (nosniff)
 * - Referrer-Policy (strict-origin-when-cross-origin)
 * - Permissions-Policy (restricts camera, microphone, geolocation, etc.)
 * - Strict-Transport-Security (HSTS: disabled by default, requires explicit opt-in;
 *   includeSubDomains and preload are separate explicit opt-ins)
 * - X-Frame-Options (DENY for legacy browsers)
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

export interface HstsOptions {
  enabled?: boolean;
  includeSubDomains?: boolean;
  preload?: boolean;
  maxAge?: number;
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

export function buildHstsHeader(options: HstsOptions = {}): string | null {
  if (!options.enabled) {
    return null;
  }

  const maxAge = options.maxAge ?? 63072000;
  const directives = [`max-age=${maxAge}`];

  if (options.includeSubDomains) {
    directives.push('includeSubDomains');
  }

  if (options.preload) {
    directives.push('preload');
  }

  return directives.join('; ');
}

export interface GetSecurityHeadersOptions {
  isProduction?: boolean;
  hsts?: HstsOptions;
}

export function getSecurityHeaders(options: GetSecurityHeadersOptions = {}): SecurityHeader[] {
  const isProduction = options.isProduction ?? (process.env.NODE_ENV === 'production');

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

  // HSTS requires explicit opt-in (ENABLE_HSTS=true); never automatic by default
  const hstsEnabled = options.hsts?.enabled ?? (process.env.ENABLE_HSTS === 'true');
  const hstsIncludeSubdomains = options.hsts?.includeSubDomains ?? (process.env.HSTS_INCLUDE_SUBDOMAINS === 'true');
  const hstsPreload = options.hsts?.preload ?? (process.env.HSTS_PRELOAD === 'true');

  const hstsValue = buildHstsHeader({
    enabled: hstsEnabled,
    includeSubDomains: hstsIncludeSubdomains,
    preload: hstsPreload,
  });

  if (hstsValue) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: hstsValue,
    });
  }

  return headers;
}
