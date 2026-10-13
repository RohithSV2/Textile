const assert = require('assert');
const http = require('http');
const app = require('../server');

let server;
const PORT = 5055;

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request(
            {
                hostname: 'localhost',
                port: PORT,
                path,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
                }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const parsed = data ? JSON.parse(data) : {};
                        resolve({ status: res.statusCode, data: parsed });
                    } catch (e) {
                        resolve({ status: res.statusCode, text: data });
                    }
                });
            }
        );
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Starting Comprehensive Automated API Tests for Textile Store System...\n');
    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Reason:`, err.message);
            failed++;
        }
    }

    try {
        server = app.listen(PORT);
        await new Promise((r) => setTimeout(r, 500));

        // 1. Health check
        await test('GET /api/health returns status UP', async () => {
            const res = await request('GET', '/api/health');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.status, 'UP');
        });

        // 2. Products List
        let testProduct;
        await test('GET /api/products returns product list', async () => {
            const res = await request('GET', '/api/products');
            assert.strictEqual(res.status, 200);
            assert(res.data.count > 0, 'Should have seeded products');
            testProduct = res.data.data[0];
            assert(testProduct.id, 'Product should have id');
            assert(testProduct.current_stock !== undefined, 'Product should have current_stock');
        });

        // 3. Product Metadata
        await test('GET /api/products/metadata returns categories, fabrics, and uoms', async () => {
            const res = await request('GET', '/api/products/metadata');
            assert.strictEqual(res.status, 200);
            assert(res.data.data.categories.length > 0);
            assert(res.data.data.fabrics.length > 0);
            assert(res.data.data.uoms.length > 0);
        });

        // 4. Product Search
        await test('GET /api/products?search=Cotton returns filtered products', async () => {
            const res = await request('GET', '/api/products?search=Cotton');
            assert.strictEqual(res.status, 200);
            assert(res.data.count > 0);
        });

        // 5. Create New Product
        let createdProductId;
        await test('POST /api/products creates new fabric product with initial roll', async () => {
            const res = await request('POST', '/api/products', {
                name: 'Silk Georgette Gold Brocade',
                category_id: 2,
                fabric_type_id: 2,
                uom_id: 1,
                hsn_code: '5007',
                tax_rate: 5.0,
                cost_price: 950.0,
                selling_price: 1800.0,
                wholesale_price: 1400.0,
                width_inches: 44,
                gsm: 130,
                color: 'Maroon Gold',
                pattern_design: 'Zari Brocade',
                current_stock: 40.0,
                min_stock_level: 10.0,
                initial_roll: {
                    roll_number: `ROL-TEST-${Date.now().toString().slice(-4)}`,
                    initial_length: 40.0,
                    location_rack: 'Rack Test-01'
                }
            });
            assert.strictEqual(res.status, 201);
            assert(res.data.data.id);
            createdProductId = res.data.data.id;
        });

        // 6. Customers List & Credit
        let testCustomer;
        await test('GET /api/customers returns customer records', async () => {
            const res = await request('GET', '/api/customers');
            assert.strictEqual(res.status, 200);
            assert(res.data.count > 0);
            testCustomer = res.data.data[1]; // Pick non-walk-in customer
        });

        // 7. Create New Customer
        let createdCustomerId;
        await test('POST /api/customers creates new customer', async () => {
            const res = await request('POST', '/api/customers', {
                name: 'Aarav Fashion House',
                customer_type: 'BOUTIQUE',
                phone: '+91 99887 66554',
                email: 'aarav@fashion.test',
                gstin: '27AABCA1234A1Z1',
                credit_limit: 30000.0
            });
            assert.strictEqual(res.status, 201);
            assert(res.data.data.id);
            createdCustomerId = res.data.data.id;
        });

        // 8. POS Billing & Stock Deduction (ACID Transaction)
        let createdInvoiceId;
        await test('POST /api/billing creates invoice with real-time stock reduction', async () => {
            // Check stock before sale
            const beforeProd = await request('GET', `/api/products/${createdProductId}`);
            const initialStock = beforeProd.data.data.current_stock;
            const roll = beforeProd.data.data.rolls[0];
            const initialRollLength = roll.current_length;

            const saleQty = 5.5; // Decimal cut length

            const billRes = await request('POST', '/api/billing', {
                customer_id: createdCustomerId,
                invoice_type: 'RETAIL',
                items: [
                    {
                        product_id: createdProductId,
                        roll_id: roll.id,
                        quantity: saleQty,
                        unit_price: 1800.0,
                        discount_percent: 5.0
                    }
                ],
                payment_method: 'CASH',
                paid_amount: 10000.0 // Full or partial
            });

            assert.strictEqual(billRes.status, 201);
            assert(billRes.data.data.invoice_id);
            createdInvoiceId = billRes.data.data.invoice_id;

            // Verify stock after sale
            const afterProd = await request('GET', `/api/products/${createdProductId}`);
            assert.strictEqual(afterProd.data.data.current_stock, Number((initialStock - saleQty).toFixed(2)));

            // Verify roll length after sale
            const afterRoll = afterProd.data.data.rolls.find((r) => r.id === roll.id);
            assert.strictEqual(afterRoll.current_length, Number((initialRollLength - saleQty).toFixed(2)));
        });

        // 9. Void Invoice & Stock Restoration
        await test('POST /api/billing/:id/void cancels invoice and restores stock and rolls', async () => {
            const beforeVoid = await request('GET', `/api/products/${createdProductId}`);
            const stockBeforeVoid = beforeVoid.data.data.current_stock;

            const voidRes = await request('POST', `/api/billing/${createdInvoiceId}/void`, {
                reason: 'Customer cancelled test order'
            });
            assert.strictEqual(voidRes.status, 200);

            // Verify stock restored
            const afterVoid = await request('GET', `/api/products/${createdProductId}`);
            assert.strictEqual(afterVoid.data.data.current_stock, Number((stockBeforeVoid + 5.5).toFixed(2)));
        });

        // 10. Dashboard Analytics
        await test('GET /api/analytics/dashboard returns executive KPIs & chart data', async () => {
            const res = await request('GET', '/api/analytics/dashboard');
            assert.strictEqual(res.status, 200);
            assert(res.data.data.kpi);
            assert(res.data.data.salesTrend);
            assert(res.data.data.categoryShare);
        });

        // 11. Complex SQL Showcase Queries
        const complexKeys = [
            'inventory_valuation',
            'roll_aging',
            'billing_trajectory',
            'customer_aging',
            'fabric_profitability',
            'gst_tax_audit',
            'reorder_forecast'
        ];

        for (const qKey of complexKeys) {
            await test(`GET /api/analytics/queries/${qKey} executes complex SQL query cleanly`, async () => {
                const res = await request('GET', `/api/analytics/queries/${qKey}`);
                assert.strictEqual(res.status, 200);
                assert(res.data.metadata.title);
                assert(res.data.metadata.executionTimeMs);
                assert(Array.isArray(res.data.data));
            });
        }

        console.log(`\n========================================`);
        console.log(`🏁 API TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
        console.log(`========================================\n`);

        if (server) server.close();
        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error('Fatal test error:', err);
        if (server) server.close();
        process.exit(1);
    }
}

runTests();
