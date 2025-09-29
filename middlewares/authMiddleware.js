const customError = require('../customError');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/user');

const authMiddleware = (requiredLoginType, allowedRoles = []) => async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return next(customError('Token is required'));

    const decoded = verifyToken(token);

    if (!decoded) return next(customError('Invalid token'));

    if (decoded.loginType !== requiredLoginType) {
        return next(customError(`Invalid login type. Expected ${requiredLoginType}`));
    }

    req.userId = decoded.userId;

    // Role-based access control
    if (allowedRoles.length > 0 || decoded.sessionId) {
        const user = await User.findById(decoded.userId);
        if (!user) {
            return next(customError('You are not authorized to access this resource', 403));
        }
        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
            return next(customError('You are not authorized to access this resource', 403));
        }
        // Single-session enforcement
        if (decoded.sessionId && user.sessionId !== decoded.sessionId) {
            return next(customError('Session is no longer valid. Please log in again.', 401));
        }
    }
    next();
};

module.exports = authMiddleware;