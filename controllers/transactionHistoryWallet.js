const customError = require('../customError.js');
const TransactionHistoryWallet = require('../models/transactionHistoryWallet.js');

// Function to get transaction history records for a user
async function getTransactionHistory(req, res, next) {
    try {
        const { userId } = req.params;

        const transactions = await TransactionHistoryWallet.find({userId}).sort({ createdAt: -1 });
            
        // Respond with transactions and pagination details
        res.status(200).json({
            message:transactions
        });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function getTransactionForReceiverTransfer(req,res,next){
    try{
      const {receiverId} = req.body

      const findTransactionTransfer = await TransactionHistoryWallet.find({receiverIdForTransfer:receiverId})

      if(!findTransactionTransfer || findTransactionTransfer.length === 0) return next(customError('No transfer fiat for receiver'))


      res.json({message: findTransactionTransfer})
    }
    catch(err){
        console.log(err)
        next(customError(err))
    }
}

module.exports = {
    getTransactionHistory,
    getTransactionForReceiverTransfer
};
