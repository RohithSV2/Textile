const db = require('../../config/db');

/**
 * Controller for Suppliers and Stock Inward / Goods Received Notes (GRN)
 */
const supplierController = {
    /**
     * Get all suppliers
     */
    getAllSuppliers: async (req, res) => {
        try {
            const { search } = req.query;

            let query = `
                SELECT 
                    s.*,
                    (SELECT COUNT(id) FROM purchases WHERE supplier_id = s.id) AS total_purchases_count,
                    (SELECT COUNT(DISTINCT product_id) FROM product_rolls WHERE supplier_id = s.id) AS products_supplied_count
                FROM suppliers s
                WHERE 1=1
            `;
            const params = [];

            if (search) {
                query += ` AND (s.company_name LIKE ? OR s.supplier_code LIKE ? OR s.phone LIKE ? OR s.city LIKE ?)`;
                const pat = `%${search}%`;
                params.push(pat, pat, pat, pat);
            }

            query += ` ORDER BY s.company_name ASC`;
            const suppliers = await db.all(query, params);
            res.json({ success: true, count: suppliers.length, data: suppliers });
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving suppliers: ' + error.message });
        }
    },

    /**
     * Create supplier
     */
    createSupplier: async (req, res) => {
        try {
            const {
                supplier_code,
                company_name,
                contact_person,
                phone,
                email,
                gstin,
                address,
                city,
                state
            } = req.body;

            if (!company_name || !phone) {
                return res.status(400).json({ success: false, message: 'Company Name and Phone are required' });
            }

            const finalCode = supplier_code || `SUP-${Date.now().toString().slice(-4)}`;

            const result = await db.run(
                `INSERT INTO suppliers (
                    supplier_code, company_name, contact_person, phone,
                    email, gstin, address, city, state, outstanding_payable
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00)`,
                [
                    finalCode,
                    company_name,
                    contact_person || null,
                    phone,
                    email || null,
                    gstin || null,
                    address || null,
                    city || null,
                    state || null
                ]
            );

            const newSupplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [result.lastID]);
            res.status(201).json({ success: true, message: 'Supplier added successfully', data: newSupplier });
        } catch (error) {
            console.error('Error creating supplier:', error);
            res.status(500).json({ success: false, message: 'Error adding supplier: ' + error.message });
        }
    },

    /**
     * Inward Stock / Create Purchase Order (GRN)
     */
    createPurchase: async (req, res) => {
        try {
            const {
                supplier_id,
                supplier_invoice_no,
                purchase_date = new Date().toISOString().split('T')[0],
                items, // Array: [{ product_id, quantity, unit_cost, tax_rate, rolls: [{ roll_number, length, rack }] }]
                notes
            } = req.body;

            if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, message: 'Supplier and at least one item are required' });
            }

            const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);
            if (!supplier) {
                return res.status(404).json({ success: false, message: 'Supplier not found' });
            }

            const purchaseResult = await db.transaction(async (tx) => {
                let subtotal = 0;
                let taxAmount = 0;

                const poPrefix = `PO-${new Date().getFullYear()}-`;
                const lastPo = await tx.get(
                    `SELECT purchase_number FROM purchases WHERE purchase_number LIKE ? ORDER BY id DESC LIMIT 1`,
                    [`${poPrefix}%`]
                );
                let nextNum = 1;
                if (lastPo && lastPo.purchase_number) {
                    const match = lastPo.purchase_number.match(/PO-\d{4}-(\d+)/);
                    if (match) nextNum = parseInt(match[1], 10) + 1;
                }
                const purchaseNumber = `${poPrefix}${String(nextNum).padStart(4, '0')}`;

                // Calculate amounts
                const processed = [];
                for (const item of items) {
                    const qty = Number(item.quantity);
                    const cost = Number(item.unit_cost);
                    const taxR = Number(item.tax_rate || 5.0);
                    const lineCost = qty * cost;
                    const lineTax = (lineCost * taxR) / 100;

                    subtotal += lineCost;
                    taxAmount += lineTax;

                    processed.push({
                        product_id: item.product_id,
                        quantity: qty,
                        unit_cost: cost,
                        tax_rate: taxR,
                        tax_amount: lineTax,
                        total_cost: lineCost + lineTax,
                        rolls: item.rolls || []
                    });
                }

                const totalAmount = subtotal + taxAmount;

                // Insert purchase record
                const poRes = await tx.run(
                    `INSERT INTO purchases (
                        purchase_number, supplier_id, supplier_invoice_no, purchase_date,
                        subtotal, tax_amount, total_amount, paid_amount, payment_status, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?)`,
                    [
                        purchaseNumber,
                        supplier_id,
                        supplier_invoice_no || null,
                        purchase_date,
                        subtotal,
                        taxAmount,
                        totalAmount,
                        totalAmount,
                        notes || null
                    ]
                );

                const purchaseId = poRes.lastID;

                // Process items
                for (const item of processed) {
                    await tx.run(
                        `INSERT INTO purchase_items (
                            purchase_id, product_id, quantity, unit_cost, tax_rate, tax_amount, total_cost
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            purchaseId,
                            item.product_id,
                            item.quantity,
                            item.unit_cost,
                            item.tax_rate,
                            item.tax_amount,
                            item.total_cost
                        ]
                    );

                    // Update product stock and update latest cost price
                    const prod = await tx.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
                    const newStock = Number((prod.current_stock + item.quantity).toFixed(2));
                    await tx.run(
                        `UPDATE products SET current_stock = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [newStock, item.unit_cost, item.product_id]
                    );

                    // If rolls provided, insert them
                    if (item.rolls && Array.isArray(item.rolls) && item.rolls.length > 0) {
                        for (const r of item.rolls) {
                            const rLen = Number(r.length || (item.quantity / item.rolls.length));
                            await tx.run(
                                `INSERT INTO product_rolls (
                                    product_id, roll_number, supplier_id, shade_lot_no,
                                    location_rack, initial_length, current_length, status, received_date
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'FULL', ?)`,
                                [
                                    item.product_id,
                                    r.roll_number,
                                    supplier_id,
                                    r.shade_lot_no || null,
                                    r.rack || 'Inward Bay',
                                    rLen,
                                    rLen,
                                    purchase_date
                                ]
                            );
                        }
                    }

                    // Audit log
                    await tx.run(
                        `INSERT INTO inventory_transactions (
                            product_id, transaction_type, reference_id,
                            quantity_change, stock_after, unit_cost, remarks
                        ) VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?)`,
                        [
                            item.product_id,
                            purchaseNumber,
                            item.quantity,
                            newStock,
                            item.unit_cost,
                            `Stock Inward GRN ${purchaseNumber}`
                        ]
                    );
                }

                return { purchaseId, purchaseNumber, totalAmount };
            });

            res.status(201).json({
                success: true,
                message: `Stock inward recorded successfully under GRN #${purchaseResult.purchaseNumber}`,
                data: purchaseResult
            });
        } catch (error) {
            console.error('Error creating purchase:', error);
            res.status(500).json({ success: false, message: 'Error processing purchase inward: ' + error.message });
        }
    },

    /**
     * Get all purchases / Goods Received Notes
     */
    getAllPurchases: async (req, res) => {
        try {
            const purchases = await db.all(
                `SELECT 
                    p.*,
                    s.company_name AS supplier_name,
                    s.supplier_code,
                    (SELECT COUNT(id) FROM purchase_items WHERE purchase_id = p.id) AS items_count
                FROM purchases p
                JOIN suppliers s ON p.supplier_id = s.id
                ORDER BY p.purchase_date DESC`
            );
            res.json({ success: true, count: purchases.length, data: purchases });
        } catch (error) {
            console.error('Error fetching purchases:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving purchases: ' + error.message });
        }
    }
};

module.exports = supplierController;
