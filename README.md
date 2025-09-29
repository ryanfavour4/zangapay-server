# Zangapay Server

## Overview
Zangapay Server is a Node.js/Express backend for a digital payments and bills platform. It provides APIs for user management, wallet operations, bill payments (airtime, data, cable, electricity, education, insurance, betting, gift cards, etc.), virtual cards, KYC, notifications, and admin operations.

---

## Main Features
- **User authentication & management** (JWT, single-session, OTP, PIN)
- **Wallet management** (balance, transactions, funding, withdrawal)
- **Bill payments** (airtime, data, cable TV, electricity, education, insurance, betting, gift cards, etc.)
- **Virtual card creation and management**
- **KYC verification**
- **Notifications** (email, in-app)
- **Admin dashboard** (user management, revenue, activities, service fees, etc.)
- **Role-based access control** (admin, support, user)
- **Security best practices** (see SECURITY.md)

---

## Directory Structure
```
controllers/         # Route handler logic for all features
models/              # Mongoose models (User, Wallet, Transaction, etc.)
routes/              # Express route definitions
middlewares/         # Authentication, authorization, and other middleware
utils/               # Utility functions (JWT, OTP, helpers, etc.)
webhooks/            # Webhook handlers for external integrations
mail template/       # Email templates for notifications
package.json         # Project dependencies and scripts
server.js            # Main server entry point
SECURITY.md          # Security documentation
README.md            # This documentation
```

---

## Setup Instructions
1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd zangapay-server-backup
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Create a `.env` file** with the following variables:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   CORS_ORIGIN=https://your-frontend-domain.com
   # ...other API keys and secrets as needed
   ```
4. **Start the server:**
   ```bash
   npm start
   ```

---

## API Structure
- All routes are prefixed with `/api` (e.g., `/api/user/signup`, `/api/bills/airtime/subscription`)
- See the `routes/` directory for all available endpoints.
- Most endpoints require authentication (JWT in `Authorization` header).
- Admin endpoints require admin role.

---

## Security Highlights
- Input validation and sanitization on all sensitive endpoints
- Rate limiting (global and per-endpoint)
- JWT authentication with single-session enforcement
- Role-based access control for admin/support
- CORS restricted to trusted origins
- Passwords hashed with bcrypt
- NoSQL injection, XSS, and command injection protections
- See [SECURITY.md](./SECURITY.md) for full details

---

## Environment Variables
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for signing JWT tokens
- `CORS_ORIGIN` - Allowed frontend origin for CORS
- API keys/secrets for third-party integrations (Reloadly, VTpass, etc.)

---

## Contribution & Support
- Please open issues or pull requests for bugs, features, or questions.
- For security issues, see the contact info in [SECURITY.md](./SECURITY.md).

---

## License
This project is proprietary to Zangapay. All rights reserved. 