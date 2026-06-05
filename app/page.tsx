'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function RootPage() {
  const { isAuthenticated, user, _hasHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Wait until Zustand has finished reading from localStorage
    if (!_hasHydrated) return;

    if (isAuthenticated && user) {
      if (user.phone === '+22901010101') {
        router.replace('/admin');
      } else {
        router.replace('/home');
      }
    } else {
      router.replace('/login');
    }
  }, [_hasHydrated, isAuthenticated, user, router]);

  // Splash screen — shown while hydration is in progress
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #1A56DB 0%, #1e3a8a 100%)',
      flexDirection: 'column',
      gap: 0,
    }}>
      {/* Logo */}
      <div style={{
        width: 80, height: 80,
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        fontSize: 40,
        border: '2px solid rgba(255,255,255,0.25)',
      }}>🤖</div>

      <div style={{
        fontSize: 32,
        fontWeight: 800,
        color: 'white',
        fontFamily: 'Space Grotesk, sans-serif',
        letterSpacing: '-1px',
        marginBottom: 6,
      }}>
        WINARY AI
      </div>

      <div style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 48,
        fontWeight: 400,
      }}>
        Investissez intelligemment
      </div>

      {/* Spinner */}
      <div style={{
        width: 28, height: 28,
        border: '3px solid rgba(255,255,255,0.25)',
        borderTopColor: 'white',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
