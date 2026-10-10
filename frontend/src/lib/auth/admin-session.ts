export type AdminRole = "OWNER" | "ADMIN";

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: AdminRole;
}

export interface AdminSession {
  user: AdminUser;
  expiresAt: number; // Unix timestamp in seconds
  issuedAt: number;  // Unix timestamp in seconds
}

export const ADMIN_COOKIE_NAME = "callme_admin_session";

const DEV_FALLBACK_SECRET = "dev_insecure_admin_session_secret_32chars_min";

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function getAdminSessionSecret(secretOverride?: string): string {
  if (secretOverride && secretOverride.trim().length >= 16) {
    return secretOverride.trim();
  }

  const envSecret = process.env.ADMIN_SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    // SECURITY INVARIANT: Production MUST fail closed if session secret is missing
    throw new Error(
      "SECURITY CRITICAL: ADMIN_SESSION_SECRET is unconfigured in production. Failing closed."
    );
  }

  return DEV_FALLBACK_SECRET;
}

/**
 * Universal Base64URL encoding (Edge runtime & Web standards compatible)
 */
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function signPayload(encodedPayload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(encodedPayload)
  );

  const bytes = new Uint8Array(signatureBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Creates a signed admin session token using standard Web Crypto API.
 */
export async function createAdminSessionToken(
  user: AdminUser,
  secretOverride?: string,
  ttlSeconds: number = 86400
): Promise<string> {
  const secret = getAdminSessionSecret(secretOverride);
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    issuedAt: now,
    expiresAt: now + ttlSeconds,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies an admin session token using standard Web Crypto API.
 *
 * Rules:
 * - Signature must be cryptographically valid (HMAC-SHA256).
 * - Expiration must be in the future.
 * - Role must be strictly OWNER or ADMIN (customer roles fail closed).
 * - Malformed, tampered, or expired tokens return null.
 */
export async function verifyAdminSession(
  token: string,
  secretOverride?: string
): Promise<AdminSession | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.trim().split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) {
    return null;
  }

  let secret: string;
  try {
    secret = getAdminSessionSecret(secretOverride);
  } catch {
    // Fail closed if production secret is missing
    return null;
  }

  try {
    const expectedSignature = await signPayload(encodedPayload, secret);
    if (!constantTimeCompare(signature, expectedSignature)) {
      return null;
    }

    const rawJson = base64UrlDecode(encodedPayload);
    const data = JSON.parse(rawJson);

    if (!data || typeof data !== "object") {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof data.expiresAt !== "number" || data.expiresAt <= now) {
      return null; // Expired session
    }

    if (typeof data.issuedAt !== "number") {
      return null;
    }

    const user = data.user;
    if (!user || typeof user !== "object") {
      return null;
    }

    if (
      typeof user.id !== "string" ||
      typeof user.username !== "string" ||
      typeof user.email !== "string"
    ) {
      return null;
    }

    // Role boundary: strictly OWNER or ADMIN. Any other role (e.g. CUSTOMER) is rejected.
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return null;
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      expiresAt: data.expiresAt,
      issuedAt: data.issuedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies an admin session from incoming HTTP Request headers or cookies.
 */
export async function getAdminSessionFromRequest(
  request: Request,
  secretOverride?: string
): Promise<AdminSession | null> {
  // 1. Check Authorization Bearer header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const session = await verifyAdminSession(token, secretOverride);
    if (session) return session;
  }

  // 2. Check Cookie header
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(`${ADMIN_COOKIE_NAME}=`)) {
        const token = cookie.slice(ADMIN_COOKIE_NAME.length + 1).trim();
        const session = await verifyAdminSession(token, secretOverride);
        if (session) return session;
      }
    }
  }

  return null;
}
