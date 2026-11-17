# Database Seeder Documentation

## Overview

The default seeder creates a super admin user with all permissions for initial application setup.

## Super Admin Role

The `superadmin` role has the following privileges:
- ✅ Access to all routes regardless of role requirements
- ✅ Full system permissions
- ✅ Cannot be restricted by the `authorize` middleware
- ✅ Highest level of access in the system

## Running the Seeder

### Basic Usage

```bash
npm run seed
```

This will create a super admin user with default credentials:
- **Email**: `admin@crm.com`
- **Password**: `Admin@123`
- **Name**: `Super Admin`

### Custom Credentials

You can customize the super admin credentials by setting environment variables in your `.env` file:

```env
# Super Admin Credentials
SUPER_ADMIN_EMAIL=your-admin@email.com
SUPER_ADMIN_PASSWORD=YourSecurePassword123
SUPER_ADMIN_NAME=Your Admin Name
```

Then run:
```bash
npm run seed
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPER_ADMIN_EMAIL` | `admin@crm.com` | Email address for the super admin |
| `SUPER_ADMIN_PASSWORD` | `Admin@123` | Password for the super admin (must be at least 8 characters) |
| `SUPER_ADMIN_NAME` | `Super Admin` | Display name for the super admin |
| `MONGODB_URI` | `mongodb://localhost:27017/crm-accounts` | MongoDB connection string |

## Seeder Behavior

### First Run
- Creates a new super admin user with the specified credentials
- Sets role to `superadmin`
- Sets `isActive` to `true`

### Subsequent Runs
- If a user with the same email exists:
  - If the user is not a superadmin, updates them to superadmin
  - If already a superadmin, displays a message and exits
  - Ensures `isActive` is set to `true`

## Security Notes

⚠️ **Important Security Recommendations:**

1. **Change Default Password**: Always change the default password after first login
2. **Use Strong Passwords**: Set a strong password via environment variables
3. **Secure Environment Variables**: Never commit `.env` files to version control
4. **Production Setup**: Use different credentials for production environments
5. **Limit Super Admin Count**: Only create super admin users when necessary

## Example Usage

### Development Setup

```bash
# 1. Set up environment variables
echo "SUPER_ADMIN_EMAIL=dev-admin@example.com" >> .env
echo "SUPER_ADMIN_PASSWORD=DevPassword123!" >> .env
echo "SUPER_ADMIN_NAME=Development Admin" >> .env

# 2. Run seeder
npm run seed
```

### Production Setup

```bash
# 1. Set secure environment variables
export SUPER_ADMIN_EMAIL=admin@yourcompany.com
export SUPER_ADMIN_PASSWORD=$(openssl rand -base64 32)
export SUPER_ADMIN_NAME="Production Admin"

# 2. Run seeder
npm run seed
```

## Troubleshooting

### Error: "E11000 duplicate key error"
- The email already exists in the database
- The seeder will update the existing user to superadmin if needed

### Error: "MongoDB connection failed"
- Check your `MONGODB_URI` environment variable
- Ensure MongoDB is running
- Verify network connectivity

### Error: "Password validation failed"
- Password must be at least 8 characters long
- Check the password meets the User model requirements

## Role Hierarchy

The application supports the following roles (in order of permissions):

1. **superadmin** - Full system access, bypasses all role checks
2. **admin** - Administrative access
3. **manager** - Management-level access
4. **user** - Standard user access (default)

## Integration with Authorization

The `authorize` middleware automatically grants access to superadmin users:

```typescript
// Superadmin can access any route
app.get('/admin-only', authorize('admin'), handler) // ✅ Superadmin allowed
app.get('/manager-only', authorize('manager'), handler) // ✅ Superadmin allowed
```

## Next Steps

After running the seeder:

1. ✅ Log in with the super admin credentials
2. ✅ Change the default password
3. ✅ Create additional admin/manager users as needed
4. ✅ Configure application settings
5. ✅ Set up email templates and branding

## Support

For issues or questions:
- Check the seeder output for error messages
- Verify environment variables are set correctly
- Ensure MongoDB is running and accessible
- Review the User model for validation requirements

