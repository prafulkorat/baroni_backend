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
    // REQUIRE sessionVersion for all tokens - this is mandatory
    if (typeof decoded.sessionVersion !== 'number') {
      console.log(`[AUTH] Token rejected: User ${decoded.userId} token has no sessionVersion (old token format)`);
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    }
    
    // If user doesn't have sessionVersion yet (migration case), set it
    if (typeof user.sessionVersion !== 'number') {
      console.log(`[AUTH] User ${decoded.userId} missing sessionVersion, setting to ${decoded.sessionVersion}`);
      await User.findByIdAndUpdate(decoded.userId, { sessionVersion: decoded.sessionVersion });
      user.sessionVersion = decoded.sessionVersion;
    }
    
    // SessionVersion must match exactly
    if (decoded.sessionVersion !== user.sessionVersion) {
      console.log(`[AUTH] Token rejected: User ${decoded.userId} token sessionVersion ${decoded.sessionVersion} != current ${user.sessionVersion} (logged out by new login)`);
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    }
    
    console.log(`[AUTH] Token valid: User ${decoded.userId} token sessionVersion ${decoded.sessionVersion} matches current ${user.sessionVersion}`);
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


