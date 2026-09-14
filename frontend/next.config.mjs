/**
 * Canonical Security Headers Configuration for Next.js (Gate 0B.1 Hardening).
 */
const isProduction = process.env.NODE_ENV === 'production';

const scriptSrc = isProduction
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
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
    ].join('; '),
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

// HSTS requires explicit deployment configuration (ENABLE_HSTS=true)
// includeSubDomains and preload are separate explicit opt-ins.
if (process.env.ENABLE_HSTS === 'true') {
  const hstsDirectives = ['max-age=63072000'];

  if (process.env.HSTS_INCLUDE_SUBDOMAINS === 'true') {
    hstsDirectives.push('includeSubDomains');
  }

  if (process.env.HSTS_PRELOAD === 'true') {
    hstsDirectives.push('preload');
  }

  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: hstsDirectives.join('; '),
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
