'use client';
import { useEffect, useState } from 'react';
import { Loader2, Zap, Clock, CheckCircle } from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '@/lib/store';
import { apiGetMyPurchases, apiWork } from '@/lib/api';
import { formatXOF, formatCountdown, workRevenueCents } from '@/lib/data';
import type { UserPurchase } from '@/lib/data';

// ─── Countdown timer hook ──────────────────────────────────────────────────────
function useCountdown(nextAllowedAt: Date | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!nextAllowedAt) return;
    const calc = () => Math.max(0, new Date(nextAllowedAt).getTime() - Date.now());
    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(interval);
  }, [nextAllowedAt]);

  return remaining;
}

// ─── Individual Purchase Card ──────────────────────────────────────────────────
function PurchaseCard({ purchase }: { purchase: UserPurchase }) {
  const { user, updateBalance } = useAuthStore();
  const { updatePurchase, addTransaction } = useAppStore();
  const { showToast } = useUIStore();
  const [working, setWorking] = useState(false);
  const [earned, setEarned] = useState<number | null>(null);

  const nextAllowedAt = purchase.nextAllowedAt ? new Date(purchase.nextAllowedAt) : null;
  const remaining = useCountdown(nextAllowedAt);
  const canWork = remaining === 0 && purchase.status === 'ACTIVE';

  const expiresAt = new Date(purchase.expiresAt);
  const purchasedAt = new Date(purchase.purchasedAt);
  const totalDays = 45;
  const daysElapsed = Math.floor((Date.now() - purchasedAt.getTime()) / (1000 * 60 * 60 * 24));
  const progressPct = Math.min((purchase.totalEarnedCents / (workRevenueCents(purchase.pricePaidCents) * totalDays * 3)) * 100, 100);

  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const isPending = purchase.status === 'PENDING';
  const isExpired = purchase.status === 'EXPIRED' || (!isPending && daysLeft === 0);

  async function handleWork() {
    if (!user || !canWork || working) return;
    setWorking(true);
    setEarned(null);
    try {
      const { earnedCents, newBalanceCents, nextAllowedAt: next } = await apiWork(user.id, purchase.id);
      updateBalance(newBalanceCents);
      updatePurchase(purchase.id, {
        lastWorkedAt: new Date(),
        nextAllowedAt: new Date(next),
        totalEarnedCents: purchase.totalEarnedCents + earnedCents,
        workCount: purchase.workCount + 1,
      });
      setEarned(earnedCents);
      setTimeout(() => setEarned(null), 3000);
      showToast(`+${formatXOF(earnedCents)} crédité !`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="bot-card card-hover fade-in" style={{
      opacity: isExpired ? 0.7 : 1,
      borderColor: isPending ? '#FCD34D' : (isExpired ? '#E5E7EB' : '#BFDBFE'),
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, border: '1.5px solid #BFDBFE',
          }}>🤖</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', fontFamily: 'Space Grotesk, sans-serif' }}>
              {purchase.botName}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
              Acheté le {new Date(purchase.purchasedAt).toLocaleDateString('fr-BJ')}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className={isPending ? 'badge-expired' : (isExpired ? 'badge-expired' : 'badge-active')} style={{
          padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
          background: isPending ? '#FEF3C7' : undefined,
          color: isPending ? '#D97706' : undefined,
          border: isPending ? '1px solid #FDE68A' : undefined,
        }}>
          {isPending ? '⏳ EN ATTENTE' : (isExpired ? '⛔ EXPIRÉ' : `✅ ${daysLeft}j restants`)}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8, marginBottom: 14,
      }}>
        {[
          ['Gain/clic', formatXOF(workRevenueCents(purchase.pricePaidCents))],
          ['Total gagné', formatXOF(purchase.totalEarnedCents)],
          ['Nb. activations', String(purchase.workCount)],
        ].map(([label, value]) => (
          <div key={label} style={{
            background: '#F9FAFB', borderRadius: 10, padding: '8px 10px',
            border: '1px solid #F3F4F6', textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{value}</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Progression</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#1A56DB' }}>
            {progressPct.toFixed(1)}%
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Work button / Pending notice */}
      {isPending ? (
        <div style={{
          background: '#FFFBEB', border: '1.5px solid #FDE68A',
          borderRadius: 12, padding: '12px 14px', color: '#B45309',
          fontSize: 12, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <span style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            ⏳ En attente de validation
          </span>
          <span>Opérateur: <strong>{purchase.operator}</strong></span>
          <span>Réf transaction: <strong>{purchase.txReference}</strong></span>
          <span style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
            Notre équipe vérifie votre paiement Mobile Money. Ce bot sera activé sous 24h dès validation de la transaction.
          </span>
        </div>
      ) : !isExpired && (
        <>
          {canWork ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={handleWork}
                disabled={working}
                className={`btn-press ${!working ? 'pulse-blue' : ''}`}
                style={{
                  width: '100%', height: 52,
                  background: working ? '#93C5FD' : 'linear-gradient(135deg, #1A56DB, #2563EB)',
                  color: 'white', border: 'none', borderRadius: 12,
                  fontSize: 16, fontWeight: 800, cursor: working ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                {working
                  ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Traitement...</>
                  : <><Zap size={18} /> Travailler — +{formatXOF(workRevenueCents(purchase.pricePaidCents))}</>
                }
              </button>
              {earned !== null && (
                <div className="coin-drop" style={{
                  position: 'absolute', top: -36, left: '50%', transform: 'translateX(-50%)',
                  background: '#DCFCE7', color: '#15803D',
                  padding: '6px 16px', borderRadius: 99,
                  fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap',
                  border: '1.5px solid #86EFAC',
                }}>
                  +{formatXOF(earned)} 🎉
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: '#F9FAFB', border: '1.5px solid #E5E7EB',
              borderRadius: 12, padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="#9CA3AF" />
                <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
                  Disponible dans
                </span>
              </div>
              <div className="tick-tock" style={{
                fontSize: 16, fontWeight: 800, color: '#1A56DB',
                fontFamily: 'monospace', letterSpacing: 1,
              }}>
                {formatCountdown(remaining)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Mes Produits Page ─────────────────────────────────────────────────────────
export default function ProductsPage() {
  const { user } = useAuthStore();
  const { purchases, setPurchases } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiGetMyPurchases(user.id).then(data => {
      setPurchases(data);
      setLoading(false);
    });
  }, [user, setPurchases]);

  const active = purchases.filter(p => p.status === 'ACTIVE');
  const pending = purchases.filter(p => p.status === 'PENDING');
  const expired = purchases.filter(p => p.status === 'EXPIRED');

  return (
    <div className="main-content">
      {/* Header */}
      <header className="page-header">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
            Mes Produits
          </h1>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
            {active.length} actif{active.length !== 1 ? 's' : ''} · {pending.length} en attente · {expired.length} expiré{expired.length !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} color="#1A56DB" style={{ animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : purchases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🤖</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
            Aucun bot acheté
          </h2>
          <p style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 20px' }}>
            Achetez votre premier bot pour commencer à générer des revenus !
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <div style={{ margin: '8px 16px 12px', fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>
                Demandes d'achats en attente
              </div>
              {pending.map(p => <PurchaseCard key={p.id} purchase={p} />)}
            </>
          )}
          {active.length > 0 && (
            <>
              {pending.length > 0 && (
                <div style={{ margin: '16px 16px 12px', fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>
                  Bots actifs
                </div>
              )}
              {active.map(p => <PurchaseCard key={p.id} purchase={p} />)}
            </>
          )}
          {expired.length > 0 && (
            <>
              <div style={{ margin: '16px 16px 12px', fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>
                Bots expirés
              </div>
              {expired.map(p => <PurchaseCard key={p.id} purchase={p} />)}
            </>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
