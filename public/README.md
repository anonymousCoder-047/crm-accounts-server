# Email Assets Directory

This directory contains static assets used in email templates.

## Logo Setup

### Option 1: Place Logo in Frontend Public Directory
1. Add your logo file (`logo.png` or `logo.jpg`) to your frontend's `public` directory
2. The email templates will automatically reference it via `FRONTEND_URL/logo.png`

### Option 2: Use Environment Variable
Set `EMAIL_LOGO_URL` in your `.env` file to point to your logo:
```
EMAIL_LOGO_URL=https://yourdomain.com/images/logo.png
```

### Logo Recommendations
- **Format**: PNG or JPG (for best email client compatibility)
- **Size**: 200px width (recommended)
- **Aspect Ratio**: 4:1 or similar (e.g., 200x50px)
- **File Size**: Keep under 50KB for faster email loading
- **Background**: Transparent PNG or white background works best

## Email Template Customization

Email templates use brand colors defined in `src/utils/emailTemplates.ts`. You can customize:

- Primary color (default: `#2563eb` - Blue)
- Secondary color (default: `#7c3aed` - Purple)
- Company name (via `COMPANY_NAME` env variable)
- Company contact info (via `COMPANY_ADDRESS`, `COMPANY_PHONE`, `COMPANY_EMAIL`)

## Environment Variables

Add these to your `.env` file for full email customization:

```env
# Email Branding
COMPANY_NAME=Your Company Name
COMPANY_ADDRESS=123 Main St, City, State 12345
COMPANY_PHONE=+1 (555) 123-4567
COMPANY_EMAIL=support@yourcompany.com
EMAIL_LOGO_URL=https://yourdomain.com/logo.png

# Frontend URL (used for email links)
FRONTEND_URL=http://localhost:3000
```

