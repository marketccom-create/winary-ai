'use client';
import { useEffect, useState } from 'react';
import { Copy, Share2, Users, Loader2, CheckCircle } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/lib/store';
import { apiGetReferrals } from '@/lib/api';
import { formatXOF } from '@/lib/data';

type ReferralData = {
  code: string;
  referees: Array<{ id: string; phone: string; botName: string; commissionCents: number; date: Date }>;
  totalCommissionCents: number;
};

export default function InvitePage() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  useEffect(() => {
    if (!user) return;
    apiGetReferrals(user.id).then(d => { setData(d as ReferralData); setLoading(false); });
  }, [user]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://winary-ai.app';
  const shareUrl = `${origin}/register?ref=${data?.code || ''}`;

  function copyToClipboard(text: string, type: 'code' | 'link') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      showToast(type === 'code' ? 'Code copié !' : 'Lien copié !', 'success');
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(
      `🤖 Rejoins WINARY AI et commence à générer des revenus dès aujourd'hui !\n\nUtilise mon code de parrainage: *${data?.code}*\n\n👉 ${shareUrl}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  return (
    <div className="main-content">
      {/* Header */}
      <header className="page-header">
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
          Inviter des amis
        </h1>
      </header>

      <div style={{ padding: '20px 16px' }}>
        {/* Stats card */}
        <div style={{
          background: 'linear-gradient(135deg, #1A56DB, #1e3a8a)',
          borderRadius: 20, padding: '20px',
          marginBottom: 20, color: 'white',
        }}>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>Commissions totales reçues</div>
          <div style={{
            fontSize: 26, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif',
            letterSpacing: '-0.5px', marginBottom: 12,
          }}>
            {loading ? '---' : formatXOF(data?.totalCommissionCents || 0)}
          </div>
          <div style={{
            display: 'flex', gap: 16,
            padding: '10px 0 0', borderTop: '1px solid rgba(255,255,255,0.2)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{data?.referees?.length || 0}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Filleuls</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>35%</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Commission</div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{
                background: 'rgba(255,255,255,0.15)', borderRadius: 8,
                padding: '6px 10px', display: 'inline-block',
                fontSize: 11, fontWeight: 600,
              }}>
                Sur chaque achat
              </div>
            </div>
          </div>
        </div>

        {/* Referral code */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
            Mon Code d'Invitation
          </label>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            background: 'white', border: '1.5px solid #BFDBFE',
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{
              flex: 1, fontSize: 22, fontWeight: 800,
              fontFamily: 'Space Grotesk, sans-serif',
              color: '#1A56DB', letterSpacing: 2,
            }}>{data?.code || '---'}</div>
            <button
              onClick={() => data && copyToClipboard(data.code, 'code')}
              style={{
                background: copied === 'code' ? '#DCFCE7' : '#EFF6FF',
                border: `1px solid ${copied === 'code' ? '#86EFAC' : '#BFDBFE'}`,
                borderRadius: 10, padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: copied === 'code' ? '#15803D' : '#1A56DB',
                transition: 'all 200ms ease',
              }}
            >
              {copied === 'code' ? <CheckCircle size={15} /> : <Copy size={15} />}
              {copied === 'code' ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>

        {/* Referral link */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
            Lien de Parrainage
          </label>
          <div style={{
            background: '#F9FAFB', border: '1.5px solid #E5E7EB',
            borderRadius: 14, padding: '12px 16px',
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <p style={{
              flex: 1, margin: 0, fontSize: 12, color: '#6B7280',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{shareUrl}</p>
            <button
              onClick={() => copyToClipboard(shareUrl, 'link')}
              style={{
                background: 'white', border: '1px solid #E5E7EB',
                borderRadius: 8, padding: '6px 10px',
                cursor: 'pointer', color: '#6B7280', flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
            >
              {copied === 'link' ? <CheckCircle size={16} color="#22C55E" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        {/* WhatsApp share button */}
        <button
          onClick={shareWhatsApp}
          className="btn-press"
          style={{
            width: '100%', height: 54,
            background: '#25D366', color: 'white',
            border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginBottom: 28,
          }}
        >
          <Share2 size={18} />
          Partager via WhatsApp
        </button>

        {/* Referees list */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#111827' }}>
            Mes Filleuls
          </h3>
          {data && <span style={{ fontSize: 12, color: '#9CA3AF' }}>{data.referees.length} filleul{data.referees.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
            <Loader2 size={24} color="#1A56DB" style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : !data || data.referees.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '30px 20px',
            background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
            <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>
              Invitez vos amis pour gagner des commissions !
            </p>
          </div>
        ) : (
          <div style={{
            background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB', overflow: 'hidden',
          }}>
            {data.referees.map((ref, i) => (
              <div key={ref.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: i < data.referees.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: '#EFF6FF', border: '1.5px solid #BFDBFE',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16,
                  }}>👤</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{ref.phone}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {ref.botName} · {new Date(ref.date).toLocaleDateString('fr-BJ')}
                    </div>
                  </div>
                </div>
                <div style={{
                  background: '#DCFCE7', color: '#15803D',
                  padding: '4px 10px', borderRadius: 99,
                  fontSize: 12, fontWeight: 700,
                  border: '1px solid #86EFAC',
                }}>+{formatXOF(ref.commissionCents)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
