import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateDeploymentEnv,
  validateStorefrontEnv,
  validateAdminEnv,
} from "../../src/lib/env-validator.ts";

describe("Deployment Environment Validation (Phase 1.2D)", () => {
  describe("Storefront Mode Requirements", () => {
    it("passes validation when all required storefront variables are present", () => {
      const mockEnv = {
        NEXT_PUBLIC_APP_MODE: "storefront",
        ERP_INTERNAL_URL: "https://erp.staging.internal",
        ERP_SERVICE_TOKEN: "valid-service-token-secret-12345",
      };

      const result = validateStorefrontEnv(mockEnv, true);
      assert.equal(result.valid, true);
      assert.equal(result.mode, "storefront");
      assert.equal(result.missingVariables.length, 0);
    });

    it("identifies missing storefront variables", () => {
      const mockEnv = {
        NEXT_PUBLIC_APP_MODE: "storefront",
        // Missing ERP_INTERNAL_URL & ERP_SERVICE_TOKEN
      };

      const result = validateDeploymentEnv({
        mode: "storefront",
        env: mockEnv,
        strict: false,
      });

      assert.equal(result.valid, false);
      assert.deepEqual(result.missingVariables.sort(), ["ERP_INTERNAL_URL", "ERP_SERVICE_TOKEN"].sort());
      assert.ok(result.error?.includes("ERP_INTERNAL_URL"));
      assert.ok(result.error?.includes("ERP_SERVICE_TOKEN"));
    });

    it("fails closed (throws error) in production when storefront secrets are missing", () => {
      const mockEnv = {
        NEXT_PUBLIC_APP_MODE: "storefront",
        ERP_INTERNAL_URL: "https://erp.staging.internal",
        // Missing ERP_SERVICE_TOKEN
      };

      assert.throws(
        () => validateStorefrontEnv(mockEnv, true),
        (err: Error) => {
          assert.ok(err.message.includes("ERP_SERVICE_TOKEN"));
          assert.ok(err.message.includes("SECURITY CRITICAL"));
          return true;
        }
      );
    });
  });

  describe("Admin Mode Requirements", () => {
    it("passes validation when all required admin variables are present", () => {
      const mockEnv = {
        NEXT_PUBLIC_APP_MODE: "admin",
        ERP_INTERNAL_URL: "https://erp.staging.internal",
        ADMIN_SESSION_SECRET: "high_entropy_admin_session_secret_32chars_minimum",
      };

      const result = validateAdminEnv(mockEnv, true);
      assert.equal(result.valid, true);
      assert.equal(result.mode, "admin");
      assert.equal(result.missingVariables.length, 0);
    });

    it("identifies missing admin session secret", () => {
      const mockEnv = {
        NEXT_PUBLIC_APP_MODE: "admin",
        ERP_INTERNAL_URL: "https://erp.staging.internal",
      };

      const result = validateDeploymentEnv({
        mode: "admin",
        env: mockEnv,
        strict: false,
      });

      assert.equal(result.valid, false);
      assert.deepEqual(result.missingVariables, ["ADMIN_SESSION_SECRET"]);
    });

    it("rejects weak / short admin session secret (<16 chars)", () => {
      const mockEnv = {
        NEXT_PUBLIC_APP_MODE: "admin",
        ERP_INTERNAL_URL: "https://erp.staging.internal",
        ADMIN_SESSION_SECRET: "tooshort",
      };

      const result = validateDeploymentEnv({
        mode: "admin",
        env: mockEnv,
        strict: false,
      });

      assert.equal(result.valid, false);
      assert.deepEqual(result.missingVariables, ["ADMIN_SESSION_SECRET"]);
    });

    it("fails closed (throws error) in production when admin secrets are missing", () => {
      const mockEnv = {
        NEXT_PUBLIC_APP_MODE: "admin",
        ERP_INTERNAL_URL: "https://erp.staging.internal",
        // Missing ADMIN_SESSION_SECRET
      };

      assert.throws(
        () => validateAdminEnv(mockEnv, true),
        (err: Error) => {
          assert.ok(err.message.includes("ADMIN_SESSION_SECRET"));
          assert.ok(err.message.includes("SECURITY CRITICAL"));
          return true;
        }
      );
    });
  });

  describe("Zero Secret Leakage Rules", () => {
    it("never includes actual secret values in error messages", () => {
      const sensitiveToken = "my-ultra-secret-service-token-that-must-never-leak-999";
      const sensitiveAdminSecret = "my-ultra-secret-admin-session-secret-key-8888";

      const mockEnv = {
        NEXT_PUBLIC_APP_MODE: "storefront",
        ERP_SERVICE_TOKEN: sensitiveToken,
        // ERP_INTERNAL_URL is missing
      };

      let thrownMessage = "";
      try {
        validateStorefrontEnv(mockEnv, true);
      } catch (err) {
        thrownMessage = (err as Error).message;
      }

      assert.ok(thrownMessage.length > 0);
      assert.ok(thrownMessage.includes("ERP_INTERNAL_URL"));
      // Assert secret values NEVER appear in the error message
      assert.ok(!thrownMessage.includes(sensitiveToken));
      assert.ok(!thrownMessage.includes(sensitiveAdminSecret));
    });

    it("rejects unknown application mode", () => {
      const mockEnv = {
        NEXT_PUBLIC_APP_MODE: "arbitrary-mode",
      };

      const result = validateDeploymentEnv({
        env: mockEnv,
        strict: false,
      });

      assert.equal(result.valid, false);
      assert.equal(result.mode, "unknown");
      assert.deepEqual(result.missingVariables, ["NEXT_PUBLIC_APP_MODE"]);
    });
  });
});
