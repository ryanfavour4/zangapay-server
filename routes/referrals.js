const express = require('express');
const router = express.Router();
const { getReferralStats, listReferrals, creditUserByReferralCode } = require('../controllers/admin');

// Get referral statistics
router.get('/referrals/stats', getReferralStats);

// List all referrals
router.get('/referrals', listReferrals);

// Credit user by referral code
router.post('/referrals/credit', creditUserByReferralCode);

module.exports = router; 