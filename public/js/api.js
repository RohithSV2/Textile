/**
 * REST Client for Textile Store Management System Backend
 */

const API = {
    baseUrl: '/api',

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Request failed with status ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, error);
            throw error;
        }
    },

    // Products & Metadata
    products: {
        getAll: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/products${query ? '?' + query : ''}`);
        },
        getById: (id) => API.request(`/products/${id}`),
        create: (payload) => API.request('/products', { method: 'POST', body: JSON.stringify(payload) }),
        update: (id, payload) => API.request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
        delete: (id) => API.request(`/products/${id}`, { method: 'DELETE' }),
        getMetadata: () => API.request('/products/metadata')
    },

    // Customers & Khata Ledger
    customers: {
        getAll: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/customers${query ? '?' + query : ''}`);
        },
        getById: (id) => API.request(`/customers/${id}`),
        create: (payload) => API.request('/customers', { method: 'POST', body: JSON.stringify(payload) }),
        update: (id, payload) => API.request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
        delete: (id) => API.request(`/customers/${id}`, { method: 'DELETE' }),
        recordPayment: (customerId, payload) => API.request(`/customers/${customerId}/payments`, { method: 'POST', body: JSON.stringify(payload) })
    },

    // Point of Sale Billing & Invoices
    billing: {
        getAll: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/billing${query ? '?' + query : ''}`);
        },
        getById: (id) => API.request(`/billing/${id}`),
        create: (payload) => API.request('/billing', { method: 'POST', body: JSON.stringify(payload) }),
        void: (id, payload = {}) => API.request(`/billing/${id}/void`, { method: 'POST', body: JSON.stringify(payload) })
    },

    // Fabric Rolls & Inventory
    inventory: {
        getRolls: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/inventory/rolls${query ? '?' + query : ''}`);
        },
        createRoll: (payload) => API.request('/inventory/rolls', { method: 'POST', body: JSON.stringify(payload) }),
        updateRoll: (id, payload) => API.request(`/inventory/rolls/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
        adjustStock: (payload) => API.request('/inventory/adjust', { method: 'POST', body: JSON.stringify(payload) }),
        getTransactions: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/inventory/transactions${query ? '?' + query : ''}`);
        }
    },

    // Suppliers & Stock Inward
    suppliers: {
        getAll: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/suppliers${query ? '?' + query : ''}`);
        },
        create: (payload) => API.request('/suppliers', { method: 'POST', body: JSON.stringify(payload) }),
        getPurchases: () => API.request('/suppliers/purchases'),
        createPurchase: (payload) => API.request('/suppliers/purchases', { method: 'POST', body: JSON.stringify(payload) })
    },

    // Analytics & Complex SQL Showcase
    analytics: {
        getDashboard: () => API.request('/analytics/dashboard'),
        getQueriesCatalog: () => API.request('/analytics/queries'),
        runComplexQuery: (key) => API.request(`/analytics/queries/${key}`),
        runCustomSql: (sql) => API.request('/analytics/query/custom', { method: 'POST', body: JSON.stringify({ sql }) })
    }
};

window.API = API;
