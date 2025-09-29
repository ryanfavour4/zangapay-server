// const EducationPackage = require("../models/education");
// const Pin = require("../models/Pin");
// const Pins = require("../models/Pin");
const ServiceFees = require("../../models/ServiceFees");
// const WithdrawalFees = require("../models/WithdrawalFees");

async function saveVariations(serviceID, variations) {
    if (!variations || variations.length === 0) {
      throw new Error("No variations found");
    }
  
    console.log(`Fetched ${serviceID} Variations`, variations);
  
    for (const variation of variations) {
      const existingPackage = await EducationPackage.findOne({
        variation_code: variation.variation_code,
        serviceID: serviceID,
        variation_amount: parseFloat(variation.variation_amount),
      });
  
      if (!existingPackage) {
        await EducationPackage.create({
          serviceID: serviceID,
          variation_code: variation.variation_code,
          name: variation.name,
          variation_amount: parseFloat(variation.variation_amount),
          fixedPrice: variation.fixedPrice === "Yes",
        });
      }
    }
  
    console.log(`Variations for ${serviceID} saved successfully`);  
}

async function initializeServiceFees() {
    try {
        const existingFees = await ServiceFees.findOne();
        
        if (!existingFees) {
            const defaultFees = {
                giftcards: 0,
                "virtual-card": 0,
                airtime2cash: 0,
                betting: 0,
                esims: 0,
                deposits: 0,
                flight: 0,
                insurance: 0,
                "intl-airtime-data": 0,
                education: 0,
                tv: 0,
                electricity: 0,
                internet: 0,
            };

            const newFees = new ServiceFees(defaultFees);
            await newFees.save();
            console.log("Initialized Service Fees with default values.");
        }
    } catch (error) {
        console.error("Error initializing service fees:", error);
    }
}

async function getServiceFee(category) {
    try {
        const serviceFees = await ServiceFees.findOne();
        if (!serviceFees) {
            throw new Error(`Service fee for ${category} not found`);
        }
        return serviceFees[category]; // Return the specific service fee
    } catch (error) {
        console.error(`Error fetching service fee for ${category}:`, error.message);
        throw error; // Rethrow to be handled by the caller
    }
} 

async function getIfSetPin(userId){
    try{
        console.log("Checking pin for userId:", userId); // ✅ Debugging
        
        if (!userId || typeof userId !== 'string') { // ✅ Prevent invalid queries
            throw new Error("Invalid userId format");
        }

        const pin = await Pin.findOne({userId});  
        if (!pin) {
            return {hasPin: false, message: "This user has no pin"};
        } else if(pin){
        return {hasPin: true, message:"This user has pin" ,pin: pin.pin  }
        }
    } catch (error) {
        console.error('Error fetching if user has pin', error)
        throw error
    }
}

async function initializeWithdrawalFees() {
  try {
    const existingCount = await WithdrawalFees.countDocuments();
    if (existingCount > 0) {
      console.log('WithdrawalFees already initialized.');
      return;
    }

    const defaultFees = [
      {
        method: 'bank_transfer',
        tier: 'basic',
        minAmount: 0,
        maxAmount: 1000,
        fixedFee: 5,
      },
      {
        method: 'bank_transfer',
        tier: 'premium',
        minAmount: 1001,
        maxAmount: 10000,
        fixedFee: 3,
      },
      {
        method: 'paypal',
        tier: 'basic',
        minAmount: 0,
        maxAmount: 500,
        fixedFee: 2,
      },
      {
        method: 'paypal',
        tier: 'premium',
        minAmount: 501,
        maxAmount: 5000,
        fixedFee: 1,
      }
    ];

    await WithdrawalFees.insertMany(defaultFees);
    console.log('WithdrawalFees initialized successfully.');
  } catch (error) {
    console.error('Error initializing WithdrawalFees:', error);
  }
}
 


module.exports = {
    saveVariations,
    initializeServiceFees,
    initializeWithdrawalFees,
    getServiceFee,
}