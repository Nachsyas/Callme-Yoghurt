/**
 * Callme Yoghurt — Vercel Staging Deployment Environment Validator (Phase 1.2D)
 *
 * Rules & Invariants:
 * 1. End-to-End Type Safety: Zero `any` types.
 * 2. Zero-Trust Security: Production environments fail closed if required secrets are unconfigured.
 * 3. Zero Secret Leakage: Error messages and logs must strictly mention missing variable names, NEVER values.
 */

export type DeploymentAppMode = "storefront" | "admin";

export interface EnvValidationResult {
  valid: boolean;
  mode: DeploymentAppMode | "unknown";
  missingVariables: string[];
  error?: string;
}

export interface ValidateEnvOptions {
  mode?: DeploymentAppMode;
  env?: Record<string, string | undefined>;
  isProduction?: boolean;
  strict?: boolean;
}

const REQUIRED_STOREFRONT_VARS = [
  "NEXT_PUBLIC_APP_MODE",
  "ERP_INTERNAL_URL",
  "ERP_SERVICE_TOKEN",
] as const;

const REQUIRED_ADMIN_VARS = [
  "NEXT_PUBLIC_APP_MODE",
  "ERP_INTERNAL_URL",
  "ADMIN_SESSION_SECRET",
] as const;

/**
 * Validates environment variables for Vercel deployment.
 *
 * In production (`NODE_ENV === "production"` or `isProduction: true`),
 * missing required variables fail closed by throwing a security exception
 * unless `strict: false` is explicitly passed.
 */
export function validateDeploymentEnv(options?: ValidateEnvOptions): EnvValidationResult {
  const env = options?.env ?? process.env;
  const isProduction =
    options?.isProduction ??
    (env.NODE_ENV === "production" || process.env.NODE_ENV === "production");
  const strict = options?.strict ?? isProduction;

  // Determine application mode
  const rawMode = options?.mode ?? env.NEXT_PUBLIC_APP_MODE;
  const mode: DeploymentAppMode | "unknown" =
    rawMode === "storefront" || rawMode === "admin" ? rawMode : "unknown";

  const missingVariables: string[] = [];

  if (mode === "unknown") {
    missingVariables.push("NEXT_PUBLIC_APP_MODE");
    const errorMsg =
      "SECURITY CRITICAL: NEXT_PUBLIC_APP_MODE must be set to 'storefront' or 'admin'.";
    if (strict) {
      throw new Error(errorMsg);
    }
    return {
      valid: false,
      mode: "unknown",
      missingVariables,
      error: errorMsg,
    };
  }

  const requiredVars =
    mode === "storefront" ? REQUIRED_STOREFRONT_VARS : REQUIRED_ADMIN_VARS;

  for (const varName of requiredVars) {
    const val = env[varName];
    if (!val || val.trim().length === 0) {
      missingVariables.push(varName);
    }
  }

  // Admin secret specific length requirement (min 16 chars)
  if (mode === "admin" && !missingVariables.includes("ADMIN_SESSION_SECRET")) {
    const secret = env.ADMIN_SESSION_SECRET;
    if (secret && secret.trim().length < 16) {
      missingVariables.push("ADMIN_SESSION_SECRET");
    }
  }

  const valid = missingVariables.length === 0;

  if (!valid) {
    const errorMsg = `SECURITY CRITICAL: Missing required environment variable(s) for ${mode}: ${missingVariables.join(
      ", "
    )}`;
    if (strict) {
      throw new Error(errorMsg);
    }
    return {
      valid: false,
      mode,
      missingVariables,
      error: errorMsg,
    };
  }

  return {
    valid: true,
    mode,
    missingVariables: [],
  };
}

export function validateStorefrontEnv(
  env?: Record<string, string | undefined>,
  isProduction?: boolean
): EnvValidationResult {
  return validateDeploymentEnv({
    mode: "storefront",
    env,
    isProduction,
  });
}

export function validateAdminEnv(
  env?: Record<string, string | undefined>,
  isProduction?: boolean
): EnvValidationResult {
  return validateDeploymentEnv({
    mode: "admin",
    env,
    isProduction,
  });
}
