# Email Templates Documentation

## Overview

Modern, responsive email templates have been created for authentication-related emails. All templates feature:

- ✅ Modern, professional design with gradient headers
- ✅ Responsive layout (mobile-friendly)
- ✅ Brand theming with customizable colors
- ✅ Logo support in email header
- ✅ Professional footer with company information
- ✅ Security notices and clear call-to-action buttons

## Available Email Templates

### 1. Password Reset Email
**Function**: `sendPasswordResetEmail(email, resetToken, userName?)`

**Features**:
- Clear reset password button
- Fallback URL for manual copy/paste
- Security warning if user didn't request reset
- 1-hour expiration notice

**Usage**:
```typescript
await sendPasswordResetEmail(user.email, resetToken, user.name)
```

### 2. Welcome Email
**Function**: `sendWelcomeEmail(email, userName)`

**Features**:
- Personalized greeting
- "Get Started" call-to-action
- Helpful next steps list
- Professional welcome message

**Usage**:
```typescript
await sendWelcomeEmail(user.email, user.name)
```

### 3. Password Changed Confirmation
**Function**: `sendPasswordChangedEmail(email, userName?)`

**Features**:
- Success confirmation with checkmark
- Security alert if user didn't make the change
- Professional confirmation message

**Usage**:
```typescript
await sendPasswordChangedEmail(user.email, user.name)
```

## Customization

### Brand Colors

Edit `backend/src/utils/emailTemplates.ts` to customize brand colors:

```typescript
const BRAND_COLORS = {
  primary: '#2563eb',      // Main brand color
  primaryDark: '#1e40af',   // Darker shade for hover states
  secondary: '#7c3aed',     // Secondary/accent color
  text: '#1f2937',          // Main text color
  textLight: '#6b7280',     // Light text color
  background: '#ffffff',    // Email background
  border: '#e5e7eb',        // Border color
  success: '#10b981',       // Success messages
  error: '#ef4444',         // Error messages
}
```

### Company Information

Set these environment variables in your `.env` file:

```env
COMPANY_NAME=Your Company Name
COMPANY_ADDRESS=123 Main St, City, State 12345
COMPANY_PHONE=+1 (555) 123-4567
COMPANY_EMAIL=support@yourcompany.com
```

### Logo Configuration

**Option 1**: Place logo in frontend public directory
- Add `logo.png` to `frontend/public/`
- Templates will automatically use `${FRONTEND_URL}/logo.png`

**Option 2**: Use environment variable
```env
EMAIL_LOGO_URL=https://yourdomain.com/images/logo.png
```

**Logo Requirements**:
- Format: PNG or JPG
- Recommended size: 200px width
- File size: Under 50KB
- Aspect ratio: 4:1 (e.g., 200x50px)

## Template Structure

All templates follow this structure:

1. **Header**: Logo/brand name with gradient background
2. **Content**: Main message with call-to-action
3. **Footer**: Company info, contact details, copyright

## Email Client Compatibility

Templates are designed to work with:
- ✅ Gmail (web, iOS, Android)
- ✅ Outlook (web, desktop, mobile)
- ✅ Apple Mail
- ✅ Yahoo Mail
- ✅ Most modern email clients

**Note**: Uses inline CSS and table-based layout for maximum compatibility.

## Testing

To test email templates:

1. Set up SMTP configuration in `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourcompany.com
```

2. Trigger password reset from your application
3. Check your email inbox

## Adding New Templates

To add a new email template:

1. Create template function in `emailTemplates.ts`:
```typescript
export const getNewTemplate = (param1: string, logoUrl?: string): string => {
  const content = `...`
  return getEmailTemplate(content, logoUrl)
}
```

2. Add send function in `sendEmail.ts`:
```typescript
export const sendNewEmail = async (email: string, param1: string) => {
  const logoUrl = getLogoUrl()
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Your Subject',
    html: getNewTemplate(param1, logoUrl),
  }
  // ... send email
}
```

## Best Practices

1. **Always test** emails in multiple email clients
2. **Keep file sizes small** for faster loading
3. **Use absolute URLs** for images (not relative paths)
4. **Include plain text fallback** (future enhancement)
5. **Test on mobile devices** to ensure responsiveness
6. **Monitor email deliverability** and adjust spam filters if needed

## Support

For issues or questions about email templates, check:
- `backend/src/utils/emailTemplates.ts` - Template definitions
- `backend/src/utils/sendEmail.ts` - Email sending functions
- `backend/public/README.md` - Asset setup guide

