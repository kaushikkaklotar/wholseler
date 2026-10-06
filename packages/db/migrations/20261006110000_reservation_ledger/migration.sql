-- Holds change allocation, not physical stock. Keep strict movement signs and balances.
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_valid_quantity";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_valid_quantity" CHECK (
  "balanceAfter" >= 0 AND "reservedAfter" >= 0 AND "reservedAfter" <= "balanceAfter"
  AND (
    (type = 'RESERVATION' AND quantity = 0 AND "reservedDelta" > 0)
    OR (type = 'RELEASE' AND quantity = 0 AND "reservedDelta" < 0)
    OR (type NOT IN ('RESERVATION', 'RELEASE') AND quantity <> 0)
  )
);
