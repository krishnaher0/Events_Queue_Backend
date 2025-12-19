import nodemailer from 'nodemailer';

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendVerificationCode = async (email, code) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.FROM_EMAIL || 'EventQueue <noreply@eventqueue.com>',
    to: email,
    subject: 'Password Reset Verification Code - EventQueue',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 500px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">EventQueue</h1>
          </div>
          <div style="padding: 40px 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px;">Password Reset</h2>
            <p style="color: #64748b; margin: 0 0 32px 0; font-size: 16px; line-height: 1.6;">
              You requested to reset your password. Use the verification code below to proceed:
            </p>
            <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1e293b;">${code}</span>
            </div>
            <p style="color: #64748b; margin: 0 0 8px 0; font-size: 14px;">
              This code will expire in <strong>10 minutes</strong>.
            </p>
            <p style="color: #94a3b8; margin: 0; font-size: 14px;">
              If you didn't request this, please ignore this email.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              &copy; 2025 EventQueue. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

export const sendPasswordResetSuccess = async (email, fullName) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.FROM_EMAIL || 'EventQueue <noreply@eventqueue.com>',
    to: email,
    subject: 'Password Reset Successful - EventQueue',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 500px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">EventQueue</h1>
          </div>
          <div style="padding: 40px 32px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="width: 64px; height: 64px; background: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </div>
            <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 24px; text-align: center;">Password Reset Successful</h2>
            <p style="color: #64748b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; text-align: center;">
              Hi ${fullName}, your password has been successfully reset. You can now log in with your new password.
            </p>
            <a href="http://localhost:5173/login" style="display: block; background: #1e293b; color: white; text-decoration: none; padding: 14px 24px; border-radius: 8px; text-align: center; font-weight: 600;">
              Go to Login
            </a>
          </div>
          <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; margin: 0; font-size: 12px;">
              &copy; 2025 EventQueue. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};
