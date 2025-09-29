const mongoose = require('mongoose');

const nineMobileDataPlansSchema = new mongoose.Schema({
    plans: {
        type: [mongoose.Schema.Types.Mixed], // Allows any object structure
        default: [],
    }
}, { timestamps: true });

const nineMobileDataPlans = mongoose.model('nineMobileDataPlans', nineMobileDataPlansSchema);

module.exports = nineMobileDataPlans;
