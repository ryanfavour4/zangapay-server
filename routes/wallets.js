const express = require('express');
const { getUserWalletBalances, transferBetweenUsers } = require('../controllers/wallet');

const router = express.Router();

router.get('/wallet/balance/:userId/:accountNumber', getUserWalletBalances);

router.post('/wallet/transfer/funds', transferBetweenUsers)


module.exports = router;
