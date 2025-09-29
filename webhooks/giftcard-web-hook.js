const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4 } = require('uuid');
const Wallet = require('../models/wallet');
const TransactionHistoryWallet = require('../models/transactionHistoryWallet');
const BillsTransactionTracker = require('../models/billsTransactionTracker');
const { sendOTPEmail } = require('../mail template/authentication-mail.js');
const { sendReceiptEmail } = require('../mail template/bills-mail.js');
require('dotenv').config();

// Webhook secret from Reloadly dashboard - this should be the webhook secret, not the API client secret
const webhookSecret = process.env.RELOADLY_API_CLIENT_SECRET;

// Store processed transaction IDs to ensure idempotency
const processedTransactions = new Set();

// Process the webhook data asynchronously
async function processWebhookData(event) {
    try {
        // Check if we've already processed this transaction
        if (processedTransactions.has(event.data.transactionId)) {
            console.log('Transaction already processed:', event.data.transactionId);
            return;
        }

        // Add to processed transactions set
        processedTransactions.add(event.data.transactionId);

        // Handle different event types
        switch (event.type) {
            case 'giftcard_transaction.status':
                // First check if there's a corresponding bills transaction
                const billsTransaction = await BillsTransactionTracker.findOne({
                    isConfirmed: false
                });

                if (!billsTransaction) {
                    console.log('No matching unconfirmed bills transaction found');
                    return;
                }

                switch (event.data.status) {
                    case 'PENDING':
                        await handlePendingOrder({
                            userId: billsTransaction.userId,
                            amount: billsTransaction.amount,
                            email: event.data.recipientEmail,
                            orderInfo: {
                                transactionId: event.data.transactionId,
                                productName: event.data.product.productName,
                                quantity: event.data.product.quantity,
                                unitPrice: event.data.product.unitPrice,
                                totalPrice: event.data.product.totalPrice,
                                currencyCode: event.data.currencyCode,
                                recipientPhone: event.data.recipientPhone,
                                recipientEmail: event.data.recipientEmail
                            }
                        });
                        break;

                    case 'SUCCESSFUL':
                        // Mark the bills transaction as confirmed
                        billsTransaction.isConfirmed = true;
                        await billsTransaction.save();

                        await handleSuccessfulOrder({
                            userId: billsTransaction.userId,
                            amount: billsTransaction.amount,
                            email: event.data.recipientEmail,
                            orderInfo: {
                                transactionId: event.data.transactionId,
                                productName: event.data.product.productName,
                                quantity: event.data.product.quantity,
                                unitPrice: event.data.product.unitPrice,
                                totalPrice: event.data.product.totalPrice,
                                currencyCode: event.data.currencyCode,
                                recipientPhone: event.data.recipientPhone,
                                recipientEmail: event.data.recipientEmail,
                                balanceInfo: event.data.balanceInfo
                            }
                        });
                        break;

                    case 'FAILED':
                        // Delete the bills transaction since it failed
                        await BillsTransactionTracker.findByIdAndDelete(billsTransaction._id);

                        await handleFailedOrder({
                            userId: billsTransaction.userId,
                            amount: billsTransaction.amount,
                            email: event.data.recipientEmail,
                            orderInfo: {
                                transactionId: event.data.transactionId,
                                productName: event.data.product.productName,
                                quantity: event.data.product.quantity,
                                unitPrice: event.data.product.unitPrice,
                                totalPrice: event.data.product.totalPrice,
                                currencyCode: event.data.currencyCode
                            },
                            errorDetails: event.data.errorMessage || 'Transaction failed'
                        });
                        break;

                    default:
                        console.log('Unhandled transaction status:', event.data.status);
                }
                break;

            default:
                console.log('Unhandled event type:', event.type);
        }
    } catch (error) {
        console.error('Error processing webhook data:', error);
        // Here we could add error handling like storing failed events for retry
    } finally {
        // Remove from processed set after some time (e.g., 1 hour)
        setTimeout(() => {
            processedTransactions.delete(event.data.transactionId);
        }, 3600000); // 1 hour
    }
}

exports.giftcardWebhook = async (req, res) => {
    try {
        console.log('Webhook called');
        console.log('Request headers:', req.headers);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const signature = req.headers['x-reloadly-signature'];
        const event = req.body;

        // Immediately acknowledge receipt
        res.status(200).json({ received: true });

        // Process the webhook data asynchronously
        processWebhookData(event).catch(error => {
            console.error('Error in async processing:', error);
        });
    } catch (error) {
        console.error('Error in webhook endpoint:', error);
        // Still return 200 to prevent retries, as we've already received the data
        res.status(200).json({ received: true });
    }
}

// Handler for pending order
async function handlePendingOrder(data) {
    try {
        const { userId, amount, email, orderInfo } = data;
        
        console.log('pending order', data)
        // Create transaction history for pending order
        const transaction = new TransactionHistoryWallet({
            userId,
            transactionType: 'Bills',
            amount: amount.toString(),
            status: 'pending',
            details: `Gift card purchase is being processed for amount ${amount}`,
            txId: orderInfo.transactionId || v4(),
            rId: v4(),
            name: 'Giftcard Purchase',
            username: orderInfo.recipientName || 'Not specified',
            provider: 'Reloadly',
            receipt: data
        });

        await transaction.save();

        // Send pending notification email
        await sendOTPEmail(email, 'Gift Card Purchase', {
            ...data,
            amount,
            transactionType: 'Gift Card Purchase',
            status: 'Pending',
            orderDetails: orderInfo,
            message: 'Your gift card purchase is being processed. You will receive another email once the transaction is complete.'
        });

    } catch (error) {
        console.error('Error in handlePendingOrder:', error);
        throw error;
    }
}

// Handler for pending redemption
async function handlePendingRedeem(data) {
    try {
        const { userId, amount, email, redemptionInfo } = data;

        // Create transaction record for pending redemption
        const transaction = new TransactionHistoryWallet({
            userId,
            transactionType: 'Bills',
            amount: amount.toString(),
            status: 'pending',
            details: `Gift card redemption is being processed for amount ${amount}`,
            txId: redemptionInfo.transactionId || v4(),
            rId: v4(),
            name: 'Gift Card Redemption',
            username: redemptionInfo.recipientName || 'Not specified',
            provider: 'Reloadly',
            receipt: data
        });

        await transaction.save();

        // Send pending redemption email
        await sendOTPEmail(email, 'Gift Card Redemption', {
            ...data,
            amount,
            transactionType: 'Gift Card Redemption',
            status: 'Pending',
            redemptionDetails: redemptionInfo,
            message: 'Your gift card redemption is being processed. You will receive another email once the redemption is complete.'
        });

    } catch (error) {
        console.error('Error in handlePendingRedeem:', error);
        throw error;
    }
}

// Handler functions for different events
async function handleSuccessfulOrder(data) {
    try {
        const { userId, amount, email, orderInfo } = data;
        
        // Deduct from user's wallet
        const userWallet = await Wallet.findOne({ userId });
        if (!userWallet) {
            throw new Error('User wallet not found');
        }

        console.log('successful order', data);
        
        // Update wallet balance
        await Wallet.findByIdAndUpdate(
            userWallet._id,
            {
                $set: {
                    balance: userWallet.balance - parseFloat(amount)
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        // Update existing pending transaction or create new one
        const existingTransaction = await TransactionHistoryWallet.findOne({
            userId,
            txId: orderInfo.transactionId,
            status: 'pending'
        });

        const transactionDetails = {
            userId,
            transactionType: 'Bills',
            amount: amount.toString(),
            status: 'success',
            details: `Successfully purchased ${orderInfo.quantity}x ${orderInfo.productName} gift card(s) worth ${amount} ${orderInfo.currencyCode}`,
            txId: orderInfo.transactionId,
            rId: v4(),
            name: 'Giftcard Subscription Successful',
            username: orderInfo.recipientEmail,
            provider: 'Reloadly',
            receipt: {
                ...orderInfo,
                transactionDate: new Date(),
                fees: {
                    discount: data.discount,
                    fee: data.fee,
                    smsFee: data.smsFee,
                    totalFee: data.totalFee
                }
            }
        };

        if (existingTransaction) {
            Object.assign(existingTransaction, transactionDetails);
            await existingTransaction.save();
        } else {
            const transaction = new TransactionHistoryWallet(transactionDetails);
            await transaction.save();
        }

        // Send success email notification with more details
        // await sendReceiptEmail(email, 'Gift Card Purchase', {
        //     transactionType: 'Gift Card Purchase',
        //     status: 'Successful',
        //     amount: `${amount} NGN`,
        //     productName: orderInfo.productName,
        //     quantity: orderInfo.quantity,
        //     unitPrice: `${orderInfo.unitPrice} ${orderInfo.currencyCode}`,
        //     totalPrice: `${orderInfo.totalPrice} ${orderInfo.currencyCode}`,
        //     recipientEmail: orderInfo.recipientEmail,
        //     recipientPhone: orderInfo.recipientPhone,
        //     transactionId: orderInfo.transactionId,
        //     balanceInfo: orderInfo.balanceInfo
        // });


        sendReceiptEmail(email, {
            type: 'Giftcard Subscription Successful',
            details: {
                status:'successful',
           amount: `${amount} NGN`,
            productName: orderInfo.productName,
            quantity: orderInfo.quantity,
            unitPrice: `${orderInfo.unitPrice} ${orderInfo.currencyCode}`,
            totalPrice: `${orderInfo.totalPrice} ${orderInfo.currencyCode}`,
            recipientEmail: orderInfo.recipientEmail,
            recipientPhone: orderInfo.recipientPhone,
            transactionId: orderInfo.transactionId,
            // balanceInfo: orderInfo.balanceInfo,
            
            }
          });

    } catch (error) {
        console.error('Error in handleSuccessfulOrder:', error);
        throw error;
    }
}

async function handleFailedOrder(data) {
    try {
        const { userId, amount, email, orderInfo, errorDetails } = data;

        // Update existing pending transaction or create new one
        const existingTransaction = await TransactionHistoryWallet.findOne({
            userId,
            txId: orderInfo.transactionId,
            status: 'pending'
        });

        if (existingTransaction) {
            existingTransaction.status = 'failed';
            existingTransaction.details = `Gift card order failed: ${errorDetails || 'Unknown error'}`;
            existingTransaction.receipt = data;
            await existingTransaction.save();
        } else {
            // Create new failed transaction record if no pending transaction exists
            const transaction = new TransactionHistoryWallet({
                userId,
                transactionType: 'Bills',
                amount: amount.toString(),
                status: 'failed',
                details: `Gift card order failed: ${errorDetails || 'Unknown error'}`,
                txId: orderInfo.transactionId || v4(),
                rId: v4(),
                name: 'Gift Card Purchase',
                username: orderInfo.recipientName || 'Not specified',
                provider: 'Reloadly',
                receipt: data
            });
            await transaction.save();
        }

        // Send failure notification email for transaction failed
        sendReceiptEmail(email, {
            type: 'Giftcard Subscription Failed',
            details: {
                amount: `${amount} NGN`,
                productName: orderInfo.productName,
                quantity: orderInfo.quantity,
                unitPrice: `${orderInfo.unitPrice} ${orderInfo.currencyCode}`,
                totalPrice: `${orderInfo.totalPrice} ${orderInfo.currencyCode}`,
                recipientEmail: orderInfo.recipientEmail,
                recipientPhone: orderInfo.recipientPhone,
                transactionId: orderInfo.transactionId,
                status: 'Failed',
                errorDetails: errorDetails || 'Transaction failed'
            }
        });
    } catch (error) {
        console.error('Error in handleFailedOrder:', error);
        throw error;
    }
}

async function handleSuccessfulRedeem(data) {
    try {
        const { userId, amount, email, redemptionInfo } = data;

        // Update existing pending transaction or create new one
        const existingTransaction = await TransactionHistoryWallet.findOne({
            userId,
            txId: redemptionInfo.transactionId,
            status: 'pending'
        });

        if (existingTransaction) {
            existingTransaction.status = 'success';
            existingTransaction.details = `Successfully redeemed gift card worth ${amount}`;
            existingTransaction.receipt = data;
            await existingTransaction.save();
        } else {
            // Create new transaction if no pending transaction exists
            const transaction = new TransactionHistoryWallet({
                userId,
                transactionType: 'Bills',
                amount: amount.toString(),
                status: 'success',
                details: `Successfully redeemed gift card worth ${amount}`,
                txId: redemptionInfo.transactionId || v4(),
                rId: v4(),
                name: 'Gift Card Redemption',
                username: redemptionInfo.recipientName || 'Not specified',
                provider: 'Reloadly',
                receipt: data
            });
            await transaction.save();
        }

        // Send redemption success email
        await sendOTPEmail(email, 'Gift Card Redemption', {
            ...data,
            amount,
            transactionType: 'Gift Card Redemption',
            status: 'Successful',
            redemptionDetails: redemptionInfo
        });

    } catch (error) {
        console.error('Error in handleSuccessfulRedeem:', error);
        throw error;
    }
}

async function handleFailedRedeem(data) {
    try {
        const { userId, amount, email, redemptionInfo, errorDetails } = data;

        // Update existing pending transaction or create new one
        const existingTransaction = await TransactionHistoryWallet.findOne({
            userId,
            txId: redemptionInfo.transactionId,
            status: 'pending'
        });

        if (existingTransaction) {
            existingTransaction.status = 'failed';
            existingTransaction.details = `Gift card redemption failed: ${errorDetails || 'Unknown error'}`;
            existingTransaction.receipt = data;
            await existingTransaction.save();
        } else {
            // Create new transaction record if no pending transaction exists
            const transaction = new TransactionHistoryWallet({
                userId,
                transactionType: 'giftcard_redeem',
                amount: amount.toString(),
                status: 'failed',
                details: `Gift card redemption failed: ${errorDetails || 'Unknown error'}`,
                txId: redemptionInfo.transactionId || v4(),
                rId: v4(),
                name: 'Gift Card Redemption',
                username: redemptionInfo.recipientName || 'Not specified',
                provider: 'Reloadly',
                receipt: data
            });
            await transaction.save();
        }

        // Send redemption failure email
    await sendOTPEmail(email, 'Gift Card Redemption', {
            ...data,
            amount,
            transactionType: 'Gift Card Redemption',
            status: 'Failed',
            errorDetails,
            redemptionDetails: redemptionInfo
        });

    } catch (error) {
        console.error('Error in handleFailedRedeem:', error);
        throw error;
    }
}