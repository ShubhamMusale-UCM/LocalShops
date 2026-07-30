import nodemailer from 'nodemailer';

// For MVP, use a simple transporter. In production, use SES or SendGrid.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 Email to ${options.to}: ${options.subject}`);
      return true;
    }

    if (!process.env.SMTP_USER) {
      console.warn('⚠️  Email credentials not configured');
      return false;
    }

    await transporter.sendMail({
      from: `"CityLocalShop" <${process.env.SMTP_USER}>`,
      ...options,
    });

    return true;
  } catch (error: any) {
    console.error('Email send error:', error.message);
    return false;
  }
};

// Email templates
export const sendWelcomeEmail = async (email: string, name: string): Promise<boolean> => {
  return sendEmail({
    to: email,
    subject: 'Welcome to CityLocalShop! 🎉',
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FF6B35, #004E89); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">CityLocalShop</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Discover Local, Shop Smart</p>
        </div>
        <div style="padding: 30px; background: #fff;">
          <h2>Welcome, ${name}! 👋</h2>
          <p>We're excited to have you on board. Explore thousands of products from local shops near you.</p>
          <p>Start discovering amazing deals from your neighborhood!</p>
        </div>
      </div>
    `,
  });
};

export const sendOrderConfirmationEmail = async (
  email: string, orderNumber: string, total: number
): Promise<boolean> => {
  return sendEmail({
    to: email,
    subject: `Order Confirmed: ${orderNumber} ✅`,
    html: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2ECC71; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">Order Confirmed! ✅</h2>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Total:</strong> ₹${total.toFixed(2)}</p>
          <p>Track your order in the CityLocalShop app.</p>
        </div>
      </div>
    `,
  });
};
