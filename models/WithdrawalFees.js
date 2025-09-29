const mongoose = require('mongoose');

const withdrawalFeesSchema = new mongoose.Schema({
    method: { type: String, required: true },
    tier: { type: String, required: true },
    minAmount: { type: Number, required: true },
    maxAmount: { type: Number, required: true },
    fixedFee: { type: Number, required: true },
}, { timestamps: true });

const WithdrawalFees = mongoose.model('WithdrawalFees', withdrawalFeesSchema);

module.exports = WithdrawalFees; 