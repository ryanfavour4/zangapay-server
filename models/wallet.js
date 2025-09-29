const mongoose = require('mongoose');
const { Schema } = mongoose;

const WalletSchema = new Schema(
    {
        userId: {
            type: String,
            required: true
        },
        balance: {
            type:Number,
            default: 0
        },
        accountNumber: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

const Wallet = mongoose.models?.Wallet || mongoose.model("Wallet", WalletSchema);

module.exports = Wallet;
