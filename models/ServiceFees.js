const mongoose = require('mongoose');

const serviceFeesSchema = new mongoose.Schema({
    giftcards: { type: Number, required: true },
    "virtual-card": { type: Number, required: true },
    airtime2cash: { type: Number, required: true },
    betting: { type: Number, required: true },
    esims: { type: Number, required: true },
    deposits: { type: Number, required: true },
    flight: { type: Number, required: true },
    insurance: { type: Number, required: true },
    "intl-airtime-data": { type: Number, required: true },
    education: { type: Number, required: true },
    tv: { type: Number, required: true },
    electricity: { type: Number, required: true },
    internet: { type: Number, required: true },
}, { timestamps: true });

const ServiceFees = mongoose.model('ServiceFees', serviceFeesSchema);

module.exports = ServiceFees; 