const express = require('express');
const Wallet = require('../models/wallet');
const TransactionHistoryWallet = require('../models/transactionHistoryWallet');
const { v4 } = require('uuid');
const { sendReceiptEmail } = require('../mail template/bills-mail');

const router = express.Router();


async function vtuAfricaWebhook (req, res) {
    try {
        const {     
            event,
            data: {
                status,
                reference,
                amount,
                network,
                phone,
                message
            }
        } = req.body;

        // Log the incoming webhook for debugging
        console.log('Received VTU Africa webhook:', {
            event,
            status,
            reference,
            amount
        });

        // Find the transaction using the reference
        const transaction = await TransactionHistoryWallet.findOne({ txId: reference });
        
        if (!transaction) {
            console.log('Transaction not found for reference:', reference);
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // If transaction is already completed, prevent double processing
        if (transaction.status === 'completed') {
            return res.status(200).json({ message: 'Transaction already processed' });
        }

        switch (event) {
            case 'airtime2cash.success':
                // Find user's wallet
                const userWallet = await Wallet.findOne({ userId: transaction.userId });
                
                if (!userWallet) {
                    console.log('Wallet not found for user:', transaction.userId);
                    return res.status(404).json({ message: 'Wallet not found' });
                }

                // Credit the user's wallet
                userWallet.balance += parseFloat(amount);
                await userWallet.save();

                // Update transaction status
                transaction.status = 'completed';
                transaction.details = `Successfully converted ${amount} naira airtime from ${network} number ${phone}`;
                await transaction.save();

                // Send email notification
                sendReceiptEmail(transaction.receipt.sender, {
                    type: 'Airtime to Cash Conversion',
                    details: {
                        amount,
                        network,
                        phone,
                        status: 'success',
                        reference
                    }
                });
                break;

            case 'airtime2cash.failed':
                // Update transaction as failed
                transaction.status = 'failed';
                transaction.details = message || 'Airtime to cash conversion failed';
                await transaction.save();

                // Send failure notification
                sendReceiptEmail(transaction.receipt.sender, {
                    type: 'Airtime to Cash Conversion',
                    details: {
                        amount,
                        network,
                        phone,
                        status: 'failed',
                        reference,
                        message
                    }
                });
                break;

            case 'airtime2cash.pending':
                // Update transaction as pending
                transaction.status = 'pending';
                transaction.details = 'Airtime to cash conversion is being processed';
                await transaction.save();
                break;

            default:
                console.log('Unhandled event type:', event);
                return res.status(400).json({ message: 'Unhandled event type' });
        }

        return res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

module.exports = vtuAfricaWebhook;
