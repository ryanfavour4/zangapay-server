const express = require('express');
const router = express.Router();
const {
    getServiceFees,
    updateServiceFees,
    getWithdrawalFees,
    updateWithdrawalFees,
    storeServiceFees,
    storeWithdrawalFees,
} = require('../controllers/admin');

// Get all service fees
router.get('/service-fees', getServiceFees);

// Store new service fees
router.post('/service-fees/store', storeServiceFees);

// Update service fees
router.put('/service-fees/update', updateServiceFees);

// Get all withdrawal fees
router.get('/withdrawal-fees', getWithdrawalFees);

// Store new withdrawal fees
router.post('/withdrawal-fees/store', storeWithdrawalFees);

// Update withdrawal fees
router.put('/withdrawal-fees/update', updateWithdrawalFees);

module.exports = router; 