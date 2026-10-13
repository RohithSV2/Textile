/**
 * Main Application Orchestrator & View Router
 */

const App = {
    currentView: 'dashboard',

    async init() {
        this.bindNavigation();
        this.bindGlobalKeyboardShortcuts();
        this.bindModalClosers();

        // Initialize modules
        if (window.Dashboard) await Dashboard.init();
        if (window.POS) await POS.init();
        if (window.Inventory) await Inventory.init();
        if (window.Billing) await Billing.init();
        if (window.Customers) await Customers.init();
        if (window.Suppliers) await Suppliers.init();
        if (window.Analytics) await Analytics.init();

        // Check URL hash for initial view
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            this.navigateTo(hash);
        } else {
            this.navigateTo('dashboard');
        }

        console.log('🧵 Textile Store Management System initialized successfully.');
    },

    bindNavigation() {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.getAttribute('data-view');
                this.navigateTo(view);
            });
        });

        // Top POS Action button
        const topPosBtn = document.getElementById('btn-header-pos');
        if (topPosBtn) {
            topPosBtn.addEventListener('click', () => this.navigateTo('pos'));
        }
    },

    navigateTo(viewName) {
        this.currentView = viewName;
        window.location.hash = viewName;

        // Update sidebar active state
        document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(item => {
            if (item.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Hide all views, show targeted view
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.remove('active');
        });

        const target = document.getElementById(`view-${viewName}`);
        if (target) {
            target.classList.add('active');
        }

        // Update page title
        const titles = {
            dashboard: 'Executive Overview',
            pos: 'Point of Sale (POS) Billing Terminal',
            inventory: 'Fabric & Inventory Management',
            billing: 'Billing & Invoices History',
            customers: 'Customers & Khata Ledger',
            suppliers: 'Suppliers & Stock Inward (GRN)',
            analytics: 'Complex SQL Analytics Workbench'
        };

        const pageTitleEl = document.getElementById('current-page-title');
        if (pageTitleEl) pageTitleEl.textContent = titles[viewName] || 'Textile Management';

        // View specific refresh
        if (viewName === 'pos') {
            const input = document.getElementById('pos-search-input');
            if (input) setTimeout(() => input.focus(), 100);
        } else if (viewName === 'dashboard' && window.Dashboard) {
            Dashboard.loadData();
        }
    },

    bindGlobalKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // F2: Jump to POS & focus search
            if (e.key === 'F2') {
                e.preventDefault();
                this.navigateTo('pos');
            }

            // F8 or Ctrl+Enter: Fast POS checkout
            if ((e.key === 'F8' || (e.ctrlKey && e.key === 'Enter')) && this.currentView === 'pos') {
                e.preventDefault();
                if (window.POS) POS.processCheckout();
            }

            // Esc: Close any open modal
            if (e.key === 'Escape') {
                document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
            }
        });
    },

    bindModalClosers() {
        document.querySelectorAll('dialog .btn-close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dialog = e.target.closest('dialog');
                if (dialog) dialog.close();
            });
        });
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span>${icons[type] || '🔔'}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    printCurrentBill(mode = 'A4') {
        const wrapper = document.getElementById('printable-bill-wrapper');
        if (!wrapper) return;

        if (mode === 'thermal') {
            wrapper.classList.add('thermal-receipt');
        } else {
            wrapper.classList.remove('thermal-receipt');
        }

        window.print();
    }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
