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

function generateOTPEmailTemplate(otp, purpose, userName) {
  const currentYear = new Date().getFullYear()

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Zangapay Verification Code</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="font-family: 'Inter', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f7f7f7; color: #333333;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header -->
        <tr>
          <td style="padding: 32px 24px; background: linear-gradient(135deg, #e60000 0%, #cc0000 100%); text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Verification Code</h1>
          </td>
        </tr>
        
        <!-- Content -->
        <tr>
          <td style="padding: 40px 24px;">
            <p style="margin-bottom: 24px; color: #333333; font-size: 16px;">Hello ${userName},</p>
            
            <p style="margin-bottom: 16px; color: #333333; font-size: 16px;">Your verification code for <strong>${purpose}</strong> is:</p>
            
            <!-- OTP Box -->
            <div style="background: linear-gradient(to right, #fff8f8, #fff0f0); border: 2px solid #e60000; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <h2 style="color: #e60000; font-size: 36px; margin: 0; letter-spacing: 8px; font-weight: 700;">${otp}</h2>
            </div>
            
            <!-- Security Notice -->
            <div style="background-color: #fff8f8; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #e60000;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #e60000; font-size: 14px;">Important Security Information</p>
              <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px;">
                <li>This code will expire in 10 minutes</li>
                <li>Never share this code with anyone</li>
                <li>Zangapay staff will never ask for this code</li>
              </ul>
            </div>
            
            <p style="margin-bottom: 24px; color: #666666; font-size: 14px;">If you didn't request this code, please ignore this email or contact our support team if you have concerns.</p>
            
            <p style="margin-bottom: 8px; color: #333333; font-size: 16px;">Best regards,</p>
            <p style="margin-bottom: 0; color: #e60000; font-size: 16px; font-weight: 700;">The Zangapay Team</p>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="padding: 24px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #eeeeee;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666666;">&copy; ${currentYear} Zangapay. All rights reserved.</p>
            <p style="margin: 0; font-size: 13px; color: #666666;">For support, contact us at <a href="mailto:support@Zangapay.com" style="color: #e60000; text-decoration: none;">support@Zangapay.com</a></p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

async function sendOTPEmail(recipientEmail, subject, otp, purpose, userName) {
  const htmlContent = generateOTPEmailTemplate(otp, purpose, userName)

  const mailOptions = {
    from: '"Zangapay Security" <noreply@Zangapay.com>',
    to: recipientEmail,
    subject: subject,
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
  sendOTPEmail,
}

