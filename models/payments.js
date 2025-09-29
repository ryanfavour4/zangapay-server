const mongoose = require('mongoose');
const { Schema } = mongoose;

const PaymentsSchema = new Schema(
    {
        accessCode: {
            type: String
        },
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
const Payments =  mongoose.model("Payments", PaymentsSchema);

module.exports = Payments;

