-- ============================================================================
-- TEXTILE STORE MANAGEMENT SYSTEM - RELATIONAL DATABASE SCHEMA (3NF)
-- Database Engine: SQLite 3 / Compatible with PostgreSQL & MySQL (ANSI Standard)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Product Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fabric Types / Materials
CREATE TABLE IF NOT EXISTS fabric_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    composition TEXT NOT NULL,
    weave_type TEXT,
    care_instructions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Units of Measure (UOM)
CREATE TABLE IF NOT EXISTS uoms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    allows_decimal INTEGER DEFAULT 1, -- 1 for meters/yards, 0 for pieces/sarees
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Suppliers / Mills / Weavers
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_code TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    gstin TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    outstanding_payable REAL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Products (Fabrics, Garments, Materials)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    fabric_type_id INTEGER NOT NULL REFERENCES fabric_types(id) ON DELETE RESTRICT,
    uom_id INTEGER NOT NULL REFERENCES uoms(id) ON DELETE RESTRICT,
    hsn_code TEXT NOT NULL,
    tax_rate REAL NOT NULL DEFAULT 5.0,        -- GST rate % (e.g. 5, 12, 18)
    cost_price REAL NOT NULL CHECK(cost_price >= 0),
    selling_price REAL NOT NULL CHECK(selling_price >= 0),    -- Retail price
    wholesale_price REAL CHECK(wholesale_price >= 0),         -- Wholesale price
    width_inches REAL,                         -- Fabric width (e.g., 44, 54, 58)
    gsm REAL,                                  -- Grams per Square Meter
    color TEXT,
    pattern_design TEXT,                       -- e.g. Plain Solid, Printed, Jacquard, Embroidered
    current_stock REAL NOT NULL DEFAULT 0.00,  -- Real-time total stock
    min_stock_level REAL NOT NULL DEFAULT 10.0,-- Low stock warning threshold
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Product Fabric Rolls & Bales Tracking
CREATE TABLE IF NOT EXISTS product_rolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    roll_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    shade_lot_no TEXT,
    location_rack TEXT,                        -- e.g., "Rack A-3", "Aisle 2"
    initial_length REAL NOT NULL CHECK(initial_length > 0),
    current_length REAL NOT NULL CHECK(current_length >= 0),
    status TEXT NOT NULL CHECK(status IN ('FULL', 'IN_USE', 'EMPTY', 'DAMAGED')) DEFAULT 'FULL',
    received_date DATE NOT NULL DEFAULT (date('now')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Customers (Retail Walk-in, Wholesale B2B, Boutiques)
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    customer_type TEXT NOT NULL CHECK(customer_type IN ('RETAIL', 'WHOLESALE', 'BOUTIQUE', 'INSTITUTIONAL')) DEFAULT 'RETAIL',
    phone TEXT NOT NULL,
    email TEXT,
    gstin TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    credit_limit REAL NOT NULL DEFAULT 5000.00,
    current_balance REAL NOT NULL DEFAULT 0.00, -- Outstanding credit balance
    total_purchases REAL NOT NULL DEFAULT 0.00, -- Lifetime purchase total
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Supplier Purchases / Goods Received Note (GRN)
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    supplier_invoice_no TEXT,
    purchase_date DATE NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0.00,
    tax_amount REAL NOT NULL DEFAULT 0.00,
    discount_amount REAL NOT NULL DEFAULT 0.00,
    total_amount REAL NOT NULL DEFAULT 0.00,
    paid_amount REAL NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL CHECK(payment_status IN ('PAID', 'PARTIAL', 'PENDING')) DEFAULT 'PAID',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Purchase Line Items
CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
    tax_rate REAL NOT NULL DEFAULT 5.0,
    tax_amount REAL NOT NULL DEFAULT 0.00,
    total_cost REAL NOT NULL CHECK(total_cost >= 0)
);

-- 10. Sales Invoices / Point of Sale Billing
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    invoice_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invoice_type TEXT NOT NULL CHECK(invoice_type IN ('RETAIL', 'WHOLESALE', 'TAX_INVOICE')) DEFAULT 'RETAIL',
    subtotal REAL NOT NULL DEFAULT 0.00,
    total_discount REAL NOT NULL DEFAULT 0.00,
    taxable_amount REAL NOT NULL DEFAULT 0.00,
    cgst_amount REAL NOT NULL DEFAULT 0.00,
    sgst_amount REAL NOT NULL DEFAULT 0.00,
    igst_amount REAL NOT NULL DEFAULT 0.00,
    total_tax REAL NOT NULL DEFAULT 0.00,
    round_off REAL NOT NULL DEFAULT 0.00,
    grand_total REAL NOT NULL CHECK(grand_total >= 0),
    paid_amount REAL NOT NULL DEFAULT 0.00,
    balance_due REAL NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'UPI', 'CARD', 'CREDIT', 'SPLIT')) DEFAULT 'CASH',
    payment_status TEXT NOT NULL CHECK(payment_status IN ('PAID', 'PARTIAL', 'UNPAID', 'VOID')) DEFAULT 'PAID',
    salesperson_name TEXT DEFAULT 'Staff',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    roll_id INTEGER REFERENCES product_rolls(id) ON DELETE SET NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit_price REAL NOT NULL CHECK(unit_price >= 0),
    cost_price REAL NOT NULL DEFAULT 0.00,       -- Snapshot of cost price for exact margin calculation
    discount_percent REAL NOT NULL DEFAULT 0.00,
    discount_amount REAL NOT NULL DEFAULT 0.00,
    taxable_value REAL NOT NULL DEFAULT 0.00,
    tax_rate REAL NOT NULL DEFAULT 5.0,
    tax_amount REAL NOT NULL DEFAULT 0.00,
    total_amount REAL NOT NULL CHECK(total_amount >= 0)
);

-- 12. Inventory Stock Movement Audit Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    roll_id INTEGER REFERENCES product_rolls(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('PURCHASE', 'SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT')),
    reference_id TEXT NOT NULL,                 -- Invoice #, PO #, or Adjustment Code
    quantity_change REAL NOT NULL,              -- Negative for sale/damage, positive for purchase/return
    stock_after REAL NOT NULL,
    unit_cost REAL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Customer Payments & Khata Settlements
CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE')),
    transaction_ref TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_fabric ON products(fabric_type_id);
CREATE INDEX IF NOT EXISTS idx_product_rolls_product ON product_rolls(product_id);
CREATE INDEX IF NOT EXISTS idx_product_rolls_status ON product_rolls(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_trans_prod ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);

-- ============================================================================
-- DATABASE VIEWS (DENORMALIZED ANALYTICAL PERSPECTIVES)
-- ============================================================================

-- View: Real-Time Stock Status with Valuation and Alerts
CREATE VIEW IF NOT EXISTS v_stock_summary AS
SELECT 
    p.id AS product_id,
    p.sku,
    p.barcode,
    p.name AS product_name,
    c.name AS category_name,
    f.name AS fabric_name,
    f.composition,
    u.code AS uom_code,
    p.cost_price,
    p.selling_price,
    p.wholesale_price,
    p.tax_rate,
    p.current_stock,
    p.min_stock_level,
    ROUND(p.current_stock * p.cost_price, 2) AS total_inventory_cost,
    ROUND(p.current_stock * p.selling_price, 2) AS potential_retail_value,
    CASE 
        WHEN p.current_stock <= 0 THEN 'OUT_OF_STOCK'
        WHEN p.current_stock <= p.min_stock_level THEN 'LOW_STOCK'
        ELSE 'OPTIMAL'
    END AS stock_status,
    COUNT(DISTINCT r.id) AS active_rolls_count,
    COALESCE(SUM(CASE WHEN r.status IN ('FULL', 'IN_USE') THEN r.current_length ELSE 0 END), 0) AS rolls_total_length
FROM products p
JOIN categories c ON p.category_id = c.id
JOIN fabric_types f ON p.fabric_type_id = f.id
JOIN uoms u ON p.uom_id = u.id
LEFT JOIN product_rolls r ON p.id = r.product_id AND r.status IN ('FULL', 'IN_USE')
WHERE p.is_active = 1
GROUP BY p.id;

-- View: Comprehensive Invoice Overview
CREATE VIEW IF NOT EXISTS v_invoice_details AS
SELECT 
    i.id AS invoice_id,
    i.invoice_number,
    i.invoice_date,
    i.invoice_type,
    c.customer_code,
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.customer_type,
    i.subtotal,
    i.total_discount,
    i.taxable_amount,
    i.total_tax,
    i.grand_total,
    i.paid_amount,
    i.balance_due,
    i.payment_method,
    i.payment_status,
    i.salesperson_name,
    COUNT(it.id) AS total_line_items,
    ROUND(SUM(it.quantity), 2) AS total_items_quantity,
    ROUND(SUM(it.total_amount - (it.quantity * it.cost_price)), 2) AS estimated_gross_profit
FROM invoices i
JOIN customers c ON i.customer_id = c.id
LEFT JOIN invoice_items it ON i.id = it.invoice_id
GROUP BY i.id;

-- View: Fabric Roll Inventory with Rack & Aging Days
CREATE VIEW IF NOT EXISTS v_roll_inventory AS
SELECT 
    r.id AS roll_id,
    r.roll_number,
    p.sku,
    p.name AS product_name,
    f.name AS fabric_name,
    s.company_name AS supplier_name,
    r.shade_lot_no,
    r.location_rack,
    r.initial_length,
    r.current_length,
    ROUND((r.current_length / r.initial_length) * 100, 1) AS remaining_percentage,
    r.status,
    r.received_date,
    CAST((julianday('now') - julianday(r.received_date)) AS INTEGER) AS age_days,
    CASE 
        WHEN (julianday('now') - julianday(r.received_date)) > 90 THEN 'DEAD_STOCK'
        WHEN (julianday('now') - julianday(r.received_date)) > 60 THEN 'SLOW_MOVING'
        ELSE 'FRESH_STOCK'
    END AS aging_category
FROM product_rolls r
JOIN products p ON r.product_id = p.id
JOIN fabric_types f ON p.fabric_type_id = f.id
LEFT JOIN suppliers s ON r.supplier_id = s.id;
