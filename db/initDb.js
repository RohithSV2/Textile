const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function initializeDatabase(force = false) {
    try {
        console.log('🔄 Initializing Textile Management Database Schema...');

        // Check if database is already initialized
        const existingTable = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='products';"
        );

        if (existingTable && !force) {
            const count = await db.get('SELECT COUNT(*) as cnt FROM products;');
            if (count && count.cnt > 0) {
                console.log(`✅ Database already initialized with ${count.cnt} products.`);
                return true;
            }
        }

        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        await db.exec(schemaSql);
        console.log('✅ Schema tables, constraints, and views created successfully.');

        const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
        await db.exec(seedSql);
        console.log('✅ Seed data inserted successfully (Categories, Fabrics, Products, Rolls, Customers, Bills).');

        const productCount = await db.get('SELECT COUNT(*) as cnt FROM products;');
        const customerCount = await db.get('SELECT COUNT(*) as cnt FROM customers;');
        const invoiceCount = await db.get('SELECT COUNT(*) as cnt FROM invoices;');
        console.log(`📊 DB Status: ${productCount.cnt} products, ${customerCount.cnt} customers, ${invoiceCount.cnt} invoices ready.`);

        return true;
    } catch (err) {
        console.error('❌ Error initializing database:', err);
        throw err;
    }
}

if (require.main === module) {
    const force = process.argv.includes('--force');
    initializeDatabase(force)
        .then(() => {
            console.log('🎉 Database initialization complete!');
            process.exit(0);
        })
        .catch(() => {
            process.exit(1);
        });
}

module.exports = initializeDatabase;
