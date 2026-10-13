from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
res1 = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'sales'")).fetchall()
res2 = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'sale_items'")).fetchall()
print("sales columns:", [r[0] for r in res1])
print("sale_items columns:", [r[0] for r in res2])

# Check stock balances
balances = db.execute(text("""
    SELECT p.sku, p.designation, w.code, w.name, sb.quantity, sb.reserved_quantity
    FROM stock_balances sb
    JOIN products p ON p.id = sb.product_id
    JOIN warehouses w ON w.id = sb.warehouse_id
    ORDER BY p.sku, w.code
""")).fetchall()
print("\nCurrent Stock Balances:")
for b in balances:
    print(f"  {b[0]} ({b[1]}) @ {b[2]} ({b[3]}): qty={b[4]}, reserved={b[5]}")

# Check stock movements
movements = db.execute(text("""
    SELECT sm.id, sm.created_at, p.sku, w.code, sm.movement_type, sm.quantity, sm.reference_type, sm.reference_id
    FROM stock_movements sm
    JOIN products p ON p.id = sm.product_id
    JOIN warehouses w ON w.id = sm.warehouse_id
    ORDER BY sm.id DESC
    LIMIT 20
""")).fetchall()
print("\nRecent Stock Movements:")
for m in movements:
    print(f"  ID={m[0]} [{m[1]}] {m[2]} @ {m[3]}: type={m[4]}, qty={m[5]}, ref_type={m[6]}, ref_id={m[7]}")
