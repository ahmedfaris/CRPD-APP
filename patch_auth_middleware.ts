import fs from 'fs';

const file = 'src/middleware/auth.ts';
let content = fs.readFileSync(file, 'utf8');

const newContent = `import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-fallback-key';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | jwt.JwtPayload | any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedTokenHeader = jwt.decode(token, { complete: true });
    
    if (!decodedTokenHeader) {
      return res.status(401).json({ error: 'Unauthorized: Malformed token' });
    }

    const header = decodedTokenHeader.header;

    if (header.alg === 'RS256' || header.kid) {
      // It's likely a Firebase token
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      return next();
    } else {
      // It's our custom JWT
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    }
  } catch (error: any) {
    console.error('Error verifying token:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token', details: error.message });
  }
};
`;

fs.writeFileSync(file, newContent);
