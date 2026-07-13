import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('CRITICAL WARNING: JWT_SECRET environment variable is missing.');
    }
    return new TextEncoder().encode('fallback-secret-for-build-phase-only');
  }
  return new TextEncoder().encode(secret);
}

export const JWT_SECRET = getJwtSecret();

export type JWTPayload = {
  sub: string;
  phone: string;
  is_admin: boolean;
};

// Extracts and verifies the Bearer token from the Authorization header
export async function verifyAuth(req: Request): Promise<JWTPayload | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
}

