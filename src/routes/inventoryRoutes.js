const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// Fabric rolls
router.get('/rolls', inventoryController.getAllRolls);
router.post('/rolls', inventoryController.createRoll);
router.put('/rolls/:id', inventoryController.updateRoll);

// Stock adjustments & audit
router.post('/adjust', inventoryController.adjustStock);
router.get('/transactions', inventoryController.getTransactions);

module.exports = router;
