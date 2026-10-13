const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');

router.get('/', supplierController.getAllSuppliers);
router.post('/', supplierController.createSupplier);

// Purchases & GRN
router.get('/purchases', supplierController.getAllPurchases);
router.post('/purchases', supplierController.createPurchase);

module.exports = router;
