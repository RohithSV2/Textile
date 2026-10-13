const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
require('dotenv').config();

const initializeDatabase = require('./db/initDb');

// Import Route Handlers
const productRoutes = require('./src/routes/productRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const billingRoutes = require('./src/routes/billingRoutes');
const inventoryRoutes = require('./src/routes/inventoryRoutes');
const supplierRoutes = require('./src/routes/supplierRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Health Check API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'Textile Store Management System',
        database: 'SQLite 3 (WAL mode)'
    });
});

let isDbInitialized = false;
let initPromise = null;

function ensureDb() {
    if (!initPromise) {
        initPromise = initializeDatabase()
            .then(() => { isDbInitialized = true; })
            .catch((err) => {
                initPromise = null;
                throw err;
            });
    }
    return initPromise;
}

// Ensure DB is initialized before handling API requests (critical for Vercel Serverless)
app.use(async (req, res, next) => {
    if (!isDbInitialized && req.path.startsWith('/api')) {
        try {
            await ensureDb();
        } catch (err) {
            console.error('Failed to initialize database on request:', err);
            return res.status(500).json({ success: false, message: 'Database initialization error: ' + err.message });
        }
    }
    next();
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/analytics', analyticsRoutes);

// Fallback for Single Page Application routing (Express 5 compatible)
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }
    if (req.method === 'GET') {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        if (require('fs').existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }
    }
    next();
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error occurred',
        error: process.env.NODE_ENV === 'production' ? null : err.message
    });
});

// Start Server when executed directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            app.listen(PORT, () => {
                console.log(`=======================================================`);
                console.log(`🧵 TEXTILE STORE MANAGEMENT SYSTEM`);
                console.log(`🚀 Server running on: http://localhost:${PORT}`);
                console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
                console.log(`=======================================================`);
            });
        })
        .catch((err) => {
            console.error('Fatal: Failed to initialize database:', err);
            process.exit(1);
        });
}

module.exports = app;
