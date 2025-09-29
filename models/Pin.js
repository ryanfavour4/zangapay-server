const mongoose = require('mongoose')

const PinsSchema = mongoose.Schema({
    userId:{
        type: String,
        default: null
    },
    pin:{
        type: String,
        default: null
    }
},{timestamps: true})


const Pins = mongoose.model('Pins', PinsSchema)


module.exports =  Pins
