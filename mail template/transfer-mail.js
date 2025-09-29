const nodemailer = require("nodemailer")

const dotenv = require('dotenv')

dotenv.config()

// Create the transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GOOGLE_APP_MAIL,
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
})

function generateTransferEmailTemplate(transferDetails, isSender = true) {
  const {
    amount,
    currency,
    senderName,
    recipientName,
    reference,
    date = new Date().toLocaleString(),
    newBalance,
    note,
  } = transferDetails

  const title = isSender ? "Transfer Confirmation" : "Money Received"
  const greeting = isSender
    ? `You have sent ${currency} ${amount} to ${recipientName}`
    : `You have received ${currency} ${amount} from ${senderName}`

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="font-family: 'Inter', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f7f7f7; color: #333333;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header -->
        <tr>
          <td style="padding: 32px 24px; background: linear-gradient(135deg, #e60000 0%, #cc0000 100%); text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${title}</h1>
          </td>
        </tr>
        
        <!-- Content -->
        <tr>
          <td style="padding: 40px 24px;">
            <p style="margin-bottom: 24px; color: #333333; font-size: 16px;">Dear Valued Customer,</p>
            
            <!-- Transaction Summary -->
            <div style="background-color: #f9f9f9; border-radius: 8px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #e60000;">
              <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #e60000;">${greeting}</p>
              <p style="margin: 0; color: #666666; font-size: 14px;">Transaction completed on ${date}</p>
            </div>
            
            <!-- Transaction Details Table -->
            <table cellpadding="12" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px; border-collapse: collapse; border-radius: 8px; overflow: hidden;">
              <tr style="background-color: #e60000; color: #FFFFFF;">
                <th style="text-align: left; padding: 12px 16px; font-weight: 600; font-size: 14px; border-top-left-radius: 8px;">Transaction Details</th>
                <th style="text-align: right; padding: 12px 16px; font-weight: 600; font-size: 14px; border-top-right-radius: 8px;">Value</th>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">Amount</td>
                <td style="text-align: right; border: 1px solid #eeeeee; padding: 12px 16px; font-weight: 600; font-size: 14px;">${currency} ${amount}</td>
              </tr>
              <tr style="background-color: #f9f9f9;">
                <td style="border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">${isSender ? "Recipient" : "Sender"}</td>
                <td style="text-align: right; border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">${isSender ? recipientName : senderName}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">Reference</td>
                <td style="text-align: right; border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">${reference}</td>
              </tr>
              <tr style="background-color: #f9f9f9;">
                <td style="border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">Date</td>
                <td style="text-align: right; border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">${date}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">New Balance</td>
                <td style="text-align: right; border: 1px solid #eeeeee; padding: 12px 16px; font-weight: 600; font-size: 14px;">${currency} ${newBalance}</td>
              </tr>
              ${
                note
                  ? `
              <tr style="background-color: #f9f9f9;">
                <td style="border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">Note</td>
                <td style="text-align: right; border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">${note}</td>
              </tr>
              `
                  : ""
              }
            </table>
            
            <!-- Security Notice -->
            <div style="background-color: #fff8f8; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #ffdddd;">
              <p style="margin: 0; color: #d30000; font-size: 14px;">If you did not authorize this transaction, please contact our support team immediately.</p>
            </div>
            
            <p style="margin-bottom: 8px; color: #333333; font-size: 16px;">Best regards,</p>
            <p style="margin-bottom: 0; color: #e60000; font-size: 16px; font-weight: 700;">The Zangapay Team</p>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="padding: 24px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #eeeeee;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666666;">&copy; ${new Date().getFullYear()} Zangapay. All rights reserved.</p>
            <p style="margin: 0; font-size: 13px; color: #666666;">For support, contact us at <a href="mailto:support@Zangapay.com" style="color: #e60000; text-decoration: none;">support@Zangapay.com</a></p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

async function sendTransferEmail(recipientEmail, transferDetails, isSender = true) {
  const htmlContent = generateTransferEmailTemplate(transferDetails, isSender)

  const mailOptions = {
    from: '"Zangapay" <noreply@Zangapay.com>',
    to: recipientEmail,
    subject: isSender ? "Transfer Confirmation" : "Money Received",
    html: htmlContent,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log("Email sent:", info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("Error sending email:", error)
    return { success: false, error: error.message }
  }
}

module.exports = {
  sendTransferEmail,
}

