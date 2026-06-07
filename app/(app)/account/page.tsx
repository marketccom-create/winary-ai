'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ArrowUpRight, ArrowDownLeft, Zap, Gift, Users, Settings, Loader2 } from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '@/lib/store';
import { apiGetTransactions } from '@/lib/api';
import { formatXOF } from '@/lib/data';
import { apiChangePassword } from '@/lib/api';
import type { Transaction } from '@/lib/data';

const TX_ICONS: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  DEPOSIT:          { icon: '⬆️', color: '#15803D', bg: '#DCFCE7', label: 'Recharge' },
  WITHDRAWAL:       { icon: '⬇️', color: '#B91C1C', bg: '#FEE2E2', label: 'Retrait' },
  BOT_PURCHASE:     { icon: '🤖', color: '#1D4ED8', bg: '#EFF6FF', label: 'Achat Bot' },
  WORK_EARNING:     { icon: '⚡', color: '#1D4ED8', bg: '#EFF6FF', label: 'Gain travail' },
  REFERRAL_BONUS:   { icon: '👥', color: '#7C3AED', bg: '#F5F3FF', label: 'Commission' },
  WELCOME_BONUS:    { icon: '🎁', color: '#D97706', bg: '#FEF3C7', label: 'Bonus bienvenue' },
  ADMIN_ADJUSTMENT: { icon: '⚙️', color: '#374151', bg: '#F3F4F6', label: 'Ajustement' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Complété', color: '#15803D' },
  PENDING:   { label: 'En cours', color: '#D97706' },
  FAILED:    { label: 'Échoué',   color: '#B91C1C' },
  CANCELLED: { label: 'Annulé',  color: '#6B7280' },
};

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useUIStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    if (newPassword.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiChangePassword(oldPassword, newPassword);
      showToast('Mot de passe modifié avec succès !', 'success');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', fontFamily: 'Space Grotesk, sans-serif' }}>
          Changer de mot de passe
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 20px' }}>
          Sécurisez votre compte en mettant à jour votre mot de passe.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Ancien mot de passe
            </label>
            <input
              className="input-field" type="password" placeholder="Mot de passe actuel"
              value={oldPassword} onChange={e => setOldPassword(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Nouveau mot de passe
            </label>
            <input
              className="input-field" type="password" placeholder="Min 6 caractères"
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          {error && (
            <div style={{
              background: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
              borderRadius: 10, fontSize: 13, fontWeight: 500,
            }}>⚠️ {error}</div>
          )}
          <button type="submit" className="btn-press" disabled={loading} style={{
            height: 52, background: loading ? '#93C5FD' : 'linear-gradient(135deg, #1A56DB, #1D4ED8)',
            color: 'white', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8
          }}>
            {loading ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Mise à jour...</> : 'Mettre à jour'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { transactions, setTransactions, resetAnnouncementSeen } = useAppStore();
  const { showToast } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiGetTransactions(user.id).then(data => {
      setTransactions(data);
      setLoading(false);
    });
  }, [user, setTransactions]);

  function handleLogout() {
    logout();
    resetAnnouncementSeen();
    router.replace('/login');
    showToast('Déconnexion réussie', 'info');
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('fr-BJ', { year: 'numeric', month: 'long' })
    : '—';

  return (
    <div className="main-content">
      {/* Header */}
      <header className="page-header">
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, fontFamily: 'Space Grotesk, sans-serif', color: '#111827', flex: 1 }}>
          Mon Compte
        </h1>
      </header>

      <div style={{ padding: '20px 16px' }}>
        {/* Profile card */}
        <div style={{
          background: 'white', border: '1.5px solid #E5E7EB',
          borderRadius: 20, padding: '20px', marginBottom: 16,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%',
              background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
              border: '2px solid #BFDBFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>👤</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.phone}
              </div>
              {user?.firstName && (
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{user?.phone}</div>
              )}
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                Membre depuis {memberSince}
              </div>
            </div>
          </div>
          <div style={{
            background: '#EFF6FF', borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 600 }}>🎟️ Code de parrainage</span>
            <span style={{
              fontSize: 13, fontWeight: 800, color: '#1A56DB',
              fontFamily: 'Space Grotesk, sans-serif', letterSpacing: 1,
            }}>{user?.referralCode}</span>
          </div>
        </div>

        {/* Balance card */}
        <div className="balance-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 4px' }}>Solde disponible</p>
              <div style={{
                fontSize: 26, fontWeight: 800,
                fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.5px',
              }}>{formatXOF(user?.balanceCents || 0)}</div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#111827' }}>
            Historique des Transactions
          </h3>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Loader2 size={24} color="#1A56DB" style={{ animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : transactions.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 24, background: 'white',
              borderRadius: 14, border: '1.5px solid #E5E7EB',
            }}>
              <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>Aucune transaction</p>
            </div>
          ) : (
            <div style={{
              background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB', overflow: 'hidden',
            }}>
              {transactions.map((tx, i) => {
                const meta = TX_ICONS[tx.type] || TX_ICONS.ADMIN_ADJUSTMENT;
                const statusMeta = STATUS_LABELS[tx.status];
                const isCredit = tx.amountCents > 0;
                return (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    borderBottom: i < transactions.length - 1 ? '1px solid #F3F4F6' : 'none',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: meta.bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 18, flexShrink: 0,
                    }}>{meta.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {tx.description || meta.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        {new Date(tx.createdAt).toLocaleDateString('fr-BJ', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })} · <span style={{ color: statusMeta.color }}>{statusMeta.label}</span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 800,
                      color: isCredit ? '#15803D' : '#B91C1C',
                      flexShrink: 0,
                    }}>
                      {isCredit ? '+' : ''}{formatXOF(Math.abs(tx.amountCents))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Change Password */}
        <button
          onClick={() => setShowPasswordModal(true)}
          className="btn-press"
          style={{
            width: '100%', height: 50,
            background: 'white', border: '1.5px solid #E5E7EB',
            borderRadius: 12, color: '#374151',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 16,
          }}
        >
          <Settings size={16} />
          Changer mon mot de passe
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="btn-press"
          style={{
            width: '100%', height: 50,
            background: 'white', border: '1.5px solid #FCA5A5',
            borderRadius: 12, color: '#DC2626',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 12,
          }}
        >
          <LogOut size={16} />
          Se déconnecter
        </button>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
