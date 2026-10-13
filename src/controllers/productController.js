const db = require('../../config/db');

/**
 * Controller for Product Inventory Operations (Full CRUD)
 */
const productController = {
    /**
     * Get all products with filters & pagination
     */
    getAllProducts: async (req, res) => {
        try {
            const { search, category, fabric, status, limit = 100, offset = 0 } = req.query;

            let query = `
                SELECT 
                    p.id,
                    p.sku,
                    p.barcode,
                    p.name,
                    p.category_id,
                    c.name AS category_name,
                    p.fabric_type_id,
                    f.name AS fabric_name,
                    f.composition,
                    p.uom_id,
                    u.code AS uom_code,
                    u.name AS uom_name,
                    u.allows_decimal,
                    p.hsn_code,
                    p.tax_rate,
                    p.cost_price,
                    p.selling_price,
                    p.wholesale_price,
                    p.width_inches,
                    p.gsm,
                    p.color,
                    p.pattern_design,
                    p.current_stock,
                    p.min_stock_level,
                    p.is_active,
                    ROUND(p.current_stock * p.cost_price, 2) AS stock_cost_value,
                    ROUND(p.current_stock * p.selling_price, 2) AS stock_retail_value,
                    CASE 
                        WHEN p.current_stock <= 0 THEN 'OUT_OF_STOCK'
                        WHEN p.current_stock <= p.min_stock_level THEN 'LOW_STOCK'
                        ELSE 'OPTIMAL'
                    END AS stock_status,
                    (SELECT COUNT(r.id) FROM product_rolls r WHERE r.product_id = p.id AND r.status IN ('FULL', 'IN_USE')) AS rolls_count
                FROM products p
                JOIN categories c ON p.category_id = c.id
                JOIN fabric_types f ON p.fabric_type_id = f.id
                JOIN uoms u ON p.uom_id = u.id
                WHERE p.is_active = 1
            `;

            const params = [];

            if (search) {
                query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.color LIKE ? OR p.pattern_design LIKE ?)`;
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
            }

            if (category) {
                query += ` AND p.category_id = ?`;
                params.push(category);
            }

            if (fabric) {
                query += ` AND p.fabric_type_id = ?`;
                params.push(fabric);
            }

            if (status === 'LOW_STOCK') {
                query += ` AND p.current_stock > 0 AND p.current_stock <= p.min_stock_level`;
            } else if (status === 'OUT_OF_STOCK') {
                query += ` AND p.current_stock <= 0`;
            } else if (status === 'OPTIMAL') {
                query += ` AND p.current_stock > p.min_stock_level`;
            }

            query += ` ORDER BY p.name ASC LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));

            const products = await db.all(query, params);
            res.json({ success: true, count: products.length, data: products });
        } catch (error) {
            console.error('Error fetching products:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving products', error: error.message });
        }
    },

    /**
     * Get single product with active rolls
     */
    getProductById: async (req, res) => {
        try {
            const { id } = req.params;

            const product = await db.get(
                `SELECT 
                    p.*,
                    c.name AS category_name,
                    f.name AS fabric_name,
                    f.composition,
                    u.code AS uom_code,
                    u.name AS uom_name,
                    u.allows_decimal
                FROM products p
                JOIN categories c ON p.category_id = c.id
                JOIN fabric_types f ON p.fabric_type_id = f.id
                JOIN uoms u ON p.uom_id = u.id
                WHERE p.id = ?`,
                [id]
            );

            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            // Fetch active rolls for this product
            const rolls = await db.all(
                `SELECT 
                    r.*,
                    s.company_name AS supplier_name,
                    CAST((julianday('now') - julianday(r.received_date)) AS INTEGER) AS age_days
                FROM product_rolls r
                LEFT JOIN suppliers s ON r.supplier_id = s.id
                WHERE r.product_id = ? AND r.status IN ('FULL', 'IN_USE')
                ORDER BY r.current_length DESC`,
                [id]
            );

            // Fetch recent stock movements
            const transactions = await db.all(
                `SELECT * FROM inventory_transactions WHERE product_id = ? ORDER BY created_at DESC LIMIT 10`,
                [id]
            );

            res.json({
                success: true,
                data: {
                    ...product,
                    rolls,
                    recent_transactions: transactions
                }
            });
        } catch (error) {
            console.error('Error fetching product by ID:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving product', error: error.message });
        }
    },

    /**
     * Create new product (with optional initial roll)
     */
    createProduct: async (req, res) => {
        try {
            const {
                sku,
                barcode,
                name,
                category_id,
                fabric_type_id,
                uom_id,
                hsn_code,
                tax_rate = 5.0,
                cost_price,
                selling_price,
                wholesale_price,
                width_inches,
                gsm,
                color,
                pattern_design,
                current_stock = 0,
                min_stock_level = 10,
                initial_roll // Optional: { roll_number, initial_length, location_rack, supplier_id }
            } = req.body;

            if (!name || !category_id || !fabric_type_id || !uom_id || !hsn_code || cost_price == null || selling_price == null) {
                return res.status(400).json({ success: false, message: 'Missing required product attributes' });
            }

            // Auto-generate SKU if omitted
            const finalSku = sku || `TEX-${Date.now().toString().slice(-6)}`;
            const finalBarcode = barcode || `${Math.floor(1000000000 + Math.random() * 9000000000)}`;

            const result = await db.transaction(async (tx) => {
                const insertRes = await tx.run(
                    `INSERT INTO products (
                        sku, barcode, name, category_id, fabric_type_id, uom_id,
                        hsn_code, tax_rate, cost_price, selling_price, wholesale_price,
                        width_inches, gsm, color, pattern_design, current_stock, min_stock_level
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        finalSku,
                        finalBarcode,
                        name,
                        category_id,
                        fabric_type_id,
                        uom_id,
                        hsn_code,
                        Number(tax_rate),
                        Number(cost_price),
                        Number(selling_price),
                        wholesale_price ? Number(wholesale_price) : Number(selling_price),
                        width_inches ? Number(width_inches) : null,
                        gsm ? Number(gsm) : null,
                        color || null,
                        pattern_design || null,
                        Number(current_stock),
                        Number(min_stock_level)
                    ]
                );

                const productId = insertRes.lastID;

                // If initial roll info provided or current_stock > 0
                if (initial_roll && initial_roll.roll_number) {
                    const rollLength = Number(initial_roll.initial_length || current_stock);
                    await tx.run(
                        `INSERT INTO product_rolls (
                            product_id, roll_number, supplier_id, location_rack,
                            initial_length, current_length, status, received_date
                        ) VALUES (?, ?, ?, ?, ?, ?, 'FULL', date('now'))`,
                        [
                            productId,
                            initial_roll.roll_number,
                            initial_roll.supplier_id || null,
                            initial_roll.location_rack || 'Warehouse General',
                            rollLength,
                            rollLength
                        ]
                    );
                }

                // Log opening stock audit transaction if stock > 0
                if (Number(current_stock) > 0) {
                    await tx.run(
                        `INSERT INTO inventory_transactions (
                            product_id, transaction_type, reference_id,
                            quantity_change, stock_after, unit_cost, remarks
                        ) VALUES (?, 'PURCHASE', 'OPENING_STOCK', ?, ?, ?, 'Opening Stock Creation')`,
                        [productId, Number(current_stock), Number(current_stock), Number(cost_price)]
                    );
                }

                return productId;
            });

            const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result]);
            res.status(201).json({ success: true, message: 'Product created successfully', data: newProduct });
        } catch (error) {
            console.error('Error creating product:', error);
            res.status(500).json({ success: false, message: 'Error creating product: ' + error.message });
        }
    },

    /**
     * Update product
     */
    updateProduct: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                name,
                category_id,
                fabric_type_id,
                uom_id,
                hsn_code,
                tax_rate,
                cost_price,
                selling_price,
                wholesale_price,
                width_inches,
                gsm,
                color,
                pattern_design,
                min_stock_level
            } = req.body;

            const existing = await db.get('SELECT id FROM products WHERE id = ?', [id]);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            await db.run(
                `UPDATE products SET 
                    name = COALESCE(?, name),
                    category_id = COALESCE(?, category_id),
                    fabric_type_id = COALESCE(?, fabric_type_id),
                    uom_id = COALESCE(?, uom_id),
                    hsn_code = COALESCE(?, hsn_code),
                    tax_rate = COALESCE(?, tax_rate),
                    cost_price = COALESCE(?, cost_price),
                    selling_price = COALESCE(?, selling_price),
                    wholesale_price = COALESCE(?, wholesale_price),
                    width_inches = COALESCE(?, width_inches),
                    gsm = COALESCE(?, gsm),
                    color = COALESCE(?, color),
                    pattern_design = COALESCE(?, pattern_design),
                    min_stock_level = COALESCE(?, min_stock_level),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [
                    name,
                    category_id,
                    fabric_type_id,
                    uom_id,
                    hsn_code,
                    tax_rate,
                    cost_price,
                    selling_price,
                    wholesale_price,
                    width_inches,
                    gsm,
                    color,
                    pattern_design,
                    min_stock_level,
                    id
                ]
            );

            const updated = await db.get('SELECT * FROM products WHERE id = ?', [id]);
            res.json({ success: true, message: 'Product updated successfully', data: updated });
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({ success: false, message: 'Error updating product: ' + error.message });
        }
    },

    /**
     * Delete product (soft delete)
     */
    deleteProduct: async (req, res) => {
        try {
            const { id } = req.params;
            const existing = await db.get('SELECT id FROM products WHERE id = ?', [id]);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            // Check if product has invoice history
            const invoiced = await db.get('SELECT COUNT(*) as count FROM invoice_items WHERE product_id = ?', [id]);
            if (invoiced && invoiced.count > 0) {
                // Soft delete to protect financial audit history
                await db.run('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
                return res.json({ success: true, message: 'Product archived (preserved in billing history)' });
            }

            // Safe to delete completely
            await db.run('DELETE FROM products WHERE id = ?', [id]);
            res.json({ success: true, message: 'Product deleted permanently' });
        } catch (error) {
            console.error('Error deleting product:', error);
            res.status(500).json({ success: false, message: 'Error deleting product: ' + error.message });
        }
    },

    /**
     * Get lookup metadata (categories, fabrics, uoms)
     */
    getMetadata: async (req, res) => {
        try {
            const categories = await db.all('SELECT * FROM categories ORDER BY name ASC');
            const fabrics = await db.all('SELECT * FROM fabric_types ORDER BY name ASC');
            const uoms = await db.all('SELECT * FROM uoms ORDER BY name ASC');
            res.json({ success: true, data: { categories, fabrics, uoms } });
        } catch (error) {
            console.error('Error fetching metadata:', error);
            res.status(500).json({ success: false, message: 'Error fetching metadata' });
        }
    }
};

module.exports = productController;
