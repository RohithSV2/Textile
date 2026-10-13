/**
 * Centralized SQL Queries for Textile Store Management System
 * Includes Complex Relational Queries, Window Functions, and CTEs
 */

module.exports = {
    // 1. Dashboard Executive KPI Summary
    DASHBOARD_KPIS: `
        SELECT 
            (SELECT COALESCE(SUM(grand_total), 0) FROM invoices WHERE date(invoice_date) = date('now') AND payment_status != 'VOID') AS today_sales,
            (SELECT COUNT(id) FROM invoices WHERE date(invoice_date) = date('now') AND payment_status != 'VOID') AS today_orders_count,
            (SELECT COALESCE(SUM(current_stock * cost_price), 0) FROM products WHERE is_active = 1) AS total_inventory_valuation,
            (SELECT COUNT(id) FROM products WHERE current_stock <= min_stock_level AND is_active = 1) AS low_stock_alerts_count,
            (SELECT COALESCE(SUM(current_balance), 0) FROM customers) AS total_receivables,
            (SELECT COUNT(id) FROM product_rolls WHERE status IN ('FULL', 'IN_USE')) AS active_rolls_count,
            (SELECT COALESCE(SUM(grand_total), 0) FROM invoices WHERE payment_status != 'VOID') AS lifetime_sales_total,
            (SELECT COALESCE(SUM(it.total_amount - (it.quantity * it.cost_price)), 0) 
             FROM invoice_items it 
             JOIN invoices inv ON it.invoice_id = inv.id 
             WHERE inv.payment_status != 'VOID') AS total_gross_profit
    `,

    // 2. Real-Time Stock Valuation by Fabric & Category
    INVENTORY_VALUATION_BY_CATEGORY: `
        SELECT 
            c.name AS category_name,
            f.name AS fabric_name,
            COUNT(p.id) AS total_products_count,
            ROUND(SUM(p.current_stock), 2) AS total_stock_quantity,
            ROUND(SUM(p.current_stock * p.cost_price), 2) AS total_inventory_cost_value,
            ROUND(SUM(p.current_stock * p.selling_price), 2) AS total_potential_sales_value,
            ROUND(SUM(p.current_stock * (p.selling_price - p.cost_price)), 2) AS projected_gross_margin,
            ROUND(
                (SUM(p.current_stock * (p.selling_price - p.cost_price)) / 
                NULLIF(SUM(p.current_stock * p.selling_price), 0)) * 100, 
                2
            ) AS profit_margin_percent,
            SUM(CASE WHEN p.current_stock <= p.min_stock_level THEN 1 ELSE 0 END) AS low_stock_item_count
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN fabric_types f ON p.fabric_type_id = f.id
        WHERE p.is_active = 1
        GROUP BY c.name, f.name
        ORDER BY total_inventory_cost_value DESC
    `,

    // 3. Roll Aging and Dead Stock Analysis (CTE)
    ROLL_AGING_ANALYSIS: `
        WITH RollMovement AS (
            SELECT 
                r.id AS roll_id,
                r.roll_number,
                p.name AS product_name,
                c.name AS category_name,
                f.name AS fabric_name,
                r.location_rack,
                r.initial_length,
                r.current_length,
                p.cost_price,
                ROUND(r.current_length * p.cost_price, 2) AS tied_up_capital,
                CAST((julianday('now') - julianday(r.received_date)) AS INTEGER) AS days_in_stock,
                COALESCE(
                    (SELECT SUM(ii.quantity) 
                     FROM invoice_items ii 
                     JOIN invoices inv ON ii.invoice_id = inv.id 
                     WHERE ii.roll_id = r.id 
                       AND julianday('now') - julianday(inv.invoice_date) <= 60), 
                    0
                ) AS sales_last_60_days
            FROM product_rolls r
            JOIN products p ON r.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            JOIN fabric_types f ON p.fabric_type_id = f.id
            WHERE r.status IN ('FULL', 'IN_USE')
        )
        SELECT 
            roll_number,
            product_name,
            category_name,
            fabric_name,
            location_rack,
            current_length,
            initial_length,
            ROUND((current_length / initial_length) * 100, 1) AS remaining_pct,
            days_in_stock,
            sales_last_60_days,
            tied_up_capital,
            CASE 
                WHEN days_in_stock > 90 AND sales_last_60_days = 0 THEN 'CRITICAL_DEAD_STOCK'
                WHEN days_in_stock > 60 AND sales_last_60_days < 5 THEN 'SLOW_MOVING'
                WHEN days_in_stock <= 30 THEN 'FAST_FRESH_STOCK'
                ELSE 'NORMAL_CYCLE'
            END AS stock_health_status
        FROM RollMovement
        ORDER BY days_in_stock DESC, tied_up_capital DESC
    `,

    // 4. Daily Billing Trajectory & Rolling Averages (Window Functions)
    DAILY_BILLING_TRAJECTORY: `
        WITH DailyBilling AS (
            SELECT 
                date(invoice_date) AS billing_date,
                COUNT(id) AS total_bills_count,
                ROUND(SUM(subtotal), 2) AS gross_subtotal,
                ROUND(SUM(total_discount), 2) AS discounts_given,
                ROUND(SUM(total_tax), 2) AS taxes_collected,
                ROUND(SUM(grand_total), 2) AS daily_grand_total,
                ROUND(AVG(grand_total), 2) AS average_basket_value
            FROM invoices
            WHERE payment_status != 'VOID'
            GROUP BY date(invoice_date)
        )
        SELECT 
            billing_date,
            total_bills_count,
            gross_subtotal,
            discounts_given,
            taxes_collected,
            daily_grand_total,
            average_basket_value,
            ROUND(SUM(daily_grand_total) OVER (ORDER BY billing_date ASC), 2) AS cumulative_revenue_to_date,
            ROUND(
                AVG(daily_grand_total) OVER (
                    ORDER BY billing_date ASC 
                    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                ), 
                2
            ) AS rolling_7_day_average_sales
        FROM DailyBilling
        ORDER BY billing_date DESC
        LIMIT 30
    `,

    // 5. Customer Overdue Credit Aging Matrix (Khata Analysis)
    CUSTOMER_CREDIT_AGING: `
        WITH CustomerUnpaidInvoices AS (
            SELECT 
                c.id AS customer_id,
                c.customer_code,
                c.name AS customer_name,
                c.customer_type,
                c.phone,
                c.credit_limit,
                c.current_balance,
                i.invoice_number,
                i.balance_due,
                CAST((julianday('now') - julianday(i.invoice_date)) AS INTEGER) AS overdue_days
            FROM customers c
            JOIN invoices i ON c.id = i.customer_id
            WHERE i.balance_due > 0 AND i.payment_status IN ('PARTIAL', 'UNPAID')
        )
        SELECT 
            customer_code,
            customer_name,
            customer_type,
            phone,
            credit_limit,
            current_balance AS total_overdue_balance,
            ROUND((current_balance / NULLIF(credit_limit, 0)) * 100, 1) AS credit_utilization_pct,
            ROUND(SUM(CASE WHEN overdue_days <= 30 THEN balance_due ELSE 0 END), 2) AS bucket_0_to_30_days,
            ROUND(SUM(CASE WHEN overdue_days BETWEEN 31 AND 60 THEN balance_due ELSE 0 END), 2) AS bucket_31_to_60_days,
            ROUND(SUM(CASE WHEN overdue_days BETWEEN 61 AND 90 THEN balance_due ELSE 0 END), 2) AS bucket_61_to_90_days,
            ROUND(SUM(CASE WHEN overdue_days > 90 THEN balance_due ELSE 0 END), 2) AS bucket_90_plus_days,
            CASE 
                WHEN current_balance > credit_limit THEN 'CREDIT_LIMIT_EXCEEDED'
                WHEN SUM(CASE WHEN overdue_days > 60 THEN balance_due ELSE 0 END) > 0 THEN 'OVERDUE_CRITICAL'
                ELSE 'ACCEPTABLE_CREDIT'
            END AS credit_risk_level
        FROM CustomerUnpaidInvoices
        GROUP BY customer_id
        ORDER BY total_overdue_balance DESC
    `,

    // 6. Fabric Profitability & Dense Rank Analysis
    FABRIC_PROFITABILITY_RANK: `
        SELECT 
            f.name AS fabric_type,
            c.name AS category_name,
            p.sku,
            p.name AS product_name,
            ROUND(SUM(it.quantity), 2) AS total_quantity_sold,
            ROUND(SUM(it.total_amount), 2) AS total_revenue_generated,
            ROUND(SUM(it.quantity * it.cost_price), 2) AS total_cogs,
            ROUND(SUM(it.total_amount - (it.quantity * it.cost_price)), 2) AS net_profit_contribution,
            ROUND(
                (SUM(it.total_amount - (it.quantity * it.cost_price)) / 
                NULLIF(SUM(it.total_amount), 0)) * 100, 
                2
            ) AS realized_profit_margin_pct,
            DENSE_RANK() OVER (ORDER BY SUM(it.total_amount - (it.quantity * it.cost_price)) DESC) AS profitability_rank
        FROM invoice_items it
        JOIN products p ON it.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        JOIN fabric_types f ON p.fabric_type_id = f.id
        JOIN invoices inv ON it.invoice_id = inv.id
        WHERE inv.payment_status != 'VOID'
        GROUP BY p.id
        ORDER BY net_profit_contribution DESC
    `,

    // 7. GST / Tax Audit Slab Aggregation & Compliance
    GST_TAX_AUDIT_REPORT: `
        SELECT 
            it.tax_rate AS gst_rate_slab,
            p.hsn_code,
            COUNT(DISTINCT inv.id) AS invoices_count,
            ROUND(SUM(it.quantity), 2) AS total_quantity_billed,
            ROUND(SUM(it.taxable_value), 2) AS total_taxable_turnover,
            ROUND(SUM(CASE WHEN inv.invoice_type = 'RETAIL' THEN it.tax_amount * 0.5 ELSE 0 END), 2) AS total_cgst,
            ROUND(SUM(CASE WHEN inv.invoice_type = 'RETAIL' THEN it.tax_amount * 0.5 ELSE 0 END), 2) AS total_sgst,
            ROUND(SUM(CASE WHEN inv.invoice_type = 'WHOLESALE' THEN it.tax_amount ELSE 0 END), 2) AS total_igst,
            ROUND(SUM(it.tax_amount), 2) AS total_tax_liability,
            ROUND(SUM(it.total_amount), 2) AS total_gross_billed
        FROM invoice_items it
        JOIN invoices inv ON it.invoice_id = inv.id
        JOIN products p ON it.product_id = p.id
        WHERE inv.payment_status != 'VOID'
        GROUP BY it.tax_rate, p.hsn_code
        ORDER BY it.tax_rate ASC, total_taxable_turnover DESC
    `,

    // 8. Reorder Forecast & Velocity
    STOCK_RUNOUT_FORECAST: `
        WITH SalesVelocity AS (
            SELECT 
                it.product_id,
                ROUND(SUM(it.quantity) / 30.0, 3) AS avg_daily_sales_rate
            FROM invoice_items it
            JOIN invoices inv ON it.invoice_id = inv.id
            WHERE julianday('now') - julianday(inv.invoice_date) <= 30
              AND inv.payment_status != 'VOID'
            GROUP BY it.product_id
        )
        SELECT 
            p.sku,
            p.name AS product_name,
            c.name AS category_name,
            u.code AS uom,
            p.current_stock,
            p.min_stock_level,
            COALESCE(sv.avg_daily_sales_rate, 0) AS daily_burn_rate,
            CASE 
                WHEN COALESCE(sv.avg_daily_sales_rate, 0) <= 0 THEN 'NO_RECENT_SALES'
                ELSE CAST(ROUND(p.current_stock / sv.avg_daily_sales_rate, 0) AS INTEGER) || ' Days'
            END AS estimated_days_remaining,
            CASE 
                WHEN p.current_stock <= 0 THEN 'CRITICAL: OUT_OF_STOCK'
                WHEN COALESCE(sv.avg_daily_sales_rate, 0) > 0 AND (p.current_stock / sv.avg_daily_sales_rate) < 7 THEN 'URGENT: REORDER_NOW'
                WHEN p.current_stock <= p.min_stock_level THEN 'WARNING: BELOW_MIN_THRESHOLD'
                ELSE 'HEALTHY_STOCK'
            END AS inventory_action_required
        FROM products p
        JOIN categories c ON p.category_id = c.id
        JOIN uoms u ON p.uom_id = u.id
        LEFT JOIN SalesVelocity sv ON p.id = sv.product_id
        WHERE p.is_active = 1
        ORDER BY 
            CASE 
                WHEN p.current_stock <= 0 THEN 1
                WHEN COALESCE(sv.avg_daily_sales_rate, 0) > 0 AND (p.current_stock / sv.avg_daily_sales_rate) < 7 THEN 2
                WHEN p.current_stock <= p.min_stock_level THEN 3
                ELSE 4
            END,
            p.current_stock ASC
    `
};
