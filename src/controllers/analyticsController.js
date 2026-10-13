const db = require('../../config/db');
const sqlQueries = require('../queries/sqlQueries');

/**
 * Controller for Real-Time Analytics & Showcase Complex SQL Queries
 */
const analyticsController = {
    /**
     * Executive Dashboard Overview & Chart Data
     */
    getDashboardOverview: async (req, res) => {
        try {
            // 1. Overall KPIs
            const kpi = await db.get(sqlQueries.DASHBOARD_KPIS);

            // 2. Sales Trend (Past 14 Days)
            const salesTrend = await db.all(`
                SELECT 
                    date(invoice_date) AS date,
                    ROUND(SUM(grand_total), 2) AS total_sales,
                    COUNT(id) AS bill_count
                FROM invoices
                WHERE payment_status != 'VOID' AND date(invoice_date) >= date('now', '-14 days')
                GROUP BY date(invoice_date)
                ORDER BY date(invoice_date) ASC
            `);

            // 3. Category Breakdown
            const categoryShare = await db.all(`
                SELECT 
                    c.name AS category_name,
                    ROUND(SUM(p.current_stock * p.selling_price), 2) AS stock_value,
                    ROUND(SUM(p.current_stock), 2) AS total_meters
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = 1
                GROUP BY c.id
                ORDER BY stock_value DESC
            `);

            // 4. Stock Health Breakdown
            const stockHealth = await db.all(`
                SELECT 
                    CASE 
                        WHEN current_stock <= 0 THEN 'Out of Stock'
                        WHEN current_stock <= min_stock_level THEN 'Low Stock'
                        ELSE 'Optimal Stock'
                    END AS status_label,
                    COUNT(id) AS count
                FROM products
                WHERE is_active = 1
                GROUP BY status_label
            `);

            // 5. Recent Sales Activity Feed
            const recentSales = await db.all(`
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.invoice_date,
                    c.name AS customer_name,
                    c.customer_type,
                    i.grand_total,
                    i.payment_status,
                    i.payment_method
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.payment_status != 'VOID'
                ORDER BY i.invoice_date DESC
                LIMIT 6
            `);

            // 6. Top Urgent Low-Stock Items
            const lowStockItems = await db.all(`
                SELECT 
                    p.id,
                    p.sku,
                    p.name,
                    c.name AS category_name,
                    p.current_stock,
                    p.min_stock_level,
                    u.code AS uom_code
                FROM products p
                JOIN categories c ON p.category_id = c.id
                JOIN uoms u ON p.uom_id = u.id
                WHERE p.current_stock <= p.min_stock_level AND p.is_active = 1
                ORDER BY p.current_stock ASC
                LIMIT 5
            `);

            res.json({
                success: true,
                data: {
                    kpi,
                    salesTrend,
                    categoryShare,
                    stockHealth,
                    recentSales,
                    lowStockItems
                }
            });
        } catch (error) {
            console.error('Error fetching dashboard overview:', error);
            res.status(500).json({ success: false, message: 'Server error retrieving analytics: ' + error.message });
        }
    },

    /**
     * Showcase Complex SQL Workbench
     * Executes advanced relational queries, timing execution and explaining mechanics
     */
    runComplexQuery: async (req, res) => {
        try {
            const { queryKey } = req.params;

            const catalog = {
                inventory_valuation: {
                    title: 'Multi-Dimensional Inventory Valuation Matrix',
                    description: 'Aggregates real-time inventory cost valuation, potential retail yield, and projected gross margins grouped by Category and Fabric Type.',
                    concepts: ['Multi-table Relational Joins', 'Aggregations', 'NULLIF division safeguarding', 'CASE conditional expression'],
                    sql: sqlQueries.INVENTORY_VALUATION_BY_CATEGORY
                },
                roll_aging: {
                    title: 'Fabric Roll Aging & Dead-Stock Detection',
                    description: 'Utilizes Common Table Expressions (CTEs) and Julian day calculations to identify stagnant rolls occupying warehouse racks with zero movement in 60+ days.',
                    concepts: ['Common Table Expressions (WITH clause)', 'Correlated Subqueries', 'Julian Day Date Arithmetic', 'Multi-tier CASE classification'],
                    sql: sqlQueries.ROLL_AGING_ANALYSIS
                },
                billing_trajectory: {
                    title: 'Daily Billing Velocity & Cumulative Trajectory',
                    description: 'Calculates day-by-day sales volume, discounts, taxes, alongside running cumulative revenue and 7-day rolling sales moving averages.',
                    concepts: ['Window Functions (SUM OVER ORDER BY)', 'Rolling Window Averages (ROWS BETWEEN 6 PRECEDING)', 'Date Grouping'],
                    sql: sqlQueries.DAILY_BILLING_TRAJECTORY
                },
                customer_aging: {
                    title: 'Customer Credit Aging Matrix (Khata Ledger)',
                    description: 'Segregates overdue receivables into aging buckets (0-30, 31-60, 61-90, 90+ days) and calculates credit utilization percentages against agreed limits.',
                    concepts: ['Financial Aging Bucketing', 'Zero-balance Filtering', 'Credit Limit Risk Flags', 'Relational Joins'],
                    sql: sqlQueries.CUSTOMER_CREDIT_AGING
                },
                fabric_profitability: {
                    title: 'Fabric Profitability & Dense Rank Contribution',
                    description: 'Ranks fabrics based on net profit contributions, cost of goods sold (COGS), and realized profit margins using analytical ranking functions.',
                    concepts: ['Analytical Window Function (DENSE_RANK)', 'Multi-table Line-Item Joins', 'Cost Margin Calculations'],
                    sql: sqlQueries.FABRIC_PROFITABILITY_RANK
                },
                gst_tax_audit: {
                    title: 'GST / Tax Audit Slab Aggregation & HSN Compliance',
                    description: 'Produces audit-ready GST turnover reports grouped by Tax Rate Slab (5%, 12%, 18%) and HSN Codes, separating CGST, SGST, and IGST portions.',
                    concepts: ['HSN Code Grouping', 'Tax Slabs Segregation', 'CGST/SGST/IGST Apportionment', 'Turnover Aggregation'],
                    sql: sqlQueries.GST_TAX_AUDIT_REPORT
                },
                reorder_forecast: {
                    title: 'Stock Runout Velocity & Reorder Forecast',
                    description: 'Analyzes daily burn rate over the previous 30 days and projects days remaining until inventory depletion, generating prioritized reorder alerts.',
                    concepts: ['Velocity CTE', 'Depletion Forecasting', 'Multi-condition Priority Ordering', 'Stock Runout Modeling'],
                    sql: sqlQueries.STOCK_RUNOUT_FORECAST
                }
            };

            const selected = catalog[queryKey];
            if (!selected) {
                return res.status(404).json({
                    success: false,
                    message: `Unknown query key: "${queryKey}". Available keys: ${Object.keys(catalog).join(', ')}`
                });
            }

            const startTime = process.hrtime();
            const rows = await db.all(selected.sql);
            const diff = process.hrtime(startTime);
            const executionTimeMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

            res.json({
                success: true,
                metadata: {
                    key: queryKey,
                    title: selected.title,
                    description: selected.description,
                    concepts: selected.concepts,
                    sql: selected.sql.trim(),
                    rowCount: rows.length,
                    executionTimeMs: `${executionTimeMs} ms`
                },
                data: rows
            });
        } catch (error) {
            console.error('Error running complex query:', error);
            res.status(500).json({ success: false, message: 'SQL execution failed: ' + error.message });
        }
    },

    /**
     * Get Catalog of all Available Complex Queries
     */
    getQueryCatalog: (req, res) => {
        const catalogList = [
            { key: 'inventory_valuation', title: 'Multi-Dimensional Inventory Valuation Matrix', badge: 'Joins & Aggregate' },
            { key: 'roll_aging', title: 'Fabric Roll Aging & Dead-Stock Detection', badge: 'CTEs & Date Math' },
            { key: 'billing_trajectory', title: 'Daily Billing Velocity & Cumulative Trajectory', badge: 'Window Functions' },
            { key: 'customer_aging', title: 'Customer Credit Aging Matrix (Khata Ledger)', badge: 'Aging Buckets' },
            { key: 'fabric_profitability', title: 'Fabric Profitability & Dense Rank Contribution', badge: 'DENSE_RANK()' },
            { key: 'gst_tax_audit', title: 'GST / Tax Audit Slab Aggregation & HSN Compliance', badge: 'Tax & Compliance' },
            { key: 'reorder_forecast', title: 'Stock Runout Velocity & Reorder Forecast', badge: 'Predictive Velocity' }
        ];
        res.json({ success: true, data: catalogList });
    },

    /**
     * Safe Read-Only SQL Query Runner (SELECT only)
     */
    runCustomQuery: async (req, res) => {
        try {
            const { sql } = req.body;
            if (!sql || typeof sql !== 'string') {
                return res.status(400).json({ success: false, message: 'Valid SQL statement required' });
            }

            const cleanSql = sql.trim();
            const upper = cleanSql.toUpperCase();

            // Strict read-only enforcement
            if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
                return res.status(403).json({
                    success: false,
                    message: 'Security Restriction: Only SELECT or WITH read-only queries are permitted.'
                });
            }

            // Reject mutation keywords
            const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'ATTACH', 'DETACH', 'PRAGMA', 'VACUUM'];
            for (const word of dangerous) {
                const regex = new RegExp(`\\b${word}\\b`, 'i');
                if (regex.test(cleanSql)) {
                    return res.status(403).json({
                        success: false,
                        message: `Security Restriction: Statement contains forbidden keyword "${word}".`
                    });
                }
            }

            const startTime = process.hrtime();
            const rows = await db.all(cleanSql);
            const diff = process.hrtime(startTime);
            const executionTimeMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

            res.json({
                success: true,
                metadata: {
                    rowCount: rows.length,
                    executionTimeMs: `${executionTimeMs} ms`
                },
                data: rows
            });
        } catch (error) {
            res.status(400).json({ success: false, message: 'SQL Execution Error: ' + error.message });
        }
    }
};

module.exports = analyticsController;
