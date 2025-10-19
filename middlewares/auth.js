import { verifyAccessToken } from '../utils/token.js';
import User from '../models/User.js';

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    
    console.log(`[RequireAuth] Checking authentication for request:`, {
      hasHeader: !!req.headers.authorization,
      headerLength: req.headers.authorization?.length || 0,
      hasToken: !!token,
      tokenLength: token?.length || 0,
      url: req.url,
      method: req.method
    });
    
    if (!token) {
      console.log(`[RequireAuth] No token provided`);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    console.log(`[RequireAuth] Verifying token...`);
    const decoded = verifyAccessToken(token);
    console.log(`[RequireAuth] Token decoded successfully:`, {
      userId: decoded.userId,
      sessionVersion: decoded.sessionVersion,
      iat: decoded.iat,
      exp: decoded.exp
    });
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log(`[RequireAuth] User ${decoded.userId} not found`);
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    
    console.log(`[RequireAuth] User found:`, {
      id: user._id,
      role: user.role,
      sessionVersion: user.sessionVersion,
      isActive: user.isActive
    });
    
    // Enforce single active session: token must include sessionVersion matching current user
    if (typeof decoded.sessionVersion === 'number' && typeof user.sessionVersion === 'number') {
      if (decoded.sessionVersion !== user.sessionVersion) {
        console.log(`[RequireAuth] Session version mismatch:`, {
          tokenSessionVersion: decoded.sessionVersion,
          userSessionVersion: user.sessionVersion,
          difference: user.sessionVersion - decoded.sessionVersion
        });
        
        // If the difference is small (1-2), allow it (user might have logged in from another device recently)
        const versionDifference = user.sessionVersion - decoded.sessionVersion;
        if (versionDifference <= 2 && versionDifference > 0) {
          console.log(`[RequireAuth] Allowing session version difference of ${versionDifference} (recent login from another device)`);
        } else {
          console.log(`[RequireAuth] Session version difference too large (${versionDifference}), denying access`);
          return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
      }
    }
    
    console.log(`[RequireAuth] Authentication successful for user ${user._id}`);
    req.user = user;
    req.auth = decoded;
    return next();
  } catch (err) {
    console.error(`[RequireAuth] Authentication error:`, err);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const requireRole = (...allowed) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      
      console.log(`[RequireRole] Checking role for user ${user._id}:`, {
        userRole: user.role,
        allowedRoles: allowed,
        hasPermission: allowed.includes(user.role)
      });
      
      if (!allowed.includes(user.role)) {
        console.log(`[RequireRole] Access denied for user ${user._id} with role '${user.role}'. Required roles: ${allowed.join(', ')}`);
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      
      console.log(`[RequireRole] Access granted for user ${user._id} with role '${user.role}'`);
      return next();
    } catch (_e) {
      console.error(`[RequireRole] Error checking role:`, _e);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  };
};


