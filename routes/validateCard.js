// routes.js
const express = require('express');
const { validateCardDetails, verifyOtp } = require('../controllers/validateCard');
const router = express.Router();

// Card validation route
router.post('/validate-card', validateCardDetails);

router.post('/verify-otp', verifyOtp);

module.exports = router;
