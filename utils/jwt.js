const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const secretKey = process.env.JWT_SECRET 
// Function to generate a JWT token
const generateToken = (userId, loginType, sessionId) => {
  const payload = {
    userId,
    loginType,
    sessionId,
  };
  const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });
  return `Bearer ${token}`;
};

// Function to verify a JWT token
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, secretKey);
    return decoded;
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};