-- ==============================================================================
-- Callme Yoghurt — Inventory Consistency Verification (Post Load Test)
-- ==============================================================================
-- Invariants:
-- 1. No negative stock balances across any warehouse / item.
-- 2. Reservations match allocations exactly.
-- 3. Ledger remains strictly append-only (no deletions/updates).
-- 4. FEFO validity: No active allocations assigned to expired lots.

-- 1. Check for Negative Stock Balances across all Warehouses and Items
SELECT 
    warehouse_id,
    inventory_item_id,
    SUM(quantity) AS current_on_hand_stock
FROM stock_ledger_entries
GROUP BY warehouse_id, inventory_item_id
HAVING SUM(quantity) < 0;
-- EXPECTED: 0 rows returned (Negative stock is strictly impossible).

-- 2. Verify Active Reservations Match Total Lot Allocations
SELECT 
    r.id AS reservation_id,
    r.quantity AS reserved_quantity,
    COALESCE(SUM(a.quantity), 0) AS allocated_quantity,
    (r.quantity - COALESCE(SUM(a.quantity), 0)) AS quantity_discrepancy
FROM stock_reservations r
LEFT JOIN stock_allocations a ON a.stock_reservation_id = r.id
WHERE r.status = 'RESERVED'
GROUP BY r.id, r.quantity
HAVING r.quantity <> COALESCE(SUM(a.quantity), 0);
-- EXPECTED: 0 rows returned (Every active reservation must have exactly balanced allocations).

-- 3. Verify No Orphan Allocations Exist Without a Valid Reservation
SELECT 
    a.id AS allocation_id,
    a.stock_reservation_id,
    a.quantity
FROM stock_allocations a
LEFT JOIN stock_reservations r ON r.id = a.stock_reservation_id
WHERE r.id IS NULL;
-- EXPECTED: 0 rows returned (Orphan allocations violate foreign key and transaction invariants).

-- 4. Verify FEFO Invariant: No Active Allocations to Expired Lots
SELECT 
    a.id AS allocation_id,
    l.lot_number,
    l.expiration_date,
    NOW() AS current_timestamp
FROM stock_allocations a
JOIN lots l ON l.id = a.lot_id
JOIN stock_reservations r ON r.id = a.stock_reservation_id
WHERE r.status = 'RESERVED'
  AND l.expiration_date IS NOT NULL
  AND l.expiration_date < CURRENT_DATE;
-- EXPECTED: 0 rows returned (FEFO strictly prohibits allocating expired yogurt batches).
