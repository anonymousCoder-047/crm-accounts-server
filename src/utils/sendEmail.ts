import nodemailer from 'nodemailer'
import {
  getPasswordResetTemplate,
  getWelcomeEmailTemplate,
  getPasswordChangedTemplate,
} from './emailTemplates'

const createTransporter = () => {
  // For development, use Gmail or configure with your SMTP settings
  // In production, use environment variables for SMTP configuration
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

/**
 * Get logo URL for emails
 * Supports both absolute URLs and relative paths
 */
const getLogoUrl = (): string | undefined => {
  const logoUrl = process.env.EMAIL_LOGO_URL
  if (logoUrl) {
    return logoUrl
  }
  
  // Try to use logo from public directory if available
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  return `${frontendUrl}/logo.png`
}

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  userName?: string
) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
  const logoUrl = getLogoUrl()

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Reset Your Password',
    html: getPasswordResetTemplate(resetUrl, userName, logoUrl),
  }

  try {
    const transporter = createTransporter()
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending password reset email:', error)
    throw new Error('Email could not be sent')
  }
}

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (
  email: string,
  userName: string
) => {
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
  const logoUrl = getLogoUrl()

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `Welcome to ${process.env.COMPANY_NAME || 'CRM Accounts'}!`,
    html: getWelcomeEmailTemplate(userName, loginUrl, logoUrl),
  }

  try {
    const transporter = createTransporter()
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending welcome email:', error)
    throw new Error('Email could not be sent')
  }
}

/**
 * Send password changed confirmation email
 */
export const sendPasswordChangedEmail = async (
  email: string,
  userName?: string
) => {
  const logoUrl = getLogoUrl()

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Your Password Has Been Changed',
    html: getPasswordChangedTemplate(userName, logoUrl),
  }

  try {
    const transporter = createTransporter()
    await transporter.sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending password changed email:', error)
    throw new Error('Email could not be sent')
  }
}

