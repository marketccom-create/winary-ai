'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bell, ArrowUpRight, ArrowDownLeft, BookOpen, MessageCircle, ChevronRight, Loader2, X } from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '@/lib/store';
import { apiGetBots, apiGetBotPaymentConfigs, apiPurchaseBot, apiWithdraw, apiInitiateDeposit, apiGetUnreadChatCount } from '@/lib/api';
import { formatXOF, Bot, BotPaymentConfig, MIN_WITHDRAWAL_CENTS, detectCountryFromPhone, getBotPromo, formatCountdown, GAM_4_PROMO, validateTransactionReference, extractAndValidateReference } from '@/lib/data';

// ─── Promo Countdown Hook ───────────────────────────────────────────────────────
function usePromoTimer(targetTimeIso: string | null | undefined) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!targetTimeIso) {
      setRemainingMs(0);
      return;
    }
    const targetMs = new Date(targetTimeIso).getTime();
    const update = () => {
      setRemainingMs(Math.max(0, targetMs - Date.now()));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTimeIso]);

  return remainingMs;
}

// ─── Gam 4 Promo Banner ─────────────────────────────────────────────────────────
function Gam4PromoBanner({ bot, onBuy }: { bot?: Bot; onBuy: (bot: Bot) => void }) {
  const promo = getBotPromo('gam-4');
  const isActive = promo?.status === 'ACTIVE';
  const isUpcoming = promo?.status === 'UPCOMING';

  const targetIso = isActive ? promo?.endTime : (isUpcoming ? promo?.startTime : null);
  const remainingMs = usePromoTimer(targetIso);

  if (!isActive && !isUpcoming) return null;

  return (
    <div className="promo-banner fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="promo-flame-icon" style={{ fontSize: 24 }}>🔥</span>
          <span style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Space Grotesk, sans-serif' }}>
            {isActive ? 'VENTE FLASH : GAM 4' : 'PROMO GAM 4 BIENTÔT !'}
          </span>
        </div>
        <div className="promo-badge-pulse" style={{
          background: '#FEF08A', color: '#854D0E',
          padding: '3px 10px', borderRadius: 99,
          fontSize: 11, fontWeight: 800, border: '1px solid #FDE047'
        }}>
          -37.5% OFF
        </div>
      </div>

      <p style={{ fontSize: 12, opacity: 0.95, margin: '0 0 12px', lineHeight: 1.4 }}>
        {isActive
          ? 'Profitez d\'une réduction exceptionnelle sur le bot Gam 4 avant la fin du temps imparti !'
          : 'La promotion sur le bot Gam 4 commence très bientôt à 08h00 !'}
      </p>

      {/* Pricing & Countdown Row */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(8px)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.8, fontWeight: 600 }}>Prix promotionnel</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <span className="strike-price" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 13, textDecoration: 'line-through' }}>
              80 000 XOF
            </span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#FEF08A', fontFamily: 'Space Grotesk, sans-serif' }}>
              50 000 XOF
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>
            {isActive ? 'Temps restant' : 'Démarre dans'}
          </div>
          <div style={{
            fontSize: 18, fontWeight: 900, fontFamily: 'monospace',
            letterSpacing: 1, color: '#FFFFFF', marginTop: 2,
            background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 6
          }}>
            {formatCountdown(remainingMs)}
          </div>
        </div>
      </div>

      {bot && isActive && (
        <button
          onClick={() => onBuy(bot)}
          className="btn-press"
          style={{
            width: '100%', height: 44,
            background: 'linear-gradient(135deg, #FEF08A, #FACC15)',
            color: '#713F12', border: 'none', borderRadius: 12,
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'Space Grotesk, sans-serif',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
          }}
        >
          <span>🔥 PROFITER DE L'OFFRE (50 000 XOF)</span>
        </button>
      )}

      {isUpcoming && (
        <div style={{
          width: '100%', height: 44,
          background: 'rgba(0,0,0,0.25)',
          border: '1.5px dashed rgba(255,255,255,0.4)',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 700,
          fontFamily: 'Space Grotesk, sans-serif',
          cursor: 'not-allowed',
        }}>
          ⏳ Disponible dès 08h00 — encore {formatCountdown(remainingMs)}
        </div>
      )}

    </div>
  );
}

// ─── Deposit Modal ─────────────────────────────────────────────────────────────
// (DepositModal unchanged)

// ─── Purchase Confirm Modal (Winpay USSD & Balance) ─────────────────────────
function PurchaseModal({ bot, balanceCents, botConfigs, isWinpayActive, onClose, onConfirm, buying }: {
  bot: Bot;
  balanceCents: number;
  botConfigs: BotPaymentConfig[];
  isWinpayActive: boolean;
  onClose: () => void;
  onConfirm: (bot: Bot, method: string, txRef: string, operator: string) => void;
  buying: boolean;
}) {
  const { showToast } = useUIStore();
  const [method, setMethod] = useState<'balance' | 'winpay'>(
    balanceCents >= bot.priceCents ? 'balance' : 'winpay'
  );
  const [selectedOperator, setSelectedOperator] = useState<'MTN' | 'MOOV' | 'ORANGE' | 'WAVE'>('MTN');
  const [phoneSender, setPhoneSender] = useState('');
  const [txRef, setTxRef] = useState('');
  const [winpayStep, setWinpayStep] = useState<'SELECT' | 'PHONE' | 'REF'>('SELECT');

  const botCfg = botConfigs.find(c => c.botId === bot.id);
  const priceFormatted = formatXOF(bot.priceCents);

  // Compute USSD Code for selected operator & bot using exact user formulas
  function getUssdCode() {
    const amountNumber = Math.round(bot.priceCents / 100);
    const defaultMtnCode = `*880*1*3*1*4*22646410950*${amountNumber}*1#`;
    const defaultMoovCode = `*855*1*1*3*2*22646410950*22646410950*${amountNumber}#`;

    if (selectedOperator === 'MTN') {
      const code = botCfg?.ssdCodeMTN?.trim();
      if (code && code.includes('22646410950')) return code;
      return defaultMtnCode;
    }
    const code = botCfg?.ssdCodeMoov?.trim();
    if (code && code.includes('22646410950')) return code;
    return defaultMoovCode;
  }

  const ussdCode = getUssdCode();

  function handleDial() {
    const cleanTel = ussdCode.replace(/#/g, '%23');
    window.location.href = `tel:${cleanTel}`;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()} style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
            Activer {bot.name}
          </h2>
          {bot.isPromo && (
            <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, border: '1px solid #FCA5A5' }}>
              🔥 PROMO FLASH
            </span>
          )}
        </div>

        <p style={{ color: '#6B7280', fontSize: 12, margin: '0 0 16px' }}>
          Tarif d'activation : <strong style={{ color: '#1A56DB', fontSize: 14 }}>{priceFormatted}</strong>
        </p>

        {winpayStep === 'SELECT' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {/* Balance Payment (if user has enough) */}
              <button
                onClick={() => setMethod('balance')}
                disabled={balanceCents < bot.priceCents}
                style={{
                  width: '100%', height: 56,
                  background: method === 'balance' ? '#EFF6FF' : '#F9FAFB',
                  border: `2px solid ${method === 'balance' ? '#1A56DB' : '#E5E7EB'}`,
                  borderRadius: 12, cursor: balanceCents < bot.priceCents ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
                  opacity: balanceCents < bot.priceCents ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>💳</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Payer avec mon solde</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>Disponible: {formatXOF(balanceCents)}</div>
                  </div>
                </div>
                {method === 'balance' && <span style={{ color: '#1A56DB', fontWeight: 'bold' }}>✓</span>}
              </button>

              {/* Winpay USSD Checkout */}
              <button
                onClick={() => setMethod('winpay')}
                style={{
                  width: '100%', height: 56,
                  background: method === 'winpay' ? '#EFF6FF' : '#F9FAFB',
                  border: `2px solid ${method === 'winpay' ? '#1A56DB' : '#E5E7EB'}`,
                  borderRadius: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>⚡</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Winpay
                      {!isWinpayActive ? (
                        <span style={{ fontSize: 10, background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                          🛠️ Maintenance
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                          ⚡ Instantané
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>MTN MoMo, Moov Money</div>
                  </div>
                </div>
                {method === 'winpay' && <span style={{ color: '#1A56DB', fontWeight: 'bold' }}>✓</span>}
              </button>

              {/* Sene-Pay (Désactivé & Grisé jusqu'à nouvel ordre) */}
              <button
                disabled={true}
                style={{
                  width: '100%', height: 56,
                  background: '#F3F4F6',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: 12, cursor: 'not-allowed', opacity: 0.55,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>💳</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Sene-Pay (Direct)
                      <span style={{ fontSize: 10, background: '#E5E7EB', color: '#6B7280', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                        🔒 Indisponible
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Temporairement désactivé</div>
                  </div>
                </div>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{
                flex: 1, height: 48, background: '#F3F4F6', border: '1px solid #E5E7EB',
                borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151',
              }}>Annuler</button>

              <button
                onClick={() => {
                  if (method === 'balance') {
                    onConfirm(bot, 'BALANCE', '', 'BALANCE');
                  } else {
                    if (!isWinpayActive) {
                      alert('Le système de paiement Winpay est actuellement en maintenance temporaire. Veuillez recharger votre solde via le Support Client.');
                      return;
                    }
                    setWinpayStep('PHONE');
                  }
                }}
                className="btn-press"
                disabled={buying}
                style={{
                  flex: 2, height: 48,
                  background: buying ? '#93C5FD' : (bot.isPromo ? 'linear-gradient(135deg, #DC2626, #EA580C)' : 'linear-gradient(135deg, #1A56DB, #1D4ED8)'),
                  color: 'white', border: 'none', borderRadius: 12,
                  fontSize: 13, fontWeight: 700, cursor: buying ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                {buying ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : (method === 'balance' ? `Payer ${priceFormatted}` : 'Continuer')}
              </button>
            </div>
          </>
        ) : winpayStep === 'PHONE' ? (
          /* Step 2: Winpay Operator & Phone Number Input */
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                1. Choisissez votre réseau Mobile Money :
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  { id: 'MTN', name: 'MTN MoMo', icon: '🟡' },
                  { id: 'MOOV', name: 'Moov Money', icon: '🔵' },
                ].map(op => (
                  <button
                    key={op.id}
                    onClick={() => setSelectedOperator(op.id as any)}
                    style={{
                      padding: '12px 8px', borderRadius: 12,
                      border: selectedOperator === op.id ? '2px solid #1A56DB' : '1.5px solid #E5E7EB',
                      background: selectedOperator === op.id ? '#EFF6FF' : '#F9FAFB',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{op.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: selectedOperator === op.id ? '#1A56DB' : '#374151' }}>{op.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Phone sender FIRST */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                2. Entrez votre N° de téléphone expéditeur :
              </label>
              <input
                className="input-field"
                placeholder="Ex: 97000000 ou +22997000000"
                value={phoneSender}
                onChange={e => setPhoneSender(e.target.value)}
                style={{ fontSize: 14, background: '#FFFFFF', border: '1.5px solid #CBD5E1', padding: '12px 14px' }}
              />
            </div>

            {/* Actions: Return & Payer button WITHOUT phone icon */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setWinpayStep('SELECT')} style={{
                flex: 1, height: 50, background: '#F3F4F6', border: '1px solid #E5E7EB',
                borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151',
              }}>Retour</button>

              <button
                onClick={() => {
                  if (!phoneSender.trim() || phoneSender.trim().length < 8) {
                    alert('Veuillez entrer un numéro de téléphone expéditeur valide (minimum 8 chiffres).');
                    return;
                  }
                  handleDial();
                  setWinpayStep('REF');
                }}
                className="btn-press"
                style={{
                  flex: 2, height: 50,
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: 'white', border: 'none', borderRadius: 12,
                  fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                Payer {priceFormatted}
              </button>
            </div>
          </div>
        ) : (
          /* Step 3: Winpay Full SMS Copy-Paste Entry & Automatic Validation */
          <div>
            <div style={{
              background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14,
              padding: 14, marginBottom: 14, textAlign: 'left'
            }}>
              <div style={{ fontSize: 12, color: '#1E40AF', fontWeight: 700, marginBottom: 2 }}>
                📲 Appel USSD déclenché ({selectedOperator})
              </div>
              <div style={{ fontSize: 11, color: '#3B82F6' }}>
                Numéro expéditeur : <strong>{phoneSender}</strong>
              </div>
            </div>

            {/* Full SMS input box */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                📩 Collez ici le message SMS complet reçu de {selectedOperator} :
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder={`Collez l'intégralité du SMS reçu de ${selectedOperator}\n(Ex: Paiement 1000F a ONAFRIQ... ID:12528949034 Ref:22654996164)`}
                value={txRef}
                onChange={e => setTxRef(e.target.value)}
                style={{ fontSize: 13, background: '#FFFFFF', border: '1.5px solid #CBD5E1', padding: '12px 14px', width: '100%', resize: 'none' }}
              />
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 4, display: 'block' }}>
                💡 Astuce : Copiez tout le SMS de confirmation reçu de votre opérateur et collez-le directement ici !
              </span>
            </div>

            {/* Actions: Back to Phone & Validate Payment */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setWinpayStep('PHONE')} style={{
                flex: 1, height: 50, background: '#F3F4F6', border: '1px solid #E5E7EB',
                borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151',
              }}>Retour</button>

              <button
                onClick={() => {
                  const check = extractAndValidateReference(selectedOperator, txRef, bot.priceCents);
                  if (!check.isValid) {
                    showToast(`❌ ${check.reason || 'Message, montant ou ID de transaction incorrect.'} Paiement non abouti.`, 'error');
                    return;
                  }
                  onConfirm(bot, 'WINPAY', check.extractedRef || txRef.trim(), selectedOperator);
                }}
                className="btn-press"
                disabled={buying}
                style={{
                  flex: 2, height: 50,
                  background: buying ? '#93C5FD' : 'linear-gradient(135deg, #1A56DB, #1D4ED8)',
                  color: 'white', border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 800, cursor: buying ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(26, 86, 219, 0.3)'
                }}
              >
                {buying ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : 'Valider mon paiement'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bot Card ──────────────────────────────────────────────────────────────────
function BotCard({ bot, onBuy }: { bot: Bot; onBuy: () => void }) {
  const isPromo = bot.isPromo || (bot.id === 'gam-4' && getBotPromo('gam-4')?.status === 'ACTIVE');
  const promo = getBotPromo(bot.id);
  const remainingMs = usePromoTimer(isPromo ? promo?.endTime : null);

  return (
    <div className={`bot-card card-hover fade-in ${isPromo ? 'promo-card-glow' : ''}`} style={{ position: 'relative' }}>
      {isPromo && (
        <div className="promo-badge-pulse" style={{
          position: 'absolute', top: 12, right: 12,
          background: 'linear-gradient(135deg, #DC2626, #EA580C)',
          color: 'white', fontSize: 10, fontWeight: 800,
          padding: '4px 10px', borderRadius: 99,
          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
          display: 'flex', alignItems: 'center', gap: 4
        }}>
          <span>🔥</span> PROMO -37.5%
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        {/* Robot image */}
        <div style={{
          width: 72, height: 72, borderRadius: 12, overflow: 'hidden',
          background: isPromo ? 'linear-gradient(135deg, #FEF2F2, #FEE2E2)' : 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: isPromo ? '1.5px solid #FCA5A5' : '1.5px solid #BFDBFE', fontSize: 36,
        }}>🤖</div>

        {/* Stats */}
        <div style={{ flex: 1, paddingRight: isPromo ? 60 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Revenu du travail</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1A56DB' }}>{formatXOF(bot.workRevenueCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Revenus quotidiens</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1A56DB' }}>{formatXOF(bot.dailyRevenueCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Période de validité</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>45 jours</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>Prix</span>
            <div>
              {isPromo && bot.originalPriceCents && (
                <span className="strike-price" style={{ marginRight: 6 }}>
                  {formatXOF(bot.originalPriceCents)}
                </span>
              )}
              <span style={{ fontSize: 13, fontWeight: 800, color: isPromo ? '#DC2626' : '#374151' }}>
                {formatXOF(bot.priceCents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown sub-bar inside card if promo is active */}
      {isPromo && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: 8, padding: '6px 10px', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11
        }}>
          <span style={{ color: '#991B1B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>⏳</span> Fin de l'offre dans :
          </span>
          <span style={{ color: '#DC2626', fontWeight: 900, fontFamily: 'monospace', fontSize: 12 }}>
            {formatCountdown(remainingMs)}
          </span>
        </div>
      )}

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          background: isPromo ? '#FEF2F2' : '#EFF6FF',
          color: isPromo ? '#DC2626' : '#1A56DB',
          padding: '4px 12px', borderRadius: 99, fontSize: 13, fontWeight: 800,
          border: isPromo ? '1.5px solid #FCA5A5' : '1.5px solid #BFDBFE',
          fontFamily: 'Space Grotesk, sans-serif',
        }}>{bot.name}</div>
        <button onClick={onBuy} className="btn-press" style={{
          flex: 1, marginLeft: 10, height: 40,
          background: isPromo ? 'linear-gradient(135deg, #DC2626, #EA580C)' : 'linear-gradient(135deg, #1A56DB, #2563EB)',
          color: 'white', border: 'none', borderRadius: 10,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Space Grotesk, sans-serif',
          boxShadow: isPromo ? '0 4px 12px rgba(220, 38, 38, 0.3)' : undefined,
        }}>
          {isPromo ? 'Acheter en Promo' : 'Acheter'}
        </button>
      </div>
    </div>
  );
}

// ─── Deposit Modal ─────────────────────────────────────────────────────────────
function DepositModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useUIStore();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDeposit() {
    setError('');
    const amtNum = parseFloat(amount);
    if (!amount || isNaN(amtNum) || amtNum < 200) {
      setError('Minimum 200 XOF');
      return;
    }
    setLoading(true);
    try {
      const data = await apiInitiateDeposit(amtNum);
      showToast('Redirection vers Sene-Pay...', 'success');
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet slide-up" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', fontFamily: 'Space Grotesk, sans-serif' }}>
          Recharger mon compte
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 20px' }}>
          Payez de manière sécurisée avec Wave, Orange, MTN, Moov, etc. via Sene-Pay
        </p>

        {/* Amount */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Montant (XOF)
          </label>
          <input
            className="input-field" type="number"
            placeholder="Ex: 5000" value={amount}
            onChange={e => { setAmount(e.target.value); setError(''); }}
            inputMode="numeric"
          />
        </div>

        {error && (
          <div style={{
            background: '#FEE2E2', color: '#DC2626', padding: '10px 14px',
            borderRadius: 10, fontSize: 13, fontWeight: 500, marginBottom: 16
          }}>⚠️ {error}</div>
        )}

        <button onClick={handleDeposit} className="btn-press" disabled={loading} style={{
          width: '100%', height: 52,
          background: loading ? '#93C5FD' : 'linear-gradient(135deg, #1A56DB, #1D4ED8)',
          color: 'white', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : 'Payer avec Sene-Pay'}
        </button>
      </div>
    </div>
  );
}

// ─── Withdraw Modal ────────────────────────────────────────────────────────────
function getOperatorLabel(op: string) {
  switch (op.toUpperCase()) {
    case 'MTN': return '🟡 MTN';
    case 'MOOV': return '🔵 Moov';
    case 'ORANGE': return '🟠 Orange';
    case 'WAVE': return '🌊 Wave';
    case 'FLOOZ': return '🟢 Flooz';
    case 'TMONEY': return '🔴 TMoney';
    case 'AIRTEL': return '🔴 Airtel';
    case 'MALI': return '🇲🇱 MALI';
    default: return op;
  }
}

function WithdrawModal({ onClose, balanceCents }: { onClose: () => void; balanceCents: number }) {
  const { user, updateBalance } = useAuthStore();
  const { addTransaction } = useAppStore();
  const { showToast } = useUIStore();
  
  const registeredPhone = user?.phone || '';
  const country = detectCountryFromPhone(registeredPhone);
  const countryPrefix = country.prefix;
  const countryFlag = country.flag;

  const [provider, setProvider] = useState<string>(country.operators?.[0] || 'MTN');
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
      const { newBalanceCents, transaction } = await apiWithdraw(user!.id, cents, provider.toUpperCase(), countryPrefix + phone);
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
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {(country.operators || ['MTN', 'MOOV']).map(p => (
            <button key={p} onClick={() => setProvider(p)} style={{
              flex: '1 1 calc(50% - 5px)', height: 48,
              background: provider === p ? '#EFF6FF' : '#F9FAFB',
              border: `2px solid ${provider === p ? '#1A56DB' : '#E5E7EB'}`,
              borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              color: provider === p ? '#1A56DB' : '#374151',
            }}>
              {getOperatorLabel(p)}
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
              <span>{countryFlag}</span> {countryPrefix}
              <div style={{ width: 1, height: 16, background: '#E5E7EB' }} />
            </div>
            <input
              className="input-field" type="tel"
              placeholder="XX XX XX XX"
              value={phone} onChange={e => setPhone(e.target.value)}
              style={{ paddingLeft: 95 }} inputMode="numeric"
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



// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const { user, updateBalance } = useAuthStore();
  const { addPurchase, addTransaction } = useAppStore();
  const { showToast } = useUIStore();
  const [bots, setBots] = useState<Bot[]>([]);
  const [botConfigs, setBotConfigs] = useState<BotPaymentConfig[]>([]);
  const [isWinpayActive, setIsWinpayActive] = useState(true);
  const [loadingBots, setLoadingBots] = useState(true);
  const [modal, setModal] = useState<null | 'deposit' | 'withdraw' | { type: 'buy'; bot: Bot }>(null);
  const [buying, setBuying] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      apiGetUnreadChatCount().then(c => setUnreadCount(c)).catch(() => {});
    }
    apiGetBots().then(b => { setBots(b as Bot[]); setLoadingBots(false); });
    apiGetBotPaymentConfigs().then(res => {
      setBotConfigs(res.configs || []);
      setIsWinpayActive(res.isWinpayActive ?? true);
    }).catch(() => {});
  }, [user]);

  async function handleBuy(bot: Bot, method: string, txRef: string = '', operator: string = 'BALANCE') {
    if (!user) return;
    setBuying(true);
    try {
      const op = method === 'BALANCE' ? 'BALANCE' : operator;
      const { purchase, newBalanceCents } = await apiPurchaseBot(user.id, bot.id, op, txRef);
      if (newBalanceCents !== undefined) {
        updateBalance(newBalanceCents);
      }
      addPurchase(purchase);
      setModal(null);
      if (method === 'BALANCE') {
        showToast(`Félicitations, ${bot.name} a été activé !`, 'success');
        router.push('/products');
      } else {
        showToast(`Demande d'activation envoyée avec succès ! En attente de vérification.`, 'success');
        router.push('/products');
      }
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
        <button 
          onClick={() => router.push('/chat')}
          style={{
            background: '#F3F4F6', border: '1px solid #E5E7EB',
            borderRadius: '50%', width: 38, height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#374151', position: 'relative'
          }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              background: '#EF4444', color: 'white',
              fontSize: 10, fontWeight: 'bold',
              minWidth: 16, height: 16, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px',
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      </header>

      {/* Hero Banner */}
      <div className="hero-banner" style={{ padding: '20px 20px 28px', marginBottom: 20 }}>
        <div style={{ color: 'white' }}>
          <p style={{ fontSize: 13, opacity: 0.8, margin: '0 0 2px' }}>Bonjour 👋, {user?.firstName || 'Utilisateur'}</p>
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
      <div style={{ display: 'flex', gap: 10, margin: '0 16px 20px', overflowX: 'auto', paddingBottom: 4 }}>

        <button className="action-btn" onClick={() => setModal('withdraw')} style={{ minWidth: 70 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowDownLeft size={20} color="#16A34A" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Retrait</span>
        </button>
        <button className="action-btn" onClick={() => router.push('/guide')} style={{ minWidth: 70 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={20} color="#D97706" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Guide</span>
        </button>
        <button className="action-btn" onClick={() => router.push('/chat')} style={{ minWidth: 70 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageCircle size={20} color="#7C3AED" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Support</span>
        </button>
      </div>

      {/* Promo Flash Gam 4 Banner */}
      <Gam4PromoBanner
        bot={bots.find(b => b.id === 'gam-4')}
        onBuy={(bot) => setModal({ type: 'buy', bot })}
      />

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
          balanceCents={user?.balanceCents || 0}
          botConfigs={botConfigs}
          isWinpayActive={isWinpayActive}
          onClose={() => setModal(null)}
          onConfirm={handleBuy}
          buying={buying}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
