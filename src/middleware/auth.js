// src/middleware/auth.js
const { verifyAccessToken } = require('../utils/jwt');
const { error }             = require('../utils/response');

/**
 * Attach the decoded JWT payload to req.user.
 * Rejects requests without a valid Bearer token.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'No token provided', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;   // { sub, name, role, email, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Access token expired', 401);
    }
    return error(res, 'Invalid token', 401);
  }
}

/**
 * Restrict a route to specific roles.
 * Usage: authorize('hospital', 'individual')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return error(res, 'Not authenticated', 401);
    if (!roles.includes(req.user.role)) {
      return error(res, 'Forbidden — insufficient role', 403);
    }
    next();
  };
}

module.exports = { authenticate, authorize };
