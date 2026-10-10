import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import * as crypto from 'crypto';

interface RateLimitEntry {
  attempts: number;
  lockUntil: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) return true;

  if (entry.lockUntil > now) {
    return false; // locked out
  }

  if (now > entry.lockUntil && entry.attempts >= MAX_ATTEMPTS) {
    // Lockout expired, reset
    rateLimitMap.delete(ip);
    return true;
  }

  return true;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { attempts: 0, lockUntil: 0 };
  entry.attempts += 1;
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockUntil = now + LOCKOUT_MS;
  }
  rateLimitMap.set(ip, entry);
}

function resetRateLimit(ip: string): void {
  rateLimitMap.delete(ip);
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'kinteba-guush-secure-session-secret-change-in-prod';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@kintebaguush.org').trim().toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

export function signToken(payload: object): string {
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(dataStr).digest('base64url');
  return `${dataStr}.${signature}`;
}

export function verifyToken(token: string): { valid: boolean; payload?: any } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };
    const [dataStr, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(dataStr).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return { valid: false };
    }
    const payload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

function verifyPassword(password: string): boolean {
  if (!ADMIN_PASSWORD_HASH) {
    // In local dev without env var, enforce a safe default warning or local check
    return password === 'KintebaGuush2026!';
  }

  // Format: salt:hash
  const parts = ADMIN_PASSWORD_HASH.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHashHex] = parts;

  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHashHex, 'hex'));
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const clientIp = event.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  const path = event.path.toLowerCase();

  // Health check
  if (path.endsWith('/health') || path.endsWith('/api/health')) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'kinteba-auth',
      }),
    };
  }

  // Verify Session Token
  if (path.endsWith('/verify')) {
    const authHeader = event.headers['authorization'] || '';
    const cookieHeader = event.headers['cookie'] || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      const match = cookieHeader.match(/kinteba_admin_session=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ authenticated: false, error: 'No token provided' }),
      };
    }

    const { valid, payload } = verifyToken(token);
    if (!valid) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ authenticated: false, error: 'Invalid or expired session' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ authenticated: true, user: payload }),
    };
  }

  // Logout
  if (path.endsWith('/logout')) {
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': 'kinteba_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
      },
      body: JSON.stringify({ success: true }),
    };
  }

  // Login
  if (event.httpMethod === 'POST') {
    if (!checkRateLimit(clientIp)) {
      return {
        statusCode: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'መጠኑ ዝበዝሐ ፈተነ ተኻይዱ። ብኽብረትኩም ን 5 ደቓይቕ ተጸበዩ። (Rate limit exceeded. Throttled for 5 minutes.)',
        }),
      };
    }

    let body: any = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON payload' }),
      };
    }

    const username = (body.username || body.email || '').trim().toLowerCase();
    const password = body.password || '';

    const isUserMatch = username === ADMIN_EMAIL || username === 'admin';
    const isPassMatch = isUserMatch && verifyPassword(password);

    if (!isPassMatch) {
      recordFailedAttempt(clientIp);
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'ዘይተፈቐደ መረጋገጺ ወይ ፓስዎርድ (Invalid administrator credentials)' }),
      };
    }

    // Success
    resetRateLimit(clientIp);
    const token = signToken({
      sub: ADMIN_EMAIL,
      role: 'admin',
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': `kinteba_admin_session=${token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax`,
      },
      body: JSON.stringify({
        success: true,
        token,
        user: { username: ADMIN_EMAIL, role: 'admin' },
      }),
    };
  }

  return {
    statusCode: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not found' }),
  };
};

