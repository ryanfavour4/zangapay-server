const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4 } = require('uuid');
const Wallet = require('../models/wallet');
const TransactionHistoryWallet = require('../models/transactionHistoryWallet');
const BillsTransactionTracker = require('../models/billsTransactionTracker');
const VirtualCard = require('../models/virtualCards');
const User = require('../models/user');
const { sendOTPEmail } = require('../mail template/authentication-mail.js');
const { default: axios } = require('axios');
const VirtualCards = require('../models/virtualCards');
require('dotenv').config();

// Store processed transaction IDs to ensure idempotency
const processedTransactions = new Set();


const bitnobSecretKey = process.env.BITNOB_SECRET_KEY

const bitnobUrl = 'https://sandboxapp.bitnob.co/api/v1/virtualcards/'

const bitnobWebhookSecret = process.env.BITNOB_WEBHOOK_SECRET

// Verify Bitnob webhook signature
function verifyBitnobSignature(payload, signature, secret) {
    try {
        // Get the raw body as a string
        const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        
        // Create HMAC with SHA256
        const hmac = crypto.createHmac('sha256', secret);
        
        // Update HMAC with the body
        hmac.update(bodyStr);
        
        // Get the computed signature
        const computedSignature = hmac.digest('hex');
        
        // Compare signatures
        return computedSignature === signature;
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
}

// Process the webhook data asynchronously
async function processWebhookData(event) {
    try {
        // Check if we've already processed this transaction
        if (processedTransactions.has(event.data.id)) {
            console.log('Transaction already processed:', event.data.id);
            return;
        }

            console.log(event, 'event')

        // Add to processed transactions set
        processedTransactions.add(event.data.id);

        // Handle different event types
        switch (event.event) {
            case 'virtualcard.created.success':
                await handleCardCreatedSuccess(event.data);
                break;

            case 'virtualcard.topup.success':
                await handleCardTopupSuccess(event.data);
                break;

            case 'card.frozen':
                await handleCardFrozen(event.data);
                break;

            case 'card.unfrozen':
                await handleCardUnfrozen(event.data);
                break;

            case 'card.terminated':
                await handleCardTerminated(event.data);
                break;

            case 'virtualcard.created.failed':
                await handleVirtualCardCreationFailed(event.data);
                break;

            case 'virtualcard.user.kyc.success':
                await handleKycSuccess(event.data);
                break;

            case 'virtualcard.withdrawal.success':
                await handleVirtualCardWithdrawalSuccess(event.data);
                break;
            case 'virtualcard.withdrawal.failed':
                await handleVirtualCardWithdrawalFailed(event.data);
                break;
            case 'virtualcard.transaction.debit': 
                await handleSuccessfulTransaction(event.data); 
                break;
                case 'virtualcard.transaction.declined':
                await handleFailedTransaction(event.data);
                 break;
            case 'virtualcard.user.kyc.failed':
                await handleKycFailed(event.data);
                break;

            default:
                console.log('Unhandled event type:', event.type);
        }
    } catch (error) {
        console.error('Error processing webhook data:', error);
    } finally {
        // Remove from processed set after some time (e.g., 1 hour)
        setTimeout(() => {
            processedTransactions.delete(event.data.id);
        }, 3600000); // 1 hour
    }
}

exports.virtualCardWebhooks = async (req, res) => {
    try {
        console.log('Webhook called');
        console.log('Request headers:', req.headers);
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const event = req.body;
        const signature = req.headers['x-bitnob-signature'];

        console.log(event)

        // Verify webhook signature
        // if (!signature) {
        //     console.error('No signature found in headers');
        //     return res.status(401).json({ error: 'No signature provided' });
        // }

        const isValidSignature = verifyBitnobSignature(
            req.body,
            signature,
            process.env.BITNOB_WEBHOOK_SECRET
        );

        // if (!isValidSignature) {
        //     console.error('Invalid webhook signature');
        //     return res.status(401).json({ error: 'Invalid signature' });
        // }

        // Immediately acknowledge receipt
        res.status(200).json({ received: true });

        // Process the webhook data asynchronously
        processWebhookData(event).catch(error => {
            console.error('Error in async processing:', error);
        });
    } catch (error) {
        console.error('Error in webhook endpoint:', error);
        // Still return 200 to prevent retries
        res.status(200).json({ received: true });
    }
}

async function handleSuccessfulTransaction(data) {
    const { userId, amount, cardInfo, settlementCountry } = data;
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return;
    const crossFee = settlementCountry !== 'US' ? parseFloat(amount) * 0.03 + 0.8 : 0;
    const total = parseFloat(amount) + crossFee;
    await Wallet.findByIdAndUpdate(wallet._id, { $inc: { balance: -total } });
    await new TransactionHistoryWallet({ userId, transactionType: 'Transaction', amount: total.toString(), status: 'success', details: `Charge ${amount} + cross-border fee ${crossFee.toFixed(2)}`, txId: cardInfo.id || v4(), rId: v4(), name: 'Card Charge', username: cardInfo.cardName, provider: 'Virtual Card', receipt: data }).save();
    await sendOTPEmail(cardInfo.email, 'Charge Successful', { transactionType: 'Charge', status: 'Success', amount: total, details: `Original ${amount}, cross-border ${crossFee.toFixed(2)}` });
  }
  
  async function handleFailedTransaction(data) {
    const { userId, amount, cardInfo, errorDetails } = data;
    await new TransactionHistoryWallet({ userId, transactionType: 'Transaction', amount: amount.toString(), status: 'failed', details: errorDetails, txId: cardInfo.id || v4(), rId: v4(), name: 'Card Charge Failed', username: cardInfo.cardName, provider: 'Virtual Card', receipt: data }).save();
    await sendOTPEmail(cardInfo.email, 'Charge Failed', { transactionType: 'Charge', status: 'Failed', amount, errorDetails });
  }
  
async function handleCardFrozen(data) {
    try {
        // Update card status
        await VirtualCard.findOneAndUpdate(
            { cardId: data.cardId },
            { status: 'frozen' },
            { new: true }
        );

        // Create transaction record
        const transaction = new TransactionHistoryWallet({
            userId: data.userId,
            transactionType: 'Bills',
            status: 'success',
            details: 'Virtual card frozen',
            txId: data.id || v4(),
            rId: v4(),
            name: 'Virtual Card Status Update',
            username: data.cardName,
            provider: 'Bitnob',
            receipt: data
        });

        await transaction.save();

        // Send email notification
        await sendOTPEmail(data.email, 'Virtual Card Transaction', {
            transactionType: 'Virtual Card Status Update',
            status: 'Card Frozen',
            cardDetails: {
                cardName: data.cardName,
                lastFourDigits: data.cardNumber.slice(-4)
            }
        });
    } catch (error) {
        console.error('Error in handleCardFrozen:', error);
        throw error;
    }
}

async function handleCardUnfrozen(data) {
    try {
        // Update card status
        await VirtualCard.findOneAndUpdate(
            { cardId: data.cardId },
            { status: 'active' },
            { new: true }
        );

        // Create transaction record
        const transaction = new TransactionHistoryWallet({
            userId: data.userId,
            transactionType: 'Bills',
            status: 'success',
            details: 'Virtual card unfrozen',
            txId: data.id || v4(),
            rId: v4(),
            name: 'Virtual Card Status Update',
            username: data.cardName,
            provider: 'Bitnob',
            receipt: data
        });

        await transaction.save();

        // Send email notification
        await sendOTPEmail(data.email, 'Virtual Card Transaction', {
            transactionType: 'Virtual Card Status Update',
            status: 'Card Unfrozen',
            cardDetails: {
                cardName: data.cardName,
                lastFourDigits: data.cardNumber.slice(-4)
            }
        });
    } catch (error) {
        console.error('Error in handleCardUnfrozen:', error);
        throw error;
    }
}
async function handleCardTerminated(data) {
    try {
      await VirtualCard.findOneAndUpdate({ cardId: data.cardId }, { status: 'terminated' }, { new: true });
      const userWallet = await Wallet.findOne({ userId: data.userId });
      if (userWallet) {
        const rateResp = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        const ngnRate = rateResp.data.usd.ngn + 250;
        const feeNGN = 1.20 * ngnRate;
        const newBal = userWallet.balance - feeNGN;
        await Wallet.findByIdAndUpdate(userWallet._id, { $set: { balance: newBal } });
        const feeTxn = new TransactionHistoryWallet({
          userId: data.userId,
          transactionType: 'Card Termination Fee',
          amount: feeNGN.toString(),
          status: 'success',
          details: 'Card termination fee of $1.20 applied.',
          txId: v4(),
          rId: v4(),
          name: 'Card Termination Fee',
          username: data.cardName,
          provider: 'Virtual Card',
          receipt: data
        });
        await feeTxn.save();
      }
      const transaction = new TransactionHistoryWallet({
        userId: data.userId,
        transactionType: 'Bills',
        status: 'success',
        details: 'Virtual card terminated',
        txId: data.id || v4(),
        rId: v4(),
        name: 'Virtual Card Status Update',
        username: data.cardName,
        provider: 'Bitnob',
        receipt: data
      });
      await transaction.save();
      await sendOTPEmail(data.email, 'Virtual Card Transaction', {
        transactionType: 'Virtual Card Status Update',
        status: 'Card Terminated',
        cardDetails: {
          cardName: data.cardName,
          lastFourDigits: data.cardNumber.slice(-4)
        }
      });
    } catch (error) {
      console.error('Error in handleCardTerminated:', error);
      throw error;
    }
  }
  
// Modified handleVirtualCardCreationFailed
async function handleVirtualCardCreationFailed(data) {
    try {
        console.log('Virtual card creation failed:', data.reason);
        // Attempt to fetch card details similar to the success flow
        const response = await axios.get(`${bitnobUrl}cards/${data.id}`, {
            headers: { accept: 'application/json', Authorization: `Bearer ${bitnobSecretKey}` }
        });
        const userData = response.data.data;
        // Retrieve user by customerEmail from Bitnob
        const userAccount = await User.findOne({ email: userData.customerEmail });
        const reference = data.reference || v4();
        const transaction = new TransactionHistoryWallet({
            userId: userAccount ? userAccount._id : null,
            transactionType: 'Virtual Card Creation Failure',
            amount: 0,
            status: 'failed',
            details: `Virtual card creation failed: ${data.reason}`,
            txId: reference,
            rId: v4(),
            name: 'Virtual Card Creation Failed',
            username: userAccount ? (userAccount.firstName + ' ' + userAccount.lastName) : 'Unknown',
            provider: 'Virtual Card',
            receipt: data
        });
        await transaction.save();
    } catch (error) {
        console.error('Error handling virtual card creation failure:', error);
    }
}

// Modified handleKycFailed
async function handleKycFailed(data) {
    try {
        console.log('KYC failed for user:', data.customerId);
        // Update user's KYC status to 'failed'
        await User.findOneAndUpdate({ _id: data.customerId }, { kycStatus: 'failed' });
        // Retrieve detailed user data from Bitnob's API similar to KYC success handler
        const response = await axios.get(`${bitnobUrl}users/${data.id}`, {
            headers: { accept: 'application/json', Authorization: `Bearer ${bitnobSecretKey}` }
        });
        const userData = response.data.data;
        const userAccount = await User.findOne({ email: userData.customerEmail });
        const reference = data.reference || v4();
        const transaction = new TransactionHistoryWallet({
            userId: userAccount ? userAccount._id : data.customerId,
            transactionType: 'KYC Failure',
            amount: 0,
            status: 'failed',
            details: `KYC verification failed: ${data.reason || 'Verification failed'}`,
            txId: reference,
            rId: v4(),
            name: 'KYC Verification Failed',
            username: userAccount ? (userAccount.firstName + ' ' + userAccount.lastName) : 'Unknown',
            provider: 'Virtual Card',
            receipt: data
        });
        await transaction.save();
    } catch (error) {
        console.error('Error handling KYC failure:', error);
    }
}

// Handle virtual card creation success
async function handleCardCreatedSuccess(data) {
    try {
        const { id } = data;

        console.log(data)

        console.log(id, 'id')

        const response = await axios.get(`${bitnobUrl}cards/${id}`, {
            headers: {accept: 'application/json', Authorization: `Bearer ${bitnobSecretKey}`}
        })
        
        const userData = response.data.data;

        const user = await User.findOne({ email: userData.customerEmail });
        await new VirtualCard({ cardId: data.id, userId: user._id, status: 'active' }).save();
        const wallet = await Wallet.findOne({ userId: user._id });
        if (wallet) {
          const rateResp = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
          const ngnRate = rateResp.data.usd.ngn + 250;
          const fee = 2.00 * ngnRate;
          await Wallet.findByIdAndUpdate(wallet._id, { $inc: { balance: -fee } });
          await new TransactionHistoryWallet({ userId: user._id, transactionType: 'Card Creation Fee', amount: fee.toString(), status: 'success', details: 'Card creation fee of $2.00 applied.', txId: v4(), rId: v4(), name: 'Card Creation Fee', username: `${user.firstName} ${user.lastName}`, provider: 'Virtual Card', receipt: data }).save();
        }
    } catch (error) {
        console.error('Error handling card creation success:', error);
    }
}

// Handle virtual card top-up success
async function handleCardTopupSuccess(data) {
    try {
    const { cardId, amount } = data;
    const response = await axios.get(`${bitnobUrl}cards/${cardId}`, {
      headers: { accept: 'application/json', Authorization: `Bearer ${bitnobSecretKey}` }
    });
    const reference = v4();
    const ngnResp = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    const rate = ngnResp.data.usd.ngn + 250;
    const userData = response.data.data;
    const userAccount = await User.findOne({ email: userData.customerEmail });
    const wallet = await Wallet.findOne({ userId: userAccount._id });
    if (!wallet) return;
    const funded = (amount/100) * rate;
    const fee = funded < 100 ? 1.5 : funded * 0.02;
    const net = funded - fee;
    await Wallet.findByIdAndUpdate(wallet._id, { $set: { balance: wallet.balance - net } }, { new: true });
    const newTransaction = new TransactionHistoryWallet({
      userId: userAccount._id,
      transactionType: 'Virtual Card Top-Up',
      amount: net,
      status: 'success',
      details: 'Your virtual card top-up was successful.',
      txId: reference,
      rId: v4(),
      name: 'Virtual Card Top-Up',
      username: userAccount.firstName + ' ' + userAccount.lastName,
      provider: 'Virtual Card',
      receipt: response.data
    });
    await newTransaction.save();
  } catch (error) {
    console.error('Error handling card top-up success:', error);
  }

}

// Add this function to handle the 'virtualcard.withdrawal.success' event
async function handleVirtualCardWithdrawalSuccess(data) {
    try {
      const { cardId, amount, isTerminated } = data;
      const response = await axios.get(`${bitnobUrl}cards/${cardId}`, {
        headers: { accept: 'application/json', Authorization: `Bearer ${bitnobSecretKey}` }
      });
      const reference = v4();
      const userData = response.data.data;
      const userAccount = await User.findOne({ email: userData.customerEmail });
      const ngnResp = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      const rate = ngnResp.data.usd.ngn + 250;
      const converted = (amount/100) * rate;

      console.log(converted, 'converted amount')
      if (!isTerminated) {
        const newTransaction = new TransactionHistoryWallet({
          userId: userAccount._id,
          transactionType: 'Virtual Card Withdrawal',
          amount: converted,
          status: 'success',
          details: 'Your withdrawal from your virtual card has been successfully processed.',
          txId: reference,
          rId: v4(),
          name: 'Virtual Card Withdrawal',
          username: userAccount.firstName + ' ' + userAccount.lastName,
          provider: 'Virtual Card',
          receipt: response.data
        });
        await newTransaction.save();
        return;
      }
      const wallet = await Wallet.findOne({ userId: userAccount._id });
      if (!wallet) return;
      await Wallet.findByIdAndUpdate(wallet._id, { $set: { balance: wallet.balance + converted } }, { new: true });
      const refundTransaction = new TransactionHistoryWallet({
        userId: userAccount._id,
        transactionType: 'Virtual Card Termination Refund',
        amount: converted,
        status: 'success',
        details: 'Your virtual card has been terminated successfully.',
        txId: reference,
        rId: v4(),
        name: 'Virtual Card Termination Refund',
        username: userAccount.firstName + ' ' + userAccount.lastName,
        provider: 'Virtual Card',
        receipt: response.data
      });
      await refundTransaction.save();
    } catch (error) {
      console.error('Error handling virtual card withdrawal:', error);
    }
  }
  
  async function handleVirtualCardWithdrawalFailed(data) {
    const { cardId, amount, reference, narrative, isTerminated } = data;
    
    // Handle withdrawal failure logic
    const virtualCard = await VirtualCard.findOne({ cardId });
    if (!virtualCard) {
      console.log(`Card with ID ${cardId} not found.`);
      return;
    }
    
    // Update card status based on 'isTerminated' value
    const newStatus = isTerminated ? 'terminated' : virtualCard.status;
    await VirtualCard.findByIdAndUpdate(virtualCard._id, { status: newStatus });

    const ngnResp = await axios.get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    const rate = ngnResp.data.usd.ngn + 250;
    const converted = (amount/100) * rate;

    console.log(converted, 'converted amount')
  
    // Log the failed withdrawal transaction
    await new TransactionHistoryWallet({
      userId: virtualCard.userId,
      transactionType: 'Withdrawal Failed',
      amount: converted,
      status: 'failed',
      details: `Failed withdrawal: ${narrative}, reference: ${reference}`,
      txId: reference || v4(),
      rId: v4(),
      name: 'Withdrawal Failed',
      username: virtualCard.cardName,
      provider: 'Virtual Card',
      receipt: data,
    }).save();
  
    console.log(`Withdrawal failed for card ${cardId}: ${narrative}`);
  }
  
async function handleKycSuccess(data) {
    const { id, customerId } = data;

    console.log(id, 'id')

    // Log the KYC success event
    console.log(`KYC Success for customer: (ID: ${customerId})`);

    // Update the user's status in the database
    try {

        const userResponse = await axios.get(`${bitnobUrl}users/${id}`, {
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${bitnobSecretKey}` // Replace with your actual token
            }
        });


        if (userResponse) {
          
            const userData = userResponse.data.data;

            // Create a new virtual card
            const createCardResponse = await axios.post(`${bitnobUrl}create`, {
                customerEmail: userData.customerEmail,
                cardBrand: 'visa', // or any other brand as needed
                cardType: 'visa', // defaults to visa
                reference: v4(), // Generate a unique reference
                amount: 2 * 100, // Set the amount as needed
                firstName: userData.firstName, // Assuming these fields are available
                lastName: userData.lastName
            }, {
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${bitnobSecretKey}` // Replace with your actual token
                }
            });

            console.log('Virtual card created:', createCardResponse.data);
        } else {
            console.log(`User not found for customer ID: ${customerId}`);
        }
    } catch (error) {
        console.error('Error updating user KYC status or creating virtual card:', error);
    }

    // Optionally, send a notification to the user
    // sendNotification(customerEmail, 'Your KYC has been successfully verified!');
}

