const Flutterwave = require('flutterwave-node-v3');
const customError = require('../customError');
const { generateReference } = require('../utils/generateReference');
// Helper function to validate card number using Luhn Algorithm
async function validateCardDetails(req, res,next) {
// Installation: npm i flutterwave-node-v3
try{
const flw = new Flutterwave('FLWPUBK_TEST-b99b789f82767040919cb317c30417d8-X', 'FLWSECK_TEST-eb571a6733c62d08e25770331f287a6d-X');

const {card_number, expiry_month, expiry_year, cvv, phone_number, fullname, email, pin} = req.body

console.log(card_number, expiry_month, expiry_year, cvv, email)
const payload = {
  card_number: '5531886652142950',
  expiry_month,
  expiry_year,
  cvv,
  currency: 'NGN',
  amount: '100',
  email,
  fullname,
  phone_number: '09073089699',
  tx_ref: generateReference(),
  redirect_url: 'https://example_company.com/success',
  enckey: 'FLWSECK_TESTc2871e7b28ff',
  authorization: {
mode: "pin",
pin
  }
}

const response = await flw.Charge.card(payload)

console.log(response)
return  res.json(response)

;

}
catch(err){
    console.log(err)
    next(customError(err))
}
}


async function verifyOtp(req,res,next){
    try{
        const flw = new Flutterwave('FLWPUBK_TEST-b99b789f82767040919cb317c30417d8-X', 'FLWSECK_TEST-eb571a6733c62d08e25770331f287a6d-X');

         const {otp, flw_ref} = req.body
        // console.log(req.session)
        const response = await flw.Charge.validate({
            otp,
            flw_ref
        });

        res.json(response)
    }
    catch(err){
        console.log(err)
        next(customError(err))
    }
}
module.exports = {
    validateCardDetails,
    verifyOtp
};
