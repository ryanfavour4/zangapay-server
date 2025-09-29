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


function flattenObject(obj, parentKey = '', result = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = parentKey ? `${parentKey}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, newKey, result);
    } else if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          flattenObject(item, `${newKey}[${idx}]`, result);
        } else {
          result[`${newKey}[${idx}]`] = item;
        }
      });
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

function generateDynamicTable(data) {
  if (!data || typeof data !== 'object') return '';
  // If the data has a 'details' key, use that, else use the data itself
  const base = data.details && typeof data.details === 'object' ? data.details : data;
  const flat = flattenObject(base);

  let tableHtml = `
    <table cellpadding="12" cellspacing="0" border="0" width="100%" style="margin-bottom: 24px; border-collapse: collapse; border-radius: 8px; overflow: hidden;">
      <tr style="background-color: #e60000; color: #FFFFFF;">
        <th style="text-align: left; padding: 12px 16px; font-weight: 600; font-size: 14px; border-top-left-radius: 8px;">Field</th>
        <th style="text-align: right; padding: 12px 16px; font-weight: 600; font-size: 14px; border-top-right-radius: 8px;">Value</th>
      </tr>
  `;
  let isAlternate = false;
  for (const [key, value] of Object.entries(flat)) {
    if (value === null || value === undefined) continue;
    const bgColor = isAlternate ? "#f9f9f9" : "#ffffff";
    tableHtml += `
      <tr style="background-color: ${bgColor};">
        <td style="border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">${key}</td>
        <td style="text-align: right; border: 1px solid #eeeeee; padding: 12px 16px; font-size: 14px;">${typeof value === 'object' ? JSON.stringify(value) : value}</td>
      </tr>
    `;
    isAlternate = !isAlternate;
  }
  tableHtml += `</table>`;
  return tableHtml;
}

function generateEmailTemplate(receiptDetails) {
  const dynamicTable = generateDynamicTable(receiptDetails);
  const currentYear = new Date().getFullYear();
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Transaction Receipt</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="font-family: 'Inter', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f7f7f7; color: #333333;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header -->
        <tr>
          <td style="padding: 32px 24px; background: linear-gradient(135deg, #e60000 0%, #cc0000 100%); text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Transaction Receipt</h1>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding: 40px 24px;">
            <p style="margin-bottom: 24px; color: #333333; font-size: 16px;">Dear Valued Customer,</p>
            <div style="background-color: #f9f9f9; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #666666;">Receipt Date</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #333333;">${currentDate}</p>
            </div>
            <p style="margin-bottom: 16px; color: #333333; font-size: 16px; font-weight: 600;">Transaction Details</p>
            ${dynamicTable}
            <div style="background: linear-gradient(to right, #fff8f8, #fff0f0); border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
              <p style="margin: 0; color: #e60000; font-size: 16px; font-weight: 500;">Thank you for choosing Zangapay for your financial needs!</p>
            </div>
            <p style="margin-bottom: 24px; color: #666666; font-size: 14px;">If you have any questions about this transaction, please don't hesitate to contact our support team.</p>
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
  `;
}

async function sendReceiptEmail(recipientEmail, receiptDetails) {
  const htmlContent = generateEmailTemplate(receiptDetails)

  const mailOptions = {
    from: '"Zangapay" <noreply@Zangapay.com>',
    to: recipientEmail,
    subject: "Transaction Receipt",
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
  sendReceiptEmail,
}

