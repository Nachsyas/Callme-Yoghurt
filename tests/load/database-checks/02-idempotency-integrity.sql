-- ==============================================================================
-- Callme Yoghurt — Idempotency & Order Integrity Verification (Post Load Test)
-- ==============================================================================
-- Invariants:
-- 1. Unique order per idempotency key (no duplicate orders linked to one key hash).
-- 2. Unique order numbers globally (no duplicate order numbers generated under load).
-- 3. Every confirmed order possesses matching order lines and stock reservations.

-- 1. Check for Duplicate Orders Linked to the Same Idempotency Key Hash
SELECT 
    idempotency_key_hash,
    COUNT(order_id) AS order_count
FROM checkout_idempotency_keys
WHERE order_id IS NOT NULL
GROUP BY idempotency_key_hash
HAVING COUNT(order_id) > 1;
-- EXPECTED: 0 rows returned (Each idempotency key must map to at most 1 distinct order).

-- 2. Verify Order Number Uniqueness across All Orders
SELECT 
    order_number,
    COUNT(*) AS duplicates
FROM orders
GROUP BY order_number
HAVING COUNT(*) > 1;
-- EXPECTED: 0 rows returned (Order numbers must be globally unique without collision).

-- 3. Check for Orphan Order Lines (Lines pointing to non-existent Orders)
SELECT 
    ol.id AS order_line_id,
    ol.order_id
FROM order_lines ol
LEFT JOIN orders o ON o.id = ol.order_id
WHERE o.id IS NULL;
-- EXPECTED: 0 rows returned.

-- 4. Verify Total Order Line Quantities Match Active Reservations
SELECT 
    o.id AS order_id,
    o.order_number,
    SUM(ol.quantity) AS total_ordered_units,
    COALESCE(SUM(r.quantity), 0) AS total_reserved_units
FROM orders o
JOIN order_lines ol ON ol.order_id = o.id
LEFT JOIN stock_reservations r ON r.order_id = o.id AND r.status = 'RESERVED'
WHERE o.status = 'CONFIRMED'
GROUP BY o.id, o.order_number
HAVING SUM(ol.quantity) <> COALESCE(SUM(r.quantity), 0);
-- EXPECTED: 0 rows returned (Every confirmed order must have matching reserved stock).
