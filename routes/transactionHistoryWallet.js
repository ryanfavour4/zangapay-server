const express = require('express');
const { getTransactionHistory, getTransactionForReceiverTransfer } = require('../controllers/transactionHistoryWallet');

const router = express.Router();

router.get('/transaction-history-fiat/:userId', getTransactionHistory); // Get transaction history for a user

router.post('/transaction-history-fiat/receiver', getTransactionForReceiverTransfer); // Get transaction history for a user

module.exports = router;
