// You need the Notify SDK installed: npm install notifycx
import { Notify } from "notifycx";

const notify = new Notify(process.env.NOTIFY_KEY);

export async function sendEmail(
  email: string,
  hashedtoken: string,
  forgotPass: boolean
) {
  const link = forgotPass
    ? `${process.env.CLIENT_URL}/auth/${hashedtoken}`
    : `${process.env.CLIENT_URL}/auth/${hashedtoken}`;

  const message = forgotPass
    ? `
   <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    /* Reset styles */
    body, html {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
    }

    /* Container */
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    /* Header */
    .header {
      background-color: #007bff;
      color: #ffffff;
      text-align: center;
      padding: 20px;
    }

    .header h1 {
      margin: 0;
      font-size: 24px;
    }

    /* Content */
    .content {
      padding: 20px;
      color: #333333;
      line-height: 1.6;
    }

    .content p {
      margin: 0 0 20px;
    }

    /* Button */
    .button {
      display: inline-block;
      background-color: #007bff;
      color: #ffffff;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 16px;
    }

    .button:hover {
      background-color: #0056b3;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 12px;
      color: #777777;
      background-color: #f9f9f9;
    }

    .footer a {
      color: #007bff;
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>

    <!-- Content -->
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset your password. If you did not make this request, you can safely ignore this email.</p>
      <p>To reset your password, click the button below:</p>
      <p style="text-align: center;">
        <a href="${link}" class="button">Reset Password</a>
      </p>
      <p>This link will expire in 24 hours for security reasons.</p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>If you’re having trouble with the button above, copy and paste the link below into your browser:</p>
      <p><a href="${link}">${link}</a></p>
      <p>&copy; 2023 Your Company. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
   `
    : `
            <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification</title>
  <style>
    /* Reset styles */
    body, html {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
    }

    /* Container */
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    /* Header */
    .header {
      background-color: #007bff;
      color: #ffffff;
      text-align: center;
      padding: 20px;
    }

    .header h1 {
      margin: 0;
      font-size: 24px;
    }

    /* Content */
    .content {
      padding: 20px;
      color: #333333;
      line-height: 1.6;
    }

    .content p {
      margin: 0 0 20px;
    }

    /* Button */
    .button {
      display: inline-block;
      background-color: #007bff;
      color: #ffffff;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 16px;
    }

    .button:hover {
      background-color: #0056b3;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 12px;
      color: #777777;
      background-color: #f9f9f9;
    }

    .footer a {
      color: #007bff;
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <h1>Verify Your Email Address</h1>
    </div>

    <!-- Content -->
    <div class="content">
      <p>Hello,</p>
      <p>Thank you for signing up to Chesser! To complete your registration, please verify your email address by clicking the button below:</p>
      <p style="text-align: center;">
        <a href="${link}" class="button">Verify Email</a>
      </p>
      <p>If you did not create an account, you can safely ignore this email.</p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>If you’re having trouble with the button above, copy and paste the link below into your browser:</p>
      <p><a href="${link}">${link}</a></p>
      <p>&copy; 2025 Chesser. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
            
            `;

  const response = await notify.sendEmail({
    to: email,
    subject: forgotPass ? "Password Reset" : "Verify your email",
    name: "Chesser",
    message,
  });
  return response;
}
