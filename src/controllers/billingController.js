const db = require('../../config/db');

/**
 * Controller for Point of Sale (POS) Billing & Invoices (Full ACID Transactional Engine)
 */
const billingController = {
    /**
     * Get all invoices with filter & search
     */
    getAllInvoices: async (req, res) => {
        try {
            const { search, status, payment_method, start_date, end_date, limit = 100, offset = 0 } = req.query;

            let query = `
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.invoice_date,
                    i.invoice_type,
                    i.customer_id,
                    c.customer_code,
                    c.name AS customer_name,
                    c.phone AS customer_phone,
                    i.subtotal,
                    i.total_discount,
                    i.taxable_amount,
                    i.cgst_amount,
                    i.sgst_amount,
                    i.igst_amount,
                    i.total_tax,
                    i.round_off,
                    i.grand_total,
                    i.paid_amount,
                    i.balance_due,
                    i.payment_method,
                    i.payment_status,
                    i.salesperson_name,
                    (SELECT COUNT(id) FROM invoice_items WHERE invoice_id = i.id) AS items_count
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE 1=1
            `;
            const params = [];

            if (search) {
                query += ` AND (i.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
                const pattern = `%${search}%`;
                params.push(pattern, pattern, pattern);
            }

            if (status) {
                query += ` AND i.payment_status = ?`;
                params.push(status);
            }

            if (payment_method) {
                query += ` AND i.payment_method = ?`;
                params.push(payment_method);
            }

            if (start_date) {
                query += ` AND date(i.invoice_date) >= date(?)`;
                params.push(start_date);
            }

            if (end_date) {
                query += ` AND date(i.invoice_date) <= date(?)`;
                params.push(end_date);
            }

            query += ` ORDER BY i.invoice_date DESC LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));

            const invoices = await db.all(query, params);
            res.json({ success: true, count: invoices.length, data: invoices });
        } catch (error) {
            console.error('Error fetching invoices:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving invoices', error: error.message });
        }
    },

    /**
     * Get single invoice with complete line-item breakdown
     */
    getInvoiceById: async (req, res) => {
        try {
            const { id } = req.params;

            const invoice = await db.get(
                `SELECT 
                    i.*,
                    c.customer_code,
                    c.name AS customer_name,
                    c.phone AS customer_phone,
                    c.email AS customer_email,
                    c.gstin AS customer_gstin,
                    c.address AS customer_address,
                    c.city AS customer_city,
                    c.state AS customer_state
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?`,
                [id]
            );

            if (!invoice) {
                return res.status(404).json({ success: false, message: 'Invoice not found' });
            }

            // Retrieve line items with product and roll details
            const items = await db.all(
                `SELECT 
                    it.*,
                    p.sku,
                    p.name AS product_name,
                    p.hsn_code,
                    p.color,
                    f.name AS fabric_name,
                    u.code AS uom_code,
                    r.roll_number,
                    r.location_rack
                FROM invoice_items it
                JOIN products p ON it.product_id = p.id
                JOIN fabric_types f ON p.fabric_type_id = f.id
                JOIN uoms u ON p.uom_id = u.id
                LEFT JOIN product_rolls r ON it.roll_id = r.id
                WHERE it.invoice_id = ?`,
                [id]
            );

            res.json({
                success: true,
                data: {
                    ...invoice,
                    items
                }
            });
        } catch (error) {
            console.error('Error fetching invoice details:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving invoice details', error: error.message });
        }
    },

    /**
     * Create Invoice & Execute Real-Time Stock Deduction (Atomic ACID Transaction)
     */
    createInvoice: async (req, res) => {
        try {
            const {
                customer_id,
                invoice_type = 'RETAIL',
                items, // Array: [{ product_id, roll_id, quantity, unit_price, discount_percent }]
                payment_method = 'CASH',
                paid_amount,
                salesperson_name = 'Staff',
                notes
            } = req.body;

            if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, message: 'Customer and at least one item are required' });
            }

            const customer = await db.get('SELECT * FROM customers WHERE id = ?', [customer_id]);
            if (!customer) {
                return res.status(404).json({ success: false, message: 'Selected customer does not exist' });
            }

            // Execute in an isolated transaction
            const invoiceResult = await db.transaction(async (tx) => {
                let subtotal = 0;
                let totalDiscount = 0;
                let taxableAmount = 0;
                let totalTax = 0;
                let cgstAmount = 0;
                let sgstAmount = 0;
                let igstAmount = 0;

                const processedItems = [];

                // 1. Validate items and stock availability
                for (const item of items) {
                    const quantity = Number(item.quantity);
                    if (isNaN(quantity) || quantity <= 0) {
                        throw new Error(`Invalid quantity for item: ${item.product_id}`);
                    }

                    const product = await tx.get(
                        'SELECT * FROM products WHERE id = ? AND is_active = 1',
                        [item.product_id]
                    );

                    if (!product) {
                        throw new Error(`Product ID ${item.product_id} not found or inactive`);
                    }

                    // Stock availability check
                    if (product.current_stock < quantity) {
                        throw new Error(
                            `Insufficient stock for "${product.name}". Available: ${product.current_stock}, Requested: ${quantity}`
                        );
                    }

                    // Roll availability check if specified
                    let roll = null;
                    if (item.roll_id) {
                        roll = await tx.get(
                            'SELECT * FROM product_rolls WHERE id = ? AND product_id = ?',
                            [item.roll_id, item.product_id]
                        );
                        if (!roll) {
                            throw new Error(`Roll ID ${item.roll_id} not found for product "${product.name}"`);
                        }
                        if (roll.current_length < quantity) {
                            throw new Error(
                                `Roll ${roll.roll_number} only has ${roll.current_length} meters available (Requested: ${quantity})`
                            );
                        }
                    }

                    const unitPrice = item.unit_price != null ? Number(item.unit_price) : Number(product.selling_price);
                    const discPct = Number(item.discount_percent || 0);
                    const lineGross = quantity * unitPrice;
                    const lineDisc = (lineGross * discPct) / 100;
                    const lineTaxable = lineGross - lineDisc;
                    const taxRate = Number(product.tax_rate || 5.0);
                    const lineTax = (lineTaxable * taxRate) / 100;
                    const lineTotal = lineTaxable + lineTax;

                    subtotal += lineGross;
                    totalDiscount += lineDisc;
                    taxableAmount += lineTaxable;
                    totalTax += lineTax;

                    // Interstate check: If WHOLESALE and interstate (different state than store), calculate IGST
                    const isInterstate = invoice_type === 'WHOLESALE' && customer.state && customer.state.toLowerCase() !== 'maharashtra';
                    if (isInterstate) {
                        igstAmount += lineTax;
                    } else {
                        cgstAmount += lineTax / 2;
                        sgstAmount += lineTax / 2;
                    }

                    processedItems.push({
                        product_id: product.id,
                        roll_id: roll ? roll.id : null,
                        roll_number: roll ? roll.roll_number : null,
                        quantity,
                        unit_price: unitPrice,
                        cost_price: Number(product.cost_price),
                        discount_percent: discPct,
                        discount_amount: lineDisc,
                        taxable_value: lineTaxable,
                        tax_rate: taxRate,
                        tax_amount: lineTax,
                        total_amount: lineTotal,
                        product
                    });
                }

                const rawGrandTotal = taxableAmount + totalTax;
                const grandTotal = Math.round(rawGrandTotal);
                const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));

                const finalPaidAmount = paid_amount != null ? Number(paid_amount) : grandTotal;
                const balanceDue = Math.max(0, Number((grandTotal - finalPaidAmount).toFixed(2)));

                let paymentStatus = 'PAID';
                if (balanceDue > 0 && finalPaidAmount > 0) {
                    paymentStatus = 'PARTIAL';
                } else if (balanceDue > 0 && finalPaidAmount === 0) {
                    paymentStatus = 'UNPAID';
                }

                // Check credit limit if balance due > 0
                if (balanceDue > 0) {
                    if (customer.credit_limit > 0 && (customer.current_balance + balanceDue) > customer.credit_limit) {
                        throw new Error(
                            `Credit limit exceeded for "${customer.name}". Current Balance: ₹${customer.current_balance}, Limit: ₹${customer.credit_limit}, New Due: ₹${balanceDue}`
                        );
                    }
                }

                // Generate Invoice Number
                const now = new Date();
                const invPrefix = `INV-${now.getFullYear()}-`;
                const lastInv = await tx.get(
                    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`,
                    [`${invPrefix}%`]
                );
                let nextNum = 1;
                if (lastInv && lastInv.invoice_number) {
                    const match = lastInv.invoice_number.match(/INV-\d{4}-(\d+)/);
                    if (match) nextNum = parseInt(match[1], 10) + 1;
                }
                const invoiceNumber = `${invPrefix}${String(nextNum).padStart(4, '0')}`;

                // 2. Insert Invoice
                const invRes = await tx.run(
                    `INSERT INTO invoices (
                        invoice_number, customer_id, invoice_type,
                        subtotal, total_discount, taxable_amount,
                        cgst_amount, sgst_amount, igst_amount, total_tax,
                        round_off, grand_total, paid_amount, balance_due,
                        payment_method, payment_status, salesperson_name, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        invoiceNumber,
                        customer.id,
                        invoice_type,
                        subtotal,
                        totalDiscount,
                        taxableAmount,
                        cgstAmount,
                        sgstAmount,
                        igstAmount,
                        totalTax,
                        roundOff,
                        grandTotal,
                        finalPaidAmount,
                        balanceDue,
                        payment_method,
                        paymentStatus,
                        salesperson_name,
                        notes || null
                    ]
                );

                const invoiceId = invRes.lastID;

                // 3. Insert Invoice Items, Deduct Stock, and Update Rolls
                for (const item of processedItems) {
                    await tx.run(
                        `INSERT INTO invoice_items (
                            invoice_id, product_id, roll_id, quantity, unit_price,
                            cost_price, discount_percent, discount_amount,
                            taxable_value, tax_rate, tax_amount, total_amount
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            invoiceId,
                            item.product_id,
                            item.roll_id,
                            item.quantity,
                            item.unit_price,
                            item.cost_price,
                            item.discount_percent,
                            item.discount_amount,
                            item.taxable_value,
                            item.tax_rate,
                            item.tax_amount,
                            item.total_amount
                        ]
                    );

                    // Deduct product stock
                    const newStock = Number((item.product.current_stock - item.quantity).toFixed(2));
                    await tx.run(
                        `UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [newStock, item.product_id]
                    );

                    // Deduct roll length if roll selected
                    if (item.roll_id) {
                        const roll = await tx.get('SELECT * FROM product_rolls WHERE id = ?', [item.roll_id]);
                        const newRollLength = Number((roll.current_length - item.quantity).toFixed(2));
                        const newRollStatus = newRollLength <= 0 ? 'EMPTY' : 'IN_USE';
                        await tx.run(
                            `UPDATE product_rolls SET current_length = ?, status = ? WHERE id = ?`,
                            [newRollLength, newRollStatus, item.roll_id]
                        );
                    }

                    // Record Audit Transaction
                    await tx.run(
                        `INSERT INTO inventory_transactions (
                            product_id, roll_id, transaction_type, reference_id,
                            quantity_change, stock_after, unit_cost, remarks
                        ) VALUES (?, ?, 'SALE', ?, ?, ?, ?, ?)`,
                        [
                            item.product_id,
                            item.roll_id,
                            invoiceNumber,
                            -item.quantity,
                            newStock,
                            item.cost_price,
                            `Sales Invoice ${invoiceNumber}`
                        ]
                    );
                }

                // 4. Update Customer Balances and Lifetime Spend
                await tx.run(
                    `UPDATE customers SET 
                        current_balance = current_balance + ?,
                        total_purchases = total_purchases + ?
                    WHERE id = ?`,
                    [balanceDue, grandTotal, customer.id]
                );

                // 5. If partial/immediate payment recorded with a receipt
                if (finalPaidAmount > 0) {
                    const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;
                    await tx.run(
                        `INSERT INTO customer_payments (
                            receipt_number, customer_id, invoice_id,
                            payment_date, amount, payment_method, notes
                        ) VALUES (?, ?, ?, date('now'), ?, ?, ?)`,
                        [
                            receiptNumber,
                            customer.id,
                            invoiceId,
                            finalPaidAmount,
                            payment_method,
                            `Payment for ${invoiceNumber}`
                        ]
                    );
                }

                return { invoiceId, invoiceNumber, grandTotal, balanceDue };
            });

            // Fetch created invoice with details
            const createdInvoice = await db.get('SELECT * FROM v_invoice_details WHERE invoice_id = ?', [invoiceResult.invoiceId]);
            res.status(201).json({
                success: true,
                message: `Invoice ${invoiceResult.invoiceNumber} billed successfully!`,
                data: createdInvoice
            });
        } catch (error) {
            console.error('Error generating billing invoice:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    },

    /**
     * Cancel / Void Invoice (Safely rolls back stock and reverses customer ledger)
     */
    voidInvoice: async (req, res) => {
        try {
            const { id } = req.params;
            const { reason = 'Cancelled by Manager' } = req.body;

            const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [id]);
            if (!invoice) {
                return res.status(404).json({ success: false, message: 'Invoice not found' });
            }

            if (invoice.payment_status === 'VOID') {
                return res.status(400).json({ success: false, message: 'Invoice is already voided' });
            }

            await db.transaction(async (tx) => {
                const items = await tx.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);

                // 1. Roll back stock and rolls
                for (const item of items) {
                    const product = await tx.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
                    const restoredStock = product.current_stock + item.quantity;

                    await tx.run('UPDATE products SET current_stock = ? WHERE id = ?', [restoredStock, item.product_id]);

                    if (item.roll_id) {
                        const roll = await tx.get('SELECT * FROM product_rolls WHERE id = ?', [item.roll_id]);
                        if (roll) {
                            const restoredLength = roll.current_length + item.quantity;
                            const restoredStatus = restoredLength >= roll.initial_length ? 'FULL' : 'IN_USE';
                            await tx.run('UPDATE product_rolls SET current_length = ?, status = ? WHERE id = ?', [
                                restoredLength,
                                restoredStatus,
                                item.roll_id
                            ]);
                        }
                    }

                    // Audit reversal
                    await tx.run(
                        `INSERT INTO inventory_transactions (
                            product_id, roll_id, transaction_type, reference_id,
                            quantity_change, stock_after, remarks
                        ) VALUES (?, ?, 'RETURN', ?, ?, ?, ?)`,
                        [
                            item.product_id,
                            item.roll_id,
                            invoice.invoice_number,
                            item.quantity,
                            restoredStock,
                            `Voided Invoice Reversal: ${reason}`
                        ]
                    );
                }

                // 2. Reverse customer balance and purchase totals
                await tx.run(
                    `UPDATE customers SET 
                        current_balance = MAX(0, current_balance - ?),
                        total_purchases = MAX(0, total_purchases - ?)
                    WHERE id = ?`,
                    [invoice.balance_due, invoice.grand_total, invoice.customer_id]
                );

                // 3. Mark invoice as VOID
                await tx.run(
                    `UPDATE invoices SET payment_status = 'VOID', notes = COALESCE(notes || ' | ', '') || ? WHERE id = ?`,
                    [`[VOIDED: ${reason}]`, id]
                );
            });

            res.json({ success: true, message: `Invoice ${invoice.invoice_number} voided and stock restored successfully` });
        } catch (error) {
            console.error('Error voiding invoice:', error);
            res.status(500).json({ success: false, message: 'Error voiding invoice: ' + error.message });
        }
    }
};

module.exports = billingController;
