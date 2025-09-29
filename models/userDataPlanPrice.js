// models/UserDataPlanPrices.js
const mongoose = require('mongoose');

const userDataPlanPriceSchema = new mongoose.Schema({
    plan: { type: String, required: true }, // This can be the plan name or ID
    subcategory_id: { type: Number, required: true }, // New field for subcategory ID
    userPrice: { type: Number, required: true },
});

module.exports = mongoose.model('UserDataPlanPrices', userDataPlanPriceSchema);