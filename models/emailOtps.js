const mongoose = require('mongoose')

const EmailOtpsSchema = mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: Number, required: true },
    expirationTime: { type: Date, required: true },
    userId: { type: String, required: true},
    isValid: { type: Boolean, required: true, default: false },
}, {timestamp: true})


const EmailOtps = mongoose.model('EmailOtps', EmailOtpsSchema)

module.exports = EmailOtps