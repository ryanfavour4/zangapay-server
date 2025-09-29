const mongoose = require('mongoose');
const { Schema } = mongoose;

const BillsTransactionTrackerSchema = new Schema(
    {
        amount: {
            type: Number
        },
        userId:{
        type: String
        },
        isConfirmed: {
            type: Boolean,
            default: false
        },
    },
    { timestamps: true }
);

// Use mongoose.models to avoid recompiling the model in watch mode
const BillsTransactionTracker =  mongoose.model("BillsTransactionTracker", BillsTransactionTrackerSchema);

module.exports = BillsTransactionTracker;

