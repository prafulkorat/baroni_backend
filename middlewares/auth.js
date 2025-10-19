import { verifyAccessToken } from '../utils/token.js';
import User from '../models/User.js';

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    // Enforce single active session: token must include sessionVersion matching current user
    if (typeof decoded.sessionVersion === 'number' && typeof user.sessionVersion === 'number') {
      if (decoded.sessionVersion !== user.sessionVersion) {
        // If the difference is small (1-2), allow it (user might have logged in from another device recently)
        const versionDifference = user.sessionVersion - decoded.sessionVersion;
        if (versionDifference <= 2 && versionDifference > 0) {
          // Allow recent login from another device
        } else {
          return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
      }
    }
    req.user = user;
    req.auth = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const requireRole = (...allowed) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (!allowed.includes(user.role)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      return next();
    } catch (_e) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  };
};


