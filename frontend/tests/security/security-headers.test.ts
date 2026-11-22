import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSecurityHeaders,
  buildContentSecurityPolicy,
  buildHstsHeader,
} from '../../src/lib/security/headers.ts';

describe('Security Headers Baseline & HSTS Hardening (Gate 0B.1)', () => {
  it('includes conservative Content-Security-Policy with frame-ancestors none', () => {
    const headers = getSecurityHeaders({ isProduction: false });
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
    const headers = getSecurityHeaders({ isProduction: false });
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

  describe('HSTS Hardening Invariants', () => {
    it('omits HSTS in development by default', () => {
      const devHeaders = getSecurityHeaders({ isProduction: false });
      const devHsts = devHeaders.find((h) => h.key === 'Strict-Transport-Security');
      assert.equal(devHsts, undefined, 'Development must not emit HSTS by default');
    });

    it('omits HSTS in production without explicit opt-in', () => {
      const prodHeaders = getSecurityHeaders({
        isProduction: true,
        hsts: { enabled: false },
      });
      const prodHsts = prodHeaders.find((h) => h.key === 'Strict-Transport-Security');
      assert.equal(prodHsts, undefined, 'Production must NOT emit HSTS without deliberate opt-in');
    });

    it('emits conservative HSTS max-age only when deliberately enabled', () => {
      const headers = getSecurityHeaders({
        isProduction: true,
        hsts: { enabled: true, includeSubDomains: false, preload: false },
      });
      const hsts = headers.find((h) => h.key === 'Strict-Transport-Security');
      assert.ok(hsts, 'HSTS header must be present when explicitly enabled');
      assert.equal(hsts.value, 'max-age=63072000');
      assert.ok(!hsts.value.includes('includeSubDomains'), 'Must not include includeSubDomains without opt-in');
      assert.ok(!hsts.value.includes('preload'), 'Must not include preload without opt-in');
    });

    it('includes includeSubDomains only when explicitly opted in', () => {
      const hstsValue = buildHstsHeader({
        enabled: true,
        includeSubDomains: true,
        preload: false,
      });
      assert.ok(hstsValue?.includes('max-age=63072000'));
      assert.ok(hstsValue?.includes('includeSubDomains'));
      assert.ok(!hstsValue?.includes('preload'), 'Must not include preload when only includeSubDomains is opted in');
    });

    it('includes preload only when explicitly opted in', () => {
      const hstsValue = buildHstsHeader({
        enabled: true,
        includeSubDomains: true,
        preload: true,
      });
      assert.ok(hstsValue?.includes('max-age=63072000'));
      assert.ok(hstsValue?.includes('includeSubDomains'));
      assert.ok(hstsValue?.includes('preload'));
    });

    it('proves a default production build configuration never automatically produces preload', () => {
      const defaultProdHeader = buildHstsHeader({ enabled: false });
      assert.equal(defaultProdHeader, null);

      const baselineOptIn = buildHstsHeader({ enabled: true });
      assert.ok(baselineOptIn && !baselineOptIn.includes('preload'), 'Baseline opt-in must not include preload');
    });
  });
});
