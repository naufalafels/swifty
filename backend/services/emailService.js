import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@vroomoo.my';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Vroomoo Car Rentals';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for 587
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Verify connection on startup (non-blocking)
transporter.verify().then(() => {
  console.log('✅ Email service ready');
}).catch((err) => {
  console.warn('⚠️  Email service not configured:', err.message);
});

// ──────────────────────────────────────────────
// Shared HTML wrapper
// ──────────────────────────────────────────────
function wrapHtml(title, bodyContent) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fb923c;font-size:28px;font-weight:800;letter-spacing:2px;">SWIFTY</h1>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;letter-spacing:3px;">CAR RENTALS</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                &copy; ${new Date().getFullYear()} Vroomoo Car Rentals. All rights reserved.
              </p>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:11px;">
                <a href="${FRONTEND_URL}" style="color:#fb923c;text-decoration:none;">Visit Vroomoo</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ──────────────────────────────────────────────
// 1. Welcome Email
// ──────────────────────────────────────────────
export async function sendWelcomeEmail(toEmail, userName) {
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;">Welcome to Vroomoo, ${userName}! 🎉</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;">
      We're thrilled to have you join the Vroomoo family. Your account is ready and you can start browsing our premium car fleet right away.
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.7;">Here's what you can do:</p>
    <ul style="color:#475569;font-size:14px;line-height:2;">
      <li>🚗 Browse and book cars instantly</li>
      <li>📋 Complete your KYC for faster bookings</li>
      <li>🏠 Become a host and list your own cars</li>
      <li>⭐ Leave reviews for your rental experience</li>
    </ul>
    <div style="text-align:center;margin:32px 0;">
      <a href="${FRONTEND_URL}/cars" style="display:inline-block;background:#fb923c;color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
        Browse Cars Now
      </a>
    </div>
    <p style="color:#94a3b8;font-size:13px;">
      If you have any questions, feel free to <a href="${FRONTEND_URL}/contact" style="color:#fb923c;">contact us</a>.
    </p>
  `;

  await transporter.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: toEmail,
    subject: 'Welcome to Vroomoo! 🚗',
    html: wrapHtml('Welcome to Vroomoo', body),
  });
}

// ──────────────────────────────────────────────
// 2. Email Verification
// ──────────────────────────────────────────────
export async function sendVerificationEmail(toEmail, userName, verifyUrl) {
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;">Verify Your Email</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;">
      Hi ${userName}, please verify your email address to secure your Vroomoo account and unlock all features.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verifyUrl}" style="display:inline-block;background:#fb923c;color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
        Verify Email Address
      </a>
    </div>
    <p style="color:#94a3b8;font-size:13px;">
      This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
    </p>
    <p style="color:#cbd5e1;font-size:11px;margin-top:24px;word-break:break-all;">
      Or copy this link: ${verifyUrl}
    </p>
  `;

  await transporter.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: toEmail,
    subject: 'Verify your Vroomoo email ✉️',
    html: wrapHtml('Verify Email', body),
  });
}

// ──────────────────────────────────────────────
// 3. Booking Confirmation with Invoice/Receipt
// ──────────────────────────────────────────────
export async function sendBookingConfirmation(toEmail, booking) {
  const {
    _id,
    customer,
    car,
    pickupDate,
    returnDate,
    amount,
    currency = 'MYR',
    paymentStatus,
    createdAt,
  } = booking;

  const carName = car?.make ? `${car.make} ${car.model || ''}`.trim() : 'Your Rental Car';
  const formattedAmount = Number(amount || 0).toLocaleString('en-MY', {
    style: 'currency',
    currency: currency || 'MYR',
    maximumFractionDigits: 0,
  });

  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;">Booking Confirmed! ✅</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;">
      Hi ${customer || 'there'}, your booking has been confirmed and payment received. Here's your receipt:
    </p>

    <!-- Invoice Card -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Invoice</td>
          <td style="color:#94a3b8;font-size:12px;text-align:right;padding-bottom:4px;">Date</td>
        </tr>
        <tr>
          <td style="color:#1e293b;font-size:14px;font-weight:600;padding-bottom:16px;">#${String(_id).slice(-8).toUpperCase()}</td>
          <td style="color:#1e293b;font-size:14px;text-align:right;padding-bottom:16px;">${new Date(createdAt || Date.now()).toLocaleDateString('en-MY')}</td>
        </tr>
        <tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding-top:16px;"></td></tr>
        <tr>
          <td style="color:#475569;font-size:14px;padding:4px 0;">Car</td>
          <td style="color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${carName}</td>
        </tr>
        <tr>
          <td style="color:#475569;font-size:14px;padding:4px 0;">Pickup</td>
          <td style="color:#1e293b;font-size:14px;text-align:right;">${pickupDate || '—'}</td>
        </tr>
        <tr>
          <td style="color:#475569;font-size:14px;padding:4px 0;">Return</td>
          <td style="color:#1e293b;font-size:14px;text-align:right;">${returnDate || '—'}</td>
        </tr>
        <tr>
          <td style="color:#475569;font-size:14px;padding:4px 0;">Payment Status</td>
          <td style="color:#16a34a;font-size:14px;font-weight:700;text-align:right;">${(paymentStatus || 'paid').toUpperCase()}</td>
        </tr>
        <tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding-top:12px;"></td></tr>
        <tr>
          <td style="color:#1e293b;font-size:16px;font-weight:800;padding-top:4px;">Total</td>
          <td style="color:#fb923c;font-size:18px;font-weight:800;text-align:right;padding-top:4px;">${formattedAmount}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="${FRONTEND_URL}/bookings" style="display:inline-block;background:#fb923c;color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
        View My Bookings
      </a>
    </div>

    <p style="color:#94a3b8;font-size:13px;">
      Please bring a valid driving license (domestic or international) for pickup. Questions? <a href="${FRONTEND_URL}/contact" style="color:#fb923c;">Contact us</a>.
    </p>
  `;

  await transporter.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: toEmail,
    subject: `Booking Confirmed — ${carName} 🚗`,
    html: wrapHtml('Booking Confirmation', body),
  });
}

// ──────────────────────────────────────────────
// 4. Marketing Email
// ──────────────────────────────────────────────
export async function sendMarketingEmail(toEmail, subject, htmlContent) {
  const body = `
    ${htmlContent}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
    <p style="color:#94a3b8;font-size:11px;text-align:center;">
      You received this because you signed up at Vroomoo. 
      <a href="${FRONTEND_URL}/profile/privacy" style="color:#fb923c;">Manage preferences</a>
    </p>
  `;

  await transporter.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: toEmail,
    subject,
    html: wrapHtml(subject, body),
  });
}

// ──────────────────────────────────────────────
// 5. Host Approval Email
// ──────────────────────────────────────────────
export async function sendHostApprovalEmail(toEmail, userName) {
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;">You're Approved as a Host! 🎊</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;">
      Congratulations ${userName}! Your host application has been approved. You can now list your cars on Vroomoo and start earning.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${FRONTEND_URL}/host/dashboard" style="display:inline-block;background:#fb923c;color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
        Go to Host Dashboard
      </a>
    </div>
  `;

  await transporter.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: toEmail,
    subject: 'Host Application Approved! 🎉',
    html: wrapHtml('Host Approved', body),
  });
}

// ──────────────────────────────────────────────
// 6. Host Rejection Email
// ──────────────────────────────────────────────
export async function sendHostRejectionEmail(toEmail, userName, reason) {
  const body = `
    <h2 style="color:#1e293b;margin:0 0 16px;">Host Application Update</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;">
      Hi ${userName}, unfortunately your host application was not approved at this time.
    </p>
    ${reason ? `<p style="color:#475569;font-size:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;"><strong>Reason:</strong> ${reason}</p>` : ''}
    <p style="color:#475569;font-size:15px;line-height:1.7;">
      You can re-apply after addressing the feedback. If you have questions, please contact our support team.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${FRONTEND_URL}/contact" style="display:inline-block;background:#64748b;color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
        Contact Support
      </a>
    </div>
  `;

  await transporter.sendMail({
    from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
    to: toEmail,
    subject: 'Host Application Update — Vroomoo',
    html: wrapHtml('Host Application', body),
  });
}

export default transporter;