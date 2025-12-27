/**
 * Backend Email Service API
 * Express.js server that handles email sending via nodemailer
 * This separates email functionality from the frontend React app
 */

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8090;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SMTP transporter
let transporter = null;

function initializeTransporter() {
  try {
    const smtpConfig = {
      host: 'sandbox.smtp.mailtrap.io',
      port: 2525,
      secure: false, // true for port 465, false for other ports like 587 
      auth: {
        user: "92e55b01bc6dbb",
        pass: "713e83e2505302"
      }
    };

    // Validate required environment variables
    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      throw new Error('SMTP credentials not found in environment variables');
    }

    transporter = nodemailer.createTransport(smtpConfig);
    
    // Verify connection configuration
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ SMTP connection error:', error);
      } else {
        console.log('✅ SMTP server is ready to take our messages');
      }
    });

  } catch (error) {
    console.error('❌ Failed to initialize email transporter:', error);
    throw error;
  }
}

// Initialize transporter on startup
initializeTransporter();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Email service status endpoint
app.get('/api/email-status', (req, res) => {
  if (!transporter) {
    return res.status(503).json({ 
      status: 'unavailable', 
      error: 'Email transporter not initialized' 
    });
  }
  
  res.json({ 
    status: 'available', 
    timestamp: new Date().toISOString() 
  });
});

// Send email endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    if (!transporter) {
      return res.status(503).json({ 
        error: 'Email service unavailable - transporter not initialized' 
      });
    }

    const { from, to, subject, html, text } = req.body;

    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, and html are required' 
      });
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Invalid email address format' 
      });
    }

    const mailOptions = {
      from: from || `"${process.env.VITE_EMAIL_FROM_NAME || 'Expense Manager Pro'}" <${process.env.VITE_EMAIL_FROM_ADDRESS || 'noreply@expensemanagerpro.com'}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || null
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully:', result.messageId);
    
    res.json({
      success: true,
      messageId: result.messageId,
      response: result.response
    });

  } catch (error) {
    console.error('❌ Error sending email:', error);
    
    res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
      code: error.code || 'EMAIL_SEND_ERROR'
    });
  }
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({ 
        error: 'testEmail is required' 
      });
    }

    const emailData = {
      to: testEmail,
      subject: 'Test Email - Expense Manager Pro Backend Service',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .success { background: #D1FAE5; border: 1px solid #10B981; padding: 15px; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">
              <h2>✅ Backend Email Service Test Successful!</h2>
              <p>This is a test email to verify that your backend email service is working correctly.</p>
              <p><strong>Service Details:</strong></p>
              <ul>
                <li>Backend API: Active</li>
                <li>SMTP Host: ${process.env.VITE_SMTP_HOST}</li>
                <li>SMTP Port: ${process.env.VITE_SMTP_PORT}</li>
                <li>From Name: ${process.env.VITE_EMAIL_FROM_NAME}</li>
                <li>From Address: ${process.env.VITE_EMAIL_FROM_ADDRESS}</li>
              </ul>
              <p>Timestamp: ${new Date().toISOString()}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Use the send-email endpoint internally
    const response = await fetch(`http://localhost:${PORT}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send test email');
    }

    const result = await response.json();
    res.json(result);

  } catch (error) {
    console.error('❌ Error sending test email:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Email service backend running on port ${PORT}`);
  console.log(`📧 Email API available at http://localhost:${PORT}/api/send-email`);
  console.log(`🔍 Health check at http://localhost:${PORT}/api/health`);
});

module.exports = app;