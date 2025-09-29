const customError = require("../customError.js");
const Kyc = require("../models/kyc.js");

// Function to get user documents and information
async function storeUserDocumentsAndInfo(req, res, next) {
    try {
        const { userId, documentNumber, isDocumentVerified, documentType, documentPhoto, isUserVerified } = req.body;

        if (!userId || !documentNumber || !isDocumentVerified || !documentType || !isUserVerified || !documentPhoto ) {
            return next(customError('User is missing one or more parameters'));
        }

        const storeDetails = new Kyc({
            userId,
            documentNumber,
            documentPhoto,
            isDocumentVerified,
            isUserVerified: false,
            documentType,
            status: 'pending'
        });

        await storeDetails.save();

        return res.json({ message: [storeDetails] });
    } catch (err) {
        console.log(err);
        next(customError(err));
    }
}

async function updateUserDocumentsAndInfo(req, res,next){
    try{
        const {userId, updatedData} = req.body

        const findUserKycDocument = await Kyc.find({userId})

        if(!findUserKycDocument || findUserKycDocument.length === 0) return next(customError('User kyc not found', 404))


        const updateUserKyc = await Kyc.findByIdAndUpdate(findUserKycDocument._id, updatedData, {new: true})

        return res.json({message:'Kyc updated successfully'})

    }
    catch(err){
        console.log(err)
        next(customError(err))
    }
}

async function getUserKycStatus(req, res, next) {
    try{
        const {userId} = req.params

        const checkIfKycExists = await Kyc.find({userId})

        if(checkIfKycExists.length === 0) return next(customError('User does not have stored KYC details'))

        res.json({message: checkIfKycExists})
    }
    catch(err){
        console.log(err)
        next(customError(err))
    }

}
module.exports = {
    storeUserDocumentsAndInfo,
    updateUserDocumentsAndInfo,
    getUserKycStatus
};


