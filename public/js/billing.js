/**
 * Billing & Invoices History Controller
 */

const Billing = {
    invoices: [],

    async init() {
        await this.loadInvoices();
        this.bindEvents();
    },

    bindEvents() {
        const searchInput = document.getElementById('bill-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.loadInvoices());
        }

        const statusSelect = document.getElementById('bill-filter-status');
        if (statusSelect) {
            statusSelect.addEventListener('change', () => this.loadInvoices());
        }

        const methodSelect = document.getElementById('bill-filter-method');
        if (methodSelect) {
            methodSelect.addEventListener('change', () => this.loadInvoices());
        }
    },

    async loadInvoices() {
        const search = document.getElementById('bill-search-input')?.value || '';
        const status = document.getElementById('bill-filter-status')?.value || '';
        const payment_method = document.getElementById('bill-filter-method')?.value || '';

        try {
            const res = await API.billing.getAll({ search, status, payment_method });
            if (res.success) {
                this.invoices = res.data;
                this.renderInvoicesTable();
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
            App.showToast('Failed to load invoices', 'error');
        }
    },

    renderInvoicesTable() {
        const tbody = document.getElementById('billing-invoices-tbody');
        if (!tbody) return;

        if (this.invoices.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 32px; color: #94a3b8;">No sales invoices found.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.invoices.map(inv => {
            const isVoid = inv.payment_status === 'VOID';
            const statusBadge = `<span class="badge badge-${inv.payment_status.toLowerCase()}">${inv.payment_status}</span>`;
            const dateStr = new Date(inv.invoice_date).toLocaleDateString('en-IN', {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return `
                <tr style="${isVoid ? 'opacity:0.6; background:#fff1f2;' : ''}">
                    <td><strong>${inv.invoice_number}</strong></td>
                    <td style="font-size:0.8rem;">${dateStr}</td>
                    <td>
                        <div style="font-weight:600;">${inv.customer_name}</div>
                        <span style="font-size:0.72rem; color:#64748b;">${inv.customer_phone}</span>
                    </td>
                    <td><span class="badge badge-${inv.invoice_type.toLowerCase()}">${inv.invoice_type}</span></td>
                    <td><strong>₹${Number(inv.grand_total).toFixed(2)}</strong></td>
                    <td style="color:#059669; font-weight:600;">₹${Number(inv.paid_amount).toFixed(2)}</td>
                    <td style="color:${inv.balance_due > 0 ? '#e11d48' : '#64748b'}; font-weight:700;">
                        ${inv.balance_due > 0 ? `₹${Number(inv.balance_due).toFixed(2)}` : 'Nil'}
                    </td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button class="btn btn-secondary btn-sm" onclick="POS.openInvoicePrintPreview(${inv.id})" title="View & Print Tax Invoice">
                                🖨️ View
                            </button>
                            ${!isVoid ? `
                                <button class="btn btn-danger btn-sm" onclick="Billing.promptVoidInvoice(${inv.id}, '${inv.invoice_number}')" title="Void / Cancel Invoice">
                                    Void
                                </button>
                            ` : `<span style="font-size:0.75rem; color:#e11d48; font-weight:700;">VOIDED</span>`}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async promptVoidInvoice(id, invNumber) {
        const reason = prompt(`Enter reason to VOID invoice ${invNumber} (Stock will be automatically restored):`);
        if (!reason) return;

        try {
            const res = await API.billing.void(id, { reason });
            if (!res.success) throw new Error(res.message);

            App.showToast(`Invoice ${invNumber} voided and inventory restored`, 'success');
            await this.loadInvoices();
            if (window.Inventory) Inventory.loadProducts();
            if (window.Dashboard) Dashboard.loadData();
        } catch (error) {
            console.error('Error voiding invoice:', error);
            App.showToast('Failed to void invoice: ' + error.message, 'error');
        }
    }
};

window.Billing = Billing;
