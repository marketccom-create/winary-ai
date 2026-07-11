'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Lock, Shield, RefreshCw, Loader2, User } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { apiRegister } from '@/lib/api';

// Captcha: simple server-generated 4-digit numeric image
function generateCaptcha(): { answer: string; token: string } {
  const num = Math.floor(1000 + Math.random() * 9000).toString();
  return { answer: num, token: btoa(num + '|' + Date.now()) };
}

function CaptchaDisplay({ code }: { code: string }) {
  return (
    <svg width="120" height="44" viewBox="0 0 120 44" style={{ border: '1.5px solid #E5E7EB', borderRadius: 8, background: '#F9FAFB' }}>
      {/* Noise lines */}
      <line x1="0" y1="22" x2="120" y2="18" stroke="#CBD5E1" strokeWidth="1" />
      <line x1="0" y1="30" x2="120" y2="10" stroke="#E2E8F0" strokeWidth="1" />
      {code.split('').map((char, i) => (
        <text
          key={i}
          x={15 + i * 26}
          y={28 + (i % 2 === 0 ? -3 : 3)}
          fontSize="22"
          fontWeight="bold"
          fontFamily="monospace"
          fill={['#1A56DB', '#374151', '#1D4ED8', '#111827'][i % 4]}
          transform={`rotate(${(i % 3 - 1) * 8}, ${15 + i * 26}, 22)`}
        >{char}</text>
      ))}
    </svg>
  );
}

const COUNTRIES = [
  { code: 'BJ', name: 'Bénin', prefix: '+229', flag: '🇧🇯' },
  { code: 'BF', name: 'Burkina Faso', prefix: '+226', flag: '🇧🇫' },
  { code: 'CI', name: 'Côte d\'Ivoire', prefix: '+225', flag: '🇨🇮' },
  { code: 'GN', name: 'Guinée', prefix: '+224', flag: '🇬🇳' },
  { code: 'ML', name: 'Mali', prefix: '+223', flag: '🇲🇱' },
  { code: 'NE', name: 'Niger', prefix: '+227', flag: '🇳🇪' },
  { code: 'SN', name: 'Sénégal', prefix: '+221', flag: '🇸🇳' },
  { code: 'TG', name: 'Togo', prefix: '+228', flag: '🇹🇬' },
];

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [refCode, setRefCode] = useState(searchParams.get('ref') || '');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function refreshCaptcha() {
    setCaptcha(generateCaptcha());
    setCaptchaInput('');
  }

  function validate() {
    const errs: Record<string, string> = {};
    const fullPhone = selectedCountry.prefix + phone.replace(/\s/g, '');
    if (!firstName.trim()) errs.firstName = 'Prénom requis';
    if (!lastName.trim()) errs.lastName = 'Nom requis';
    if (!phone || phone.replace(/\s/g, '').length < 8) errs.phone = 'Numéro invalide';
    if (!password || password.length < 6) errs.password = 'Minimum 6 caractères';
    if (password !== confirm) errs.confirm = 'Les mots de passe ne correspondent pas';
    if (captchaInput !== captcha.answer) { errs.captcha = 'Code de vérification incorrect'; refreshCaptcha(); }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    const fullPhone = selectedCountry.prefix + phone.replace(/\s/g, '');
    setLoading(true);
    try {
      const { user, token } = await apiRegister({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: fullPhone,
        password,
        referralCode: refCode.trim().toUpperCase(),
        captchaAnswer: captchaInput,
        captchaToken: captcha.token,
      });
      login(user, token);
      router.replace('/home');
    } catch (err: any) {
      setError(err.message);
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: '#1A56DB', padding: '16px 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: 'rgba(255,255,255,0.2)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <Image src="/logo.png" alt="Logo" width={36} height={36} style={{ objectFit: 'cover' }} />
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 18, fontFamily: 'Space Grotesk, sans-serif' }}>WINARY AI</span>
        </div>
        <Link href="/login" style={{
          background: 'rgba(255,255,255,0.2)', color: 'white',
          padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
          textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)',
        }}>Connexion</Link>
      </div>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #1A56DB 0%, #1e3a8a 100%)',
        height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 180, height: 180, background: 'rgba(255,255,255,0.05)', borderRadius: '50%',
        }} />
        <div style={{ textAlign: 'center', color: 'white', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <Image src="/logo.png" alt="Winary AI Logo" width={64} height={64} style={{ borderRadius: 12 }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
            Créez votre compte
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>+1 000 XOF offerts à l'inscription !</div>
        </div>
      </div>

      {/* Form */}
      <div style={{
        background: 'white', borderRadius: '24px 24px 0 0',
        marginTop: -16, flex: 1, padding: '28px 20px 40px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
      }}>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Nom & Prénom */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
                  <User size={18} />
                </div>
                <input
                  className={`input-field${fieldErrors.lastName ? ' error' : ''}`}
                  type="text" placeholder="Nom"
                  value={lastName} onChange={e => setLastName(e.target.value)}
                  style={{ paddingLeft: 44 }}
                />
              </div>
              {fieldErrors.lastName && <p style={{ color: '#EF4444', fontSize: 12, margin: '4px 0 0 4px' }}>{fieldErrors.lastName}</p>}
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <input
                  className={`input-field${fieldErrors.firstName ? ' error' : ''}`}
                  type="text" placeholder="Prénom"
                  value={firstName} onChange={e => setFirstName(e.target.value)}
                  style={{ paddingLeft: 16 }}
                />
              </div>
              {fieldErrors.firstName && <p style={{ color: '#EF4444', fontSize: 12, margin: '4px 0 0 4px' }}>{fieldErrors.firstName}</p>}
            </div>
          </div>

          {/* Phone */}
          <div>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 13, fontWeight: 600, color: '#374151',
                zIndex: 10,
              }}>
                <span style={{ fontSize: 16 }}>{selectedCountry.flag}</span>
                <select
                  value={selectedCountry.code}
                  onChange={e => {
                    const found = COUNTRIES.find(c => c.code === e.target.value);
                    if (found) setSelectedCountry(found);
                  }}
                  style={{
                    border: 'none', background: 'transparent',
                    fontSize: 13, fontWeight: 700, color: '#374151',
                    cursor: 'pointer', outline: 'none', padding: '0 2px',
                    marginRight: 4,
                  }}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.prefix}
                    </option>
                  ))}
                </select>
                <div style={{ width: 1, height: 16, background: '#E5E7EB', marginLeft: 2 }} />
              </div>
              <input
                className={`input-field${fieldErrors.phone ? ' error' : ''}`}
                type="tel" placeholder="XX XX XX XX"
                value={phone} onChange={e => setPhone(e.target.value)}
                style={{ paddingLeft: 100 }} inputMode="numeric"
              />
            </div>
            {fieldErrors.phone && <p style={{ color: '#EF4444', fontSize: 12, margin: '4px 0 0 4px' }}>{fieldErrors.phone}</p>}
          </div>

          {/* Password */}
          <div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
                <Lock size={18} />
              </div>
              <input
                className={`input-field${fieldErrors.password ? ' error' : ''}`}
                type={showPass ? 'text' : 'password'} placeholder="Mot de passe"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: 44, paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0,
              }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && <p style={{ color: '#EF4444', fontSize: 12, margin: '4px 0 0 4px' }}>{fieldErrors.password}</p>}
          </div>

          {/* Confirm password */}
          <div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
                <Lock size={18} />
              </div>
              <input
                className={`input-field${fieldErrors.confirm ? ' error' : ''}`}
                type={showConfirm ? 'text' : 'password'} placeholder="Confirmer le mot de passe"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                style={{ paddingLeft: 44, paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0,
              }}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.confirm && <p style={{ color: '#EF4444', fontSize: 12, margin: '4px 0 0 4px' }}>{fieldErrors.confirm}</p>}
          </div>

          {/* Referral code */}
          <div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
                <Shield size={18} />
              </div>
              <input
                className={`input-field${fieldErrors.refCode ? ' error' : ''}`}
                type="text" placeholder="Code d'invitation (Optionnel)"
                value={refCode} onChange={e => setRefCode(e.target.value.toUpperCase())}
                style={{ paddingLeft: 44 }}
              />
            </div>
            {fieldErrors.refCode && <p style={{ color: '#EF4444', fontSize: 12, margin: '4px 0 0 4px' }}>{fieldErrors.refCode}</p>}
          </div>

          {/* Captcha */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <CaptchaDisplay code={captcha.answer} />
              <button type="button" onClick={refreshCaptcha} style={{
                background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '8px 10px', cursor: 'pointer', color: '#6B7280',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              }}>
                <RefreshCw size={14} /> Nouveau
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
                <Shield size={18} />
              </div>
              <input
                className={`input-field${fieldErrors.captcha ? ' error' : ''}`}
                type="text" placeholder="Entrez le code de vérification"
                value={captchaInput} onChange={e => setCaptchaInput(e.target.value)}
                maxLength={4} style={{ paddingLeft: 44 }} inputMode="numeric"
              />
            </div>
            {fieldErrors.captcha && <p style={{ color: '#EF4444', fontSize: 12, margin: '4px 0 0 4px' }}>{fieldErrors.captcha}</p>}
          </div>

          {/* Global error */}
          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FECACA', color: '#DC2626',
              padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            }}>⚠️ {error}</div>
          )}

          {/* Submit */}
          <button
            type="submit" className="btn-press" disabled={loading}
            style={{
              width: '100%', height: 54,
              background: loading ? '#93C5FD' : 'linear-gradient(135deg, #1A56DB, #1D4ED8)',
              color: 'white', border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Space Grotesk, sans-serif', marginTop: 4,
            }}
          >
            {loading
              ? <><Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> Création...</>
              : "S'inscrire — Obtenir 1 000 XOF"}
          </button>

          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
            Déjà inscrit ?{' '}
            <Link href="/login" style={{ color: '#1A56DB', fontWeight: 600, textDecoration: 'none' }}>
              Se connecter
            </Link>
          </p>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
