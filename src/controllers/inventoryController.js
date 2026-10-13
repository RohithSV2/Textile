const db = require('../../config/db');

/**
 * Controller for Real-Time Inventory & Roll Management
 */
const inventoryController = {
    /**
     * Get all fabric rolls with aging & rack status
     */
    getAllRolls: async (req, res) => {
        try {
            const { product_id, status, rack, search, limit = 100, offset = 0 } = req.query;

            let query = `
                SELECT 
                    r.*,
                    p.sku,
                    p.name AS product_name,
                    p.cost_price,
                    p.selling_price,
                    f.name AS fabric_name,
                    c.name AS category_name,
                    s.company_name AS supplier_name,
                    ROUND(r.current_length * p.cost_price, 2) AS tied_up_cost_value,
                    CAST((julianday('now') - julianday(r.received_date)) AS INTEGER) AS age_days,
                    CASE 
                        WHEN (julianday('now') - julianday(r.received_date)) > 90 THEN 'DEAD_STOCK'
                        WHEN (julianday('now') - julianday(r.received_date)) > 60 THEN 'SLOW_MOVING'
                        ELSE 'FRESH'
                    END AS aging_category
                FROM product_rolls r
                JOIN products p ON r.product_id = p.id
                JOIN fabric_types f ON p.fabric_type_id = f.id
                JOIN categories c ON p.category_id = c.id
                LEFT JOIN suppliers s ON r.supplier_id = s.id
                WHERE 1=1
            `;
            const params = [];

            if (product_id) {
                query += ` AND r.product_id = ?`;
                params.push(product_id);
            }

            if (status) {
                query += ` AND r.status = ?`;
                params.push(status);
            }

            if (rack) {
                query += ` AND r.location_rack LIKE ?`;
                params.push(`%${rack}%`);
            }

            if (search) {
                query += ` AND (r.roll_number LIKE ? OR p.name LIKE ? OR p.sku LIKE ? OR r.shade_lot_no LIKE ?)`;
                const pat = `%${search}%`;
                params.push(pat, pat, pat, pat);
            }

            query += ` ORDER BY r.status ASC, r.current_length DESC LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));

            const rolls = await db.all(query, params);
            res.json({ success: true, count: rolls.length, data: rolls });
        } catch (error) {
            console.error('Error fetching fabric rolls:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving rolls: ' + error.message });
        }
    },

    /**
     * Add new fabric roll to an existing product
     */
    createRoll: async (req, res) => {
        try {
            const {
                product_id,
                roll_number,
                supplier_id,
                shade_lot_no,
                location_rack = 'General Rack',
                initial_length,
                received_date = new Date().toISOString().split('T')[0]
            } = req.body;

            const length = Number(initial_length);
            if (!product_id || !roll_number || !length || length <= 0) {
                return res.status(400).json({ success: false, message: 'Product ID, Roll Number, and positive initial length are required' });
            }

            const product = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            await db.transaction(async (tx) => {
                // 1. Insert Roll
                await tx.run(
                    `INSERT INTO product_rolls (
                        product_id, roll_number, supplier_id, shade_lot_no,
                        location_rack, initial_length, current_length, status, received_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'FULL', ?)`,
                    [
                        product_id,
                        roll_number,
                        supplier_id || null,
                        shade_lot_no || null,
                        location_rack,
                        length,
                        length,
                        received_date
                    ]
                );

                // 2. Increase product current stock
                const newStock = product.current_stock + length;
                await tx.run('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStock, product_id]);

                // 3. Log audit trail
                await tx.run(
                    `INSERT INTO inventory_transactions (
                        product_id, transaction_type, reference_id,
                        quantity_change, stock_after, unit_cost, remarks
                    ) VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?)`,
                    [
                        product_id,
                        `ROLL-ADD-${roll_number}`,
                        length,
                        newStock,
                        product.cost_price,
                        `New Roll Inward: ${roll_number} (${length}m at ${location_rack})`
                    ]
                );
            });

            res.status(201).json({ success: true, message: `Roll ${roll_number} added successfully and stock updated` });
        } catch (error) {
            console.error('Error creating roll:', error);
            res.status(500).json({ success: false, message: 'Error adding roll: ' + error.message });
        }
    },

    /**
     * Update roll details (e.g. rack location, status, mark damaged)
     */
    updateRoll: async (req, res) => {
        try {
            const { id } = req.params;
            const { location_rack, status, shade_lot_no } = req.body;

            const existing = await db.get('SELECT * FROM product_rolls WHERE id = ?', [id]);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Roll not found' });
            }

            await db.run(
                `UPDATE product_rolls SET
                    location_rack = COALESCE(?, location_rack),
                    status = COALESCE(?, status),
                    shade_lot_no = COALESCE(?, shade_lot_no)
                WHERE id = ?`,
                [location_rack, status, shade_lot_no, id]
            );

            const updated = await db.get('SELECT * FROM product_rolls WHERE id = ?', [id]);
            res.json({ success: true, message: 'Roll updated successfully', data: updated });
        } catch (error) {
            console.error('Error updating roll:', error);
            res.status(500).json({ success: false, message: 'Error updating roll: ' + error.message });
        }
    },

    /**
     * Manual Stock Adjustment (Damage, Audit Correction, Shrinkage)
     */
    adjustStock: async (req, res) => {
        try {
            const { product_id, roll_id, type = 'ADJUSTMENT', quantity_change, remarks } = req.body;

            const change = Number(quantity_change);
            if (!product_id || isNaN(change) || change === 0) {
                return res.status(400).json({ success: false, message: 'Valid Product ID and non-zero quantity change are required' });
            }

            const product = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            await db.transaction(async (tx) => {
                const newStock = Math.max(0, Number((product.current_stock + change).toFixed(2)));

                // Update product stock
                await tx.run('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStock, product_id]);

                // If roll was specified and stock decreased
                if (roll_id) {
                    const roll = await tx.get('SELECT * FROM product_rolls WHERE id = ?', [roll_id]);
                    if (roll) {
                        const newRollLength = Math.max(0, Number((roll.current_length + change).toFixed(2)));
                        const newRollStatus = newRollLength <= 0 ? 'EMPTY' : (newRollLength < roll.initial_length ? 'IN_USE' : 'FULL');
                        await tx.run('UPDATE product_rolls SET current_length = ?, status = ? WHERE id = ?', [
                            newRollLength,
                            newRollStatus,
                            roll_id
                        ]);
                    }
                }

                // Log audit transaction
                const refCode = `ADJ-${Date.now().toString().slice(-6)}`;
                await tx.run(
                    `INSERT INTO inventory_transactions (
                        product_id, roll_id, transaction_type, reference_id,
                        quantity_change, stock_after, unit_cost, remarks
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        product_id,
                        roll_id || null,
                        type,
                        refCode,
                        change,
                        newStock,
                        product.cost_price,
                        remarks || `Manual stock adjustment (${change > 0 ? '+' : ''}${change})`
                    ]
                );
            });

            const updatedProduct = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
            res.json({
                success: true,
                message: `Stock adjusted successfully. New stock: ${updatedProduct.current_stock}`,
                data: updatedProduct
            });
        } catch (error) {
            console.error('Error adjusting stock:', error);
            res.status(500).json({ success: false, message: 'Error adjusting stock: ' + error.message });
        }
    },

    /**
     * Get Inventory Audit Transaction Log
     */
    getTransactions: async (req, res) => {
        try {
            const { product_id, type, limit = 100, offset = 0 } = req.query;

            let query = `
                SELECT 
                    t.*,
                    p.sku,
                    p.name AS product_name,
                    u.code AS uom_code,
                    r.roll_number
                FROM inventory_transactions t
                JOIN products p ON t.product_id = p.id
                JOIN uoms u ON p.uom_id = u.id
                LEFT JOIN product_rolls r ON t.roll_id = r.id
                WHERE 1=1
            `;
            const params = [];

            if (product_id) {
                query += ` AND t.product_id = ?`;
                params.push(product_id);
            }

            if (type) {
                query += ` AND t.transaction_type = ?`;
                params.push(type);
            }

            query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));

            const transactions = await db.all(query, params);
            res.json({ success: true, count: transactions.length, data: transactions });
        } catch (error) {
            console.error('Error fetching inventory transactions:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving transaction logs: ' + error.message });
        }
    }
};

module.exports = inventoryController;
