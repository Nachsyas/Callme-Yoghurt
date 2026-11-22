/**
 * Callme Yoghurt — Vercel Staging Deployment Environment Validator (Phase 1.2D)
 *
 * Rules & Invariants:
 * 1. End-to-End Type Safety: Zero `any` types.
 * 2. Zero-Trust Security: Production environments fail closed if required secrets are unconfigured.
 * 3. Zero Secret Leakage: Error messages and logs must strictly mention missing variable names, NEVER values.
 */

export type DeploymentAppRole = "storefront" | "admin";
export type DeploymentAppMode = DeploymentAppRole;

export interface EnvValidationResult {
  valid: boolean;
  mode: DeploymentAppMode | "unknown";
  role?: DeploymentAppRole | "unknown";
  missingVariables: string[];
  error?: string;
}

export interface ValidateEnvOptions {
  mode?: DeploymentAppMode;
  role?: DeploymentAppRole;
  env?: Record<string, string | undefined>;
  isProduction?: boolean;
  strict?: boolean;
}

export interface ResolvedDeploymentRole {
  role: DeploymentAppRole | "both" | null;
  isValid: boolean;
  error?: string;
}

/**
 * Normalizes and resolves deployment role authority.
 *
 * Requirements (Phase 1.7C.22A):
 * 1. APP_DEPLOYMENT_ROLE is mandatory for production deployment.
 * 2. NEXT_PUBLIC_APP_MODE cannot serve as production security authority.
 * 3. Contradictory role variables fail closed immediately.
 * 4. Invalid or missing role in production fails closed.
 * 5. Safe non-production development configuration is preserved.
 */
export function resolveDeploymentRole(
  env: Record<string, string | undefined> = process.env
): ResolvedDeploymentRole {
  const isProduction =
    env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
  const sanitize = (val?: string) => {
    if (!val) return undefined;
    const trimmed = val.trim();
    return trimmed === "" || trimmed === "undefined" ? undefined : trimmed;
  };

  const appDeploymentRole = sanitize(env.APP_DEPLOYMENT_ROLE);
  const nextPublicMode = sanitize(env.NEXT_PUBLIC_APP_MODE);

  const isConcreteRole = (r?: string): r is DeploymentAppRole =>
    r === "storefront" || r === "admin";

  // Contradiction detection: if both define concrete opposing roles, fail closed immediately
  if (
    isConcreteRole(appDeploymentRole) &&
    isConcreteRole(nextPublicMode) &&
    appDeploymentRole !== nextPublicMode
  ) {
    return {
      role: null,
      isValid: false,
      error: "SECURITY CRITICAL: APP_DEPLOYMENT_ROLE and NEXT_PUBLIC_APP_MODE contradict each other.",
    };
  }

  if (isProduction) {
    if (!appDeploymentRole) {
      return {
        role: null,
        isValid: false,
        error: "SECURITY CRITICAL: APP_DEPLOYMENT_ROLE is mandatory in production.",
      };
    }
    if (appDeploymentRole !== "storefront" && appDeploymentRole !== "admin") {
      return {
        role: null,
        isValid: false,
        error: `SECURITY CRITICAL: Invalid APP_DEPLOYMENT_ROLE '${appDeploymentRole}' in production.`,
      };
    }
    return {
      role: appDeploymentRole,
      isValid: true,
    };
  }

  // Development / test environment fallback
  if (isConcreteRole(appDeploymentRole)) {
    return {
      role: appDeploymentRole,
      isValid: true,
    };
  }

  if (isConcreteRole(nextPublicMode)) {
    return {
      role: nextPublicMode,
      isValid: true,
    };
  }

  if (nextPublicMode === "both" || (!appDeploymentRole && !nextPublicMode)) {
    return {
      role: "both",
      isValid: true,
    };
  }

  return {
    role: null,
    isValid: false,
    error: "Development deployment role unconfigured or invalid.",
  };
}

/**
 * Returns authoritative server-side deployment role, prioritizing APP_DEPLOYMENT_ROLE
 * over client-facing NEXT_PUBLIC_APP_MODE.
 */
export function getDeploymentRole(
  env: Record<string, string | undefined> = process.env
): DeploymentAppRole | "both" | "unknown" {
  const resolved = resolveDeploymentRole(env);
  return resolved.isValid && resolved.role ? resolved.role : "unknown";
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

  // Determine application mode / role
  const resolved = resolveDeploymentRole(env);

  // If both are defined but contradict each other, fail closed
  if (!resolved.isValid && resolved.error?.includes("contradict")) {
    const conflictMsg = resolved.error;
    if (strict) {
      throw new Error(conflictMsg);
    }
    return {
      valid: false,
      mode: "unknown",
      role: "unknown",
      missingVariables: ["APP_DEPLOYMENT_ROLE"],
      error: conflictMsg,
    };
  }

  const rawMode =
    options?.role ??
    options?.mode ??
    resolved.role ??
    env.APP_DEPLOYMENT_ROLE ??
    env.NEXT_PUBLIC_APP_MODE;
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
      role: "unknown",
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
      role: mode,
      missingVariables,
      error: errorMsg,
    };
  }

  return {
    valid: true,
    mode,
    role: mode,
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
