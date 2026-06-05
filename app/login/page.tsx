'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Phone, Lock, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { apiLogin } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!phone || !password) { setError('Remplissez tous les champs'); return; }
    const fullPhone = phone.startsWith('+') ? phone : '+229' + phone.replace(/\s/g, '');
    setLoading(true);
    try {
      const { user, token } = await apiLogin(fullPhone, password);
      login(user, token);
      if ((user as any).isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/home');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <div style={{
        background: '#1A56DB',
        padding: '16px 20px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: 'white',
            fontFamily: 'Space Grotesk, sans-serif',
          }}>W</div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 18, fontFamily: 'Space Grotesk, sans-serif' }}>WINARY AI</span>
        </div>
        <Link href="/register" style={{
          background: 'rgba(255,255,255,0.2)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: 99,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>S'inscrire</Link>
      </div>

      {/* Hero Image */}
      <div style={{
        background: 'linear-gradient(135deg, #1A56DB 0%, #1e3a8a 100%)',
        height: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 200, height: 200,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '50%',
        }} />
        <div style={{ textAlign: 'center', color: 'white', zIndex: 1 }}>
          <div style={{ fontSize: 52, marginBottom: 4 }}>🤖</div>
          <div style={{
            fontSize: 20, fontWeight: 800,
            fontFamily: 'Space Grotesk, sans-serif',
            letterSpacing: '-0.5px',
          }}>BIENVENUE CHEZ<br />WINARY AI !</div>
        </div>
      </div>

      {/* Form Card */}
      <div style={{
        background: 'white',
        borderRadius: '24px 24px 0 0',
        marginTop: -20,
        flex: 1,
        padding: '32px 20px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
      }}>
        <h1 style={{
          fontSize: 22, fontWeight: 700, marginBottom: 24,
          fontFamily: 'Space Grotesk, sans-serif',
          color: '#111827',
        }}>Se connecter</h1>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Phone */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280',
              fontSize: 13, fontWeight: 600, pointerEvents: 'none',
            }}>
              <span>🇧🇯</span>
              <span style={{ color: '#374151' }}>+229</span>
              <div style={{ width: 1, height: 16, background: '#E5E7EB' }} />
            </div>
            <input
              className="input-field"
              type="tel"
              placeholder="XX XX XX XX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{ paddingLeft: 90 }}
              inputMode="numeric"
            />
          </div>

          {/* Password */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              color: '#9CA3AF',
            }}>
              <Lock size={18} />
            </div>
            <input
              className={`input-field${error ? ' error' : ''}`}
              type={showPass ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ paddingLeft: 44, paddingRight: 44 }}
            />
            <button type="button" onClick={() => setShowPass(!showPass)} style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0,
            }}>
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FECACA', color: '#DC2626',
              padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            }}>⚠️ {error}</div>
          )}

          {/* Demo hint */}
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8',
            padding: '10px 14px', borderRadius: 10, fontSize: 12,
          }}>
            <strong>Démo:</strong> +22997001234 / Demo@1234<br />
            <strong>Admin:</strong> +22901010101 / Admin@2024
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-press"
            disabled={loading}
            style={{
              width: '100%', height: 54,
              background: loading ? '#93C5FD' : 'linear-gradient(135deg, #1A56DB, #1D4ED8)',
              color: 'white', border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            {loading ? <><Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> Connexion...</> : 'Se connecter'}
          </button>

          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>
            Pas encore de compte ?{' '}
            <Link href="/register" style={{ color: '#1A56DB', fontWeight: 600, textDecoration: 'none' }}>
              S'inscrire
            </Link>
          </p>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
