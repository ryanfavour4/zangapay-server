const { customAlphabet } = require('nanoid');

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 6);
        
function generateReferralCode() {
    return nanoid();
}


module.exports = generateReferralCode;
