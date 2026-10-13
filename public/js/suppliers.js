/**
 * Supplier & Goods Received Notes (GRN) Controller
 */

const Suppliers = {
    suppliers: [],
    purchases: [],

    async init() {
        await Promise.all([this.loadSuppliers(), this.loadPurchases()]);
        this.bindEvents();
    },

    bindEvents() {
        const formAddSup = document.getElementById('form-add-supplier');
        if (formAddSup) {
            formAddSup.addEventListener('submit', (e) => this.handleSaveSupplier(e));
        }

        const formGrn = document.getElementById('form-stock-inward');
        if (formGrn) {
            formGrn.addEventListener('submit', (e) => this.handleSaveInward(e));
        }
    },

    async loadSuppliers() {
        try {
            const res = await API.suppliers.getAll();
            if (res.success) {
                this.suppliers = res.data;
                this.renderSuppliersTable();
                this.populateSupplierSelects();
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    },

    async loadPurchases() {
        try {
            const res = await API.suppliers.getPurchases();
            if (res.success) {
                this.purchases = res.data;
                this.renderPurchasesTable();
            }
        } catch (error) {
            console.error('Error fetching purchases:', error);
        }
    },

    populateSupplierSelects() {
        const select = document.getElementById('grn-supplier-select');
        if (select) {
            select.innerHTML = this.suppliers.map(s => `
                <option value="${s.id}">${s.company_name} (${s.supplier_code}) - ${s.city || ''}</option>
            `).join('');
        }
    },

    renderSuppliersTable() {
        const tbody = document.getElementById('suppliers-tbody');
        if (!tbody) return;

        if (this.suppliers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:#94a3b8;">No suppliers found.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.suppliers.map(s => `
            <tr>
                <td><strong>${s.supplier_code}</strong></td>
                <td>
                    <div style="font-weight:700;">${s.company_name}</div>
                    <div style="font-size:0.75rem; color:#64748b;">${s.contact_person || 'N/A'}</div>
                </td>
                <td>${s.phone}</td>
                <td><code>${s.gstin || 'Unregistered'}</code></td>
                <td>${s.city || ''}, ${s.state || ''}</td>
                <td><strong>₹${Number(s.outstanding_payable || 0).toFixed(2)}</strong></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="Suppliers.openInwardForSupplier(${s.id})">
                        + Inward Stock
                    </button>
                </td>
            </tr>
        `).join('');
    },

    renderPurchasesTable() {
        const tbody = document.getElementById('purchases-tbody');
        if (!tbody) return;

        if (this.purchases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:#94a3b8;">No purchase orders received yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.purchases.map(p => `
            <tr>
                <td><strong>${p.purchase_number}</strong></td>
                <td>${p.purchase_date}</td>
                <td><strong>${p.supplier_name}</strong> (${p.supplier_code})</td>
                <td>${p.supplier_invoice_no || '-'}</td>
                <td><strong>₹${Number(p.total_amount).toFixed(2)}</strong></td>
                <td><span class="badge badge-paid">${p.payment_status}</span></td>
            </tr>
        `).join('');
    },

    openAddSupplierModal() {
        document.getElementById('form-add-supplier').reset();
        document.getElementById('modal-add-supplier').showModal();
    },

    async handleSaveSupplier(e) {
        e.preventDefault();
        const payload = {
            company_name: document.getElementById('modal-sup-company').value,
            contact_person: document.getElementById('modal-sup-contact').value,
            phone: document.getElementById('modal-sup-phone').value,
            email: document.getElementById('modal-sup-email').value,
            gstin: document.getElementById('modal-sup-gstin').value,
            address: document.getElementById('modal-sup-address').value,
            city: document.getElementById('modal-sup-city').value,
            state: document.getElementById('modal-sup-state').value
        };

        try {
            await API.suppliers.create(payload);
            App.showToast('Supplier added successfully', 'success');
            document.getElementById('modal-add-supplier').close();
            await this.loadSuppliers();
        } catch (error) {
            console.error('Error adding supplier:', error);
            App.showToast('Failed to add supplier: ' + error.message, 'error');
        }
    },

    openInwardModal() {
        const prodSelect = document.getElementById('grn-product-select');
        if (prodSelect && window.Inventory && window.Inventory.products) {
            prodSelect.innerHTML = window.Inventory.products.map(p => `
                <option value="${p.id}">${p.name} (${p.sku}) - Current: ${p.current_stock} ${p.uom_code}</option>
            `).join('');
        }
        document.getElementById('form-stock-inward').reset();
        document.getElementById('modal-stock-inward').showModal();
    },

    openInwardForSupplier(supplierId) {
        this.openInwardModal();
        const supSelect = document.getElementById('grn-supplier-select');
        if (supSelect) supSelect.value = supplierId;
    },

    async handleSaveInward(e) {
        e.preventDefault();
        const supplier_id = parseInt(document.getElementById('grn-supplier-select').value, 10);
        const product_id = parseInt(document.getElementById('grn-product-select').value, 10);
        const supplier_invoice_no = document.getElementById('grn-inv-no').value;
        const quantity = parseFloat(document.getElementById('grn-quantity').value);
        const unit_cost = parseFloat(document.getElementById('grn-unit-cost').value);
        const roll_number = document.getElementById('grn-roll-number').value;
        const rack = document.getElementById('grn-rack').value;

        if (isNaN(quantity) || quantity <= 0 || isNaN(unit_cost) || unit_cost <= 0) {
            App.showToast('Quantity and cost must be positive values', 'error');
            return;
        }

        const items = [{
            product_id,
            quantity,
            unit_cost,
            rolls: roll_number ? [{ roll_number, length: quantity, rack: rack || 'Bay Inward' }] : []
        }];

        try {
            const res = await API.suppliers.createPurchase({
                supplier_id,
                supplier_invoice_no,
                items,
                notes: 'Mill Stock Inward'
            });

            App.showToast(`Goods Inward #${res.data.purchaseNumber} recorded successfully!`, 'success');
            document.getElementById('modal-stock-inward').close();
            await Promise.all([this.loadPurchases(), this.loadSuppliers()]);
            if (window.Inventory) Inventory.loadProducts();
            if (window.POS) POS.loadProducts();
            if (window.Dashboard) Dashboard.loadData();
        } catch (error) {
            console.error('Error saving inward:', error);
            App.showToast('Stock Inward Failed: ' + error.message, 'error');
        }
    }
};

window.Suppliers = Suppliers;
