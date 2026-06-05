'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bell, ArrowUpRight, ArrowDownLeft, UserPlus, ChevronRight, Loader2, X } from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '@/lib/store';
import { apiGetBots, apiPurchaseBot, apiDeposit, apiWithdraw, apiGetBotPaymentConfigs } from '@/lib/api';
import { formatXOF, Bot, MIN_WITHDRAWAL_CENTS, BotPaymentConfig } from '@/lib/data';

// ─── Deposit Modal ─────────────────────────────────────────────────────────────
function DepositModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<'mtn' | 'moov'>('mtn');
  const [amount, setAmount] = useState('');
  const [info, setInfo] = useState<{ ssdCode: string; phone: string } | null>(null);

  async function handleShow() {
    const data = await apiDeposit(provider);
    setInfo(data);
  }

  const finalCode = info ? info.ssdCode.replace('MONTANT', amount || 'XXXX').replace('CODE', '2024') : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', fontFamily: 'Space Grotesk, sans-serif' }}>
          Recharger mon compte
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 20px' }}>
          Choisissez votre opérateur Mobile Money
        </p>

        {/* Provider selector */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {(['mtn', 'moov'] as const).map(p => (
            <button key={p} onClick={() => { setProvider(p); setInfo(null); }} style={{
              flex: 1, height: 52,
              background: provider === p ? '#EFF6FF' : '#F9FAFB',
              border: `2px solid ${provider === p ? '#1A56DB' : '#E5E7EB'}`,
              borderRadius: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 14, fontWeight: 700,
              color: provider === p ? '#1A56DB' : '#374151',
            }}>
              <span style={{ fontSize: 20 }}>{p === 'mtn' ? '🟡' : '🔵'}</span>
              {p === 'mtn' ? 'MTN MoMo' : 'Moov Money'}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Montant (XOF)
          </label>
          <input
            className="input-field" type="number"
            placeholder="Ex: 10000" value={amount}
            onChange={e => { setAmount(e.target.value); setInfo(null); }}
            inputMode="numeric"
          />
        </div>

        <button onClick={handleShow} className="btn-press" style={{
          width: '100%', height: 52,
          background: 'linear-gradient(135deg, #1A56DB, #1D4ED8)',
          color: 'white', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 16,
        }}>
          Générer le code de paiement
        </button>

        {info && (
          <div className="fade-in" style={{
            background: '#EFF6FF', border: '1.5px solid #BFDBFE',
            borderRadius: 14, padding: 16,
          }}>
            <p style={{ fontSize: 13, color: '#1D4ED8', fontWeight: 600, margin: '0 0 8px' }}>
              📱 Composez ce code sur votre téléphone {provider.toUpperCase()} :
            </p>
            <div style={{
              background: 'white', borderRadius: 10, padding: '12px 16px',
              fontFamily: 'monospace', fontSize: 20, fontWeight: 800,
              color: '#1A56DB', letterSpacing: 1, textAlign: 'center',
              border: '1.5px solid #BFDBFE', marginBottom: 10,
            }}>{finalCode}</div>
            <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>
              ⚠️ Remplacez <strong>MONTANT</strong> par votre montant exact en XOF. Votre solde sera mis à jour après validation par l'administrateur sous 24h.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Withdraw Modal ────────────────────────────────────────────────────────────
function WithdrawModal({ onClose, balanceCents }: { onClose: () => void; balanceCents: number }) {
  const { user, updateBalance } = useAuthStore();
  const { addTransaction } = useAppStore();
  const { showToast } = useUIStore();
  const [provider, setProvider] = useState<'mtn' | 'moov'>('mtn');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleWithdraw() {
    setError('');
    const cents = parseInt(amount) * 100;
    if (!amount || cents < MIN_WITHDRAWAL_CENTS) { setError(`Minimum ${formatXOF(MIN_WITHDRAWAL_CENTS)}`); return; }
    if (cents > balanceCents) { setError('Solde insuffisant'); return; }
    if (!phone) { setError('Entrez votre numéro Mobile Money'); return; }
    setLoading(true);
    try {
      const { newBalanceCents, transaction } = await apiWithdraw(user!.id, cents, provider.toUpperCase(), '+229' + phone);
      updateBalance(newBalanceCents);
      addTransaction(transaction);
      showToast('Demande de retrait envoyée !', 'success');
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
          Retirer des fonds
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 6px' }}>
          Solde disponible: <strong style={{ color: '#1A56DB' }}>{formatXOF(balanceCents)}</strong>
        </p>
        <p style={{ color: '#9CA3AF', fontSize: 12, margin: '0 0 20px' }}>
          Minimum: {formatXOF(MIN_WITHDRAWAL_CENTS)} · Traitement 24-48h
        </p>

        {/* Provider */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {(['mtn', 'moov'] as const).map(p => (
            <button key={p} onClick={() => setProvider(p)} style={{
              flex: 1, height: 48,
              background: provider === p ? '#EFF6FF' : '#F9FAFB',
              border: `2px solid ${provider === p ? '#1A56DB' : '#E5E7EB'}`,
              borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              color: provider === p ? '#1A56DB' : '#374151',
            }}>
              {p === 'mtn' ? '🟡 MTN' : '🔵 Moov'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input-field" type="number"
            placeholder={`Montant en XOF (min 3 000)`}
            value={amount} onChange={e => setAmount(e.target.value)}
            inputMode="numeric"
          />
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, fontWeight: 600, color: '#374151',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>🇧🇯</span> +229
              <div style={{ width: 1, height: 16, background: '#E5E7EB' }} />
            </div>
            <input
              className="input-field" type="tel"
              placeholder="XX XX XX XX"
              value={phone} onChange={e => setPhone(e.target.value)}
              style={{ paddingLeft: 90 }} inputMode="numeric"
            />
          </div>

          {error && (
            <div style={{
              background: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
              borderRadius: 10, fontSize: 13, fontWeight: 500,
            }}>⚠️ {error}</div>
          )}

          <button onClick={handleWithdraw} className="btn-press" disabled={loading} style={{
            height: 52, background: loading ? '#93C5FD' : 'linear-gradient(135deg, #1A56DB, #1D4ED8)',
            color: 'white', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {loading ? <><Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Traitement...</> : 'Demander le retrait'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Purchase Confirm Modal (SSD Codes) ──────────────────────────────────────────
function PurchaseModal({ bot, onClose, onConfirm }: {
  bot: Bot; onClose: () => void; onConfirm: (operator: 'MTN' | 'MOOV', ref: string) => void;
}) {
  const [provider, setProvider] = useState<'mtn' | 'moov'>('mtn');
  const [txRef, setTxRef] = useState('');
  const [configs, setConfigs] = useState<BotPaymentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGetBotPaymentConfigs().then(cfg => {
      setConfigs(cfg);
      setLoading(false);
    });
  }, []);

  const config = configs.find(c => c.botId === bot.id);
  const mtnCode = config?.ssdCodeMTN || `*880*1*${bot.priceCents / 100}*97001122#`;
  const moovCode = config?.ssdCodeMoov || `*155*1*${bot.priceCents / 100}*95001122#`;
  const mtnPhone = config?.merchantPhoneMTN || '97001122';
  const moovPhone = config?.merchantPhoneMoov || '95001122';

  const selectedCode = provider === 'mtn' ? mtnCode : moovCode;
  const selectedPhone = provider === 'mtn' ? mtnPhone : moovPhone;

  function handleSubmit() {
    if (!txRef.trim()) {
      setError('Veuillez entrer la référence de transaction');
      return;
    }
    onConfirm(provider.toUpperCase() as 'MTN' | 'MOOV', txRef.trim());
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()} style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', fontFamily: 'Space Grotesk, sans-serif' }}>
          Activer {bot.name}
        </h2>
        <p style={{ color: '#6B7280', fontSize: 12, margin: '0 0 16px' }}>
          Sélectionnez votre opérateur Mobile Money pour payer {formatXOF(bot.priceCents)}
        </p>

        {/* Operator Choice */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {(['mtn', 'moov'] as const).map(p => (
            <button key={p} onClick={() => setProvider(p)} style={{
              flex: 1, height: 48,
              background: provider === p ? '#EFF6FF' : '#F9FAFB',
              border: `2px solid ${provider === p ? '#1A56DB' : '#E5E7EB'}`,
              borderRadius: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 13, fontWeight: 700,
              color: provider === p ? '#1A56DB' : '#374151',
            }}>
              <span style={{ fontSize: 16 }}>{p === 'mtn' ? '🟡' : '🔵'}</span>
              {p === 'mtn' ? 'MTN' : 'Moov'}
            </button>
          ))}
        </div>

        {/* Payment info card */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <Loader2 size={24} color="#1A56DB" style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div style={{
            background: '#F9FAFB', border: '1.5px solid #E5E7EB',
            borderRadius: 14, padding: 14, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: '#6B7280' }}>Numéro marchand :</span>
              <span style={{ fontWeight: 700, color: '#111827' }}>+229 {selectedPhone}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: '#6B7280' }}>Montant :</span>
              <span style={{ fontWeight: 700, color: '#1A56DB' }}>{formatXOF(bot.priceCents)}</span>
            </div>
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>
                📱 Code SSD à composer sur votre téléphone :
              </span>
              <div style={{
                background: 'white', borderRadius: 8, padding: '10px',
                fontFamily: 'monospace', fontSize: 16, fontWeight: 800,
                color: '#1A56DB', letterSpacing: 0.5, textAlign: 'center',
                border: '1.5px solid #BFDBFE',
              }}>{selectedCode}</div>
            </div>
          </div>
        )}

        {/* Transaction ID input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            ID / Référence de transaction Mobile Money
          </label>
          <input
            className="input-field"
            placeholder="Ex: 837492837 ou Ref. MoMo"
            value={txRef}
            onChange={e => { setTxRef(e.target.value); setError(''); }}
          />
        </div>

        {error && (
          <div style={{
            background: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
            borderRadius: 10, fontSize: 12, fontWeight: 500, marginBottom: 16,
          }}>⚠️ {error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, height: 48, background: '#F3F4F6', border: '1px solid #E5E7EB',
            borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151',
          }}>Annuler</button>
          <button
            onClick={handleSubmit}
            className="btn-press"
            style={{
              flex: 2, height: 48,
              background: 'linear-gradient(135deg, #1A56DB, #1D4ED8)',
              color: 'white', border: 'none', borderRadius: 12,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Déclarer le paiement
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bot Card ──────────────────────────────────────────────────────────────────
function BotCard({ bot, onBuy }: { bot: Bot; onBuy: () => void }) {
  return (
    <div className="bot-card card-hover fade-in">
      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        {/* Robot image */}
        <div style={{
          width: 72, height: 72, borderRadius: 12, overflow: 'hidden',
          background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid #BFDBFE', fontSize: 36,
        }}>🤖</div>

        {/* Stats */}
        <div style={{ flex: 1 }}>
          {[
            ['Revenu du travail', formatXOF(bot.workRevenueCents), '#1A56DB'],
            ['Revenus quotidiens', formatXOF(bot.dailyRevenueCents), '#1A56DB'],
            ['Période de validité', '45 jours', '#374151'],
            ['Prix', formatXOF(bot.priceCents), '#374151'],
          ].map(([label, value, color]) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              marginBottom: 3,
            }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          background: '#EFF6FF', color: '#1A56DB',
          padding: '4px 12px', borderRadius: 99, fontSize: 13, fontWeight: 800,
          border: '1.5px solid #BFDBFE', fontFamily: 'Space Grotesk, sans-serif',
        }}>{bot.name}</div>
        <button onClick={onBuy} className="btn-press" style={{
          flex: 1, marginLeft: 10, height: 40,
          background: 'linear-gradient(135deg, #1A56DB, #2563EB)',
          color: 'white', border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Space Grotesk, sans-serif',
        }}>Acheter</button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const { user, updateBalance } = useAuthStore();
  const { addPurchase, addTransaction } = useAppStore();
  const { showToast } = useUIStore();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loadingBots, setLoadingBots] = useState(true);
  const [modal, setModal] = useState<null | 'deposit' | 'withdraw' | { type: 'buy'; bot: Bot }>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    apiGetBots().then(b => { setBots(b as Bot[]); setLoadingBots(false); });
  }, []);

  async function handleBuy(bot: Bot, operator: 'MTN' | 'MOOV', txReference: string) {
    if (!user) return;
    setBuying(true);
    try {
      const { purchase, newBalanceCents } = await apiPurchaseBot(user.id, bot.id, operator, txReference);
      updateBalance(newBalanceCents);
      addPurchase(purchase);
      setModal(null);
      showToast(`✅ Demande d'achat pour ${bot.name} envoyée !`, 'success');
      router.push('/products');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="main-content">
      {/* Header */}
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{
            width: 32, height: 32, background: '#1A56DB', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <Image src="/logo.png" alt="Logo" width={32} height={32} style={{ objectFit: 'cover' }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
            WINARY AI
          </span>
        </div>
        <button style={{
          background: '#F3F4F6', border: '1px solid #E5E7EB',
          borderRadius: '50%', width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#374151',
        }}>
          <Bell size={18} />
        </button>
      </header>

      {/* Hero Banner */}
      <div className="hero-banner" style={{ padding: '20px 20px 28px', marginBottom: 20 }}>
        <div style={{ color: 'white' }}>
          <p style={{ fontSize: 13, opacity: 0.8, margin: '0 0 2px' }}>Bonjour 👋</p>
          <h2 style={{
            fontSize: 22, fontWeight: 800, margin: '0 0 4px',
            fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.5px',
          }}>BIENVENUE CHEZ<br />WINARY AI !</h2>
          <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>{user?.phone}</p>
        </div>
      </div>

      {/* Balance Card */}
      <div className="balance-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 12, opacity: 0.7, margin: '0 0 4px', fontWeight: 500 }}>
              Solde Total
            </p>
            <div style={{
              fontSize: 28, fontWeight: 800,
              fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-1px',
            }}>
              {formatXOF(user?.balanceCents || 0)}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 12, padding: '6px 12px',
            fontSize: 12, fontWeight: 600, color: 'white',
          }}>💳 Solde</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 10, margin: '0 16px 24px' }}>
        <button className="action-btn" onClick={() => setModal('deposit')}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowUpRight size={20} color="#1A56DB" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Recharger</span>
        </button>
        <button className="action-btn" onClick={() => setModal('withdraw')}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowDownLeft size={20} color="#16A34A" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Retrait</span>
        </button>
        <button className="action-btn" onClick={() => router.push('/invite')}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UserPlus size={20} color="#D97706" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Inviter</span>
        </button>
      </div>

      {/* Bots Section */}
      <div style={{ margin: '0 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#111827' }}>
          Nos Bots Disponibles
        </h3>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>6 bots</span>
      </div>

      {loadingBots ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Loader2 size={28} color="#1A56DB" style={{ animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} onBuy={() => setModal({ type: 'buy', bot })} />
        ))
      )}

      {/* Modals */}
      {modal === 'deposit' && <DepositModal onClose={() => setModal(null)} />}
      {modal === 'withdraw' && (
        <WithdrawModal onClose={() => setModal(null)} balanceCents={user?.balanceCents || 0} />
      )}
      {modal && typeof modal === 'object' && modal.type === 'buy' && (
        <PurchaseModal
          bot={modal.bot}
          onClose={() => setModal(null)}
          onConfirm={(operator, ref) => handleBuy(modal.bot, operator, ref)}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
