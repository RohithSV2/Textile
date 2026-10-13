const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

router.get('/', billingController.getAllInvoices);
router.get('/:id', billingController.getInvoiceById);
router.post('/', billingController.createInvoice);
router.post('/:id/void', billingController.voidInvoice);

module.exports = router;
