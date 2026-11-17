/**
 * Email Template Utilities
 * Modern, responsive email templates with brand theming
 */

// Brand colors - customize these to match your brand
const BRAND_COLORS = {
  primary: '#10b981', // Green
  primaryDark: '#059669',
  secondary: '#E21C1C', // Red
  accent: '#cccccc', // Light gray
  text: '#1f2937',
  textLight: '#6b7280',
  background: '#ffffff',
  border: '#e5e7eb',
  success: '#10b981',
  error: '#E21C1C',
}

/**
 * Email Logo SVG (inline for better email client support)
 */
const getEmailLogoSVG = (): string => {
  return `
    <svg width="200" height="100" viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg" style="display: block; margin: 0 auto;">
      <!-- Arabic text (top) -->
      <text x="250" y="120" font-family="Noto Sans Arabic, Arial, sans-serif" font-size="100" font-weight="800" text-anchor="middle" fill="#d4af37">حساب</text>
      <!-- Divider line -->
      <line x1="50" y1="150" x2="450" y2="150" stroke="#cccccc" stroke-width="2"/>
      <!-- English text (bottom) with green -->
      <text x="250" y="240" font-family="Noto Sans Arabic, Arial, sans-serif" font-size="100" font-weight="800" text-anchor="middle" fill="#10b981">Hisab</text>
    </svg>
  `
}

/**
 * Email Header Component
 * Includes logo and brand name
 */
export const getEmailHeader = (logoUrl?: string): string => {
  const companyName = process.env.COMPANY_NAME || 'CRM Accounts'

  return `
    <tr>
      <td style="padding: 40px 20px 30px; text-align: center; background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%);">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="text-align: center;">
              ${getEmailLogoSVG()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
}

/**
 * Email Footer Component
 * Includes company info, social links, and unsubscribe
 */
export const getEmailFooter = (): string => {
  const companyName = process.env.COMPANY_NAME || 'CRM Accounts'
  const companyAddress = process.env.COMPANY_ADDRESS || ''
  const companyPhone = process.env.COMPANY_PHONE || ''
  const companyEmail = process.env.COMPANY_EMAIL || process.env.SMTP_FROM || ''
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

  return `
    <tr>
      <td style="padding: 40px 20px; background-color: #f9fafb; border-top: 1px solid ${BRAND_COLORS.border};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="text-align: center; padding-bottom: 20px;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 14px; line-height: 1.6;">
                <strong style="color: ${BRAND_COLORS.text};">${companyName}</strong>
              </p>
              ${companyAddress ? `<p style="margin: 8px 0 0; color: ${BRAND_COLORS.textLight}; font-size: 13px;">${companyAddress}</p>` : ''}
              ${companyPhone ? `<p style="margin: 4px 0 0; color: ${BRAND_COLORS.textLight}; font-size: 13px;">Phone: ${companyPhone}</p>` : ''}
              ${companyEmail ? `<p style="margin: 4px 0 0; color: ${BRAND_COLORS.textLight}; font-size: 13px;">Email: <a href="mailto:${companyEmail}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">${companyEmail}</a></p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="text-align: center; padding: 20px 0; border-top: 1px solid ${BRAND_COLORS.border};">
              <p style="margin: 0 0 15px; color: ${BRAND_COLORS.textLight}; font-size: 12px; line-height: 1.6;">
                This email was sent to you because you have an account with ${companyName}.
                <br />
                If you have any questions, please contact our support team.
              </p>
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 11px;">
                © ${new Date().getFullYear()} ${companyName}. All rights reserved.
                <br />
                <a href="${frontendUrl}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">Visit our website</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `
}

/**
 * Base Email Template Wrapper
 * Provides consistent structure for all emails
 */
export const getEmailTemplate = (
  content: string,
  logoUrl?: string
): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Email Template</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 20px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND_COLORS.background}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              ${getEmailHeader(logoUrl)}
              ${content}
              ${getEmailFooter()}
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
 * Password Reset Email Template
 */
export const getPasswordResetTemplate = (
  resetUrl: string,
  userName?: string,
  logoUrl?: string
): string => {
  const greeting = userName ? `Hello ${userName},` : 'Hello,'
  
  const content = `
    <tr>
      <td style="padding: 40px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <h2 style="margin: 0 0 20px; color: ${BRAND_COLORS.text}; font-size: 24px; font-weight: 600; line-height: 1.3;">
                Reset Your Password
              </h2>
              <p style="margin: 0 0 20px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              <p style="margin: 0 0 30px; color: ${BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password. This link will expire in <strong>1 hour</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 20px; color: ${BRAND_COLORS.textLight}; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px; padding: 12px; background-color: #f3f4f6; border-radius: 4px; word-break: break-all; color: ${BRAND_COLORS.primary}; font-size: 13px; font-family: 'Courier New', monospace;">
                ${resetUrl}
              </p>
              <div style="margin: 30px 0; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `

  return getEmailTemplate(content, logoUrl)
}

/**
 * Welcome Email Template (for new user registration)
 */
export const getWelcomeEmailTemplate = (
  userName: string,
  loginUrl: string,
  logoUrl?: string
): string => {
  const content = `
    <tr>
      <td style="padding: 40px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <h2 style="margin: 0 0 20px; color: ${BRAND_COLORS.text}; font-size: 24px; font-weight: 600; line-height: 1.3;">
                Welcome to ${process.env.COMPANY_NAME || 'CRM Accounts'}!
              </h2>
              <p style="margin: 0 0 20px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
                Hello ${userName},
              </p>
              <p style="margin: 0 0 30px; color: ${BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.6;">
                Thank you for joining us! We're excited to have you on board. Your account has been successfully created and you can now access all our features.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.secondary} 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                      Get Started
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin: 30px 0; padding: 20px; background-color: #ecfdf5; border-left: 4px solid ${BRAND_COLORS.success}; border-radius: 4px;">
                <p style="margin: 0 0 10px; color: #065f46; font-size: 14px; font-weight: 600;">
                  What's next?
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #047857; font-size: 14px; line-height: 1.8;">
                  <li>Complete your profile</li>
                  <li>Explore our features</li>
                  <li>Get in touch if you need help</li>
                </ul>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `

  return getEmailTemplate(content, logoUrl)
}

/**
 * Password Changed Confirmation Email Template
 */
export const getPasswordChangedTemplate = (
  userName?: string,
  logoUrl?: string
): string => {
  const greeting = userName ? `Hello ${userName},` : 'Hello,'
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`

  const content = `
    <tr>
      <td style="padding: 40px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 64px; height: 64px; background: linear-gradient(135deg, ${BRAND_COLORS.success} 0%, #059669 100%); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto;">
                  <span style="color: #ffffff; font-size: 32px;">✓</span>
                </div>
              </div>
              <h2 style="margin: 0 0 20px; color: ${BRAND_COLORS.text}; font-size: 24px; font-weight: 600; line-height: 1.3; text-align: center;">
                Password Changed Successfully
              </h2>
              <p style="margin: 0 0 20px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6; text-align: center;">
                ${greeting}
              </p>
              <p style="margin: 0 0 30px; color: ${BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.6; text-align: center;">
                Your password has been successfully changed. If you made this change, you can safely ignore this email.
              </p>
              <div style="margin: 30px 0; padding: 20px; background-color: #fef2f2; border-left: 4px solid ${BRAND_COLORS.error}; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Security Alert:</strong> If you didn't change your password, please <a href="${loginUrl}" style="color: ${BRAND_COLORS.error}; text-decoration: underline;">log in</a> immediately and change your password, then contact our support team.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `

  return getEmailTemplate(content, logoUrl)
}

