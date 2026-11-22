-- ==============================================================================
-- Callme Yoghurt — Admin Audit Log & Rate Limit Verification (Post Load Test)
-- ==============================================================================
-- Invariants:
-- 1. All failed and successful login attempts are audited with timestamp & IP.
-- 2. No plaintext passwords, password hashes, or session secrets appear in logs.
-- 3. Account lockout events are audited when thresholds (>= 5 failures) are breached.

-- 1. Count Total Audited Login Events During Load Test Window
SELECT 
    action,
    COUNT(*) AS event_count,
    MIN(created_at) AS first_event,
    MAX(created_at) AS last_event
FROM admin_audit_logs
GROUP BY action
ORDER BY event_count DESC;
-- EXPECTED: Rows with actions 'LOGIN_FAILURE', 'ACCOUNT_LOCKED', or 'LOGIN_SUCCESS'.

-- 2. Audit Verification: Assert Zero Password or Token Leakage in Details JSON
SELECT 
    id,
    action,
    details
FROM admin_audit_logs
WHERE details::text ILIKE '%password%'
   OR details::text ILIKE '%secret%'
   OR details::text ILIKE '%token%';
-- EXPECTED: 0 rows returned (Audit payloads must NEVER store sensitive credentials).

-- 3. Verify Locked Admin Accounts Match High-Failure Audits
SELECT 
    u.id AS admin_user_id,
    u.email,
    u.failed_login_attempts,
    u.locked_until,
    COUNT(l.id) AS recorded_failures
FROM admin_users u
LEFT JOIN admin_audit_logs l ON l.admin_user_id = u.id AND l.action = 'LOGIN_FAILURE'
WHERE u.locked_until IS NOT NULL AND u.locked_until > NOW()
GROUP BY u.id, u.email, u.failed_login_attempts, u.locked_until;
-- EXPECTED: High-failure accounts show locked_until in the future with corresponding audit records.
