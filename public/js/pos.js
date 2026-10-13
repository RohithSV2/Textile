/**
 * Point of Sale (POS) Billing Terminal Controller
 */

const POS = {
    products: [],
    customers: [],
    cart: [],
    selectedCustomerId: null,
    priceMode: 'RETAIL', // 'RETAIL' or 'WHOLESALE'
    paymentMethod: 'CASH',
    activeCategoryFilter: 'ALL',

    async init() {
        await Promise.all([this.loadProducts(), this.loadCustomers()]);
        this.bindEvents();
        this.renderCart();
    },

    async loadProducts() {
        try {
            const res = await API.products.getAll();
            if (res.success) {
                this.products = res.data;
                this.renderProductCatalog();
            }
        } catch (error) {
            console.error('Error loading products for POS:', error);
            App.showToast('Failed to load products for POS', 'error');
        }
    },

    async loadCustomers() {
        try {
            const res = await API.customers.getAll();
            if (res.success) {
                this.customers = res.data;
                const select = document.getElementById('pos-customer-select');
                if (select) {
                    select.innerHTML = this.customers.map(c => `
                        <option value="${c.id}" ${c.customer_type === 'RETAIL' && c.name.includes('Walk-in') ? 'selected' : ''}>
                            ${c.name} (${c.customer_type}) - ${c.phone} [Bal: ₹${c.current_balance}]
                        </option>
                    `).join('');
                    this.selectedCustomerId = select.value;
                    this.updateCustomerInfoDisplay();
                }
            }
        } catch (error) {
            console.error('Error loading customers for POS:', error);
        }
    },

    bindEvents() {
        // Search Input
        const searchInput = document.getElementById('pos-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterCatalog(e.target.value);
            });
            // Barcode Enter key event
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleBarcodeScan(searchInput.value.trim());
                }
            });
        }

        // Category Filter Pills
        const pills = document.querySelectorAll('.cat-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                pills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.activeCategoryFilter = pill.getAttribute('data-cat') || 'ALL';
                this.filterCatalog(searchInput ? searchInput.value : '');
            });
        });

        // Customer Select Change
        const custSelect = document.getElementById('pos-customer-select');
        if (custSelect) {
            custSelect.addEventListener('change', (e) => {
                this.selectedCustomerId = e.target.value;
                this.updateCustomerInfoDisplay();
            });
        }

        // Price Mode Toggle
        const btnRetail = document.getElementById('mode-retail-btn');
        const btnWholesale = document.getElementById('mode-wholesale-btn');
        if (btnRetail && btnWholesale) {
            btnRetail.addEventListener('click', () => {
                this.setPriceMode('RETAIL');
            });
            btnWholesale.addEventListener('click', () => {
                this.setPriceMode('WHOLESALE');
            });
        }

        // Payment Method Buttons
        const payBtns = document.querySelectorAll('.pay-btn');
        payBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                payBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.paymentMethod = btn.getAttribute('data-method');
            });
        });

        // Checkout Button
        const checkoutBtn = document.getElementById('btn-pos-checkout');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.processCheckout());
        }

        // Clear Cart Button
        const clearBtn = document.getElementById('btn-clear-cart');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.cart.length > 0 && confirm('Are you sure you want to clear the cart?')) {
                    this.clearCart();
                }
            });
        }
    },

    setPriceMode(mode) {
        this.priceMode = mode;
        const btnRetail = document.getElementById('mode-retail-btn');
        const btnWholesale = document.getElementById('mode-wholesale-btn');
        if (mode === 'RETAIL') {
            btnRetail.classList.add('active');
            btnWholesale.classList.remove('active');
        } else {
            btnWholesale.classList.add('active');
            btnRetail.classList.remove('active');
        }

        // Update cart items prices to match mode
        this.cart.forEach(item => {
            item.unit_price = mode === 'WHOLESALE' ? item.product.wholesale_price : item.product.selling_price;
        });

        this.renderProductCatalog();
        this.renderCart();
        App.showToast(`Switched pricing mode to ${mode}`, 'info');
    },

    updateCustomerInfoDisplay() {
        const cust = this.customers.find(c => c.id == this.selectedCustomerId);
        const infoDiv = document.getElementById('pos-customer-ledger-info');
        if (!infoDiv) return;

        if (cust) {
            const hasOverdue = cust.current_balance > 0;
            infoDiv.innerHTML = `
                <div style="font-size:0.75rem; color: ${hasOverdue ? '#e11d48' : '#059669'}; font-weight: 600;">
                    Khata Balance: ₹${Number(cust.current_balance).toFixed(2)} | Limit: ₹${Number(cust.credit_limit).toFixed(2)}
                </div>
            `;
        } else {
            infoDiv.innerHTML = '';
        }
    },

    filterCatalog(searchTerm = '') {
        const term = searchTerm.toLowerCase();
        const filtered = this.products.filter(p => {
            const matchesCat = this.activeCategoryFilter === 'ALL' || p.category_id == this.activeCategoryFilter;
            const matchesSearch = !term ||
                p.name.toLowerCase().includes(term) ||
                p.sku.toLowerCase().includes(term) ||
                (p.barcode && p.barcode.includes(term)) ||
                (p.color && p.color.toLowerCase().includes(term));
            return matchesCat && matchesSearch;
        });

        this.renderProductCatalog(filtered);
    },

    playBeep(type = 'scan') {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            if (type === 'scan') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1760, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                osc.start();
                osc.stop(ctx.currentTime + 0.08);
            } else if (type === 'success') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
            }
        } catch (e) {
            // Audio context policy safe ignore
        }
    },

    handleBarcodeScan(barcode) {
        if (!barcode) return;
        const matched = this.products.find(p => p.barcode === barcode || p.sku.toUpperCase() === barcode.toUpperCase());
        if (matched) {
            this.playBeep('scan');
            this.addToCart(matched.id);
            const input = document.getElementById('pos-search-input');
            if (input) input.value = '';
            this.filterCatalog('');
            App.showToast(`Added "${matched.name}" via Barcode scan`, 'success');
        } else {
            App.showToast(`No product found with Barcode/SKU: "${barcode}"`, 'error');
        }
    },

    renderProductCatalog(list = this.products) {
        const grid = document.getElementById('pos-products-grid');
        if (!grid) return;

        if (list.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: #94a3b8;">No products found matching criteria.</div>`;
            return;
        }

        grid.innerHTML = list.map(p => {
            const isOutOfStock = p.current_stock <= 0;
            const isLowStock = p.current_stock > 0 && p.current_stock <= p.min_stock_level;
            const stockBadgeClass = isOutOfStock ? 'badge-out' : (isLowStock ? 'badge-low' : 'badge-optimal');
            const stockText = isOutOfStock ? 'OUT OF STOCK' : `${p.current_stock} ${p.uom_code}`;

            const price = this.priceMode === 'WHOLESALE' ? p.wholesale_price : p.selling_price;

            return `
                <div class="pos-product-card" onclick="POS.addToCart(${p.id})" style="${isOutOfStock ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
                    <div>
                        <div class="pos-card-sku">${p.sku} ${p.color ? '• ' + p.color : ''}</div>
                        <div class="pos-card-name" title="${p.name}">${p.name}</div>
                        <div class="pos-card-fabric">${p.fabric_name}</div>
                    </div>
                    <div class="pos-card-footer">
                        <div>
                            <div class="pos-card-price">₹${Number(price).toFixed(2)}</div>
                            <div class="pos-card-price-unit">per ${p.uom_name} (${p.tax_rate}% GST)</div>
                        </div>
                        <span class="badge ${stockBadgeClass} pos-card-stock">${stockText}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    async addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        if (product.current_stock <= 0) {
            App.showToast(`"${product.name}" is out of stock!`, 'error');
            return;
        }

        // Check if item already in cart
        const existing = this.cart.find(item => item.product_id === productId);
        if (existing) {
            const newQty = existing.quantity + 1;
            if (newQty > product.current_stock) {
                App.showToast(`Cannot add more: Only ${product.current_stock} ${product.uom_code} available`, 'error');
                return;
            }
            existing.quantity = newQty;
            this.renderCart();
            return;
        }

        // Fetch detailed product with active rolls
        let rolls = [];
        try {
            const detailRes = await API.products.getById(productId);
            if (detailRes.success && detailRes.data.rolls) {
                rolls = detailRes.data.rolls;
            }
        } catch (e) {
            console.warn('Could not fetch rolls:', e);
        }

        const unitPrice = this.priceMode === 'WHOLESALE' ? product.wholesale_price : product.selling_price;
        const initialRoll = rolls.length > 0 ? rolls[0].id : null;

        this.cart.push({
            product_id: product.id,
            product,
            quantity: 1.0,
            unit_price: unitPrice,
            discount_percent: 0,
            roll_id: initialRoll,
            rolls
        });

        this.renderCart();
    },

    updateQuantity(index, newQty) {
        const item = this.cart[index];
        if (!item) return;

        const qty = parseFloat(newQty);
        if (isNaN(qty) || qty <= 0) {
            this.removeFromCart(index);
            return;
        }

        if (qty > item.product.current_stock) {
            App.showToast(`Exceeds available stock (${item.product.current_stock} ${item.product.uom_code})`, 'error');
            item.quantity = item.product.current_stock;
        } else {
            item.quantity = Number(qty.toFixed(2));
        }

        this.renderCart();
    },

    updateDiscount(index, newDisc) {
        const item = this.cart[index];
        if (!item) return;

        const disc = parseFloat(newDisc);
        item.discount_percent = isNaN(disc) ? 0 : Math.min(100, Math.max(0, disc));
        this.renderCart();
    },

    updateRoll(index, rollId) {
        const item = this.cart[index];
        if (!item) return;
        item.roll_id = rollId ? parseInt(rollId, 10) : null;
        this.renderCart();
    },

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.renderCart();
    },

    clearCart() {
        this.cart = [];
        this.renderCart();
    },

    calculateTotals() {
        let grossSubtotal = 0;
        let totalDiscount = 0;
        let taxableTotal = 0;
        let totalTax = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        const customer = this.customers.find(c => c.id == this.selectedCustomerId);
        const isInterstate = this.priceMode === 'WHOLESALE' && customer && customer.state && customer.state.toLowerCase() !== 'maharashtra';

        this.cart.forEach(item => {
            const gross = item.quantity * item.unit_price;
            const disc = (gross * item.discount_percent) / 100;
            const taxable = gross - disc;
            const tax = (taxable * (item.product.tax_rate || 5.0)) / 100;

            grossSubtotal += gross;
            totalDiscount += disc;
            taxableTotal += taxable;
            totalTax += tax;

            if (isInterstate) {
                igst += tax;
            } else {
                cgst += tax / 2;
                sgst += tax / 2;
            }
        });

        const rawGrandTotal = taxableTotal + totalTax;
        const grandTotal = Math.round(rawGrandTotal);
        const roundOff = grandTotal - rawGrandTotal;

        return {
            grossSubtotal,
            totalDiscount,
            taxableTotal,
            totalTax,
            cgst,
            sgst,
            igst,
            roundOff,
            grandTotal,
            isInterstate
        };
    },

    renderCart() {
        const container = document.getElementById('pos-cart-items-container');
        if (!container) return;

        if (this.cart.length === 0) {
            container.innerHTML = `
                <div class="cart-empty-state">
                    <svg class="cart-empty-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119.993z" />
                    </svg>
                    <h4>Terminal Cart is Empty</h4>
                    <p style="font-size:0.8rem; margin-top:4px;">Click products on the left or scan barcodes to begin billing.</p>
                </div>
            `;
            this.updateSummaryDisplay({ grossSubtotal: 0, totalDiscount: 0, taxableTotal: 0, totalTax: 0, roundOff: 0, grandTotal: 0 });
            return;
        }

        container.innerHTML = this.cart.map((item, idx) => {
            const lineGross = item.quantity * item.unit_price;
            const lineDisc = (lineGross * item.discount_percent) / 100;
            const lineTaxable = lineGross - lineDisc;
            const lineTax = (lineTaxable * item.product.tax_rate) / 100;
            const lineTotal = lineTaxable + lineTax;

            // Roll options if available
            let rollSelectHtml = '';
            if (item.rolls && item.rolls.length > 0) {
                rollSelectHtml = `
                    <select class="cart-item-roll-select" onchange="POS.updateRoll(${idx}, this.value)" title="Select Fabric Roll">
                        <option value="">-- General Stock --</option>
                        ${item.rolls.map(r => `
                            <option value="${r.id}" ${item.roll_id === r.id ? 'selected' : ''}>
                                ${r.roll_number} (${r.current_length}m at ${r.location_rack})
                            </option>
                        `).join('')}
                    </select>
                `;
            }

            return `
                <div class="cart-item-card">
                    <div class="cart-item-header">
                        <div>
                            <div class="cart-item-title">${item.product.name}</div>
                            <div style="font-size: 0.72rem; color: #64748b;">
                                SKU: ${item.product.sku} | ₹${item.unit_price}/${item.product.uom_code} | GST ${item.product.tax_rate}%
                            </div>
                        </div>
                        <button class="btn btn-icon btn-sm" onclick="POS.removeFromCart(${idx})" title="Remove item" style="color: #e11d48; border: none; background: transparent;">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    ${rollSelectHtml ? `<div style="margin-top:2px;">${rollSelectHtml}</div>` : ''}

                    <div class="cart-item-controls">
                        <!-- Cut Piece Decimal Quantity Counter -->
                        <div class="qty-input-wrap">
                            <button class="qty-btn" onclick="POS.updateQuantity(${idx}, ${item.quantity - (item.product.allows_decimal ? 0.5 : 1)})">-</button>
                            <input type="number" class="qty-input" value="${item.quantity}" step="${item.product.allows_decimal ? '0.25' : '1'}" min="0.1" onchange="POS.updateQuantity(${idx}, this.value)">
                            <button class="qty-btn" onclick="POS.updateQuantity(${idx}, ${item.quantity + (item.product.allows_decimal ? 0.5 : 1)})">+</button>
                        </div>

                        <!-- Line Discount Input -->
                        <div style="display:flex; align-items:center; gap:4px; font-size:0.75rem;">
                            <span>Disc:</span>
                            <input type="number" value="${item.discount_percent}" min="0" max="100" style="width:42px; padding:2px 4px; font-size:0.75rem; border:1px solid #cbd5e1; border-radius:4px;" onchange="POS.updateDiscount(${idx}, this.value)">%
                        </div>

                        <!-- Line Total -->
                        <div class="cart-item-total">₹${lineTotal.toFixed(2)}</div>
                    </div>
                </div>
            `;
        }).join('');

        const totals = this.calculateTotals();
        this.updateSummaryDisplay(totals);
    },

    updateSummaryDisplay(totals) {
        document.getElementById('pos-summary-subtotal').textContent = `₹${totals.grossSubtotal.toFixed(2)}`;
        document.getElementById('pos-summary-discount').textContent = `-₹${totals.totalDiscount.toFixed(2)}`;
        document.getElementById('pos-summary-taxable').textContent = `₹${totals.taxableTotal.toFixed(2)}`;

        if (totals.isInterstate) {
            document.getElementById('pos-summary-taxes').textContent = `IGST: ₹${totals.igst.toFixed(2)}`;
        } else {
            document.getElementById('pos-summary-taxes').textContent = `CGST: ₹${totals.cgst.toFixed(2)} + SGST: ₹${totals.sgst.toFixed(2)}`;
        }

        document.getElementById('pos-summary-roundoff').textContent = `${totals.roundOff >= 0 ? '+' : ''}₹${totals.roundOff.toFixed(2)}`;
        document.getElementById('pos-summary-grandtotal').textContent = `₹${totals.grandTotal.toFixed(2)}`;

        const payInput = document.getElementById('pos-tendered-amount');
        if (payInput && (!payInput.value || parseFloat(payInput.value) === 0)) {
            payInput.value = totals.grandTotal;
        }
    },

    async processCheckout() {
        if (this.cart.length === 0) {
            App.showToast('Cart is empty! Add items before billing.', 'error');
            return;
        }

        if (!this.selectedCustomerId) {
            App.showToast('Please select a customer.', 'error');
            return;
        }

        const totals = this.calculateTotals();
        const tenderedInput = document.getElementById('pos-tendered-amount');
        const tenderedAmount = tenderedInput ? parseFloat(tenderedInput.value) : totals.grandTotal;

        const payload = {
            customer_id: parseInt(this.selectedCustomerId, 10),
            invoice_type: this.priceMode === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
            items: this.cart.map(item => ({
                product_id: item.product_id,
                roll_id: item.roll_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount_percent: item.discount_percent
            })),
            payment_method: this.paymentMethod,
            paid_amount: isNaN(tenderedAmount) ? totals.grandTotal : tenderedAmount,
            salesperson_name: 'Counter Cashier'
        };

        const btn = document.getElementById('btn-pos-checkout');
        btn.disabled = true;
        btn.innerHTML = `<span class="icon spin">⏳</span> Processing Invoice...`;

        try {
            const res = await API.billing.create(payload);
            if (!res.success) throw new Error(res.message);

            App.showToast(`Invoice ${res.data.invoice_number} generated successfully!`, 'success');
            this.playBeep('success');

            // Open Printable Tax Invoice Modal
            await this.openInvoicePrintPreview(res.data.invoice_id);

            // Reset Cart and refresh state
            this.clearCart();
            await Promise.all([this.loadProducts(), this.loadCustomers()]);
            if (window.Dashboard) Dashboard.loadData();
        } catch (error) {
            console.error('Checkout error:', error);
            App.showToast('Billing Failed: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                Complete Bill & Print (F8)
            `;
        }
    },

    async openInvoicePrintPreview(invoiceId) {
        try {
            const res = await API.billing.getById(invoiceId);
            if (!res.success) throw new Error(res.message);

            const inv = res.data;
            const container = document.getElementById('printable-invoice-content');

            container.innerHTML = `
                <div class="invoice-print-container" id="printable-bill-wrapper">
                    <div class="invoice-header-box">
                        <div>
                            <div class="inv-brand-name">VOGUE TEXTILE EMPORIUM</div>
                            <div style="font-size: 0.78rem; color: #475569;">
                                128 Handloom Hub, Textile Market Ring Road, Surat, Gujarat - 395002<br>
                                Phone: +91 98250 88771 | Email: billing@voguetextiles.com<br>
                                <strong>GSTIN: 24AAACV1234F1Z9</strong>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.1rem; font-weight: 800; color: #4f46e5;">TAX INVOICE</div>
                            <div style="font-size: 0.85rem; font-weight: 700;"># ${inv.invoice_number}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">
                                Date: ${new Date(inv.invoice_date).toLocaleString('en-IN')}<br>
                                Type: <strong>${inv.invoice_type}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="inv-details-grid">
                        <div>
                            <strong>Billed To:</strong><br>
                            ${inv.customer_name} (${inv.customer_code})<br>
                            Phone: ${inv.customer_phone}<br>
                            ${inv.customer_gstin ? `GSTIN: ${inv.customer_gstin}<br>` : ''}
                            ${inv.customer_address ? `${inv.customer_address}, ${inv.customer_city || ''}` : ''}
                        </div>
                        <div style="text-align: right;">
                            <strong>Payment Details:</strong><br>
                            Mode: <strong>${inv.payment_method}</strong><br>
                            Status: <span class="badge badge-${inv.payment_status.toLowerCase()}">${inv.payment_status}</span><br>
                            Cashier: ${inv.salesperson_name}
                        </div>
                    </div>

                    <table class="inv-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Description / Fabric</th>
                                <th>Roll #</th>
                                <th>HSN</th>
                                <th>Qty</th>
                                <th>Rate (₹)</th>
                                <th>Disc %</th>
                                <th>Taxable (₹)</th>
                                <th>GST</th>
                                <th>Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${inv.items.map((item, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td><strong>${item.product_name}</strong><br><span style="font-size:0.7rem; color:#64748b;">${item.fabric_name} ${item.color ? '• ' + item.color : ''}</span></td>
                                    <td>${item.roll_number || 'Stock'}</td>
                                    <td>${item.hsn_code}</td>
                                    <td><strong>${item.quantity} ${item.uom_code}</strong></td>
                                    <td>₹${item.unit_price.toFixed(2)}</td>
                                    <td>${item.discount_percent > 0 ? item.discount_percent + '%' : '-'}</td>
                                    <td>₹${item.taxable_value.toFixed(2)}</td>
                                    <td>${item.tax_rate}%</td>
                                    <td><strong>₹${item.total_amount.toFixed(2)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="inv-summary-box">
                        <table class="inv-summary-table">
                            <tr><td>Subtotal:</td><td style="text-align:right;">₹${inv.subtotal.toFixed(2)}</td></tr>
                            <tr><td>Total Discount:</td><td style="text-align:right;">-₹${inv.total_discount.toFixed(2)}</td></tr>
                            <tr><td>Taxable Value:</td><td style="text-align:right;">₹${inv.taxable_amount.toFixed(2)}</td></tr>
                            ${inv.cgst_amount > 0 ? `<tr><td>CGST:</td><td style="text-align:right;">₹${inv.cgst_amount.toFixed(2)}</td></tr>` : ''}
                            ${inv.sgst_amount > 0 ? `<tr><td>SGST:</td><td style="text-align:right;">₹${inv.sgst_amount.toFixed(2)}</td></tr>` : ''}
                            ${inv.igst_amount > 0 ? `<tr><td>IGST:</td><td style="text-align:right;">₹${inv.igst_amount.toFixed(2)}</td></tr>` : ''}
                            <tr><td>Round-Off:</td><td style="text-align:right;">₹${inv.round_off.toFixed(2)}</td></tr>
                            <tr style="font-size: 1.1rem; font-weight: 800; border-top: 2px solid #000;">
                                <td>Grand Total:</td><td style="text-align:right;">₹${inv.grand_total.toFixed(2)}</td>
                            </tr>
                            <tr><td>Amount Paid:</td><td style="text-align:right;">₹${inv.paid_amount.toFixed(2)}</td></tr>
                            ${inv.balance_due > 0 ? `<tr style="color:#e11d48; font-weight:700;"><td>Balance Due (Khata):</td><td style="text-align:right;">₹${inv.balance_due.toFixed(2)}</td></tr>` : ''}
                        </table>
                    </div>

                    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b;">
                        <div>
                            Terms: Cut pieces once cut cannot be exchanged or returned.<br>
                            Subject to Surat Jurisdiction. Thank you for your business!
                        </div>
                        <div style="text-align: right;">
                            For Vogue Textile Emporium<br><br>
                            <strong>Authorized Signatory</strong>
                        </div>
                    </div>
                </div>
            `;

            const modal = document.getElementById('modal-print-invoice');
            if (modal) modal.showModal();
        } catch (error) {
            console.error('Error rendering print invoice:', error);
            App.showToast('Failed to load invoice preview: ' + error.message, 'error');
        }
    }
};

window.POS = POS;
