const mongoose = require('mongoose');

const DataPlansSchema = new mongoose.Schema({
    plans: [{
        subcategory_id: { type: Number, required: true },
        title: { type: String, required: true },
        category: { type: String, required: true },
        plan: [{
            plan: { type: String, required: true }, // Plan name (e.g., "1GB for 30 days")
            amount: { type: Number, required: true } // Plan price
        }],
        status: { type: Number, default: 1 } // Active status
    }]
}, { timestamps: true });

const DataPlans = mongoose.model('DataPlans', DataPlansSchema);

module.exports = DataPlans;