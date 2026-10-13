-- ============================================================================
-- TEXTILE STORE MANAGEMENT SYSTEM - RICH SEED DATA
-- ============================================================================

-- Categories
INSERT INTO categories (code, name, description) VALUES
('CAT-COT', 'Cotton & Cambric', 'Natural pure cottons, organic cotton, cambric, and muslins'),
('CAT-SLK', 'Pure Silks & Handlooms', 'Banarasi, Katan, Tussar, Mulberry, and raw handwoven silks'),
('CAT-SUI', 'Suiting & Shirting', 'Premium men suitings, blazers, trouserings, and executive shirting'),
('CAT-LIN', 'Pure & Blended Linens', 'European flax linens, Irish linen weaves, and linen-cotton blends'),
('CAT-GEO', 'Georgette & Chiffons', 'Lightweight flowing georgettes, viscose chiffon, and moss crepes'),
('CAT-VEL', 'Velvets & Brocades', 'Micro velvet 9000, metallic brocade, and heavy festive jacquards'),
('CAT-DEN', 'Denim & Heavy Twills', 'Indigo ring-spun denim, washed stretch twills, and heavy drills'),
('CAT-ETH', 'Sarees & Ethnic Unstitched', 'Designer unstitched salwar suits, lehenga fabrics, and sarees');

-- Fabric Types
INSERT INTO fabric_types (code, name, composition, weave_type, care_instructions) VALUES
('FAB-COT-60', 'Pure Cotton Cambric 60s', '100% Combed Cotton', 'Plain Weave 60x60', 'Machine wash cold, steam iron'),
('FAB-SLK-BAN', 'Banarasi Katan Silk', '100% Pure Silk with Zari', 'Brocade Jacquard', 'Dry clean only, wrap in muslin'),
('FAB-RAY-SUI', 'Raymond Poly-Viscose Trovi', '65% Polyester, 35% Viscose', 'Twill Weave 2/2', 'Dry clean recommended, mild iron'),
('FAB-LIN-80', 'Belgian Pure Linen 80 Lea', '100% Flax Linen', 'Plain Weave Crisp', 'Gentle hand wash or dry clean'),
('FAB-GEO-VIS', 'Viscose Georgette 60g', '100% Viscose Rayon', 'Crepe Twisted Weave', 'Hand wash cold or dry clean'),
('FAB-VEL-9K', 'Micro Velvet 9000', '95% Polyester, 5% Spandex', 'Cut Pile Knit', 'Dry clean only, steam from back'),
('FAB-DEN-12', 'Indigo Denim Twill 12oz', '98% Cotton, 2% Spandex', '3/1 Right Hand Twill', 'Wash inside out in cold water'),
('FAB-CHIK-LUC', 'Lucknowi Embroidered Chanderi', '70% Cotton, 30% Silk', 'Hand Embroidered Chanderi', 'Gentle dry clean only');

-- Units of Measure
INSERT INTO uoms (code, name, allows_decimal) VALUES
('MTR', 'Meters', 1),
('YD', 'Yards', 1),
('PCS', 'Pieces', 0),
('ROLL', 'Full Rolls', 0),
('SET', 'Suits / Sets', 0);

-- Suppliers
INSERT INTO suppliers (supplier_code, company_name, contact_person, phone, email, gstin, address, city, state, outstanding_payable) VALUES
('SUP-001', 'Arvind Mills Ltd', 'Rajesh Sharma', '+91 98250 11223', 'orders@arvindmills.com', '24AAACA1234F1Z8', 'Naroda Road Textile Hub', 'Ahmedabad', 'Gujarat', 24500.00),
('SUP-002', 'Banaras Weavers Guild', 'Mukesh Kasera', '+91 94152 44332', 'sales@banarasweavers.in', '09AABCB5678G1Z2', 'Gowdowlia Silk Chowk', 'Varanasi', 'Uttar Pradesh', 18200.00),
('SUP-003', 'Raymond Lifestyle Ltd', 'Sunil Mehta', '+91 98200 99887', 'corporate@raymond.in', '27AABCR9999K1Z5', 'Pokhran Road No 1', 'Thane', 'Maharashtra', 0.00),
('SUP-004', 'Kolkata Linen Importers', 'Debashis Roy', '+91 98310 55664', 'contact@kolkatalinen.com', '19AABCK3344M1Z9', 'Burrabazar Market', 'Kolkata', 'West Bengal', 12000.00),
('SUP-005', 'Surat Jacquard Creations', 'Dinesh Patel', '+91 98980 77665', 'dinesh@suratjacquard.com', '24AABCS8877P1Z3', 'Ring Road Textile Market', 'Surat', 'Gujarat', 31500.00);

-- Products
INSERT INTO products (sku, barcode, name, category_id, fabric_type_id, uom_id, hsn_code, tax_rate, cost_price, selling_price, wholesale_price, width_inches, gsm, color, pattern_design, current_stock, min_stock_level) VALUES
('TEX-COT-001', '8901001001', 'Premium Supima White Cambric 60s', 1, 1, 1, '5208', 5.0, 160.00, 280.00, 220.00, 44.0, 110.0, 'Optical White', 'Solid Plain', 145.50, 30.0),
('TEX-COT-002', '8901001002', 'Floral Handblock Printed Mulmul', 1, 1, 1, '5208', 5.0, 180.00, 320.00, 250.00, 44.0, 95.0, 'Indigo Floral', 'Sanganeri Print', 84.00, 25.0),
('TEX-COT-003', '8901001003', 'Organic Charcoal Black Cambric', 1, 1, 1, '5208', 5.0, 165.00, 290.00, 230.00, 44.0, 115.0, 'Jet Black', 'Solid Plain', 62.25, 20.0),
('TEX-COT-004', '8901001004', 'Sky Blue Oxford Weave Cotton', 1, 1, 1, '5208', 5.0, 210.00, 360.00, 290.00, 58.0, 140.0, 'Pastel Sky Blue', 'Pinpoint Oxford', 18.00, 25.0), -- Low stock alert!

('TEX-SLK-001', '8902002001', 'Banarasi Katan Pure Silk Brocade', 2, 2, 1, '5007', 5.0, 1250.00, 2200.00, 1750.00, 44.0, 165.0, 'Royal Magenta', 'Gold Floral Zari Jaal', 42.50, 15.0),
('TEX-SLK-002', '8902002002', 'Emerald Green Zari Border Katan', 2, 2, 1, '5007', 5.0, 1300.00, 2350.00, 1850.00, 44.0, 170.0, 'Emerald Green', 'Meenakari Border', 31.00, 15.0),
('TEX-SLK-003', '8902002003', 'Raw Tussar Silk Natural Beige', 2, 2, 1, '5007', 5.0, 850.00, 1550.00, 1200.00, 44.0, 145.0, 'Natural Tussar', 'Textured Slub Weave', 6.50, 12.0), -- Low stock alert!

('TEX-SUI-001', '8903003001', 'Raymond Charcoal Pinstripe Suiting', 3, 3, 1, '5515', 12.0, 480.00, 890.00, 720.00, 58.0, 260.0, 'Charcoal Grey', 'Fine Pinstripe', 95.00, 25.0),
('TEX-SUI-002', '8903003002', 'Raymond Midnight Blue Solid Suiting', 3, 3, 1, '5515', 12.0, 520.00, 950.00, 760.00, 58.0, 275.0, 'Midnight Navy', 'Matte Twill', 112.50, 30.0),
('TEX-SUI-003', '8903003003', 'Italian Wool-Blend Camel Blazer Fabric', 3, 3, 1, '5515', 12.0, 780.00, 1450.00, 1150.00, 58.0, 310.0, 'Camel Brown', 'Flannel Weave', 38.00, 15.0),

('TEX-LIN-001', '8904004001', 'Pure European Flax Linen 80 Lea White', 4, 4, 1, '5309', 5.0, 550.00, 980.00, 790.00, 58.0, 155.0, 'Bleached White', 'Crisp Plain Linen', 78.50, 20.0),
('TEX-LIN-002', '8904004002', 'Natural Unbleached Sand Linen 60 Lea', 4, 4, 1, '5309', 5.0, 460.00, 820.00, 680.00, 58.0, 175.0, 'Sand Khaki', 'Slub Linen Weave', 54.00, 20.0),
('TEX-LIN-003', '8904004003', 'Sage Green Yarn-Dyed Linen Stripe', 4, 4, 1, '5309', 5.0, 580.00, 1050.00, 850.00, 58.0, 160.0, 'Sage & White', 'Deckchair Stripe', 4.00, 15.0), -- Critical low stock!

('TEX-GEO-001', '8905005001', 'Dyeable Pure Viscose Georgette 60g', 5, 5, 1, '5407', 5.0, 140.00, 260.00, 200.00, 44.0, 60.0, 'Raw Off-White', 'High Twist Crepe', 160.00, 35.0),
('TEX-GEO-002', '8905005002', 'Crimson Red Floral Digital Georgette', 5, 5, 1, '5407', 5.0, 190.00, 340.00, 270.00, 44.0, 75.0, 'Crimson Red', 'Digital Bloom Print', 65.00, 20.0),

('TEX-VEL-001', '8906006001', 'Royal Maroon Micro Velvet 9000', 6, 6, 1, '5801', 12.0, 320.00, 620.00, 490.00, 44.0, 340.0, 'Deep Maroon', 'Plush Smooth Pile', 72.00, 20.0),
('TEX-VEL-002', '8906006002', 'Emerald Bottle Green Micro Velvet', 6, 6, 1, '5801', 12.0, 320.00, 620.00, 490.00, 44.0, 340.0, 'Bottle Green', 'Plush Smooth Pile', 48.50, 15.0),

('TEX-DEN-001', '8907007001', 'Raw Indigo Selvedge Denim 13oz', 7, 7, 1, '5209', 5.0, 290.00, 560.00, 440.00, 32.0, 410.0, 'Deep Indigo', 'Red-Line Selvedge', 85.00, 25.0),
('TEX-DEN-002', '8907007002', 'Washed Light Blue Stretch Denim 10oz', 7, 7, 1, '5209', 5.0, 260.00, 490.00, 390.00, 56.0, 320.0, 'Faded Ice Blue', 'Enzyme Washed Twill', 0.00, 20.0), -- Out of stock!

('TEX-ETH-001', '8908008001', 'Banarasi Silk Semi-Stitched Lehenga Set', 8, 2, 5, '5007', 12.0, 3400.00, 6800.00, 5200.00, NULL, NULL, 'Rani Pink & Gold', 'Zari Brocade Panel', 14.00, 5.0),
('TEX-ETH-002', '8908008002', 'Pure Katan Silk Traditional Saree', 8, 2, 3, '5007', 5.0, 4200.00, 7900.00, 6100.00, NULL, NULL, 'Royal Peacock Blue', 'Temple Zari Border', 9.00, 4.0);

-- Product Rolls (Roll level tracking for exact rack storage & aging)
INSERT INTO product_rolls (product_id, roll_number, supplier_id, shade_lot_no, location_rack, initial_length, current_length, status, received_date) VALUES
(1, 'ROL-COT-01A', 1, 'LOT-W-101', 'Rack A-01', 50.0, 22.5, 'IN_USE', date('now', '-25 days')),
(1, 'ROL-COT-01B', 1, 'LOT-W-101', 'Rack A-01', 50.0, 43.0, 'IN_USE', date('now', '-18 days')),
(1, 'ROL-COT-01C', 1, 'LOT-W-102', 'Rack A-02', 80.0, 80.0, 'FULL',   date('now', '-5 days')),

(2, 'ROL-COT-02A', 1, 'LOT-IND-88', 'Rack A-03', 45.0, 34.0, 'IN_USE', date('now', '-35 days')),
(2, 'ROL-COT-02B', 1, 'LOT-IND-88', 'Rack A-03', 50.0, 50.0, 'FULL',   date('now', '-12 days')),

(5, 'ROL-SLK-01A', 2, 'LOT-MG-01', 'Locker S-1', 25.0, 17.5, 'IN_USE', date('now', '-40 days')),
(5, 'ROL-SLK-01B', 2, 'LOT-MG-02', 'Locker S-1', 25.0, 25.0, 'FULL',   date('now', '-10 days')),

(6, 'ROL-SLK-02A', 2, 'LOT-EM-01', 'Locker S-2', 31.0, 31.0, 'FULL',   date('now', '-85 days')), -- Slow moving stock!

(7, 'ROL-SLK-03A', 2, 'LOT-TUS-09', 'Locker S-3', 20.0, 6.5, 'IN_USE', date('now', '-110 days')), -- Dead stock alert!

(8, 'ROL-SUI-01A', 3, 'LOT-CH-77', 'Rack B-01', 50.0, 45.0, 'IN_USE', date('now', '-20 days')),
(8, 'ROL-SUI-01B', 3, 'LOT-CH-77', 'Rack B-01', 50.0, 50.0, 'FULL',   date('now', '-15 days')),

(9, 'ROL-SUI-02A', 3, 'LOT-NV-45', 'Rack B-02', 60.0, 52.5, 'IN_USE', date('now', '-30 days')),
(9, 'ROL-SUI-02B', 3, 'LOT-NV-45', 'Rack B-02', 60.0, 60.0, 'FULL',   date('now', '-8 days')),

(11, 'ROL-LIN-01A', 4, 'LOT-FL-12', 'Rack C-01', 40.0, 38.5, 'IN_USE', date('now', '-14 days')),
(11, 'ROL-LIN-01B', 4, 'LOT-FL-12', 'Rack C-01', 40.0, 40.0, 'FULL',   date('now', '-3 days')),

(13, 'ROL-LIN-03A', 4, 'LOT-SG-01', 'Rack C-03', 25.0, 4.0, 'IN_USE',  date('now', '-120 days')), -- Dead stock candidate!

(16, 'ROL-VEL-01A', 5, 'LOT-MR-99', 'Rack D-01', 40.0, 32.0, 'IN_USE', date('now', '-22 days')),
(16, 'ROL-VEL-01B', 5, 'LOT-MR-99', 'Rack D-01', 40.0, 40.0, 'FULL',   date('now', '-9 days')),

(18, 'ROL-DEN-01A', 1, 'LOT-SLV-01', 'Rack E-01', 50.0, 35.0, 'IN_USE', date('now', '-45 days')),
(18, 'ROL-DEN-01B', 1, 'LOT-SLV-01', 'Rack E-01', 50.0, 50.0, 'FULL',   date('now', '-15 days'));

-- Customers
INSERT INTO customers (customer_code, name, customer_type, phone, email, gstin, address, city, state, credit_limit, current_balance, total_purchases) VALUES
('CUST-001', 'Walk-in Retail Cash', 'RETAIL', '+91 90000 00000', 'walkin@store.local', NULL, 'Counter Sales', 'City Center', 'Local', 0.00, 0.00, 4520.00),
('CUST-002', 'Ananya Designer Studio', 'BOUTIQUE', '+91 98111 22334', 'ananya.couture@gmail.com', '27AABCU1122D1ZP', 'Shop 14, Designer Arcade', 'Mumbai', 'Maharashtra', 25000.00, 8450.00, 38500.00),
('CUST-003', 'Royal Bespoke Tailors', 'WHOLESALE', '+91 98222 33445', 'royalbespoke@yahoo.com', '27AABCR4455E1ZX', '45 MG Road, Suite 3', 'Pune', 'Maharashtra', 50000.00, 19200.00, 72000.00),
('CUST-004', 'Meera Rao (Bridal Customer)', 'RETAIL', '+91 98333 44556', 'meera.rao92@outlook.com', NULL, 'Flat 402, Lotus Greens', 'Bengaluru', 'Karnataka', 10000.00, 0.00, 18400.00),
('CUST-005', 'Kaveri Silk House', 'WHOLESALE', '+91 98444 55667', 'kaverisilks@gmail.com', '29AABCK7788H1ZT', 'Commercial Street 12', 'Bengaluru', 'Karnataka', 60000.00, 32500.00, 94000.00),
('CUST-006', 'Vikramaditya Garments', 'INSTITUTIONAL', '+91 98555 66778', 'procure@vikramgarments.com', '33AABCV9911J1ZK', 'Industrial Area Phase 2', 'Coimbatore', 'Tamil Nadu', 75000.00, 45000.00, 115000.00);

-- Historical Invoices
INSERT INTO invoices (invoice_number, customer_id, invoice_date, invoice_type, subtotal, total_discount, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax, round_off, grand_total, paid_amount, balance_due, payment_method, payment_status, salesperson_name, notes) VALUES
('INV-2026-0001', 2, datetime('now', '-24 days'), 'RETAIL', 5600.00, 200.00, 5400.00, 135.00, 135.00, 0.00, 270.00, 0.00, 5670.00, 5670.00, 0.00, 'UPI', 'PAID', 'Aman Verma', 'Boutique collection order'),
('INV-2026-0002', 3, datetime('now', '-20 days'), 'WHOLESALE', 14400.00, 720.00, 13680.00, 820.80, 820.80, 0.00, 1641.60, -0.60, 15321.00, 10000.00, 5321.00, 'SPLIT', 'PARTIAL', 'Neha Sen', 'Suiting lot with partial payment'),
('INV-2026-0003', 4, datetime('now', '-15 days'), 'RETAIL', 14700.00, 500.00, 14200.00, 355.00, 355.00, 0.00, 710.00, 0.00, 14910.00, 14910.00, 0.00, 'CARD', 'PAID', 'Aman Verma', 'Bridal silk saree and matching blouse fabric'),
('INV-2026-0004', 1, datetime('now', '-8 days'), 'RETAIL', 2240.00, 0.00, 2240.00, 56.00, 56.00, 0.00, 112.00, 0.00, 2352.00, 2352.00, 0.00, 'CASH', 'PAID', 'Counter Staff', 'Walk-in cash counter sale'),
('INV-2026-0005', 5, datetime('now', '-4 days'), 'WHOLESALE', 28500.00, 1500.00, 27000.00, 0.00, 0.00, 1350.00, 1350.00, 0.00, 28350.00, 15000.00, 13350.00, 'CREDIT', 'PARTIAL', 'Neha Sen', 'Interstate wholesale shipment to Bangalore'),
('INV-2026-0006', 2, datetime('now', '-1 day'), 'RETAIL', 8120.00, 300.00, 7820.00, 195.50, 195.50, 0.00, 391.00, -1.00, 8210.00, 0.00, 8210.00, 'CREDIT', 'UNPAID', 'Aman Verma', 'Boutique seasonal cut-pieces on credit');

-- Invoice Items
INSERT INTO invoice_items (invoice_id, product_id, roll_id, quantity, unit_price, cost_price, discount_percent, discount_amount, taxable_value, tax_rate, tax_amount, total_amount) VALUES
-- INV 1 (Ananya)
(1, 1, 1, 10.0, 280.00, 160.00, 0.0, 0.00, 2800.00, 5.0, 140.00, 2940.00),
(1, 2, 4, 10.0, 280.00, 180.00, 7.14, 200.00, 2600.00, 5.0, 130.00, 2730.00),

-- INV 2 (Royal Bespoke)
(2, 8, 10, 10.0, 720.00, 480.00, 5.0, 360.00, 6840.00, 12.0, 820.80, 7660.80),
(2, 9, 12, 10.0, 720.00, 520.00, 5.0, 360.00, 6840.00, 12.0, 820.80, 7660.80),

-- INV 3 (Meera Rao)
(3, 21, NULL, 1.0, 7900.00, 4200.00, 0.0, 0.00, 7900.00, 5.0, 395.00, 8295.00),
(3, 20, NULL, 1.0, 6800.00, 3400.00, 7.35, 500.00, 6300.00, 5.0, 315.00, 6615.00),

-- INV 4 (Walk-in)
(4, 1, 1, 8.0, 280.00, 160.00, 0.0, 0.00, 2240.00, 5.0, 112.00, 2352.00),

-- INV 5 (Kaveri Silks)
(5, 5, 6, 7.5, 1750.00, 1250.00, 5.0, 656.25, 12468.75, 5.0, 623.44, 13092.19),
(5, 6, NULL, 8.0, 1850.00, 1300.00, 5.7, 843.75, 13956.25, 5.0, 697.81, 14654.06),

-- INV 6 (Ananya Couture Credit)
(6, 11, 14, 4.0, 980.00, 550.00, 0.0, 0.00, 3920.00, 5.0, 196.00, 4116.00),
(6, 16, 17, 7.0, 600.00, 320.00, 7.14, 300.00, 3900.00, 5.0, 195.00, 4095.00);

-- Inventory Audit Transactions (Historical trail)
INSERT INTO inventory_transactions (product_id, roll_id, transaction_type, reference_id, quantity_change, stock_after, unit_cost, remarks) VALUES
(1, 1, 'PURCHASE', 'PO-2026-001', 50.0, 163.5, 160.00, 'Initial Bale Received from Arvind'),
(1, 1, 'SALE', 'INV-2026-0001', -10.0, 153.5, 160.00, 'Cut sale for Ananya Studio'),
(1, 1, 'SALE', 'INV-2026-0004', -8.0, 145.5, 160.00, 'Counter sale walk-in'),
(2, 4, 'SALE', 'INV-2026-0001', -10.0, 84.0, 180.00, 'Block print sold to Ananya Studio'),
(8, 10, 'SALE', 'INV-2026-0002', -10.0, 95.0, 480.00, 'Suiting roll cut for Royal Bespoke'),
(9, 12, 'SALE', 'INV-2026-0002', -7.5, 112.5, 520.00, 'Suiting roll cut for Royal Bespoke');

-- Customer Payments / Khata Receipts
INSERT INTO customer_payments (receipt_number, customer_id, invoice_id, payment_date, amount, payment_method, transaction_ref, notes) VALUES
('REC-2026-0001', 3, 2, date('now', '-18 days'), 10000.00, 'BANK_TRANSFER', 'NEFT-HDFC889911', 'Advance payment for suiting invoice'),
('REC-2026-0002', 5, 5, date('now', '-2 days'), 15000.00, 'UPI', 'UPI-TXN-9021983', 'Part payment received for Bangalore shipment');
