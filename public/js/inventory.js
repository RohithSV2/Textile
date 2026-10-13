/**
 * Inventory & Roll Management Controller
 */

const Inventory = {
    products: [],
    metadata: { categories: [], fabrics: [], uoms: [] },
    currentTab: 'catalog', // 'catalog', 'rolls', 'transactions'

    async init() {
        await this.loadMetadata();
        await this.loadProducts();
        this.bindEvents();
    },

    async loadMetadata() {
        try {
            const res = await API.products.getMetadata();
            if (res.success) {
                this.metadata = res.data;
                this.populateMetadataSelects();
            }
        } catch (error) {
            console.error('Error loading metadata:', error);
        }
    },

    populateMetadataSelects() {
        const catSelect = document.getElementById('inv-filter-category');
        const prodCat = document.getElementById('modal-prod-category');
        if (catSelect) {
            catSelect.innerHTML = `<option value="">All Categories</option>` +
                this.metadata.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
        if (prodCat) {
            prodCat.innerHTML = this.metadata.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        const prodFabric = document.getElementById('modal-prod-fabric');
        if (prodFabric) {
            prodFabric.innerHTML = this.metadata.fabrics.map(f => `<option value="${f.id}">${f.name} (${f.composition})</option>`).join('');
        }

        const prodUom = document.getElementById('modal-prod-uom');
        if (prodUom) {
            prodUom.innerHTML = this.metadata.uoms.map(u => `<option value="${u.id}">${u.name} (${u.code})</option>`).join('');
        }
    },

    bindEvents() {
        // Tab switching
        const tabs = document.querySelectorAll('.inv-sub-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTab = tab.getAttribute('data-tab');
                this.switchTab(this.currentTab);
            });
        });

        // Search and Filters
        const searchInput = document.getElementById('inv-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.loadProducts());
        }

        const catFilter = document.getElementById('inv-filter-category');
        if (catFilter) {
            catFilter.addEventListener('change', () => this.loadProducts());
        }

        const statusFilter = document.getElementById('inv-filter-status');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.loadProducts());
        }

        // Form Submit for Add/Edit Product
        const prodForm = document.getElementById('form-add-product');
        if (prodForm) {
            prodForm.addEventListener('submit', (e) => this.handleSaveProduct(e));
        }

        // Form Submit for Stock Adjustment
        const adjForm = document.getElementById('form-stock-adjustment');
        if (adjForm) {
            adjForm.addEventListener('submit', (e) => this.handleSaveAdjustment(e));
        }
    },

    switchTab(tab) {
        document.getElementById('inv-catalog-view').style.display = tab === 'catalog' ? 'block' : 'none';
        document.getElementById('inv-rolls-view').style.display = tab === 'rolls' ? 'block' : 'none';
        document.getElementById('inv-transactions-view').style.display = tab === 'transactions' ? 'block' : 'none';

        if (tab === 'catalog') this.loadProducts();
        else if (tab === 'rolls') this.loadRolls();
        else if (tab === 'transactions') this.loadTransactions();
    },

    async loadProducts() {
        const search = document.getElementById('inv-search-input')?.value || '';
        const category = document.getElementById('inv-filter-category')?.value || '';
        const status = document.getElementById('inv-filter-status')?.value || '';

        try {
            const res = await API.products.getAll({ search, category, status });
            if (res.success) {
                this.products = res.data;
                this.renderProductsTable();
            }
        } catch (error) {
            console.error('Error fetching inventory products:', error);
            App.showToast('Failed to load inventory products', 'error');
        }
    },

    renderProductsTable() {
        const tbody = document.getElementById('inv-products-tbody');
        if (!tbody) return;

        if (this.products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 32px; color: #94a3b8;">No matching products in inventory.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.products.map(p => {
            const isOut = p.current_stock <= 0;
            const isLow = p.current_stock > 0 && p.current_stock <= p.min_stock_level;
            const badgeClass = isOut ? 'badge-out' : (isLow ? 'badge-low' : 'badge-optimal');

            return `
                <tr>
                    <td><strong>${p.sku}</strong><br><span style="font-size:0.72rem; color:#64748b;">${p.barcode || ''}</span></td>
                    <td>
                        <div style="font-weight:700;">${p.name}</div>
                        <div style="font-size:0.75rem; color:#64748b;">${p.color || ''} ${p.pattern_design ? '• ' + p.pattern_design : ''}</div>
                    </td>
                    <td><span class="badge" style="background:#e0e7ff; color:#4338ca;">${p.category_name}</span></td>
                    <td><div style="font-weight:600; font-size:0.8rem;">${p.fabric_name}</div></td>
                    <td>₹${p.cost_price.toFixed(2)}</td>
                    <td><strong>₹${p.selling_price.toFixed(2)}</strong></td>
                    <td>
                        <span style="font-weight:800; font-size:0.95rem;">${p.current_stock}</span> ${p.uom_code}
                        ${p.rolls_count > 0 ? `<br><span style="font-size:0.7rem; color:#6366f1;">(${p.rolls_count} rolls)</span>` : ''}
                    </td>
                    <td><span class="badge ${badgeClass}">${p.stock_status}</span></td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button class="btn btn-secondary btn-sm" onclick="Inventory.openAdjustmentModal(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.current_stock})" title="Adjust Stock">
                                ⚖️ Adjust
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="Inventory.openEditModal(${p.id})" title="Edit Product">
                                ✏️
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async loadRolls() {
        try {
            const res = await API.inventory.getRolls();
            if (!res.success) return;

            const tbody = document.getElementById('inv-rolls-tbody');
            if (!tbody) return;

            tbody.innerHTML = res.data.map(r => {
                const agingBadge = r.aging_category === 'DEAD_STOCK' ? 'badge-out' : (r.aging_category === 'SLOW_MOVING' ? 'badge-low' : 'badge-optimal');
                return `
                    <tr>
                        <td><strong>${r.roll_number}</strong></td>
                        <td>
                            <div style="font-weight:600;">${r.product_name}</div>
                            <span style="font-size:0.72rem; color:#64748b;">${r.sku} • ${r.fabric_name}</span>
                        </td>
                        <td><span style="font-weight:700; background:#f1f5f9; padding:3px 8px; border-radius:4px;">📍 ${r.location_rack || 'General'}</span></td>
                        <td>${r.initial_length} m</td>
                        <td><strong>${r.current_length} m</strong></td>
                        <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
                        <td>
                            <strong>${r.age_days} days</strong>
                            <span class="badge ${agingBadge}" style="font-size:0.65rem; margin-left:4px;">${r.aging_category}</span>
                        </td>
                        <td>₹${Number(r.tied_up_cost_value).toFixed(2)}</td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Error fetching rolls:', error);
            App.showToast('Failed to load rolls', 'error');
        }
    },

    async loadTransactions() {
        try {
            const res = await API.inventory.getTransactions();
            if (!res.success) return;

            const tbody = document.getElementById('inv-transactions-tbody');
            if (!tbody) return;

            tbody.innerHTML = res.data.map(t => {
                const isPositive = t.quantity_change > 0;
                return `
                    <tr>
                        <td>${new Date(t.created_at).toLocaleString('en-IN')}</td>
                        <td><strong>${t.product_name}</strong> (${t.sku})</td>
                        <td><span class="badge" style="background:#f1f5f9; font-weight:700;">${t.transaction_type}</span></td>
                        <td><code>${t.reference_id}</code></td>
                        <td style="color: ${isPositive ? '#059669' : '#e11d48'}; font-weight: 700;">
                            ${isPositive ? '+' : ''}${t.quantity_change} ${t.uom_code}
                        </td>
                        <td><strong>${t.stock_after} ${t.uom_code}</strong></td>
                        <td style="font-size:0.8rem; color:#64748b;">${t.remarks || '-'}</td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }
    },

    openAddModal() {
        document.getElementById('modal-product-title').textContent = 'Add New Fabric / Product';
        document.getElementById('form-add-product').reset();
        document.getElementById('modal-prod-id').value = '';
        document.getElementById('modal-add-product').showModal();
    },

    async openEditModal(productId) {
        try {
            const res = await API.products.getById(productId);
            if (!res.success) return;

            const p = res.data;
            document.getElementById('modal-product-title').textContent = `Edit Product: ${p.sku}`;
            document.getElementById('modal-prod-id').value = p.id;
            document.getElementById('modal-prod-name').value = p.name;
            document.getElementById('modal-prod-category').value = p.category_id;
            document.getElementById('modal-prod-fabric').value = p.fabric_type_id;
            document.getElementById('modal-prod-uom').value = p.uom_id;
            document.getElementById('modal-prod-hsn').value = p.hsn_code;
            document.getElementById('modal-prod-tax').value = p.tax_rate;
            document.getElementById('modal-prod-cost').value = p.cost_price;
            document.getElementById('modal-prod-retail').value = p.selling_price;
            document.getElementById('modal-prod-wholesale').value = p.wholesale_price || p.selling_price;
            document.getElementById('modal-prod-min-stock').value = p.min_stock_level;
            document.getElementById('modal-prod-color').value = p.color || '';
            document.getElementById('modal-prod-pattern').value = p.pattern_design || '';

            // Hide initial roll input during edit
            document.getElementById('modal-initial-roll-section').style.display = 'none';

            document.getElementById('modal-add-product').showModal();
        } catch (error) {
            console.error('Error opening edit modal:', error);
        }
    },

    async handleSaveProduct(e) {
        e.preventDefault();
        const id = document.getElementById('modal-prod-id').value;

        const payload = {
            name: document.getElementById('modal-prod-name').value,
            category_id: parseInt(document.getElementById('modal-prod-category').value, 10),
            fabric_type_id: parseInt(document.getElementById('modal-prod-fabric').value, 10),
            uom_id: parseInt(document.getElementById('modal-prod-uom').value, 10),
            hsn_code: document.getElementById('modal-prod-hsn').value,
            tax_rate: parseFloat(document.getElementById('modal-prod-tax').value),
            cost_price: parseFloat(document.getElementById('modal-prod-cost').value),
            selling_price: parseFloat(document.getElementById('modal-prod-retail').value),
            wholesale_price: parseFloat(document.getElementById('modal-prod-wholesale').value),
            min_stock_level: parseFloat(document.getElementById('modal-prod-min-stock').value),
            color: document.getElementById('modal-prod-color').value,
            pattern_design: document.getElementById('modal-prod-pattern').value
        };

        if (!id) {
            // New product: check initial roll
            const rollNum = document.getElementById('modal-prod-roll-number')?.value;
            const rollLen = parseFloat(document.getElementById('modal-prod-roll-length')?.value || 0);
            const rollRack = document.getElementById('modal-prod-roll-rack')?.value;

            if (rollNum && rollLen > 0) {
                payload.current_stock = rollLen;
                payload.initial_roll = {
                    roll_number: rollNum,
                    initial_length: rollLen,
                    location_rack: rollRack || 'Rack Inward'
                };
            }
        }

        try {
            if (id) {
                await API.products.update(id, payload);
                App.showToast('Product updated successfully', 'success');
            } else {
                await API.products.create(payload);
                App.showToast('New Product added successfully', 'success');
            }

            document.getElementById('modal-add-product').close();
            await this.loadProducts();
            if (window.POS) POS.loadProducts();
            if (window.Dashboard) Dashboard.loadData();
        } catch (error) {
            console.error('Error saving product:', error);
            App.showToast('Failed to save product: ' + error.message, 'error');
        }
    },

    openAdjustmentModal(productId, productName, currentStock) {
        document.getElementById('adj-prod-id').value = productId;
        document.getElementById('adj-prod-name-display').textContent = `${productName} (Current: ${currentStock})`;
        document.getElementById('adj-qty').value = '';
        document.getElementById('adj-remarks').value = '';
        document.getElementById('modal-stock-adjustment').showModal();
    },

    async handleSaveAdjustment(e) {
        e.preventDefault();
        const productId = document.getElementById('adj-prod-id').value;
        const qty = parseFloat(document.getElementById('adj-qty').value);
        const type = document.getElementById('adj-type').value;
        const remarks = document.getElementById('adj-remarks').value;

        if (isNaN(qty) || qty === 0) {
            App.showToast('Quantity change cannot be zero', 'error');
            return;
        }

        try {
            await API.inventory.adjustStock({
                product_id: parseInt(productId, 10),
                type,
                quantity_change: qty,
                remarks
            });

            App.showToast('Stock adjusted successfully', 'success');
            document.getElementById('modal-stock-adjustment').close();
            await this.loadProducts();
            if (window.POS) POS.loadProducts();
            if (window.Dashboard) Dashboard.loadData();
        } catch (error) {
            console.error('Error adjusting stock:', error);
            App.showToast('Stock adjustment failed: ' + error.message, 'error');
        }
    }
};

window.Inventory = Inventory;
