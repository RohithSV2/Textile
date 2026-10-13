/**
 * Complex SQL Analytics & Query Workbench Controller
 */

const Analytics = {
    catalog: [],
    activeQueryKey: 'inventory_valuation',

    async init() {
        await this.loadCatalog();
        this.bindEvents();
        await this.runQuery(this.activeQueryKey);
    },

    bindEvents() {
        const customSqlForm = document.getElementById('form-custom-sql');
        if (customSqlForm) {
            customSqlForm.addEventListener('submit', (e) => this.handleCustomSqlRun(e));
        }

        const copyBtn = document.getElementById('btn-copy-sql');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const code = document.getElementById('analytics-sql-code')?.textContent;
                if (code) {
                    navigator.clipboard.writeText(code);
                    App.showToast('SQL copied to clipboard', 'info');
                }
            });
        }
    },

    async loadCatalog() {
        try {
            const res = await API.analytics.getQueriesCatalog();
            if (res.success) {
                this.catalog = res.data;
                this.renderCatalogList();
            }
        } catch (error) {
            console.error('Error fetching query catalog:', error);
        }
    },

    renderCatalogList() {
        const container = document.getElementById('analytics-queries-nav');
        if (!container) return;

        container.innerHTML = this.catalog.map(q => `
            <button class="nav-item ${q.key === this.activeQueryKey ? 'active' : ''}" onclick="Analytics.runQuery('${q.key}')" style="justify-content:space-between; margin-bottom:4px; font-size:0.82rem; padding:10px 12px;">
                <span>${q.title}</span>
                <span class="badge" style="background:#1e293b; color:#94a3b8; font-size:0.68rem; margin-left:8px;">${q.badge}</span>
            </button>
        `).join('');
    },

    async runQuery(queryKey) {
        this.activeQueryKey = queryKey;
        this.renderCatalogList();

        const titleEl = document.getElementById('analytics-query-title');
        const descEl = document.getElementById('analytics-query-desc');
        const conceptsEl = document.getElementById('analytics-concepts-badges');
        const codeEl = document.getElementById('analytics-sql-code');
        const metaEl = document.getElementById('analytics-exec-meta');
        const tableContainer = document.getElementById('analytics-results-table-wrap');

        if (metaEl) metaEl.textContent = 'Executing query...';

        try {
            const res = await API.analytics.runComplexQuery(queryKey);
            if (!res.success) throw new Error(res.message);

            const { metadata, data } = res;

            if (titleEl) titleEl.textContent = metadata.title;
            if (descEl) descEl.textContent = metadata.description;

            if (conceptsEl) {
                conceptsEl.innerHTML = metadata.concepts.map(c => `
                    <span class="badge" style="background:#e0e7ff; color:#4338ca; font-size:0.72rem;">${c}</span>
                `).join('');
            }

            if (codeEl) codeEl.textContent = metadata.sql;
            if (metaEl) metaEl.innerHTML = `⚡ Execution time: <strong>${metadata.executionTimeMs}</strong> | Rows: <strong>${metadata.rowCount}</strong>`;

            this.renderResultsTable(data, tableContainer);
        } catch (error) {
            console.error('Error running complex query:', error);
            App.showToast('Failed to execute query: ' + error.message, 'error');
            if (tableContainer) {
                tableContainer.innerHTML = `<div style="padding:24px; color:#e11d48; text-align:center;">Error: ${error.message}</div>`;
            }
        }
    },

    renderResultsTable(rows, container) {
        if (!container) return;

        if (!rows || rows.length === 0) {
            container.innerHTML = `<div style="padding:32px; text-align:center; color:#94a3b8;">Query returned 0 rows.</div>`;
            return;
        }

        const columns = Object.keys(rows[0]);

        const tableHtml = `
            <div class="table-container" style="max-height: 480px; overflow-y: auto;">
                <table>
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col.replace(/_/g, ' ')}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                ${columns.map(col => {
                                    const val = row[col];
                                    return `<td>${this.formatCellValue(col, val)}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;
    },

    formatCellValue(colName, val) {
        if (val === null || val === undefined) return '<span style="color:#cbd5e1;">-</span>';

        const col = colName.toLowerCase();

        // Currency formatting
        if (col.includes('value') || col.includes('margin') || col.includes('capital') ||
            col.includes('total') || col.includes('cogs') || col.includes('price') ||
            col.includes('subtotal') || col.includes('cgst') || col.includes('sgst') ||
            col.includes('igst') || col.includes('balance') || col.includes('bucket')) {
            if (typeof val === 'number') {
                return `<strong>₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>`;
            }
        }

        // Percentage formatting
        if (col.includes('percent') || col.includes('pct')) {
            if (typeof val === 'number') {
                return `<span style="font-weight:700; color:${val >= 30 ? '#059669' : (val > 10 ? '#d97706' : '#e11d48')};">${val}%</span>`;
            }
        }

        // Status badges
        if (typeof val === 'string' && (val.includes('STOCK') || val.includes('CREDIT') || val.includes('CYCLE') || val.includes('URGENT') || val.includes('WARNING') || val.includes('HEALTHY'))) {
            let badgeClass = 'badge-optimal';
            if (val.includes('DEAD') || val.includes('CRITICAL') || val.includes('EXCEEDED') || val.includes('OUT')) {
                badgeClass = 'badge-out';
            } else if (val.includes('SLOW') || val.includes('BELOW') || val.includes('WARNING')) {
                badgeClass = 'badge-low';
            }
            return `<span class="badge ${badgeClass}">${val.replace(/_/g, ' ')}</span>`;
        }

        return val;
    },

    async handleCustomSqlRun(e) {
        e.preventDefault();
        const textarea = document.getElementById('custom-sql-input');
        const sql = textarea?.value?.trim();
        if (!sql) return;

        const tableContainer = document.getElementById('custom-sql-results-wrap');
        const metaEl = document.getElementById('custom-sql-meta');

        if (metaEl) metaEl.textContent = 'Running custom query...';

        try {
            const res = await API.analytics.runCustomSql(sql);
            if (!res.success) throw new Error(res.message);

            if (metaEl) metaEl.innerHTML = `⚡ Execution time: <strong>${res.metadata.executionTimeMs}</strong> | Rows: <strong>${res.metadata.rowCount}</strong>`;
            this.renderResultsTable(res.data, tableContainer);
            App.showToast(`Custom query executed successfully (${res.metadata.rowCount} rows)`, 'success');
        } catch (error) {
            console.error('Custom SQL error:', error);
            App.showToast(error.message, 'error');
            if (tableContainer) {
                tableContainer.innerHTML = `<div style="padding:24px; color:#e11d48; text-align:center;">Error: ${error.message}</div>`;
            }
        }
    }
};

window.Analytics = Analytics;
