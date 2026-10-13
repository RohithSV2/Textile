const db = require('../../config/db');

/**
 * Controller for Customer & Khata Credit Ledger Operations (Full CRUD)
 */
const customerController = {
    /**
     * Get all customers with search & filter
     */
    getAllCustomers: async (req, res) => {
        try {
            const { search, type, limit = 100, offset = 0 } = req.query;

            let query = `
                SELECT 
                    c.*,
                    ROUND((c.current_balance / NULLIF(c.credit_limit, 0)) * 100, 1) AS credit_used_pct,
                    (SELECT COUNT(id) FROM invoices WHERE customer_id = c.id AND payment_status != 'VOID') AS invoices_count,
                    (SELECT MAX(invoice_date) FROM invoices WHERE customer_id = c.id) AS last_purchase_date
                FROM customers c
                WHERE 1=1
            `;
            const params = [];

            if (search) {
                query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ? OR c.gstin LIKE ?)`;
                const pattern = `%${search}%`;
                params.push(pattern, pattern, pattern, pattern);
            }

            if (type) {
                query += ` AND c.customer_type = ?`;
                params.push(type);
            }

            query += ` ORDER BY c.current_balance DESC, c.name ASC LIMIT ? OFFSET ?`;
            params.push(Number(limit), Number(offset));

            const customers = await db.all(query, params);
            res.json({ success: true, count: customers.length, data: customers });
        } catch (error) {
            console.error('Error fetching customers:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving customers', error: error.message });
        }
    },

    /**
     * Get single customer with ledger history (Invoices and Receipts)
     */
    getCustomerById: async (req, res) => {
        try {
            const { id } = req.params;

            const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
            if (!customer) {
                return res.status(404).json({ success: false, message: 'Customer not found' });
            }

            // Customer Invoices
            const invoices = await db.all(
                `SELECT * FROM invoices WHERE customer_id = ? ORDER BY invoice_date DESC LIMIT 50`,
                [id]
            );

            // Customer Payments / Receipts
            const payments = await db.all(
                `SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY payment_date DESC LIMIT 50`,
                [id]
            );

            res.json({
                success: true,
                data: {
                    ...customer,
                    invoices,
                    payments
                }
            });
        } catch (error) {
            console.error('Error fetching customer by ID:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving customer', error: error.message });
        }
    },

    /**
     * Create new customer
     */
    createCustomer: async (req, res) => {
        try {
            const {
                customer_code,
                name,
                customer_type = 'RETAIL',
                phone,
                email,
                gstin,
                address,
                city,
                state,
                credit_limit = 5000.00
            } = req.body;

            if (!name || !phone) {
                return res.status(400).json({ success: false, message: 'Name and Phone are mandatory' });
            }

            // Generate customer code if not provided
            const finalCode = customer_code || `CUST-${Date.now().toString().slice(-5)}`;

            const result = await db.run(
                `INSERT INTO customers (
                    customer_code, name, customer_type, phone, email,
                    gstin, address, city, state, credit_limit, current_balance, total_purchases
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00)`,
                [
                    finalCode,
                    name,
                    customer_type,
                    phone,
                    email || null,
                    gstin || null,
                    address || null,
                    city || null,
                    state || null,
                    Number(credit_limit)
                ]
            );

            const newCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [result.lastID]);
            res.status(201).json({ success: true, message: 'Customer added successfully', data: newCustomer });
        } catch (error) {
            console.error('Error creating customer:', error);
            res.status(500).json({ success: false, message: 'Error creating customer: ' + error.message });
        }
    },

    /**
     * Update customer details
     */
    updateCustomer: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                name,
                customer_type,
                phone,
                email,
                gstin,
                address,
                city,
                state,
                credit_limit
            } = req.body;

            const existing = await db.get('SELECT id FROM customers WHERE id = ?', [id]);
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Customer not found' });
            }

            await db.run(
                `UPDATE customers SET 
                    name = COALESCE(?, name),
                    customer_type = COALESCE(?, customer_type),
                    phone = COALESCE(?, phone),
                    email = COALESCE(?, email),
                    gstin = COALESCE(?, gstin),
                    address = COALESCE(?, address),
                    city = COALESCE(?, city),
                    state = COALESCE(?, state),
                    credit_limit = COALESCE(?, credit_limit)
                WHERE id = ?`,
                [name, customer_type, phone, email, gstin, address, city, state, credit_limit, id]
            );

            const updated = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
            res.json({ success: true, message: 'Customer updated successfully', data: updated });
        } catch (error) {
            console.error('Error updating customer:', error);
            res.status(500).json({ success: false, message: 'Error updating customer: ' + error.message });
        }
    },

    /**
     * Record Khata / Credit Payment from Customer
     */
    recordPayment: async (req, res) => {
        try {
            const { id } = req.params; // customer_id
            const {
                amount,
                payment_method = 'CASH',
                transaction_ref,
                invoice_id,
                notes,
                payment_date = new Date().toISOString().split('T')[0]
            } = req.body;

            const payAmount = Number(amount);
            if (!payAmount || payAmount <= 0) {
                return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero' });
            }

            const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
            if (!customer) {
                return res.status(404).json({ success: false, message: 'Customer not found' });
            }

            const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;

            await db.transaction(async (tx) => {
                // 1. Insert into customer_payments
                await tx.run(
                    `INSERT INTO customer_payments (
                        receipt_number, customer_id, invoice_id,
                        payment_date, amount, payment_method, transaction_ref, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        receiptNumber,
                        id,
                        invoice_id || null,
                        payment_date,
                        payAmount,
                        payment_method,
                        transaction_ref || null,
                        notes || 'Khata Balance Settlement'
                    ]
                );

                // 2. Reduce customer's outstanding balance
                const newBalance = Math.max(0, customer.current_balance - payAmount);
                await tx.run(
                    `UPDATE customers SET current_balance = ? WHERE id = ?`,
                    [newBalance, id]
                );

                // 3. If tied to a specific invoice, update that invoice's balance
                if (invoice_id) {
                    const inv = await tx.get('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
                    if (inv) {
                        const newDue = Math.max(0, inv.balance_due - payAmount);
                        const newPaid = inv.paid_amount + payAmount;
                        const newStatus = newDue <= 0 ? 'PAID' : 'PARTIAL';
                        await tx.run(
                            `UPDATE invoices SET paid_amount = ?, balance_due = ?, payment_status = ? WHERE id = ?`,
                            [newPaid, newDue, newStatus, invoice_id]
                        );
                    }
                }
            });

            const updatedCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
            res.status(201).json({
                success: true,
                message: `Payment of ₹${payAmount.toFixed(2)} recorded successfully`,
                receipt_number: receiptNumber,
                data: updatedCustomer
            });
        } catch (error) {
            console.error('Error recording payment:', error);
            res.status(500).json({ success: false, message: 'Error recording payment: ' + error.message });
        }
    },

    /**
     * Delete customer
     */
    deleteCustomer: async (req, res) => {
        try {
            const { id } = req.params;
            const hasBills = await db.get('SELECT COUNT(*) as cnt FROM invoices WHERE customer_id = ?', [id]);
            if (hasBills && hasBills.cnt > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete customer with existing sales invoices. Customer records are legally retained for financial audit.'
                });
            }

            await db.run('DELETE FROM customers WHERE id = ?', [id]);
            res.json({ success: true, message: 'Customer deleted successfully' });
        } catch (error) {
            console.error('Error deleting customer:', error);
            res.status(500).json({ success: false, message: 'Error deleting customer: ' + error.message });
        }
    }
};

module.exports = customerController;
