import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Basic in-memory rate limiter for Edge (works per-isolate)
// In production with multiple instances, this is not globally synced,
// but it is sufficient to prevent rapid burst attacks from a single IP.
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute for sensitive routes

function getRateLimitKey(req: NextRequest) {
  // Use x-forwarded-for if behind a proxy, otherwise use a generic fallback
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  return `${ip}_${req.nextUrl.pathname}`;
}

export function middleware(req: NextRequest) {
  // Only apply rate limiting to sensitive auth/financial routes
  const sensitivePaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/purchases',
    '/api/transactions'
  ];

  const isSensitive = sensitivePaths.some(path => req.nextUrl.pathname.startsWith(path));

  if (isSensitive && req.method === 'POST') {
    const key = getRateLimitKey(req);
    const now = Date.now();
    const record = rateLimitMap.get(key);

    if (record) {
      // Check if window has expired
      if (now - record.timestamp > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.set(key, { count: 1, timestamp: now });
      } else {
        if (record.count >= MAX_REQUESTS_PER_WINDOW) {
          return new NextResponse(
            JSON.stringify({ error: 'Trop de requêtes. Veuillez patienter une minute.' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          );
        }
        record.count += 1;
        rateLimitMap.set(key, record);
      }
    } else {
      rateLimitMap.set(key, { count: 1, timestamp: now });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
