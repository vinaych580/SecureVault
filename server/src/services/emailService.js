const nodemailer = require('nodemailer');
const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, CLIENT_URL } = require('../config/env');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn('Email not configured. Emails will be logged to console.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
    console.log(`[EMAIL MOCK] Body: ${html.substring(0, 200)}...`);
    return;
  }
  await transport.sendMail({
    from: `"SecureVault" <${EMAIL_USER}>`,
    to, subject, html,
  });
};

const sendVerificationEmail = async (email, token) => {
  const url = `${CLIENT_URL}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'SecureVault — Verify your email',
    html: `<h2>Welcome to SecureVault</h2><p>Click the link below to verify your email:</p><a href="${url}">${url}</a><p>This link expires in 24 hours.</p>`,
  });
};

const sendPasswordResetEmail = async (email, token) => {
  const url = `${CLIENT_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'SecureVault — Password Reset',
    html: `<h2>Password Reset</h2><p>Click the link below to reset your password:</p><a href="${url}">${url}</a><p>This link expires in 1 hour.</p>`,
  });
};

const sendLoginAlertEmail = async (email, device, ip) => {
  await sendEmail({
    to: email,
    subject: 'SecureVault — New Login Detected',
    html: `<h2>New Login Detected</h2><p>A new login was detected on your account:</p><p>Device: ${device}<br>IP: ${ip}<br>Time: ${new Date().toISOString()}</p><p>If this wasn't you, change your password immediately.</p>`,
  });
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendLoginAlertEmail };
