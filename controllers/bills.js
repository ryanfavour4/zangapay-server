const customError = require("../customError")
const {v4} = require('uuid')
const axios = require('axios');
const TransactionHistoryWallet = require("../models/transactionHistoryWallet");
const Wallet = require("../models/wallet");
const moment = require('moment-timezone'); // Use moment-timezone for time zone handling
const crypto = require('crypto');
const { sendOTPEmail, sendReceiptEmail } = require("../mail template/bills-mail.js");
const Amadeus = require('amadeus');
const VirtualCard = require("../models/virtualCards");
const DataPlans = require("../models/DataPlans");
const nineMobileDataPlans = require("../models/9mobileDataPlans");
const BillsTransactionTracker = require("../models/billsTransactionTracker");
const dataPlans = require('../utils/data_plans_storage/dataPlans.json')
const dotenv = require('dotenv')
const GiftCard = require("../models/giftCards");
const GiftCardCountry = require('../models/giftCardCountries');
const { query, validationResult } = require('express-validator');
const { body: vBody } = require('express-validator');

dotenv.config()


const pluginUrl = 'https://pluginng.com/api/'

const vtpassUrl = 'https://vtpass.com/api/'

const bitnobSecretKey = process.env.BITNOB_SECRET_KEY

const plugingEmail = process.env.PLUGIN_EMAIL

const plugingPassword = process.env.PLUGIN_PASSWORD

const vtpassEmail = process.env.VTPASS_EMAIL

const vtpassPassword = process.env.VTPASS_PASSWORD

const vtuAfricaKey = process.env.VTU_AFRICA_KEY

const reloadlyClientId = process.env.RELOADLY_API_CLIENT_ID

const reloadlySecretKey = process.env.RELOADLY_API_CLIENT_SECRET

const esimsAccessCode = process.env.ESIMS_ACCESS_CODE

const esimsSecretKey = process.env.ESIMS_SECRET_KEY

// https://vtpass.com/ap

// const vtpassUrl = '${vtpassUrl}'
const authString = Buffer.from(`${vtpassEmail}:${vtpassPassword}`).toString('base64');

const vtuAfricaBettingUrl = 'https://vtuafrica.com.ng/portal'

const vtuAfricaAirtime2CashUrl = 'https://vtuafrica.com.ng/portal/api-test/airtime-cash/'

const esimsUrl = 'https://api.esimaccess.com/api/'

// const giftCardUrl = 'https://giftcards-sandbox.reloadly.com/'

const giftCardUrl = 'https://giftcards.reloadly.com/'

const bitnobUrl = 'https://api.bitnob.co/api/v1/virtualcards/'

const flightBookingUrl = 'https://api.amadeus.com/v1'

const fee = 10

const flightClientId = 'CMmPljqdQv4U4QaqvfuTV3iPPGUxujte';

const flightClientSecret = '8uKd3B7drBrg2bfU';

const { logActivity } = require('./admin');
const { saveDataToFile } = require("../utils/saveDataToFile.js");
const { getServiceFee } = require("../utils/helpers/helpers.js");
const ServiceFees = require("../models/ServiceFees.js");
const UserDataPlanPrices = require('../models/userDataPlanPrice.js');

async function airtimePurchase(req, res,next){
    try{
    const {phone, amount, subcategory_id, name, userId, email} = req.body

    const checkIfUserWalletExists = await Wallet.find({userId})

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

    const reference = v4()

    const payload = {
      phonenumber: phone, 
      subcategory_id,
      amount,
      ported: 'yes',
      custom_reference: reference,
    };

    const loginResponse = await axios.post(`${pluginUrl}login`, {
      email: plugingEmail,
      password: plugingPassword
    })

    const token = loginResponse.data.data.token;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const response = await axios.post(`${pluginUrl}purchase/airtime`, payload, { headers })
  
    await Wallet.findByIdAndUpdate(
        checkIfUserWalletExists[0]._id,
        {
            $set: {
                balance: checkIfUserWalletExists[0].balance - (parseInt(amount))
            }
        },
        {
            new: true,
            runValidators: true
        })

      const newTransaction = new TransactionHistoryWallet({
        userId,
        transactionType: 'Bills',
        amount: +amount,
        status: 'success',
        details: `You successfully purchased ${+amount} naira worth of airtime to ${phone}`,
        txId: reference,
        rId: v4(),
        name: 'Airtime Topup',
        username: name,
        provider: subcategory_id === 8 ? 'MTN' : subcategory_id === '9' ? 'AIRTEL' : subcategory_id === '10' ? 'GLO' : 'NULL',
        receipt: response.data
    });    
    
    await newTransaction.save()

    sendReceiptEmail(email, { type: 'Airtime Topup', details: {...response.data, amount} });

    await logActivity(
        userId,
        'BILL_PAYMENT',
        `${name} purchased airtime worth ₦${amount}`,
        amount,
        'success',
        { 
            provider: subcategory_id === 8 ? 'MTN' : subcategory_id === '9' ? 'AIRTEL' : subcategory_id === '10' ? 'GLO' : 'NULL',
            phone 
        }
    );

    return res.json({text:'Airtime purchased successfully', message: newTransaction})

    }
    catch(err){
        console.log(err.response.data)
        next(customError(err.response ? err.response.data.message : err.message))
    }
}

const getMobileNetworkPlans = async (req, res) => {
  try {
    const pluginUrl = process.env.PLUGIN_URL; // or your defined pluginUrl

        // Step 1: Log in to get the token
    const loginResponse = await axios.post(`${pluginUrl}login`, {
      email: plugingEmail,
      password: plugingPassword
        });

    const token = loginResponse.data.data.token;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

        // Step 2: Fetch all plans from your API endpoint
        const response = await axios.get(`${pluginUrl}get/plans`, { headers });

        // Step 3: Extract data plans
    const allPlans = response.data.data;
        const dataPlans = allPlans.filter(plan => plan.category === 'Data');

        // Step 4: Store data plans in the database
        await DataPlans.deleteMany({}); // Clear existing plans before saving new ones

        const newPlans = new DataPlans({
            plans: dataPlans.map(plan => ({
                subcategory_id: plan.subcategory_id,
                title: plan.title,
                category: plan.category,
                plan: plan.plan.map(p => ({
                    plan: p.plan,
                    amount: p.amount,
                    userPrice: 0, // Placeholder for user price
                    total: p.amount // Total is initially set to the original amount
                }))
            }))
        });

        await newPlans.save();

        // Step 5: Fetch user-specific prices
        const userPrices = await UserDataPlanPrices.find({}); // Fetch all user prices

        // Step 6: Merge user prices with data plans
        dataPlans.forEach(plan => {
            plan.plan.forEach(p => {
                const userPriceEntry = userPrices.find(up => up.plan === p.plan && up.subcategory_id === plan.subcategory_id);
                if (userPriceEntry) {
                    p.userPrice = userPriceEntry.userPrice; // Set user price
                    p.total = p.userPrice + p.amount; // Calculate total
                } else {
                    p.userPrice = 0; // Default user price if not set
                    p.total = p.amount; // Total is just the original amount
                }
            });
        });

        // Step 7: Return the updated plans with user prices and totals
        res.status(200).json({ data: dataPlans });
  } catch (error) {
    console.error('Error fetching mobile network plans:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
async function storeDataNetworks(req, res, next) {
  try {
    // Clear existing plans before saving new ones
    await DataPlans.deleteMany({});
    
    const newPlans = new DataPlans({
      plans: dataPlans
    });

    await newPlans.save();
    return res.json({ message: 'Data plans updated successfully', data: newPlans });
  } catch (err) {
    console.error(err);
    next(customError(err));
  }
}

async function fetchDataPlans(req, res, next) {
  try {
    const { provider } = req.params; 

    const dataPlans = await DataPlans.find({});

    const filteredPlans = dataPlans[0].plans.filter(plan => {

      return plan.title && plan.title.toLowerCase().includes(provider.toLowerCase());
    });

    
    res.status(200).json({ plans: filteredPlans });
  } catch (err) {
    console.error(err);
    next(err); 
  }
}

async function fetch9MobileDataPlans(req, res, next) {
  try {
    // Fetch all data plans from your database
    const dataPlans = await nineMobileDataPlans.find({});
    
    res.status(200).json({ plans: dataPlans });
  } catch (err) {
    console.error(err);
    next(err); // Pass error to error-handling middleware
  }
}



async function dataPurchase(req, res,next){
  try{
  const {phone, amount, subcategory_id,data, validity, name, email, userId, plan_id} = req.body

  // const fee = await getServiceFee()

  const checkIfUserWalletExists = await Wallet.find({userId})

  if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

  if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

  const reference = v4()

  const payload = {
        phonenumber: phone, 
        subcategory_id,
        amount,
        plan_id,
        ported: "yes",
        custom_reference: reference,
  };


  const loginResponse = await axios.post(`${pluginUrl}login`, {
    email: plugingEmail,
    password: plugingPassword
  })


  const token = loginResponse.data.data.token;

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await axios.post(`${pluginUrl}purchase/data`, payload, { headers })

  
  await Wallet.findByIdAndUpdate(
      checkIfUserWalletExists[0]._id,
      {
          $set: {
              balance: checkIfUserWalletExists[0].balance - parseInt(amount)
          }
      },
      {
          new: true,
          runValidators: true
      })

  const newTransaction = new TransactionHistoryWallet({
      userId,
      transactionType: 'Bills',
      amount: +amount  ,
      status: 'success',
      details: `You have successfully purchased ${data} for ${validity} worth ₦${amount}`,
      txId: v4(),
      rId: v4(),
      name: 'Data Topup',
      username: name,
      provider: subcategory_id === (1 || 8 ||  44 || 46 || 25) ? 'MTN' : subcategory_id === (3 || 4 || 9 || 46 || 48) ? 'AIRTEL' : subcategory_id === (5 || 10 || 24 || 51 )  ? 'GLO' : 'NULL' ,
      receipt: response.data
  });    
  
  await newTransaction.save()

  sendReceiptEmail(email, 'Data Topup', {...response.data, amount})

  await logActivity(
      userId,
      'BILL_PAYMENT',
      `${name} purchased ${data} data plan for ${validity}`,
      amount,
      'success',
      { 
          provider: subcategory_id === 8 ? 'MTN' : subcategory_id === '9' ? 'AIRTEL' : subcategory_id === '10' ? 'GLO' : 'NULL',
          phone,
          plan: data,
          validity 
      }
  );

  return res.json({text:'Data purchased successfully', message: newTransaction})
  }
  catch(err){
      console.log(err)

      next(customError(err))
  }
}


async function fetchCableTvPlans(req, res,next){
    try{
        const {provider} = req.params

        const response = await axios.get(`${vtpassUrl}service-variations?serviceID=${provider}`)

        return res.json({message: response.data})
    }
    catch(err){
        console.log(err)
    }
}

async function verifyTvSmartCode(req, res,next){
  try{
      // const {billersCode ='1212121212', serviceId='showmax'} = req.body

      const {billersCode, serviceId} = req.body

      const body = {
          billersCode,
          serviceID:serviceId
      }

      const response = await axios.post(`${vtpassUrl}merchant-verify`, body, {
          headers:{
              Authorization: `Basic ${authString}`
          }
      })

      if(response.data.code === '085') return next(customError('Service is currently unavailable'));

      if(response.data.code === '028') return next(customError('Service is currently unavailable'));


      if(response.data.content.error === 'Incorrect SmartCard number. Please try with a correct one'){
        return next(customError('Incorrect SmartCard number. Please try with a correct one'))
      }



      return res.json({message: response.data})
  }
  catch(err){
      console.log(err)
      next(customError(err))
  }
}
async function cableSubscription(req, res, next) {
    try {
        const { phone, serviceID, billersCode, amount, email, variation_code, quantity, name, userId, subscription_type } = req.body;

        const checkIfUserWalletExists = await Wallet.find({userId})

        if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

        if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

        const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;
      
        const payload = {
            phone,
            serviceID,
            billersCode,
            variation_code,
            subscription_type: subscription_type || 'monthly',
            quantity,
            request_id: reference
        };

        const headers = {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
        };    
        const response = await axios.post(`${vtpassUrl}pay`, payload, { headers })

        const serviceFees = await ServiceFees.find();

  

        if(response.data.code === '085') return next(customError('Service is currently unavailable'));


        if(response.data.code === '028') return next(customError('Service is currently unavailable'));

        if(response.data.response_description === 'TRANSACTION FAILED') return next(customError(response.data.response_description));

        await Wallet.findByIdAndUpdate(
            checkIfUserWalletExists[0]._id,
            {
                $set: {
                    balance: checkIfUserWalletExists[0].balance - parseInt(amount + serviceFees[0].tv)
                }
            },
            {
                new: true,
                runValidators: true
            })
 
        sendReceiptEmail(email, { type: 'Cable Tv Subscription', details: { ...response.data, amount: +amount + serviceFees[0].tv } });
 
        const newTransaction = new TransactionHistoryWallet({
            userId,
            transactionType: 'Bills',
            amount: +amount + serviceFees[0].tv,
            status: 'success',
            details: `You have successfully subscribed to ${serviceID} service worth ${+amount + serviceFees[0].tv} naira`,
            txId: reference,
            rId: v4(),
            name: 'Cable Subscription',
            username: name,
            provider: serviceID,
            receipt: response.data
        });    
        
        await newTransaction.save()

        await logActivity(
            userId,
            'BILL_PAYMENT',
            `${name} subscribed to ${serviceID} cable service worth ₦${amount + serviceFees[0].tv}`,
            amount+serviceFees[0].tv,
            'success',
            { provider: serviceID, smartCardNumber: billersCode, package: variation_code }
        );

        return res.json({text:'Cable purchased successfully', message: newTransaction})   
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        next(customError(error.response ? error.response.data : error.message))
    }
}

async function fetchElectricityPlans(req, res,next){
  try{
      const {provider} = req.params

      const response = await axios.get(`${vtpassUrl}service-variations?serviceID=${provider}`)

      return res.json({message: response.data})
  }
  catch(err){
          console.log(err)
  }
}

async function verifyElectricityMeterNumber(req,res,next) {
    try{
      const {billersCode = '1010101010101', serviceID = 'yola-electric', type = 'postpaid'}  = req.body

    const payload = {
      billersCode,
      serviceID,
      type
    }
    
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json'
  };    

      const response = await axios.post(`${vtpassUrl}merchant-verify`, payload, {headers})

      return res.json({message: response.data})
    }
    catch(err){
      console.log(err);
      next(customError(err))
    }
}

async function electricityBillSubscription(req, res, next){
  try {
    const {phone, serviceID, billersCode, email, amount, variation_code, name, userId} = req.body

    const checkIfUserWalletExists = await Wallet.find({userId})

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

    const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

    const payload = {
      phone,
      serviceID,
      billersCode,
      variation_code: variation_code.toLowerCase(),
      request_id: reference,
      amount
    };

    const headers = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
    };    

    const response = await axios.post(`${vtpassUrl}pay`, payload, { headers })

    
    const serviceFees = await ServiceFees.find();

    if(response.data.code === '028') return next(customError('Service is currently unavailable'));

    if(response.data.code === '085') return next(customError(response.data.response_description));
    if(response.data.code === '011') return next(customError(response.data.response_description));
    if(response.data.response_description === 'TRANSACTION FAILED') return next(customError(response.data.response_description));

    await Wallet.findByIdAndUpdate(
        checkIfUserWalletExists[0]._id,
        {
            $set: {
                balance: checkIfUserWalletExists[0].balance - +amount +  serviceFees[0].electricity
            }
        },
        {
            new: true,
            runValidators: true
        })
 
    const newTransaction = new TransactionHistoryWallet({
        userId,
        transactionType: 'Bills',
        amount: amount +  serviceFees[0].electricity,
        status: 'success',
        details: `You have successfully purchased ${serviceID} services worth ${+amount +  serviceFees[0].electricity} naira`,
        txId: reference,
        rId: v4(),
        name: 'Electricity Subscription',
        username: name,
        provider: serviceID,
        receipt: response.data
    });    
    
    await newTransaction.save()

    console.log(response.data)

    // content: {
    //   transactions: {
    //     status: 'delivered',
    //     product_name: 'Yola Electric Disco Payment - YEDC',
    //     unique_element: '1010101010101',
    //     unit_price: '1500',
    //     quantity: 1,
    //     service_verification: null,
    //     channel: 'api',
    //     commission: 12,
    //     total_amount: 1588,
    //     discount: null,
    //     type: 'Electricity Bill',
    //     email: plugingEmail,
    //     phone: '08152000002',
    //     name: null,
    //     convinience_fee: 100,
    //     amount: '1500',
    //     platform: 'api',
    //     method: 'api',
    //     transactionId: '17454605696607536318613113',

    sendReceiptEmail(email, { type: 'Electricity Subscription', details: {...response.data, amount: +amount+ serviceFees[0].electricity, ...response.data.content.transactions , convinience_fee:'', email, phone, totalAmount: +amount+ serviceFees[0].electricity } });

    await logActivity(
        userId,
        'BILL_PAYMENT',
        `${name} purchased electricity worth ₦${amount+ serviceFees[0].electricity} from ${serviceID}`,
        amount+ serviceFees[0].electricity,
        'success',
        { provider: serviceID, meter_number: billersCode }
    );

    return res.json({text:'Electricity purchased successfully', message: newTransaction})   

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    next(customError(error.response ? error.response.data : error.message))
  }
}

async function getWaecRegistrationVariations(req, res, next) {
  try{
    const response = await axios.post(`${vtpassUrl}service-variations?serviceID=waec-registration`)

    return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }

}

async function waecRegistrationSubscription(req, res, next){
  try {
    
    const {phone, serviceID, billersCode, amount, variation_code, quantity, name, userId} = req.body

    const checkIfUserWalletExists = await Wallet.find({userId})

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

    const reference = v4()

    const payload = {
      phone,
      serviceID,
      billersCode,
      variation_code,
      request_id: reference,
      quantity
    };

    const headers = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
    };    

    await  axios.post(`${vtpassUrl}pay`, payload, { headers })

    await  Wallet.findByIdAndUpdate(
        checkIfUserWalletExists[0]._id,
        {
            $set: {
                balance: checkIfUserWalletExists[0].balance - parseInt(amount)
            }
        },
        {
            new: true,
            runValidators: true
        })
 
      const newTransaction = new TransactionHistoryWallet({
        userId,
        transactionType: 'bills',
        amount,
        status: 'success',
        details: `You just purchased ${data} for ${validity} worth ₦${amount}`,
        txId: reference,
        rId: v4(),
        name: 'Waec Registration',
        username: name,
        provider
    });    
    
    await newTransaction.save()

    return res.json({text:'Waec Registration purchased successfully', message: newTransaction})   

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    
    next(customError(error.response ? error.response.data : error.message))
  }
};

async function getWaecResultCheckerVariations(req, res, next) {
  try{
    const response = await axios.post(`${vtpassUrl}service-variations?serviceID=waec`)

    console.log(response.data)
    return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }

}
async function waecResultCheckerSubscription(req, res, next){
  try {
    
    const {phone, serviceID, billersCode, amount, variation_code, quantity, name, userId} = req.body

    const checkIfUserWalletExists = await Wallet.find({userId})

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

    const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

    const payload = {
      phone,
      serviceID,
      billersCode,
      variation_code,
      request_id: reference,
      quantity
    };

    const headers = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
    };    

    const response = await  axios.post(`${vtpassUrl}pay`, payload, { headers })

    console.log(response.data)

    
    if(response.data.code === '085') return next(customError(response.data.response_description));

    if(response.data.response_description === 'TRANSACTION FAILED') return next(customError(response.data.response_description));


    await  Wallet.findByIdAndUpdate(
        checkIfUserWalletExists[0]._id,
        {
            $set: {
                balance: checkIfUserWalletExists[0].balance - parseInt(amount)
            }
        },
        {
            new: true,
            runValidators: true
        })
 
      const newTransaction = new TransactionHistoryWallet({
        userId,
        transactionType: 'Bills',
        amount,
        status: 'success',
        details: `You have successfully purchased waec checker pin`,
        txId: reference,
        rId: v4(),
        name: 'Waec Result Checker',
        username: name,
        provider: 'Waec',
        receipt: response.data
    });    
    
    await newTransaction.save()

    await logActivity(
        userId,
        'BILL_PAYMENT',
        `${name} purchased WAEC result checker pin worth ₦${amount}`,
        amount,
        'success',
        { provider: 'WAEC', quantity }
    );

    return res.json({text:'Waec Registration purchased successfully', message: newTransaction})   

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    
    next(customError(error.response ? error.response.data : error.message))
  }
};

async function getJambSubscriptionVariations(req, res, next) {
  try{
    const response = await axios.post(`${vtpassUrl}service-variations?serviceID=jamb`)

    return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }

}

async function jambRegistrationSubscription(req, res, next){
  try {
    
    const {phone, serviceID, billersCode, amount, variation_code, quantity, name, userId} = req.body

    const checkIfUserWalletExists = await Wallet.find({userId})

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

    const reference = v4()

    const payload = {
      phone,
      serviceID,
      billersCode,
      variation_code,
      request_id: reference,
      quantity
    };

    const headers = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
    };    

    await  axios.post(`${vtpassUrl}pay`, payload, { headers })

    await  Wallet.findByIdAndUpdate(
        checkIfUserWalletExists[0]._id,
        {
            $set: {
                balance: checkIfUserWalletExists[0].balance - parseInt(amount)
            }
        },
        {
            new: true,
            runValidators: true
        })
 
      const newTransaction = new TransactionHistoryWallet({
        userId,
        transactionType: 'Jamb Subscription',
        amount,
        status: 'success',
        details: `You just purchased ${data} for ${validity} worth ₦${amount}`,
        txId: reference,
        rId: v4(),
        name: 'Jamb Subscription',
        username: name,
        provider
    });    
    
    await newTransaction.save()

    await logActivity(
        userId,
        'BILL_PAYMENT',
        `${name} purchased JAMB registration pin worth ₦${amount}`,
        amount,
        'success',
        { provider: 'JAMB', quantity }
    );

    return res.json({text:'Jamb Registration purchased successfully', message: newTransaction})   

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    
    next(customError(error.response ? error.response.data : error.message))
  }
};

async function getThirdPartyInsuranceVariations(req,res,next){
  try{

    const response = await axios.get(`${vtpassUrl}service-variations?serviceID=ui-insure`)

    return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function getThirdPartyColorCodes(req, res, next) {
  try{
      const response = await axios.get(`${vtpassUrl}universal-insurance/options/color`)

      return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }

}

async function getThirdPartyEngineCapacityCode(req, res, next) {
  try{
      const response = await axios.get(`${vtpassUrl}universal-insurance/options/engine-capacity`)

      return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }

}

async function getThirdPartyStateCode(req, res, next) {
  try{
      const response = await axios.get(`${vtpassUrl}universal-insurance/options/state`)

      return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function getThirdPartyLocalGovernmentAreaCode(req, res, next){
  try{
      const {stateCode} = req.params

      const response = await axios.get(`${vtpassUrl}universal-insurance/options/lga/${stateCode}`)

      return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function getThirdPartyVehicleMakeCode(req, res, next){
   try{
      const response = await axios.get(`${vtpassUrl}universal-insurance/options/brand`)

      return res.json({message: response.data})
   }
   catch(err){
    console.log(err)
    next(customError(err))
   }
}

async function getThirdPartyVehicleModelCode(req, res, next){
  try{
    const {vehicleMakeCode} = req.params

      const response = await axios.get(`${vtpassUrl}universal-insurance/options/model/${vehicleMakeCode}`)

      return res.json({message: response.data})
 
  }
  catch(err){
    conosle.log(err)
    next(customError(err))
  }

}


async function thirdPartyInsuranceSubscription(req, res, next){
  try{

  const {phone,
     serviceID,
      billersCode,
       amount, 
       variation_code, email,
        name,
         userId,
    Insured_Name,
    engine_capacity,
    Chasis_Number,
    Plate_Number,
    vehicle_make,
    vehicle_color,
    vehicle_model,
    YearOfMake,
    state,
    lga
  } = req.body

  const fee = await getServiceFee('insurance')
  const checkIfUserWalletExists = await Wallet.find({userId})

  if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

  if(checkIfUserWalletExists[0].balance < parseInt(amount + fee)) return next(customError('Insufficient funds'))

  const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  


  // const payload = {
  //   phone,
  //   serviceID: 'ui-insure',
  //   billersCode,
  //   variation_code: +variation_code,
  //   request_id: reference,
  //   amount,
  //   Insured_Name,
  //   engine_capacity: +engine_capacity,
  //   Chasis_Number,
  //   Plate_Number,
  //   vehicle_make: +vehicle_make,
  //   vehicle_color: +vehicle_color,
  //   vehicle_model: +vehicle_model,
  //   YearOfMake: +YearOfMake,
  //   state: +state,
  //   lga: +lga,
  //   email
  // };

  const payload = {
    
    "request_id":"2023050316471112",
    "serviceID":"ui-insure",
    "variation_code":1,
    "phone":"08111111111",
    "Insured_Name":"Mr Ajanlekoko",
    "engine_capacity":1,
    "Chasis_Number":"S12332323FRHJJ433434J",
    "Plate_Number":"ATU480ER",
    "billersCode":"ATU480ER",
    "vehicle_make":335,
    "vehicle_color":20,
    "vehicle_model":745,
    "YearofMake":2009,
    "state":1,
    "lga":770,
    "email":"sandbox@vtpass.com"
}


  const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json'
  };    

  const response = await  axios.post(`${vtpassUrl}pay`, payload, { headers })


  if(response.data.code === '085') return next(customError(response.data.response_description));

  if(response.data.response_description === 'TRANSACTION FAILED') return next(customError(response.data.response_description));

  if(response.data.response_description === "IMPROPER REQUEST ID:  TIME NOT CORRECT – MAKE SURE YOU ARE USING GMT+1 AND YOUR HOUR IS IN 24 HOURLY FORMAT") return next(customError('Transaction Failed'));

  if(response.data.response_description === 'PRODUCT DOES NOT EXIST') return next(customError('Product does not exist'));

  if(response.data.code === '028') return next(customError('Service is not available'));

  
  await  Wallet.findByIdAndUpdate(
      checkIfUserWalletExists[0]._id,
      {
          $set: {
              balance: checkIfUserWalletExists[0].balance - parseInt(amount + fee )
          }
      },
      {
          new: true,
          runValidators: true
      })

    const newTransaction = new TransactionHistoryWallet({
      userId,
      transactionType: 'Bills',
      amount,
      status: 'success',
      details: `You have successfully purchase third party vehicle insurance subscription`,
      txId: reference,
      rId: v4(),
      name: 'Third Party Vehicle Insurance Subscription',
      username: name,
      provider:'Third Party Vehicle Insurance Subscription',
      receipt: response.data
  });    
  
  await newTransaction.save()

  sendReceiptEmail(email, {...response.data.content.transactions, ...response.data, amount, email})

  await logActivity(
      userId,
      'BILL_PAYMENT',
      `${name} purchased third party vehicle insurance worth ₦${amount}`,
      amount,
      'success',
      { 
          provider: serviceID,
          vehicle_details: {
              make: vehicle_make,
              model: vehicle_model,
              color: vehicle_color,
              plate: Plate_Number
          }
      }
  );

  return res.json({text:'Third Party Vehicle Insurance Subscription', message: newTransaction})   

} catch (error) {
  console.error('Error:', error.response ? error.response.data : error.message);
  
  next(customError(error.response ? error.response.data : error.message))
}
}


async function getPersonalAccidentInsuranceVariations(req,res,next){
  try{

    const response = await axios.get(`${vtpassUrl}service-variations?serviceID=personal-accident-insurance`)

    return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function personalAccidentInsuranceSubscription(req, res, next) {
    try {
        const { phone, serviceID, billersCode, amount, email, name, userId } = req.body;

        // ... existing checks ...

        const newTransaction = new TransactionHistoryWallet({
            userId,
            transactionType: 'Bills',
            amount,
            status: 'success',
            details: `You just purchased personal accident insurance worth ₦${amount}`,
            txId: reference,
            rId: v4(),
            name: 'Personal Accident Insurance Subscription',
            username: name,
            provider: serviceID,
            receipt: response.data
        });

        await newTransaction.save();

        // Send receipt email
        sendReceiptEmail(email, { type: 'Personal Accident Insurance Subscription', details: { ...response.data, amount } });

        // ... existing logActivity and response ...
    } catch (error) {
        // ... existing error handling ...
    }
}

async function  bettingSubscription(req,res,next) {
  try{
    // const {phone = '08039914037', amount = '10000', userId='686421b63851fa9644ed110b', name, service = 'bet9ja', betUserId= '08039914037'} = req.body

    const {phone, amount, userId, name, service, betUserId, email } = req.body

    // console.log(req.body)

    const fee = await getServiceFee('betting')
    const checkIfUserWalletExists = await Wallet.find({userId})

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(amount + fee) ) 
      return next(customError('Insufficient funds'))

    const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

    const response = await axios.post(`https://vtuafrica.com.ng/portal/api/betpay/?apikey=${vtuAfricaKey}&service=${service}&userid=${betUserId}&phone=${phone}&amount=${amount}&ref=${reference}`)


    // console.log(response.data)

    if(response.data.code === 103) return next(customError('Server Error. Please contact support'))

    if(response.data.description.message === 'Invalid Amount Entered. Minimun Bet funding is N100') return next(customError(response.data.description.message))

      if(response.data.description.message === 'Your Account Balance is Low. Please fund Your wallet and try Again') {
     
        return next(customError('Service is currently unavailable'))
}
    if(response.data.code === 104) return next(customError('Server Error... Please contact support'))

  
    
    await  Wallet.findByIdAndUpdate(
      checkIfUserWalletExists[0]._id,
      {
          $set: {
              balance: checkIfUserWalletExists[0].balance - (parseInt(amount) + fee )
          }
      },
      {
          new: true,
          runValidators: true
      })

    const newTransaction = new TransactionHistoryWallet({
      userId,
      transactionType: 'Bills',
      amount,
      status: 'success',
      details: `You have successfully subscribed to the given betting account worth ${amount} naira`,
      txId: reference,
      rId: v4(),
      name: 'Betting Subscription',
      username: name,
      provider: service,
      receipt: response.data
  });    
  
  await newTransaction.save()

  await logActivity(
        userId,
        'BILL_PAYMENT',
        `${name} funded ${service} betting account with ₦${amount}`,
        amount,
        'success',
        { provider: service, betting_id: betUserId }
    );

    sendReceiptEmail(email, {...response?.data?.content?.transactions, ...response.data, amount})

  return res.json({text:'Betting Subscription purchased successfully', message: newTransaction})

  }
  catch(err){
    console.log(err);
    next(customError(err))
  }
}

async function verifyIfAirtime2CashIsAvailable(req, res, next){
  try{
    const {network} = req.params

    const response = await axios.post(`https://vtuafrica.com.ng/portal/api/merchant-verify/?
    apikey=${vtuAfricaKey}&serviceName=Airtime2Cash&network=${network.toLowerCase()}`)

    if(response.data.code === 103) return next(customError('Invalid API Key'))

    return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function airtime2CashSubscription(req,res,next) {
    try{
        const {phone, amount, userId, name, service, network, email} = req.body
        const fee = await getServiceFee('airtime2cash')
 
        const checkIfUserWalletExists = await Wallet.find({userId})

        if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

              
      const serviceFees = await ServiceFees.find();


        if(checkIfUserWalletExists[0].balance < parseInt(amount + serviceFees[0].airtime2cash )) return next(customError('Insufficient funds'))

        const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

        const response = await axios.post(`https://vtuafrica.com.ng/portal/api/airtime-cash/?apikey=${vtuAfricaKey}&network=${network}&sender=${email}&sendernumber=${phone}&amount=${amount}&sitephone=08124139638&ref=${reference}&https://814f-105-116-11-173.ngrok-free.app/api/vtu-africa-webhook`)

        
        
        if(response.data.description.message === 'You Can Not Convert Airtime Less Than N100') 
            return next(customError(response.data.description.message))

        const newTransaction = new TransactionHistoryWallet({
            userId,
            transactionType: 'Bills',
            amount: +amount + serviceFees[0].airtime2cash,
            status: 'pending',
            details: `Airtime to Cash is currently pending. Account will be deposited once confirmed`,
            txId: reference,
            rId: v4(),
            name: 'Airtime to Cash Subscription',
            username: name,
            provider: 'Airtime to Cash',
            receipt: response.data
        });    

        await newTransaction.save()

        await logActivity(
            userId,
            'BILL_PAYMENT',
            `${name} initiated airtime to cash conversion of ₦${amount}`,
            +amount + serviceFees[0].airtime2cash,
            'pending',
            { provider: network, phone }
        );

        // Send receipt email
        sendReceiptEmail(email, { type: 'Airtime to Cash Subscription', details: { ...response.data, amount } });

        return res.json({text:'Airtime to Cash Subscription purchased successfully', message: newTransaction})
    }
    catch(err){
        console.log(err);
        next(customError(err))
    }
}


async function getAllEsimsDataPackages(req, res, next){
  try{

    const payload = {
        "locationCode": "",
        "type":"",
        "slug":"",
        "packageCode":"",
        "iccid":""
    }

    const config = {
      "RT-AccessCode": esimsAccessCode,
      "RT-RequestID":v4(),
      "RT-Signature":'',
      "RT-Timestamp":Math.floor(Date.now() / 1000),
      "SecretKey":esimsSecretKey,
      "RequestBody": JSON.stringify(payload)
    }
  
    const signData = config.RT_Timestamp + 
      config.RT_RequestID + 
      config.RT_AccessCode + 
      config.RequestBody;
  
    // Step 4: Generate HMAC-SHA256 Signature
    const signature = crypto
      .createHmac('sha256', config.SecretKey) // Use Secret Key
      .update(signData) // Add signData to HMAC
      .digest('hex') // Generate hexadecimal output
      .toLowerCase(); // Standardize to lowercase
  
      
    config.RT_Signature = signature;
  
    const rateResponse = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');

    const usdToNgn = rateResponse.data.usd.ngn + 250 ; 

    const response = await axios.post('https://api.esimaccess.com/api/v1/open/package/list', payload, {
      headers: config
    });

  
    // Convert prices from USD to NGN
    const dataWithNaira = response.data.obj.packageList.map(item => ({
      ...item,
      priceInNaira: Math.ceil(item.retailPrice / 10000 * usdToNgn), // Convert USD to NGN and round up
      originalPrice: item.retailPrice, // Keep original USD price if needed,
      nairaCurrency: 'NGN'
    }));

    

    return res.json({
      message: dataWithNaira,
      exchangeRate: usdToNgn,
      lastUpdated: new Date().toISOString()
    });
  
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function esimSubscription(req, res, next){
    try{
        const {originalAmount: amount, packageCode, feeAmount, count, userId, name} = req.body

        const checkIfUserWalletExists = await Wallet.find({userId})

        if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

        // const fee = await ServiceFees.find()
        
        if(checkIfUserWalletExists[0].balance < parseInt(feeAmount)) return next(customError('Insufficient funds'))

        const reference = v4()

        const payload = {
            transactionId:reference,
            amount,
            packageInfoList: [{
                packageCode,
                count,
                price:amount
            }]
        }

        const config = {
            "RT-AccessCode": esimsAccessCode,
            "RT-RequestID":v4(),
            "RT-Signature":'',
            "RT-Timestamp":Math.floor(Date.now() / 1000),
            "SecretKey":esimsSecretKey,
            "RequestBody": JSON.stringify(payload)
        }

        const signData = config.RT_Timestamp + 
            config.RT_RequestID + 
            config.RT_AccessCode + 
            config.RequestBody;

        const signature = crypto
            .createHmac('sha256', config.SecretKey)
            .update(signData)
            .digest('hex')
            .toLowerCase();

        config.RT_Signature = signature;


        const response = await axios.post(`${esimsUrl}v1/open/esim/order`, payload, {
            headers: config
        })

        if(response.data?.errorMsg === 'the balance is insufficient') 
            return next(customError('Service is unavailable'))

        await Wallet.findByIdAndUpdate(
            checkIfUserWalletExists[0]._id,
            {
                $set: {
                    balance: checkIfUserWalletExists[0].balance - parseInt(feeAmount)
                }
            },
            {
                new: true,
                runValidators: true
            })

        const newTransaction = new TransactionHistoryWallet({
            userId,
            transactionType: 'Bills',
            amount: feeAmount,
            status: 'success',
            details: `You have successfully purchased esims worth ${feeAmount} naira`,
            txId: reference,
            rId: v4(),
            name: 'Esims Subscription',
            username: name,
            provider:'Esims',
            receipt: response.data
        });    

        await newTransaction.save()

        await logActivity(
            userId,
            'BILL_PAYMENT',
            `${name} purchased eSIM package worth ₦${feeAmount}`,
             feeAmount,
            'success',
            { packageCode, count }
        );

        return res.json({text:'Esims Subscription successfully purchased', message: newTransaction})   
    }
    catch(err){
        console.log(err);
        next(customError(err))
    }
}


async function getAvailableGiftCardsCountries(req, res, next) {
  try {
    // Fetch all active countries from the database
    const countries = await GiftCardCountry.find({  });
    return res.json({ message: countries.map(c => c.data) });
  } catch (err) {
    console.log(err);
    next(customError(err));
  }
}

async function getAvailableGiftCardsProducts(req, res, next) {
try{
  const {size = 50, page = 1, countryCode, brandId, search} = req.query;
  
  // Build query based on filters
  const query = { isActive: true };
  
  if (countryCode) {
    query['data.countryCode'] = countryCode;
  }
  
  if (brandId) {
    query['data.brandId'] = parseInt(brandId);
  }
  
  if (search) {
    query.$or = [
      { 'data.productName': { $regex: search, $options: 'i' } },
      { 'data.brandName': { $regex: search, $options: 'i' } },
      { 'data.countryName': { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const limit = parseInt(size);
  const skip = (parseInt(page) - 1) * limit;

  // Get total count for pagination
  const totalCount = await GiftCard.countDocuments(query);
  
  // Fetch gift cards from database
  const giftCards = await GiftCard.find(query)
    .sort({ 'data.productName': 1 })
    .skip(skip)
    .limit(limit);


  const formattedResponse = {
    content: giftCards.map(card => card.data), // Return the entire data object
    totalElements: totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: parseInt(page),
    size: limit,
    first: parseInt(page) === 1,
    last: parseInt(page) >= Math.ceil(totalCount / limit)
  };

  return res.json({message: formattedResponse});
}
catch(err){
    console.log(err);
    next(customError(err));
}
}

async function getAvailableGiftCardsProductsByCountry(req, res, next) {
  try {
    const { countryCode, size = 50, page = 1, brandId } = req.params;
    // Fetch the country from the DB
    const country = await GiftCardCountry.findOne({ countryCode: countryCode.toUpperCase() });
    if (!country) {
      return res.status(404).json({ error: 'Country not found' });
    }
    // Use the country name to filter products
    const countryName = country.data.name || country.data.countryName || country.data.displayName;
    if (!countryName) {
      return res.status(400).json({ error: 'Country name not found in country data' });
    }

    const exampleProduct = await GiftCard.findOne({});

    const query = { isActive: true, 'data.country.name': { $regex: `^${countryName}$`, $options: 'i' } };
    if (brandId) {
      query['data.brandId'] = parseInt(brandId);
    }
    // Pagination
    const limit = parseInt(size);
    const skip = (parseInt(page) - 1) * limit;
    // Get total count for pagination
    const totalCount = await GiftCard.countDocuments(query);
    // Fetch gift cards from database
    const giftCards = await GiftCard.find(query)
      .sort({ 'data.productName': 1 })
      .skip(skip)
      .limit(limit);
    // Format response to match the original API structure
    const formattedResponse = {
      content: giftCards.map(card => card.data),
      totalElements: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      size: limit,
      first: parseInt(page) === 1,
      last: parseInt(page) >= Math.ceil(totalCount / limit)
    };
    return res.json({ message: formattedResponse });
  } catch (err) {
    console.log(err);
    next(customError(err));
  }
}

async function getPurchasedGiftCardTransaction(req, res, next) {
try{

  const {transactionId} = req.params

const payload = {
"client_id": reloadlyClientId,
"client_secret": reloadlySecretKey,
"grant_type": "client_credentials",
"audience": giftCardUrl
}

const loginResponse = await axios.post(`https://auth.reloadly.com/oauth/token`, payload, {
headers: {
'Content-Type': 'application/json',
},
})


  const config = {
    "Authorization": `Bearer ${loginResponse.data.access_token}`,
    "Content-Type": "application/json",
  }
  const response = await axios.get(`${giftCardUrl}orders/transactions/cards`, {
    params: {
      transactionId,
    },
    headers: config,
  });
  

    return res.json({message: response.data})
}
catch(err){
    console.log(err)
    next(customError(err?.response))
}
}

async function viewGiftCardRedeemInstructions(req, res, next) {
  try{
    const {brandId} = req.params
    

    const payload = {
      "client_id": reloadlyClientId,
      "client_secret": reloadlySecretKey,
      "grant_type": "client_credentials",
      "audience": giftCardUrl
    }
    

    const loginResponse = await axios.post(`https://auth.reloadly.com/oauth/token`, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const response = await axios.get(`${giftCardUrl}redeem-instructions/${brandId}`, {
      headers:'Bearer '
    })

      return res.json({message: response.data})
    
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

const purchaseGiftCardValidators = [
  vBody('recipientPhone').isString().isLength({ min: 5, max: 20 }).trim().escape(),
  vBody('productId').isInt(),
  vBody('countryCode').isString().isLength({ min: 2, max: 5 }).trim().escape(),
  vBody('unitPrice').isNumeric(),
  vBody('quantity').isInt({ min: 1 }),
  vBody('productName').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('senderName').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('email').isEmail().normalizeEmail(),
  vBody('recipientCountryCode').isString().isLength({ min: 2, max: 5 }).trim().escape(),
  vBody('amount').isNumeric(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape()
];

async function purchaseGiftCard(req, res, next) {
  try{
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
    }
    const {recipientPhone, productId, countryCode, unitPrice, quantity, productName, senderName, email, recipientCountryCode, amount, userId,   name} = req.body
    
    const fee = await getServiceFee('giftcards') / 100 * amount 

    const checkIfUserWalletExists = await Wallet.find({userId})

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(amount + fee)) return next(customError('Insufficient funds'))

    const reference = v4()

   const payload = {
      "productId": productId,
      "quantity": quantity,
      "unitPrice": unitPrice,
      "customIdentifier": reference,
      "productAdditionalRequirements": {
          "userId": userId
      },
      "senderName": senderName,
      "recipientEmail": email,
      "recipientPhoneDetails": {
          "countryCode": countryCode, 
          "phoneNumber": recipientPhone
      },
      "preOrder": false,
  }
  

const authPayload = {
"client_id": reloadlyClientId,
"client_secret": reloadlySecretKey,
"grant_type": "client_credentials",
"audience": giftCardUrl.replace(/\/$/, '')
}

const loginResponse = await axios.post(`https://auth.reloadly.com/oauth/token`, authPayload, {
headers: {
  'Content-Type': 'application/json',
},
})


    const config = {
      "Authorization": `Bearer ${loginResponse.data.access_token}`,
      "Content-Type": "application/json",
    }

    const response = await axios.post(`${giftCardUrl}orders`, payload, {
      headers:config
    })

    const billsTransactionTracker = new BillsTransactionTracker({
      userId,
      amount,
      isConfirmed: false,
    })


    await billsTransactionTracker.save()

    const newTransaction = new TransactionHistoryWallet({
      userId,
      transactionType: 'Bills',
      amount: amount + fee,
      status: 'pending',  
      details: `Your giftcard purchase is currently being processed`,
      txId: reference,
      rId: v4(),
      name: 'Giftcard Subscription Pending',
      username: name,
      provider:'Giftcard',
      receipt: response.data
  });    
  
  await newTransaction.save()

  await logActivity(
    userId,
    'BILL_PAYMENT',
    `${name} purchased a giftcard worth ₦${amount + fee} which is being processed`,
    amount + fee,
    'pending',
    { provider: 'Giftcard', product: productName }
  );

  sendReceiptEmail(email, {
    type: 'Giftcard Subscription Pending',
    details: {
      // ...response.data,
      amount: amount + fee,
      // transactionId: reference,
      date: new Date().toISOString(),
      status: 'Pending',
      product: productName,
      BillersCode: '',
      product: response.data.product,
      recipientEmail: response.data.recipientEmail,
      recipientPhone: response.data.recipientPhone,
      transactionCreatedTime: response.data.transactionCreatedTime,
      customIdentifier: response.data.customIdentifier,
      fee,
       preOrdered: response.data.preOrdered
    }
  });
  

  return res.json({text:'GiftCard Subscription', message: 'pending'})   


  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}


async function getInternationalAirtimeCountries(req, res, next){
  try{
    const response = await axios.get(`${vtpassUrl}get-international-airtime-countries`)

    return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function getInternationalProductTypes(req,res, next){
  try{
    const {countryCode} = req.params

    const response = await axios.get(`${vtpassUrl}get-international-airtime-product-types?code=${countryCode}`)

    return res.json({message: response.data})
  }   
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function getInternationalAirtimeOperators(req, res, next) {
    try{
      const {countryCode, productId} = req.params


      const response = await axios.get(`${vtpassUrl}get-international-airtime-operators?code=${countryCode}&product_type_id=${productId}`)
      
      return res.json({message: response.data})
    }
    catch(err){
      console.log(err)
      next(customError(err))
    }
}

async function getInternationalAirtimeVariations(req,res, next){
  try{
    const {productId, operatorId} = req.params


    const response = await axios.get(`${vtpassUrl}service-variations?serviceID=foreign-airtime&operator_id=${operatorId}&product_type_id=${productId}`)
   

    }
    catch(err){
      console.log(err)
      next(customError(err))
    }
}

async function internationalAirtimeSubscription(req, res, next){
    try {
        const {phone, serviceID, billersCode, country_code, operator_id, productId, email, amount, variation_code, variation_amount, name, userId} = req.body

        const checkIfUserWalletExists = await Wallet.find({userId})

        if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

        const fee = await ServiceFees.find()

        if(checkIfUserWalletExists[0].balance < parseInt(amount + fee[0]["intl-airtime-data"])) return next(customError('Insufficient funds'))

        const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

        const payload = {
            phone,
            serviceID,
            billersCode,
            variation_code,
            request_id: reference,
            amount: variation_amount,
            country_code,
            product_type_id: productId,
            email,
            operator_id
        };

        const headers = {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
        };    

        const response = await axios.post(`${vtpassUrl}pay`, payload, { headers })

        if(response.data.code === '085') return next(customError(response.data.response_description));
        if(response.data.code === '011') return next(customError(response.data.response_description));
        if(response.data.response_description === 'TRANSACTION FAILED') return next(customError(response.data.response_description));

        if(response.data.response_description === 'BELOW MINIMUM AMOUNT ALLOWED') return next(customError('AMOUNT IS BELOW MINIMUM AMOUNT ALLOWED'));

        await Wallet.findByIdAndUpdate(
            checkIfUserWalletExists[0]._id,
            {
                $set: {
                    balance: checkIfUserWalletExists[0].balance - parseInt(amount+fee[0]["intl-airtime-data"])
                }
            },
            {
                new: true,
                runValidators: true
            })

        const newTransaction = new TransactionHistoryWallet({
            userId,
            transactionType: 'Bills',
            amount: +amount + fee[0]["intl-airtime-data"],
            status: 'success',
            details: `You have successfully purchased international airtime services worth ${+amount + fee[0]["intl-airtime-data"]} naira`,
            txId: reference,
            rId: v4(),
            name: 'International Airtime Subscription',
            username: name,
            provider: serviceID,
            receipt: response.data
        });    

        await newTransaction.save()

        await logActivity(
            userId,
            'BILL_PAYMENT',
            `${name} purchased international airtime worth ₦${+amount + fee[0]["intl-airtime-data"]} for ${country_code}`,
            amount + fee[0]["intl-airtime-data"],
            'success',
            { provider: serviceID, country: country_code, operator: operator_id }
        );

        return res.json({text:'International Airtime purchased successfully', message: newTransaction})   

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        next(customError(error.response ? error.response.data : error.message))
    }
}

async function getSmileInternetVariations(req, res, next) {
    try{
        const response = await axios.get(`${vtpassUrl}service-variations?serviceID=smile-direct`)

        return res.json({message: response.data})
    }
    catch(err){
      console.log(err)
      next(customError(err))
    }
}

async function verifySmileEmail(req, res, next) {
    try{
      const {billersCode, serviceID} = req.body

      const payload = {
        billersCode, 
        serviceID
      }


      const headers = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
    };    


      const response = await axios.post(`${vtpassUrl}merchant-verify/smile/email`, payload, {headers})

      return res.json({message: response.data})
    }
    catch(err){
      console.log(err)
      next(customError(err))
    }

}

async function smileInternetSubscription(req, res, next){
  try {
    const {phone, serviceID, billersCode, amount, variation_code, email, name, userId} = req.body

    const checkIfUserWalletExists = await Wallet.find({userId})

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    const fee = await ServiceFees.find()

    if(checkIfUserWalletExists[0].balance < parseInt(amount + fee[0].internet)) return next(customError('Insufficient funds'))

    const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

    const payload = {
      phone,
      serviceID,
      billersCode,
      variation_code,
      request_id: reference,
      amount,
    };


    const headers = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
    };    

    const response = await axios.post(`${vtpassUrl}pay`, payload, { headers })


    if(response.data.code === '085') return next(customError('Service is currently unavailable'));


    if(response.data.code === '028') return next(customError('Service is currently unavailable'));

    if(response.data.code === '011') return next(customError(response.data.response_description));
    if(response.data.response_description === 'TRANSACTION FAILED') return next(customError(response.data.response_description));

    await Wallet.findByIdAndUpdate(
        checkIfUserWalletExists[0]._id,
        {
            $set: {
                balance: checkIfUserWalletExists[0].balance - parseInt(amount + fee[0].internet)
            }
        },
        {
            new: true,
            runValidators: true
        })
 
    const newTransaction = new TransactionHistoryWallet({
        userId,
        transactionType: 'Bills',
        amount: +amount + fee[0].internet,
        status: 'success',
        details: `You have successfully purchased smile internet services worth ${+amount + fee[0].internet} naira`,
        txId: reference,
        rId: v4(),
        name: 'Smile Internet Subscription',
        username: name,
        provider: serviceID,
        receipt: response.data
    });    
    
    await newTransaction.save()

    await sendReceiptEmail(email, {
      type: 'Smile Internet Subscription',
      details: {
          amount: parseInt(amount) + fee[0].internet,
          transactionId: reference,
          date: new Date().toISOString(),
          status: 'SUCCESSFUL',
          product: variation_code,
          "BillersCode": billersCode
      }
  });
    await logActivity(
        userId,
        'BILL_PAYMENT',
        `${name} purchased Smile Internet subscription worth ₦${amount + fee[0].internet}`,
        amount + fee[0].internet,
        'success',
        { provider: serviceID, plan: variation_code }
    );


    return res.json({text:'Smile Internet purchased successfully', message: newTransaction})   

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    next(customError(error.response ? error.response.data : error.message))
  }
}

async function getSpectranetVariations(req, res, next){
  try{
    const response = await axios.get(`${vtpassUrl}service-variations?serviceID=spectranet`)

    return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function spectranetInternetSubscription(req, res, next){
  try {
    const {phone, serviceID, billersCode, amount, quantity, variation_code, name, userId, email} = req.body // Add email to destructuring

    const fee = await ServiceFees.find()

    const checkIfUserWalletExists = await Wallet.find({userId})

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

    const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

    const payload = {
      phone,
      serviceID, 
      billersCode,
      variation_code,
      request_id: reference,
      amount,
      quantity
    };

    const headers = {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
    };    

    const response = await axios.post(`${vtpassUrl}pay`, payload, { headers })

    if(response.data.code === '085') return next(customError('Service is currently unavailable'));
    if(response.data.code === '028') return next(customError('Service is currently unavailable'));
    if(response.data.code === '011') return next(customError(response.data.response_description));
    if(response.data.response_description === 'TRANSACTION FAILED') return next(customError(response.data.response_description));

    await Wallet.findByIdAndUpdate(
        checkIfUserWalletExists[0]._id,
        {
            $set: {
                balance: checkIfUserWalletExists[0].balance - parseInt(amount + fee[0].internet)
            }
        },
        {
            new: true,
            runValidators: true
        })
 
    const newTransaction = new TransactionHistoryWallet({
        userId,
        transactionType: 'Bills',
        amount: amount + fee[0].internet,
        status: 'success',
        details: `You have successfully purchased spectranet internet services worth ${amount + fee[0].internet} naira`,
        txId: reference,
        rId: v4(),
        name: 'Spectranet Internet Subscription',
        username: name,
        provider: serviceID,
        receipt: response.data
    });    
    
    await newTransaction.save()

    await logActivity(
        userId,
        'BILL_PAYMENT',
        `${name} purchased Spectranet Internet subscription worth ₦${amount + fee[0].internet}`,
        amount + fee[0].internet,
        'success',
        { provider: serviceID, plan: variation_code }
    );

    // Add email sending
    await sendReceiptEmail(email, {
        type: 'Spectranet Internet Subscription',
        details: {
            ...response.data,
            amount: amount + fee[0].internet,
            planName: variation_code,
            transactionId: reference,
            date: moment().format('YYYY-MM-DD HH:mm:ss')
        }
    });
    
    return res.json({text:'Spectranet Internet purchased successfully', message: newTransaction})   

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    next(customError(error.response ? error.response.data : error.message))
  }
}

async function getUserCardDetails(req, res, next){
  try{
    const {userId = '6753813bf5ab2d7865c2b84e' } = req.params
    
 const checkIfUserCardExists = await VirtualCard.find({userId})
 

 if(checkIfUserCardExists.length === 0) return next(customError("User card does not exist"))

  const response = await
  axios.get(`${bitnobUrl}cards/${checkIfUserCardExists[0].cardId}`, {
    headers:{
      Authorization:`Bearer ${bitnobSecretKey}`
    }
  })


  
  return res.json({message: response.data, status: checkIfUserCardExists[0].status})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function freezeVirtualCard(req, res, next){
  try{
    const {userId} = req.body

    
    const checkIfUserCardExists = await VirtualCard.find({userId})
 
    if(checkIfUserCardExists.length === 0) return next(customError("User card does not exist"))

    if(checkIfUserCardExists[0].status === 'frozen') return next(customError("Card is already frozen"))

    const payload = {
        cardId: checkIfUserCardExists[0].cardId
 }

  const response = await axios.post(`${bitnobUrl}freeze`, payload, {
    headers:{
      Authorization:`Bearer ${bitnobSecretKey}`
    }
  })

  const updatedCard = await VirtualCard.findByIdAndUpdate(checkIfUserCardExists[0]._id, {
    status: "frozen"
  }, {new: true})

  return res.json({message: response.data, status: updatedCard.status})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function unfreezeVirtualCard(req, res, next){
  try{
    const {userId} = req.body
    
    const checkIfUserCardExists = await VirtualCard.find({userId})
 
 if(checkIfUserCardExists.length === 0) return next(customError("User card does not exist"))

  if(checkIfUserCardExists[0].status === 'active') return next(customError("Card is already active"))
  const payload = {
  cardId: checkIfUserCardExists[0].cardId
 }
 
  const response = await axios.post(`${bitnobUrl}unfreeze`, payload, {
    headers:{
      Authorization:`Bearer ${bitnobSecretKey}`
    }
  })
  
  const updatedCard = await VirtualCard.findByIdAndUpdate(checkIfUserCardExists[0]._id, {
    status: "active"
  }, {new: true})
  
  return res.json({message: response.data, status: updatedCard.status})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}
async function topupVirtualCard(req, res, next) {
    try{
      const {amount, userId = '6753813bf5ab2d7865c2b84e'} = req.body


      const checkIfUserCardExists = await VirtualCard.find({userId})
 
      if(checkIfUserCardExists.length === 0) return next(customError("User card does not exist"))

      const checkIfUserWalletExists = await Wallet.find({userId})

      if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))
      
      const ngnRate = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
          
      if(checkIfUserWalletExists[0].balance < parseInt(amount * ngnRate.data.usd.ngn)) return next(customError('Insufficient funds'))
    

      const reference = v4()

      const payload = {
        "amount": +amount * 100, // 100 cents is 1 dollar
        "cardId": checkIfUserCardExists[0].cardId,
        "reference": reference
        
      }

    

      const response = await axios.post(`${bitnobUrl}topup`, payload, {
        headers:{
          Authorization:`Bearer ${bitnobSecretKey}`
        }
      })
      

      return res.json({message: response.data  })
    }
    catch(err){
      console.log(err, 'nessafe')
      next(customError( err))
    }
}

async function terminateVirtualCard(req, res, next){
  try{
    const {userId} = req.body
    
    const checkIfUserCardExists = await VirtualCard.find({userId})
 
 if(checkIfUserCardExists.length === 0) return next(customError("User card does not exist"))
 
 const payload = {
  cardId: checkIfUserCardExists[0].cardId
 }

 const response = await
  axios.post(`${bitnobUrl}terminate`, payload, {
    headers:{
      Authorization:`Bearer ${bitnobSecretKey}`
    }
  })
  
  const updatedCard = await VirtualCard.findByIdAndUpdate(checkIfUserCardExists[0]._id, {
    status: "terminated"
  }, {new: true})
  
  return res.json({message: response.data, status: updatedCard.status})
  
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}
async function purchaseVirtualCard(req, res, next) {
    try{
      const { idNumber='08080933979383', idType='PASSPORT',country='nigeria', phoneNumber='0808232002', city='imo', state='owerri', zipCode='02808', line1='lmpdp', houseName='dlkojdj', bvn='02820890033828', userPhoto='odjo0duu00', dateOfBirth='jdojodod', userId = '67f1795c16e606ddf48c9959', customerEmail='favoralex0@gmail.com', firstName='Alex', lastName='Favour', amount='2', name='alex', cuserIdardBrand='visa', cardType = 'visa'} = req.body

      const checkIfUserWalletExists = await Wallet.find({userId})

      if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))
  
      const ngnRate = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')

     if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

      const reference = v4()

      const payload = {customerEmail, idNumber, idType, firstName, lastName,
      country, phoneNumber, city, state, zipCode, line1, houseName, bvn,
      userPhoto, dateOfBirth, reference, idImage: userPhoto}

      const response = await axios.post(`${bitnobUrl}registercarduser`, payload, {
        headers:{
          Authorization:`Bearer ${bitnobSecretKey}`
        }
      })

      await logActivity(
        userId,
        'VIRTUAL_CARD',
        `${firstName} ${lastName} created a new virtual card`,
        amount * ngnRate.data.usd.ngn,
        'success',
        { cardType, reference }
      );

    return res.json({text:'Virtual Card Subscription', message:response.data})   

    }
    catch(err){
      console.log(err.response)
      next(customError(err))
    }
}

async function waecNecoAndJambSubscriptions(req, res, next){
  try{
      const {service, product_code, quantity, amount, email, userId, name} = req.body

      
    const checkIfUserWalletExists = await Wallet.find({userId})
     
    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))


    const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

    const response = await axios.post(`https://vtuafrica.com.ng/portal/api/exam-pin/?apikey=${vtuAfricaKey}&service=${service}&product_code=${product_code}&quantity=${quantity}&ref=${reference}`)


    if(response.data.code === 103) return next(customError('Invalid API Key'))

    if(response.data.code === 104) return next(customError('Transaction Failed'))

    if(response.data.description.message === 'LOW BALANCE. Please Fund your account and try Again.') return next(customError('Service unavailable'))
    
    if(response.data?.description.message === 'Invalid Amount Entered. Minimun Bet funding is N100') return next(customError(response.data.description.message))

    if(response.data.code === 400) return next(customError('Service is currently unavailable due to server error'))

    if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

    if(checkIfUserWalletExists[0].balance < parseInt(response.data.description.UnitPrice)) return next(customError('Insufficient funds'))

      const fee = await ServiceFees.find()

    await  Wallet.findByIdAndUpdate(
      checkIfUserWalletExists[0]._id,
      {
          $set: {
              balance: checkIfUserWalletExists[0].balance - (parseInt(amount) + fee[0].education)
          }
      },
      {
          new: true,
          runValidators: true
      })

    const newTransaction = new TransactionHistoryWallet({
      userId,
      transactionType: 'Bills',
      amount: amount + fee[0].education,
      status: 'success',
      details: `You have successfully purchased an educational service worth ${amount + fee[0].education} naira`,
      txId: reference,
      rId: v4(),
      name: 'Educational Subscription',
      username: name,
      provider: 'Educational',
      receipt: response.data
  });    
  
  await newTransaction.save()

  sendReceiptEmail(email, {...response.data.content.transactions, ...response.data, amount})

  await logActivity(
      userId,
      'BILL_PAYMENT',
      `${name} purchased ${service} subscription worth ₦${amount + fee[0].education}`,
      amount + fee[0].education,
      'success',
      { service, product_code, quantity }
  );

  return res.json({text:'Educational Service purchased successfully', message: newTransaction})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function fetchEducationPlans(req, res, next){
  try{
    const response = await axios.get(`https://vtuafrica.com.ng/api/exam-pins.php`)



    return res.json({message: response.data})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}


async function buy9mobileAirtime(req, res, next) {
  try {
      const { phone, amount, name, userId } = req.body;

      const checkIfUserWalletExists = await Wallet.find({userId})

      if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

      if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

      const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

      const response = await axios.post(`${mobileNGUrl}api/topup`, {
          network: '9mobile',
          amount: amount,
          phone: phone,
          ref_id: reference
      }, {
          headers: {
              'Authorization': `Bearer ${mobileNGToken}`
          }
      })

      if(response.data.status === 'success') {
          await Wallet.findByIdAndUpdate(
              checkIfUserWalletExists[0]._id,
              {
                  $set: {
                      balance: checkIfUserWalletExists[0].balance - parseInt(amount)
                  }
              },
              {
                  new: true,
                  runValidators: true
              }
          )

          const newTransaction = new TransactionHistoryWallet({
              userId,
              transactionType: 'Bills',
              amount,
              status: 'success',
              details: `You have successfully purchased 9mobile airtime worth ${amount} naira`,
              txId: reference,
              rId: v4(),
              name: '9mobile Airtime',
              username: name,
              provider: '9mobile',
              receipt: response.data
          });

          await newTransaction.save()

          await logActivity(
              userId,
              'BILL_PAYMENT',
              `${name} purchased 9mobile airtime worth ₦${amount}`,
              amount,
              'success',
              { provider: '9mobile', phone }
          );

          return res.json({text:'9mobile airtime purchased successfully', message: newTransaction})
      } else {
          return next(customError('Transaction failed'))
      }
  } catch (error) {
      console.error('Error:', error.response ? error.response.data : error.message);
      next(customError(error.response ? error.response.data : error.message))
  }
}

async function buy9mobileData(req, res, next) {
  try {
      const { phone, amount, plan, name, userId } = req.body;

      const checkIfUserWalletExists = await Wallet.find({userId})

      if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

      if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

      const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

      const response = await axios.post(`${mobileNGUrl}api/data`, {
          network: '9mobile',
          plan: plan,
          phone: phone,
          ref_id: reference
      }, {
          headers: {
              'Authorization': `Bearer ${mobileNGToken}`
          }
      })

      if(response.data.status === 'success') {
          await Wallet.findByIdAndUpdate(
              checkIfUserWalletExists[0]._id,
              {
                  $set: {
                      balance: checkIfUserWalletExists[0].balance - parseInt(amount)
                  }
              },
              {
                  new: true,
                  runValidators: true
              }
          )

          const newTransaction = new TransactionHistoryWallet({
              userId,
              transactionType: '9mobile Bills',
              amount,
              status: 'success',
              details: `You have successfully purchased 9mobile data worth ${amount} naira`,
              txId: reference,
              rId: v4(),
              name: '9mobile Data',
              username: name,
              provider: '9mobile',
              receipt: response.data
          });    

          await newTransaction.save()

          await logActivity(
              userId,
              'BILL_PAYMENT',
              `${name} purchased 9mobile data plan worth ₦${amount}`,
              amount,
              'success',
              { provider: '9mobile', phone, plan }
          );

          return res.json({text:'9mobile data purchased successfully', message: newTransaction})
      } else {
          return next(customError('Transaction failed'))
      }
  } catch (error) {
      console.error('Error:', error.response ? error.response.data : error.message);
      next(customError(error.response ? error.response.data : error.message))
  }
}

async function getAccessToken(clientId, clientSecret) {
  const url = 'https://api.amadeus.com/v1/security/oauth2/token'; // Production endpoint
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const response = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data.access_token; // Return the access token
  } catch (error) {
    console.error('Error fetching access token:', error.response?.data || error.message);
    throw new Error('Unable to retrieve access token');
  }
}

async function fetchFlightBookingLocations(req, res, next) {
  try {
      const { keyword = 'lagos' } = req.params;

      
   const amadeus = new Amadeus({
    clientId: flightClientId,
    clientSecret: flightClientSecret,
   })

      const response = await amadeus.referenceData.locations 
        .get({ 
          keyword: keyword, 
          subType: "CITY,AIRPORT", 
        }) 

      return res.json({ message: response });
  } catch (err) {
      console.error(err);
      next(customError(err));
  }
}


async function fetchFlightBookingOffers(req, res, next){
  try{

    const {originCode = 'LON', destinationCode ='NYC', departureDate = '', adults= '1', children, infants, returnDate, travelClass} = req.body

    console.log(travelClass, 'date')

   const amadeus = new Amadeus({
    clientId: flightClientId,
    clientSecret: flightClientSecret,
   })

   console.log({
    originLocationCode: originCode,
    destinationLocationCode: destinationCode,
    departureDate,
    adults,
    children,
    infants,
    travelClass: travelClass.toUpperCase(),
    currencyCode: "USD",  
    ...(returnDate ? { returnDate } : {})  // Only add returnDate if it exists
  })
  
   const response = await amadeus.shopping.flightOffersSearch.get({
    originLocationCode: originCode,
    destinationLocationCode: destinationCode,
    departureDate,
    adults,
    children,
    infants,
    travelClass: travelClass.toUpperCase(),
    currencyCode: "USD",  
    ...(returnDate ? { returnDate } : {})  // Only add returnDate if it exists
  });

   return res.json({message: response.data})

  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function validateFlightBookingOfferPrice(req, res, next){
    try{

    const data = req.body

      
   const amadeus = new Amadeus({
    clientId: flightClientId,
    clientSecret: flightClientSecret,
   })

    const pricingResponse = await amadeus.shopping.flightOffers.pricing.post(
        JSON.stringify({
          data: {
            type: 'flight-offers-pricing',
            flightOffers: [data]
          },
        }))


       // {
      return res.json({message: pricingResponse.result.data.flightOffers})
      
    }
    catch(err){
      console.log(err)
      next(customError(err))
    }
}

async function flightBookingSubscription(req, res, next) {
  try {
    // Step 1: Generate Access Token
    const {flightData, travelers} = req.body


   const amadeus = new Amadeus({
    clientId: flightClientId,
    clientSecret: flightClientSecret,
   })


    const bookingResponse = await amadeus.booking.flightOrders
    .post(
      JSON.stringify({
        data: {
          type: "flight-order",
          flightOffers: [flightData],
          travelers: [
            {
              id: "1",
              dateOfBirth: "2012-10-11",
              gender: "FEMALE",
              contact: {
                emailAddress: "jorge.gonzales833@telefonica.es",
                phones: [
                  {
                    deviceType: "MOBILE",
                    countryCallingCode: "34",
                    number: "480080076",
                  },
                ],
              },
              name: {
                firstName: "ADRIANA",
                lastName: "GONZALES",
              },
            },
          ],
        },
      })
    )

    // const tokenResponse = await axios.post(
    //   'https://test.api.amadeus.com/v1/security/oauth2/token',
    //   new URLSearchParams({
    //     grant_type: 'client_credentials',
    //     client_id: 'CMmPljqdQv4U4QaqvfuTV3iPPGUxujte', // Replace with your Amadeus Client ID
    //     client_secret: '8uKd3B7drBrg2bfU', // Replace with your Amadeus Client Secret
    //   }).toString(),
    //   {
    //     headers: {
    //       'Content-Type': 'application/x-www-form-urlencoded',
    //     },
    //   }
    // );
    // console.log(tokenResponse, 'response')
    // const accessToken = tokenResponse.data.access_token;
    // console.log('Access Token:', accessToken);

    // // Step 2: Make the Flight Booking Request
    // const bookingPayload = {
    //   data: {
    //     type: 'flight-order',
    //     flightOffers: [flightData],
    //   },
    // };

    // const bookingResponse = await axios.post('https://test.api.amadeus.com/v1/booking/flight-orders', bookingPayload, {
    //   headers: {
    //     Authorization: `Bearer ${accessToken}`,
    //     'Content-Type': 'application/json',
    //     Accept: 'application/vnd.amadeus+json',
    //   },
    // });


    return res.json({ message: bookingResponse.data });
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    next(err);
  }
}

async function airtimeSubscription(req, res, next) {
    try {
        const { phone, serviceID, amount, name, userId } = req.body;

        const checkIfUserWalletExists = await Wallet.find({userId})

        if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

        if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

        const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

        const payload = {
            request_id: reference,
            serviceID,
            amount,
            phone
        };

        const headers = {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${vtpassUrl}pay`, payload, { headers })

        if(response.data.code === '000') {
            await Wallet.findByIdAndUpdate(
                checkIfUserWalletExists[0]._id,
                {
                    $set: {
                        balance: checkIfUserWalletExists[0].balance - parseInt(amount)
                    }
                },
                {
                    new: true,
                    runValidators: true
                }
            )

            const newTransaction = new TransactionHistoryWallet({
                userId,
                transactionType: 'Bills',
                amount,
                status: 'success',
                details: `You have successfully purchased airtime worth ${amount} naira`,
                txId: reference,
                rId: v4(),
                name: 'Airtime Subscription',
                username: name,
                provider: serviceID,
                receipt: response.data
            });    

            await newTransaction.save()

            await logActivity(
                userId,
                'BILL_PAYMENT',
                `${name} purchased airtime worth ₦${amount}`,
                amount,
                'success',
                { provider: serviceID, phone }
            );

            return res.json({text:'Airtime purchased successfully', message: newTransaction})
        } else {
            return next(customError(response.data.response_description))
        }
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        next(customError(error.response ? error.response.data : error.message))
    }
}

async function educationSubscription(req, res, next) {
    try {
        const { serviceID, billersCode, amount, email, name, userId } = req.body;

        const checkIfUserWalletExists = await Wallet.find({userId})

        if(checkIfUserWalletExists.length === 0) return next(customError('User wallet not found'))

        if(checkIfUserWalletExists[0].balance < parseInt(amount)) return next(customError('Insufficient funds'))

        const reference = `${moment().tz('Africa/Lagos').format('YYYYMMDDHHmmss')}-${v4()}`;  

        const payload = {
            request_id: reference,
            serviceID,
            billersCode,
            amount
        };

        const headers = {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(`${vtpassUrl}pay`, payload, { headers })

        if(response.data.code === '000') {
            await Wallet.findByIdAndUpdate(
                checkIfUserWalletExists[0]._id,
                {
                    $set: {
                        balance: checkIfUserWalletExists[0].balance - parseInt(amount)
                    }
                },
                {
                    new: true,
                    runValidators: true
                }
            )

            const newTransaction = new TransactionHistoryWallet({
                userId,
                transactionType: 'Bills',
                amount,
                status: 'success',
                details: `You have successfully paid education bill worth ${amount} naira`,
                txId: reference,
                rId: v4(),
                name: 'Education Bill Payment',
                username: name,
                provider: serviceID,
                receipt: response.data
            });    

            await newTransaction.save()

            // Send receipt email
            sendReceiptEmail(email, { type: 'Education Bill Payment', details: { ...response.data, amount } });

            await logActivity(
                userId,
                'BILL_PAYMENT',
                `${name} paid education bill worth ₦${amount}`,
                amount,
                'success',
                { provider: serviceID, billersCode }
            );

            return res.json({text:'Education bill paid successfully', message: newTransaction})
        } else {
            return next(customError(response.data.response_description))
        }
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        next(customError(error.response ? error.response.data : error.message))
    }
}

// Fetch gift cards from DB based on search term (productName, brandName, or countryName)
const searchGiftCardsByTermValidators = [
  query('search').optional().isString().isLength({ max: 50 }).trim().escape(),
  query('size').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('page').optional().isInt({ min: 1, max: 1000 }).toInt()
];

async function searchGiftCardsByTerm(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
    }
    const { search = '', size = 50, page = 1 } = req.query;
    const queryObj = { isActive: true };
    if (search) {
      // Escape regex special characters
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      queryObj.$or = [
        { 'data.productName': { $regex: safeSearch, $options: 'i' } },
        { 'data.brandName': { $regex: safeSearch, $options: 'i' } },
        { 'data.countryName': { $regex: safeSearch, $options: 'i' } },
        { 'data.country.name': { $regex: safeSearch, $options: 'i' } }
      ];
    }
    const limit = parseInt(size);
    const skip = (parseInt(page) - 1) * limit;
    const totalCount = await GiftCard.countDocuments(queryObj);
    const giftCards = await GiftCard.find(queryObj)
      .sort({ 'data.productName': 1 })
      .skip(skip)
      .limit(limit);
    const formattedResponse = {
      content: giftCards.map(card => card.data),
      totalElements: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      size: limit,
      first: parseInt(page) === 1,
      last: parseInt(page) >= Math.ceil(totalCount / limit)
    };
    return res.json({ message: formattedResponse });
  } catch (err) {
    // Scrub sensitive data from logs
    console.log('Error in searchGiftCardsByTerm:', err.message);
    next(customError('An error occurred while searching for gift cards. Please try again.'));
  }
}

const airtimePurchaseValidators = [
  vBody('phone').isString().isLength({ min: 7, max: 20 }).trim().escape(),
  vBody('amount').isNumeric(),
  vBody('subcategory_id').isString().trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('email').isEmail().normalizeEmail()
];

const dataPurchaseValidators = [
  vBody('phone').isString().isLength({ min: 7, max: 20 }).trim().escape(),
  vBody('amount').isNumeric(),
  vBody('subcategory_id').isString().trim().escape(),
  vBody('data').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('validity').isString().isLength({ min: 1, max: 50 }).trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('email').isEmail().normalizeEmail(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('plan_id').isString().trim().escape()
];

const cableSubscriptionValidators = [
  vBody('phone').isString().isLength({ min: 7, max: 20 }).trim().escape(),
  vBody('serviceID').isString().trim().escape(),
  vBody('billersCode').isString().trim().escape(),
  vBody('amount').isNumeric(),
  vBody('email').isEmail().normalizeEmail(),
  vBody('variation_code').isString().trim().escape(),
  vBody('quantity').isInt({ min: 1 }),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('subscription_type').optional().isString().trim().escape()
];

const electricityBillSubscriptionValidators = [
  vBody('phone').isString().isLength({ min: 7, max: 20 }).trim().escape(),
  vBody('serviceID').isString().trim().escape(),
  vBody('billersCode').isString().trim().escape(),
  vBody('email').isEmail().normalizeEmail(),
  vBody('amount').isNumeric(),
  vBody('variation_code').isString().trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape()
];

const bettingSubscriptionValidators = [
  vBody('phone').isString().isLength({ min: 7, max: 20 }).trim().escape(),
  vBody('amount').isNumeric(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('service').isString().trim().escape(),
  vBody('betUserId').isString().trim().escape(),
  vBody('email').isEmail().normalizeEmail()
];

const airtime2CashSubscriptionValidators = [
  vBody('phone').isString().isLength({ min: 7, max: 20 }).trim().escape(),
  vBody('amount').isNumeric(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('service').isString().trim().escape(),
  vBody('network').isString().trim().escape(),
  vBody('email').isEmail().normalizeEmail()
];

const waecNecoAndJambSubscriptionsValidators = [
  vBody('service').isString().trim().escape(),
  vBody('product_code').isString().trim().escape(),
  vBody('quantity').isInt({ min: 1 }),
  vBody('amount').isNumeric(),
  vBody('email').isEmail().normalizeEmail(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape()
];

const thirdPartyInsuranceSubscriptionValidators = [
  vBody('phone').isString().isLength({ min: 7, max: 20 }).trim().escape(),
  vBody('amount').isNumeric(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('email').isEmail().normalizeEmail(),
  vBody('vehicleNumber').isString().trim().escape(),
  vBody('vehicleMake').isString().trim().escape(),
  vBody('vehicleModel').isString().trim().escape(),
  vBody('vehicleColor').isString().trim().escape(),
  vBody('engineCapacity').isString().trim().escape(),
  vBody('stateCode').isString().trim().escape(),
  vBody('lgaCode').isString().trim().escape(),
  vBody('variation_code').isString().trim().escape()
];

const personalAccidentInsuranceSubscriptionValidators = [
  vBody('phone').isString().isLength({ min: 7, max: 20 }).trim().escape(),
  vBody('amount').isNumeric(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('email').isEmail().normalizeEmail(),
  vBody('variation_code').isString().trim().escape(),
  vBody('fullName').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('dateOfBirth').isString().trim().escape(),
  vBody('gender').isString().trim().escape(),
  vBody('occupation').isString().trim().escape(),
  vBody('address').isString().trim().escape()
];

const esimSubscriptionValidators = [
  vBody('phone').isString().isLength({ min: 7, max: 20 }).trim().escape(),
  vBody('amount').isNumeric(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('email').isEmail().normalizeEmail(),
  vBody('packageId').isString().trim().escape(),
  vBody('packageName').isString().trim().escape(),
  vBody('dataSize').isString().trim().escape(),
  vBody('validity').isString().trim().escape()
];

const purchaseVirtualCardValidators = [
  vBody('amount').isNumeric(),
  vBody('userId').isString().isLength({ min: 5, max: 50 }).trim().escape(),
  vBody('name').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  vBody('email').isEmail().normalizeEmail(),
  vBody('currency').optional().isString().trim().escape(),
  vBody('cardType').optional().isString().trim().escape()
];

module.exports = {
    airtimePurchase,
    dataPurchase,
    cableSubscription,
    electricityBillSubscription,
    fetchDataPlans,
    fetchCableTvPlans,
    verifyTvSmartCode,
    verifyElectricityMeterNumber,
    getWaecRegistrationVariations,
    waecRegistrationSubscription,
    getWaecResultCheckerVariations,
    waecResultCheckerSubscription,
    getJambSubscriptionVariations,
    jambRegistrationSubscription,
    getAllEsimsDataPackages,
    esimSubscription,
    getAvailableGiftCardsCountries,
    viewGiftCardRedeemInstructions,
    purchaseGiftCard,
    getThirdPartyColorCodes,
    getThirdPartyEngineCapacityCode,
    getThirdPartyInsuranceVariations,
    getThirdPartyLocalGovernmentAreaCode,
    getThirdPartyStateCode,
    getThirdPartyVehicleMakeCode,
    getThirdPartyVehicleModelCode,
    thirdPartyInsuranceSubscription,
    personalAccidentInsuranceSubscription,
    getPersonalAccidentInsuranceVariations,
    bettingSubscription,
    airtime2CashSubscription,
    verifyIfAirtime2CashIsAvailable,
    getAvailableGiftCardsProducts,
    getAvailableGiftCardsProductsByCountry,
    getPurchasedGiftCardTransaction,
    purchaseVirtualCard,
    getSpectranetVariations,
    spectranetInternetSubscription,
    getSmileInternetVariations,
    smileInternetSubscription,
    topupVirtualCard,
    verifySmileEmail,
    getInternationalAirtimeCountries,
    internationalAirtimeSubscription,
    getInternationalAirtimeOperators,
    getInternationalAirtimeVariations,
    getInternationalProductTypes,
    waecNecoAndJambSubscriptions,
    fetchFlightBookingLocations,
    fetchFlightBookingOffers,
    validateFlightBookingOfferPrice,
    flightBookingSubscription,
    getUserCardDetails,
    terminateVirtualCard,
    unfreezeVirtualCard,
    freezeVirtualCard,
    buy9mobileAirtime,
    buy9mobileData,
    fetch9MobileDataPlans,
    airtimeSubscription,
    fetchEducationPlans,
    educationSubscription,
    getMobileNetworkPlans,
    storeDataNetworks,
    searchGiftCardsByTerm,
    searchGiftCardsByTermValidators,
    purchaseGiftCardValidators,
    airtimePurchaseValidators,
    dataPurchaseValidators,
    cableSubscriptionValidators,
    electricityBillSubscriptionValidators,
    bettingSubscriptionValidators,
    airtime2CashSubscriptionValidators,
    waecNecoAndJambSubscriptionsValidators,
    thirdPartyInsuranceSubscriptionValidators,
    personalAccidentInsuranceSubscriptionValidators,
    esimSubscriptionValidators,
    purchaseVirtualCardValidators
}