const mongoose = require('mongoose');

const recentActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    activityType: {
        type: String,
        required: true,
        enum: ['BILL_PAYMENT', 'ACCOUNT_CREATION', 'TRANSFER', 'VIRTUAL_CARD', 'KYC_UPDATE', 'ADMIN_FUND', 'USER_BLOCKED', 'USER_UNBLOCKED', 'USER_DELETED']
    },
    description: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['success', 'pending', 'failed'],
        default: 'success'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

module.exports = mongoose.model('RecentActivity', recentActivitySchema); 