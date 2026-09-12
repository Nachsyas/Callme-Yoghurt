import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSecurityHeaders, buildContentSecurityPolicy } from '../../src/lib/security/headers.ts';

describe('Security Headers Baseline (Gate 0B)', () => {
  it('includes conservative Content-Security-Policy with frame-ancestors none', () => {
    const headers = getSecurityHeaders(false);
    const csp = headers.find((h) => h.key === 'Content-Security-Policy');

    assert.ok(csp, 'Content-Security-Policy header must be present');
    assert.ok(csp.value.includes("frame-ancestors 'none'"), 'CSP must forbid iframe embedding via frame-ancestors none');
    assert.ok(csp.value.includes("default-src 'self'"), 'CSP default-src must be restricted to self');
    assert.ok(csp.value.includes("object-src 'none'"), 'CSP object-src must be none');
    assert.ok(csp.value.includes("base-uri 'self'"), 'CSP base-uri must be self');
  });

  it('adapts CSP script policy safely between development and production', () => {
    const devCsp = buildContentSecurityPolicy(false);
    const prodCsp = buildContentSecurityPolicy(true);

    assert.ok(devCsp.includes("'unsafe-eval'"), 'Dev CSP allows eval for React Fast Refresh/HMR');
    assert.ok(!prodCsp.includes("'unsafe-eval'"), 'Prod CSP forbids unsafe-eval');
    assert.ok(prodCsp.includes("'self' 'unsafe-inline'"), 'Prod CSP allows self and inline scripts for Next.js hydration');
  });

  it('includes mandatory baseline headers: nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options', () => {
    const headers = getSecurityHeaders(false);
    const headerMap = new Map(headers.map((h) => [h.key, h.value]));

    assert.equal(headerMap.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(headerMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.equal(headerMap.get('X-Frame-Options'), 'DENY');

    const permissions = headerMap.get('Permissions-Policy');
    assert.ok(permissions, 'Permissions-Policy must be present');
    assert.ok(permissions.includes('camera=()'));
    assert.ok(permissions.includes('microphone=()'));
    assert.ok(permissions.includes('geolocation=()'));
  });

  it('omits Strict-Transport-Security in development but enforces it in production', () => {
    const devHeaders = getSecurityHeaders(false);
    const devHsts = devHeaders.find((h) => h.key === 'Strict-Transport-Security');
    assert.equal(devHsts, undefined, 'HSTS must not be sent on non-production HTTP environments');

    const prodHeaders = getSecurityHeaders(true);
    const prodHsts = prodHeaders.find((h) => h.key === 'Strict-Transport-Security');
    assert.ok(prodHsts, 'HSTS must be present in production');
    assert.ok(prodHsts.value.includes('max-age=63072000'));
    assert.ok(prodHsts.value.includes('includeSubDomains'));
    assert.ok(prodHsts.value.includes('preload'));
  });
});
