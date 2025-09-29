const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReferralSchema = new Schema({
    // referrerId: {
    //     type: Schema.Types.ObjectId,
    //     ref: 'User',
    //     required: true
    // },
    referralCode: {
        type: String,
        required: true,
        unique: true
    },
    usageCount: {
        type: Number,
        default: 0
    },
    totalReward: {
        type: Number,
        default: 0
    },
    referredUsersId:{
        type: [String],
        default:[]
    }
}, { timestamps: true });

const Referral = mongoose.model('Referral', ReferralSchema);

module.exports = Referral; 