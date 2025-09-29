const mongoose = require('mongoose');
const { Schema } = mongoose;

const TransactionHistoryWalletSchema = new Schema(
    {
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            required: true 
        },
        transactionType: {
            type: String,
            // enum: ['deposit', 'withdrawal', 'purchase', 'sale', 'transfer', 'escrow'], 
            required: true
        },
        amount:{
           type:String
        },
        name:{
    type: String,
    default:null,
        },
        status: {
            type: String, 
            default: 'pending'
        },
        details: {
            type: String,
            required: true // Could store more information such as recipient details, transaction ID, etc.
        },
        txId:{
            type:String
        },
        rId:{
            type:String
        },
        receiverIdForTransfer:{
            type: String,
            default:null
        },
        receiverNote:{
            type: String,
            default:null
        },
        username:{
            type: String,
            default: null
        },
        provider:{
            type: String,
            default: null
        },
        receipt:{
            type: Object,
            default: {}
        },
    },
    { timestamps: true }
);

const TransactionHistoryWallet = mongoose.model('TransactionHistoryWallet', TransactionHistoryWalletSchema);

module.exports = TransactionHistoryWallet;
