/**
 * Executive Dashboard Controller & Chart Visualizations
 */

let salesChartInstance = null;
let categoryChartInstance = null;

const Dashboard = {
    async init() {
        await this.loadData();
    },

    async loadData() {
        try {
            const res = await API.analytics.getDashboard();
            if (!res.success) throw new Error(res.message);

            const { kpi, salesTrend, categoryShare, stockHealth, recentSales, lowStockItems } = res.data;

            // 1. Render KPIs
            this.renderKPIs(kpi);

            // 2. Render Urgent Low Stock Banner
            this.renderLowStockBanner(lowStockItems);

            // 3. Render Charts
            this.renderSalesChart(salesTrend);
            this.renderCategoryChart(categoryShare);

            // 4. Render Recent Sales Activity
            this.renderRecentSales(recentSales);
        } catch (error) {
            console.error('Error loading dashboard:', error);
            App.showToast('Failed to load dashboard data: ' + error.message, 'error');
        }
    },

    renderKPIs(kpi) {
        document.getElementById('kpi-today-sales').textContent = `₹${Number(kpi.today_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        document.getElementById('kpi-today-orders').textContent = `${kpi.today_orders_count || 0} bills today`;

        document.getElementById('kpi-inventory-val').textContent = `₹${Number(kpi.total_inventory_valuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        document.getElementById('kpi-active-rolls').textContent = `${kpi.active_rolls_count || 0} active fabric rolls`;

        document.getElementById('kpi-low-stock').textContent = kpi.low_stock_alerts_count || 0;
        document.getElementById('kpi-receivables').textContent = `₹${Number(kpi.total_receivables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        document.getElementById('kpi-gross-profit').textContent = `₹${Number(kpi.total_gross_profit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    },

    renderLowStockBanner(items) {
        const banner = document.getElementById('dashboard-alert-banner');
        if (!items || items.length === 0) {
            banner.style.display = 'none';
            return;
        }

        banner.style.display = 'flex';
        const count = items.length;
        const names = items.map(i => `${i.name} (${i.current_stock} ${i.uom_code})`).slice(0, 3).join(', ');
        document.getElementById('alert-banner-text').innerHTML = `
            <strong>Attention Required:</strong> ${count} products are below critical reorder levels. <span style="color: #64748b;">(${names})</span>
        `;
    },

    renderSalesChart(trend) {
        const ctx = document.getElementById('chart-sales-trend');
        if (!ctx) return;

        if (salesChartInstance) {
            salesChartInstance.destroy();
        }

        const labels = trend.map(t => {
            const d = new Date(t.date);
            return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        });
        const data = trend.map(t => t.total_sales);

        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['No recent data'],
                datasets: [{
                    label: 'Daily Revenue (₹)',
                    data: data.length ? data : [0],
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.08)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#4f46e5',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` Sales: ₹${Number(ctx.raw).toLocaleString('en-IN')}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (val) => '₹' + Number(val).toLocaleString('en-IN')
                        },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    },

    renderCategoryChart(categories) {
        const ctx = document.getElementById('chart-category-dist');
        if (!ctx) return;

        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        const labels = categories.map(c => c.category_name);
        const data = categories.map(c => c.stock_value);
        const colors = [
            '#4f46e5', '#06b6d4', '#10b981', '#f59e0b',
            '#ec4899', '#8b5cf6', '#64748b', '#ef4444'
        ];

        categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}`
                        }
                    }
                },
                cutout: '68%'
            }
        });
    },

    renderRecentSales(sales) {
        const tbody = document.getElementById('dashboard-recent-sales-tbody');
        if (!tbody) return;

        if (!sales || sales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #94a3b8;">No sales activity recorded yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = sales.map(s => {
            const dateStr = new Date(s.invoice_date).toLocaleDateString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const statusBadge = `<span class="badge badge-${s.payment_status.toLowerCase()}">${s.payment_status}</span>`;
            return `
                <tr>
                    <td><strong>${s.invoice_number}</strong></td>
                    <td>${dateStr}</td>
                    <td>
                        <div style="font-weight: 600;">${s.customer_name}</div>
                        <span class="badge badge-${s.customer_type.toLowerCase()}" style="font-size:0.65rem;">${s.customer_type}</span>
                    </td>
                    <td><strong>₹${Number(s.grand_total).toFixed(2)}</strong></td>
                    <td>${s.payment_method}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }
};

window.Dashboard = Dashboard;
