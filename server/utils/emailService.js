const nodemailer = require('nodemailer');
const fs = require('fs');

async function sendInvoiceEmail({ to, invoiceNumber, vendorName, total, pdfPath }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const attachments = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({
      filename: `${invoiceNumber}.pdf`,
      path: pdfPath
    });
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'VendorBridge <noreply@vendorbridge.com>',
    to,
    subject: `Invoice ${invoiceNumber} from VendorBridge`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Invoice from VendorBridge</h2>
        <p>Dear ${vendorName},</p>
        <p>Please find attached invoice <strong>${invoiceNumber}</strong> for the amount of <strong>₹${Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>.</p>
        <p>Invoice details:</p>
        <ul>
          <li><strong>Invoice Number:</strong> ${invoiceNumber}</li>
          <li><strong>Amount:</strong> ₹${Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</li>
        </ul>
        <p>Please process the payment at your earliest convenience.</p>
        <br/>
        <p>Best regards,<br/><strong>VendorBridge Team</strong></p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;"/>
        <p style="color: #999; font-size: 12px;">This is an automated email from VendorBridge Procurement & Vendor Management ERP.</p>
      </div>
    `,
    attachments
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendInvoiceEmail };
