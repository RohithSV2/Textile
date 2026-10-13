const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Dashboard summary
router.get('/dashboard', analyticsController.getDashboardOverview);

// Showcase Complex SQL queries
router.get('/queries', analyticsController.getQueryCatalog);
router.get('/queries/:queryKey', analyticsController.runComplexQuery);
router.post('/query/custom', analyticsController.runCustomQuery);

// CSV Data Exporter
router.get('/export/:type', analyticsController.exportCsv);

module.exports = router;
