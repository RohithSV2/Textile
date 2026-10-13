/**
 * Customer & Khata Credit Ledger Controller
 */

const Customers = {
    customers: [],

    async init() {
        await this.loadCustomers();
        this.bindEvents();
    },

    bindEvents() {
        const searchInput = document.getElementById('cust-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.loadCustomers());
        }

        const typeSelect = document.getElementById('cust-filter-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => this.loadCustomers());
        }

        const formAddCust = document.getElementById('form-add-customer');
        if (formAddCust) {
            formAddCust.addEventListener('submit', (e) => this.handleSaveCustomer(e));
        }

        const formPay = document.getElementById('form-record-customer-payment');
        if (formPay) {
            formPay.addEventListener('submit', (e) => this.handleSavePayment(e));
        }
    },

    async loadCustomers() {
        const search = document.getElementById('cust-search-input')?.value || '';
        const type = document.getElementById('cust-filter-type')?.value || '';

        try {
            const res = await API.customers.getAll({ search, type });
            if (res.success) {
                this.customers = res.data;
                this.renderCustomersTable();
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
            App.showToast('Failed to load customers', 'error');
        }
    },

    renderCustomersTable() {
        const tbody = document.getElementById('customers-tbody');
        if (!tbody) return;

        if (this.customers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 32px; color: #94a3b8;">No customer records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.customers.map(c => {
            const isExceeded = c.credit_limit > 0 && c.current_balance > c.credit_limit;
            const utilPct = Math.min(100, c.credit_used_pct || 0);

            return `
                <tr>
                    <td><strong>${c.customer_code}</strong></td>
                    <td>
                        <div style="font-weight:700;">${c.name}</div>
                        <div style="font-size:0.75rem; color:#64748b;">${c.email || 'No email'}</div>
                    </td>
                    <td>${c.phone}</td>
                    <td><span class="badge badge-${c.customer_type.toLowerCase()}">${c.customer_type}</span></td>
                    <td>₹${Number(c.credit_limit).toFixed(2)}</td>
                    <td>
                        <div style="font-weight:800; font-size:0.95rem; color:${c.current_balance > 0 ? '#e11d48' : '#059669'};">
                            ₹${Number(c.current_balance).toFixed(2)}
                        </div>
                        ${c.credit_limit > 0 ? `
                            <div style="width:100px; height:5px; background:#e2e8f0; border-radius:3px; margin-top:4px; overflow:hidden;">
                                <div style="width:${utilPct}%; height:100%; background:${isExceeded ? '#e11d48' : '#4f46e5'};"></div>
                            </div>
                        ` : ''}
                    </td>
                    <td><strong>₹${Number(c.total_purchases).toFixed(2)}</strong></td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button class="btn btn-secondary btn-sm" onclick="Customers.viewLedger(${c.id})" title="View Complete Ledger">
                                📜 Ledger
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="Customers.openPaymentModal(${c.id}, '${c.name.replace(/'/g, "\\'")}', ${c.current_balance})" title="Receive Payment">
                                💳 Pay
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openAddModal() {
        document.getElementById('form-add-customer').reset();
        document.getElementById('modal-add-customer').showModal();
    },

    async handleSaveCustomer(e) {
        e.preventDefault();
        const payload = {
            name: document.getElementById('modal-cust-name').value,
            customer_type: document.getElementById('modal-cust-type').value,
            phone: document.getElementById('modal-cust-phone').value,
            email: document.getElementById('modal-cust-email').value,
            gstin: document.getElementById('modal-cust-gstin').value,
            address: document.getElementById('modal-cust-address').value,
            city: document.getElementById('modal-cust-city').value,
            credit_limit: parseFloat(document.getElementById('modal-cust-credit').value || 5000)
        };

        try {
            await API.customers.create(payload);
            App.showToast('Customer added successfully', 'success');
            document.getElementById('modal-add-customer').close();
            await this.loadCustomers();
            if (window.POS) POS.loadCustomers();
        } catch (error) {
            console.error('Error adding customer:', error);
            App.showToast('Failed to add customer: ' + error.message, 'error');
        }
    },

    openPaymentModal(customerId, customerName, currentBalance) {
        document.getElementById('pay-cust-id').value = customerId;
        document.getElementById('pay-cust-name-display').textContent = `${customerName} (Due: ₹${currentBalance.toFixed(2)})`;
        document.getElementById('pay-amount').value = currentBalance > 0 ? currentBalance : '';
        document.getElementById('pay-notes').value = 'Khata balance settlement';
        document.getElementById('modal-record-payment').showModal();
    },

    async handleSavePayment(e) {
        e.preventDefault();
        const customerId = document.getElementById('pay-cust-id').value;
        const amount = parseFloat(document.getElementById('pay-amount').value);
        const payment_method = document.getElementById('pay-method').value;
        const transaction_ref = document.getElementById('pay-ref').value;
        const notes = document.getElementById('pay-notes').value;

        if (isNaN(amount) || amount <= 0) {
            App.showToast('Please enter a valid payment amount', 'error');
            return;
        }

        try {
            const res = await API.customers.recordPayment(customerId, {
                amount,
                payment_method,
                transaction_ref,
                notes
            });

            App.showToast(`Receipt #${res.receipt_number} issued for ₹${amount.toFixed(2)}`, 'success');
            document.getElementById('modal-record-payment').close();
            await this.loadCustomers();
            if (window.POS) POS.loadCustomers();
            if (window.Dashboard) Dashboard.loadData();
        } catch (error) {
            console.error('Error recording payment:', error);
            App.showToast('Failed to record payment: ' + error.message, 'error');
        }
    },

    async viewLedger(customerId) {
        try {
            const res = await API.customers.getById(customerId);
            if (!res.success) return;

            const c = res.data;
            document.getElementById('ledger-customer-title').textContent = `Khata Ledger: ${c.name} (${c.customer_code})`;
            document.getElementById('ledger-balance-display').textContent = `₹${c.current_balance.toFixed(2)}`;
            document.getElementById('ledger-purchases-display').textContent = `₹${c.total_purchases.toFixed(2)}`;

            const tbody = document.getElementById('ledger-invoices-tbody');
            if (tbody) {
                tbody.innerHTML = c.invoices.map(inv => `
                    <tr>
                        <td><strong>${inv.invoice_number}</strong></td>
                        <td>${new Date(inv.invoice_date).toLocaleDateString('en-IN')}</td>
                        <td>₹${inv.grand_total.toFixed(2)}</td>
                        <td>₹${inv.paid_amount.toFixed(2)}</td>
                        <td style="color:${inv.balance_due > 0 ? '#e11d48' : '#059669'}; font-weight:700;">
                            ₹${inv.balance_due.toFixed(2)}
                        </td>
                        <td><span class="badge badge-${inv.payment_status.toLowerCase()}">${inv.payment_status}</span></td>
                    </tr>
                `).join('');
            }

            const payTbody = document.getElementById('ledger-payments-tbody');
            if (payTbody) {
                payTbody.innerHTML = c.payments.map(p => `
                    <tr>
                        <td><strong>${p.receipt_number}</strong></td>
                        <td>${p.payment_date}</td>
                        <td style="color:#059669; font-weight:700;">+₹${p.amount.toFixed(2)}</td>
                        <td>${p.payment_method}</td>
                        <td style="font-size:0.75rem; color:#64748b;">${p.notes || '-'}</td>
                    </tr>
                `).join('');
            }

            document.getElementById('modal-customer-ledger').showModal();
        } catch (error) {
            console.error('Error loading ledger:', error);
            App.showToast('Failed to load customer ledger', 'error');
        }
    }
};

window.Customers = Customers;
