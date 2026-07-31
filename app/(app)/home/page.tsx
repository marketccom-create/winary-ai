'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bell, ArrowUpRight, ArrowDownLeft, BookOpen, MessageCircle, ChevronRight, Loader2, X } from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '@/lib/store';
import { apiGetBots, apiGetBotPaymentConfigs, apiPurchaseBot, apiWithdraw, apiInitiateDeposit, apiGetUnreadChatCount, apiGetMyPurchases } from '@/lib/api';
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

// ─── Flash Sale Banner ─────────────────────────────────────────────────────────
function FlashSaleBanner({ bots, onBuy }: { bots: Bot[]; onBuy: (bot: Bot) => void }) {
  const promoGam3 = getBotPromo('gam-3');
  const promoGam4 = getBotPromo('gam-4');
  const promoGam5 = getBotPromo('gam-5');
  
  const isActive = promoGam3?.status === 'ACTIVE' || promoGam4?.status === 'ACTIVE' || promoGam5?.status === 'ACTIVE';
  const targetIso = promoGam3?.endTime || promoGam4?.endTime || promoGam5?.endTime;
  const remainingMs = usePromoTimer(targetIso || null);

  if (!isActive) return null;

  const botGam3 = bots.find(b => b.id === 'gam-3');
  const botGam4 = bots.find(b => b.id === 'gam-4');
  const botGam5 = bots.find(b => b.id === 'gam-5');

  return (
    <div className="promo-banner fade-in" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="promo-flame-icon" style={{ fontSize: 24 }}>⚡</span>
          <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Space Grotesk, sans-serif' }}>
            VENTE FLASH EXCEPTIONNELLE !
          </span>
        </div>
        <div className="promo-badge-pulse" style={{
          background: '#FEF08A', color: '#854D0E',
          padding: '3px 10px', borderRadius: 99,
          fontSize: 11, fontWeight: 800, border: '1px solid #FDE047'
        }}>
          JUSQU'À -50% OFF
        </div>
      </div>

      <p style={{ fontSize: 12, opacity: 0.95, margin: '0 0 12px', lineHeight: 1.4 }}>
        🔥 Valable <strong>aujourd'hui 18h00 à demain 18h00</strong> ! Réductions flash sur les robots Gam 3, Gam 4 et Gam 5.
      </p>

      {/* Countdown Row */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(8px)',
        borderRadius: 14,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.9, fontWeight: 700 }}>
          ⏱️ Temps restant :
        </div>
        <div style={{
          fontSize: 16, fontWeight: 900, fontFamily: 'monospace',
          letterSpacing: 1, color: '#FFFFFF',
          background: 'rgba(0,0,0,0.35)', padding: '3px 10px', borderRadius: 6
        }}>
          {formatCountdown(remainingMs)}
        </div>
      </div>

      {/* Cards in banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {botGam3 && (
          <button
            onClick={() => onBuy(botGam3)}
            className="btn-press"
            style={{
              background: 'linear-gradient(135deg, #E0E7FF, #818CF8)',
              color: '#1E1B4B', border: 'none', borderRadius: 12,
              padding: '10px 6px', textAlign: 'center', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800 }}>🤖 GAM 3</div>
            <div style={{ fontSize: 10, textDecoration: 'line-through', opacity: 0.7 }}>30 000 XOF</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#1E1B4B' }}>15 000 XOF</div>
          </button>
        )}
        {botGam4 && (
          <button
            onClick={() => onBuy(botGam4)}
            className="btn-press"
            style={{
              background: 'linear-gradient(135deg, #FEF08A, #FACC15)',
              color: '#713F12', border: 'none', borderRadius: 12,
              padding: '10px 6px', textAlign: 'center', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800 }}>🤖 GAM 4</div>
            <div style={{ fontSize: 10, textDecoration: 'line-through', opacity: 0.7 }}>80 000 XOF</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#854D0E' }}>50 000 XOF</div>
          </button>
        )}
        {botGam5 && (
          <button
            onClick={() => onBuy(botGam5)}
            className="btn-press"
            style={{
              background: 'linear-gradient(135deg, #FFEDD5, #FB923C)',
              color: '#7C2D12', border: 'none', borderRadius: 12,
              padding: '10px 6px', textAlign: 'center', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800 }}>🤖 GAM 5</div>
            <div style={{ fontSize: 10, textDecoration: 'line-through', opacity: 0.7 }}>200 000 XOF</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#7C2D12' }}>100 000 XOF</div>
          </button>
        )}
      </div>
    </div>
  );
}

// Helper to detect country & its specific mobile money networks based on phone prefix
function getCountryFromPhone(phone?: string): { name: string; prefix: string; flag: string; operators: { id: string; name: string; icon: string }[] } {
  if (!phone) {
    return {
      name: 'Bénin', prefix: '+229', flag: '🇧🇯',
      operators: [
        { id: 'MTN', name: 'MTN MoMo', icon: '🟡' },
        { id: 'MOOV', name: 'Moov Money', icon: '🔵' },
        { id: 'CELTIIS', name: 'Celtiis Cash', icon: '🟣' },
      ]
    };
  }
  const clean = phone.replace(/\s+/g, '');

  if (clean.startsWith('+229') || clean.startsWith('229')) {
    return {
      name: 'Bénin', prefix: '+229', flag: '🇧🇯',
      operators: [
        { id: 'MTN', name: 'MTN MoMo', icon: '🟡' },
        { id: 'MOOV', name: 'Moov Money', icon: '🔵' },
        { id: 'CELTIIS', name: 'Celtiis Cash', icon: '🟣' },
      ]
    };
  }
  if (clean.startsWith('+225') || clean.startsWith('225')) {
    return {
      name: 'Côte d’Ivoire', prefix: '+225', flag: '🇨🇮',
      operators: [
        { id: 'MTN', name: 'MTN MoMo', icon: '🟡' },
        { id: 'MOOV', name: 'Moov Money', icon: '🔵' },
        { id: 'ORANGE', name: 'Orange Money', icon: '🟠' },
        { id: 'WAVE', name: 'Wave', icon: '🌊' },
      ]
    };
  }
  if (clean.startsWith('+221') || clean.startsWith('221')) {
    return {
      name: 'Sénégal', prefix: '+221', flag: '🇸🇳',
      operators: [
        { id: 'WAVE', name: 'Wave', icon: '🌊' },
        { id: 'ORANGE', name: 'Orange Money', icon: '🟠' },
        { id: 'FREE', name: 'Free Money', icon: '🔴' },
      ]
    };
  }
  if (clean.startsWith('+228') || clean.startsWith('228')) {
    return {
      name: 'Togo', prefix: '+228', flag: '🇹🇬',
      operators: [
        { id: 'FLOOZ', name: 'Flooz (Moov)', icon: '🟢' },
        { id: 'TMONEY', name: 'TMoney (Togocom)', icon: '🔴' },
      ]
    };
  }
  if (clean.startsWith('+226') || clean.startsWith('226')) {
    return {
      name: 'Burkina Faso', prefix: '+226', flag: '🇧🇫',
      operators: [
        { id: 'ORANGE', name: 'Orange Money', icon: '🟠' },
        { id: 'MOOV', name: 'Moov Money', icon: '🟡' },
      ]
    };
  }
  if (clean.startsWith('+223') || clean.startsWith('223')) {
    return {
      name: 'Mali', prefix: '+223', flag: '🇲🇱',
      operators: [
        { id: 'ORANGE', name: 'Orange Money', icon: '🟠' },
        { id: 'MOOV', name: 'Moov Money', icon: '🟡' },
      ]
    };
  }
  if (clean.startsWith('+224') || clean.startsWith('224')) {
    return {
      name: 'Guinée', prefix: '+224', flag: '🇬🇳',
      operators: [
        { id: 'ORANGE', name: 'Orange Money', icon: '🟠' },
        { id: 'MTN', name: 'MTN MoMo', icon: '🟡' },
      ]
    };
  }
  if (clean.startsWith('+237') || clean.startsWith('237')) {
    return {
      name: 'Cameroun', prefix: '+237', flag: '🇨🇲',
      operators: [
        { id: 'MTN', name: 'MTN MoMo', icon: '🟡' },
        { id: 'ORANGE', name: 'Orange Money', icon: '🟠' },
      ]
    };
  }
  if (clean.startsWith('+232') || clean.startsWith('232')) {
    return {
      name: 'Sierra Leone', prefix: '+232', flag: '🇸🇱',
      operators: [
        { id: 'ORANGE', name: 'Orange Money', icon: '🟠' },
        { id: 'AFRICELL', name: 'Africell Money', icon: '🔴' },
      ]
    };
  }
  if (clean.startsWith('+242') || clean.startsWith('242')) {
    return {
      name: 'Congo', prefix: '+242', flag: '🇨🇬',
      operators: [
        { id: 'MTN', name: 'MTN MoMo', icon: '🟡' },
        { id: 'AIRTEL', name: 'Airtel Money', icon: '🔴' },
      ]
    };
  }
  if (clean.startsWith('+243') || clean.startsWith('243')) {
    return {
      name: 'RDC', prefix: '+243', flag: '🇨🇩',
      operators: [
        { id: 'MPESA', name: 'M-Pesa', icon: '🔴' },
        { id: 'AIRTEL', name: 'Airtel Money', icon: '🔴' },
        { id: 'ORANGE', name: 'Orange Money', icon: '🟠' },
      ]
    };
  }
  if (clean.startsWith('+235') || clean.startsWith('235')) {
    return {
      name: 'Tchad', prefix: '+235', flag: '🇹🇩',
      operators: [
        { id: 'AIRTEL', name: 'Airtel Money', icon: '🔴' },
        { id: 'MOOV', name: 'Moov Money', icon: '🟡' },
      ]
    };
  }
  if (clean.startsWith('+227') || clean.startsWith('227')) {
    return {
      name: 'Niger', prefix: '+227', flag: '🇳🇪',
      operators: [
        { id: 'AIRTEL', name: 'Airtel Money', icon: '🔴' },
        { id: 'MOOV', name: 'Moov Money', icon: '🟡' },
      ]
    };
  }
  if (clean.startsWith('+241') || clean.startsWith('241')) {
    return {
      name: 'Gabon', prefix: '+241', flag: '🇬🇦',
      operators: [
        { id: 'AIRTEL', name: 'Airtel Money', icon: '🔴' },
        { id: 'MOOV', name: 'Moov Money', icon: '🟡' },
      ]
    };
  }

  return {
    name: 'International', prefix: clean.startsWith('+') ? clean.substring(0, 4) : '+229', flag: '🌍',
    operators: [
      { id: 'MTN', name: 'MTN MoMo', icon: '🟡' },
      { id: 'MOOV', name: 'Moov Money', icon: '🔵' },
      { id: 'ORANGE', name: 'Orange Money', icon: '🟠' },
      { id: 'WAVE', name: 'Wave / Autre', icon: '🌊' },
    ]
  };
}

// ─── Purchase Confirm Modal (Winpay 2 WhatsApp, Winpay USSD & Balance) ─────────────────────────
function PurchaseModal({ bot, balanceCents, botConfigs, isWinpayActive, isWinpay2Active, winpay2WhatsappPhone, isWinpayOneActive = true, winpayOneSlackWebhookUrl = '', userPhone, userName, onClose, onConfirm, buying }: {
  bot: Bot;
  balanceCents: number;
  botConfigs: BotPaymentConfig[];
  isWinpayActive: boolean;
  isWinpay2Active: boolean;
  winpay2WhatsappPhone: string;
  isWinpayOneActive?: boolean;
  winpayOneSlackWebhookUrl?: string;
  userPhone?: string;
  userName?: string;
  onClose: () => void;
  onConfirm: (bot: Bot, method: string, txRef: string, operator: string) => Promise<any>;
  buying: boolean;
}) {
  const { showToast } = useUIStore();
  const detectedCountry = getCountryFromPhone(userPhone);

  const [method, setMethod] = useState<'winpayone' | 'winpay' | 'balance'>(
    isWinpayOneActive ? 'winpayone' : (balanceCents >= bot.priceCents ? 'balance' : 'winpay')
  );
  const [selectedOperator, setSelectedOperator] = useState<string>(detectedCountry.operators[0]?.name || 'MTN MoMo');
  const [phoneSender, setPhoneSender] = useState('');
  const [clientFullName, setClientFullName] = useState(userName || '');
  const [txRef, setTxRef] = useState('');
  const [winpayStep, setWinpayStep] = useState<'SELECT' | 'PHONE' | 'REF' | 'WINPAYONE_WAIT'>('SELECT');
  const [reqRefCode, setReqRefCode] = useState<string>('');
  const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(null);

  useEffect(() => {
    if (winpayStep !== 'WINPAYONE_WAIT' || !currentPurchaseId) return;

    const interval = setInterval(async () => {
      try {
        const purchases = await apiGetMyPurchases(userPhone || '');
        const activeMatch = purchases.find(p => p.id === currentPurchaseId && p.status === 'ACTIVE');
        if (activeMatch) {
          clearInterval(interval);
          playSuccessSound();
          showToast(`🎉 Félicitations ! Votre bot ${bot.name} a été activé avec succès !`, 'success');
          onClose();
        }
      } catch (e) {}
    }, 2500);

    return () => clearInterval(interval);
  }, [winpayStep, bot.name, userPhone, currentPurchaseId]);

  function playSuccessSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(1760, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  }

  const botCfg = botConfigs.find(c => c.botId === bot.id);
  const priceFormatted = formatXOF(bot.priceCents);
  const currentCountry = getCountryFromPhone(phoneSender || userPhone);

  // Compute USSD Code for selected operator & bot
  function getUssdCode() {
    const amountNumber = Math.round(bot.priceCents / 100);
    const defaultMtnCode = `*880*1*3*1*4*22646410950*${amountNumber}*1#`;
    const defaultMoovCode = `*855*1*1*3*2*22646410950*22646410950*${amountNumber}#`;

    if (selectedOperator.includes('MTN')) {
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

  // Handle Winpay 2 WhatsApp Redirect & Instant Order Submission
  function handleWinpay2Redirect() {
    if (!phoneSender.trim() || phoneSender.trim().length < 8) {
      alert('Veuillez entrer un numéro de téléphone valide (minimum 8 chiffres).');
      return;
    }

    const cleanWhatsapp = (winpay2WhatsappPhone || '17095064087').replace(/\D/g, '');
    const clientNameFormatted = clientFullName.trim() ? clientFullName.trim() : (userName || 'Utilisateur');

    // Generate unique 4-digit demand reference code (e.g. 0046)
    const randomNum = Math.floor(1 + Math.random() * 9999);
    const reqRefCode = String(randomNum).padStart(4, '0');

    // Exact user format with blank lines and demand reference code
    const message = `Bonjour, C'est ${clientNameFormatted} je souhaite valider mon achat de bot.

Bot : ${bot.name} (${priceFormatted})

Pays : ${currentCountry.name} (${currentCountry.prefix})

Réseau : ${selectedOperator}

Numéro : ${phoneSender.trim()}

Référence de la demande : ${reqRefCode}`;

    // Submit pending purchase to DB with exact reference code so Admin sees it on the pending bot
    onConfirm(bot, 'WINPAY2', `Référence : ${reqRefCode} | ${clientNameFormatted} | ${phoneSender.trim()} | ${selectedOperator} | ${currentCountry.name}`, 'WINPAY2');

    // Open WhatsApp link immediately
    const waUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
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
              {/* Option 1: WinpayOne (Guichet Agrégateur de Paiement) */}
              <button
                onClick={() => setMethod('winpayone')}
                disabled={!isWinpayOneActive}
                style={{
                  width: '100%', padding: '14px 16px', minHeight: 60,
                  background: method === 'winpayone' ? '#ECFDF5' : '#F9FAFB',
                  border: `2px solid ${method === 'winpayone' ? '#10B981' : '#E5E7EB'}`,
                  borderRadius: 14, cursor: !isWinpayOneActive ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  opacity: !isWinpayOneActive ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #10B981, #047857)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20, fontWeight: 900
                  }}>
                    ⚡
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#065F46', display: 'flex', alignItems: 'center', gap: 6 }}>
                      WinpayOne
                      {isWinpayOneActive ? (
                        <span style={{ fontSize: 10, background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: 99, fontWeight: 800 }}>
                          🔒 Guichet Sécurisé
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                          🛠️ Maintenance
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                      Guichet de Paiement Mobile Money Direct
                    </div>
                  </div>
                </div>
                {method === 'winpayone' && <span style={{ color: '#059669', fontWeight: 'bold', fontSize: 18 }}>✓</span>}
              </button>

              {/* Option 2: Winpay USSD Checkout */}
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
                      Winpay (SMS / USSD)
                      {!isWinpayActive ? (
                        <span style={{ fontSize: 10, background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                          🛠️ Maintenance
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                          ⚡ Appel USSD
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>MTN MoMo, Moov Money</div>
                  </div>
                </div>
                {method === 'winpay' && <span style={{ color: '#1A56DB', fontWeight: 'bold' }}>✓</span>}
              </button>

              {/* Option 3: Balance Payment */}
              <button
                onClick={() => {
                  if (bot.id === 'priority-boost') {
                    alert('🔒 Le produit PRIORITY BOOST ne peut pas être acheté via votre solde principal. Seul le paiement direct Mobile Money est accepté.');
                    return;
                  }
                  setMethod('balance');
                }}
                disabled={bot.id === 'priority-boost' || balanceCents < bot.priceCents}
                style={{
                  width: '100%', height: 56,
                  background: method === 'balance' ? '#EFF6FF' : '#F9FAFB',
                  border: `2px solid ${method === 'balance' ? '#1A56DB' : '#E5E7EB'}`,
                  borderRadius: 12, cursor: (bot.id === 'priority-boost' || balanceCents < bot.priceCents) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
                  opacity: (bot.id === 'priority-boost' || balanceCents < bot.priceCents) ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>💳</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Payer avec mon solde</div>
                    {bot.id === 'priority-boost' ? (
                      <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 800 }}>
                        🔒 Incompatible solde — Paiement Direct Requis
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: '#6B7280' }}>Disponible: {formatXOF(balanceCents)}</div>
                    )}
                  </div>
                </div>
                {method === 'balance' && <span style={{ color: '#1A56DB', fontWeight: 'bold' }}>✓</span>}
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
                    if (bot.id === 'priority-boost') {
                      alert('🔒 Le produit PRIORITY BOOST ne peut pas être acheté via votre solde principal. Seul le paiement direct Mobile Money est accepté.');
                      return;
                    }
                    onConfirm(bot, 'BALANCE', '', 'BALANCE');
                  } else if (method === 'winpayone') {
                    if (!isWinpayOneActive) {
                      alert('Le guichet WinpayOne est temporairement en maintenance.');
                      return;
                    }
                    setWinpayStep('PHONE');
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
                  background: buying ? '#93C5FD' : (method === 'winpayone' ? 'linear-gradient(135deg, #10B981, #059669)' : (bot.isPromo ? 'linear-gradient(135deg, #DC2626, #EA580C)' : 'linear-gradient(135deg, #1A56DB, #1D4ED8)')),
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
          /* Step 2: Écran du Guichet d'Agrégation de Paiement WinpayOne / USSD / Winpay 2 */
          <div>
            {method === 'winpayone' && (
              <div style={{
                background: 'linear-gradient(135deg, #ECFDF5, #F0FDF4)',
                border: '1.5px solid #A7F3D0', borderRadius: 14,
                padding: '12px 14px', marginBottom: 16, textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#065F46', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>
                  <span>WinpayOne</span>
                </div>
                <div style={{ fontSize: 11, color: '#047857' }}>
                  Sélectionnez votre réseau et entrez le numéro Mobile Money avec lequel vous effectuez le paiement.
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                1. Choisissez votre réseau Mobile Money :
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: currentCountry.operators.length >= 3 ? 'repeat(3, 1fr)' : `repeat(${currentCountry.operators.length}, 1fr)`,
                gap: 8
              }}>
                {currentCountry.operators.map(op => (
                  <button
                    key={op.id}
                    onClick={() => setSelectedOperator(op.name)}
                    style={{
                      padding: '10px 8px', borderRadius: 12,
                      border: selectedOperator === op.name ? '2px solid #10B981' : '1.5px solid #E5E7EB',
                      background: selectedOperator === op.name ? '#ECFDF5' : '#F9FAFB',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{op.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: selectedOperator === op.name ? '#065F46' : '#374151' }}>{op.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Nom & Prénom Input */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                2. Vos Nom & Prénom :
              </label>
              <input
                className="input-field"
                placeholder="Ex: Jean Dupont"
                value={clientFullName}
                onChange={e => setClientFullName(e.target.value)}
                style={{ fontSize: 14, background: '#FFFFFF', border: '1.5px solid #CBD5E1', padding: '12px 14px' }}
              />
            </div>

            {/* Input Phone Sender */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                3. Entrez votre N° de téléphone ({currentCountry.name}) :
              </label>
              <input
                className="input-field"
                placeholder={`Ex: ${currentCountry.prefix} 97000000`}
                value={phoneSender}
                onChange={e => setPhoneSender(e.target.value)}
                style={{ fontSize: 14, background: '#FFFFFF', border: '1.5px solid #CBD5E1', padding: '12px 14px' }}
              />
            </div>

            {/* Actions: Return & Payer button */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setWinpayStep('SELECT')} style={{
                flex: 1, height: 50, background: '#F3F4F6', border: '1px solid #E5E7EB',
                borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151',
              }}>Retour</button>

              <button
                onClick={() => {
                  if (!phoneSender.trim() || phoneSender.trim().length < 8) {
                    alert('Veuillez entrer un numéro de téléphone valide (minimum 8 chiffres).');
                    return;
                  }

                  if (method === 'winpayone') {
                    const randomNum = Math.floor(1000 + Math.random() * 9000);
                    const code = String(randomNum);
                    setReqRefCode(code);
                    const clientNameFormatted = clientFullName.trim() ? clientFullName.trim() : (userName || 'Utilisateur');

                    onConfirm(
                      bot,
                      'WINPAYONE',
                      `Référence : REQ-${code} | ${clientNameFormatted} | ${phoneSender.trim()} | ${selectedOperator} | ${currentCountry.name}`,
                      'WINPAYONE'
                    ).then((resPurchase) => {
                      if (resPurchase && resPurchase.id) {
                        setCurrentPurchaseId(resPurchase.id);
                      }
                    });
                    setWinpayStep('WINPAYONE_WAIT');
                  } else {
                    handleDial();
                    setWinpayStep('REF');
                  }
                }}
                className="btn-press"
                disabled={buying}
                style={{
                  flex: 2, height: 50,
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: 'white', border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                {buying ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : (method === 'winpayone' ? `🔒 Payer ${priceFormatted}` : `Payer ${priceFormatted}`)}
              </button>
            </div>
          </div>
        ) : winpayStep === 'WINPAYONE_WAIT' ? (
          /* Step 3: Écran d'attente WinpayOne */
          <div style={{ padding: '4px 0 12px', textAlign: 'center' }}>
            {/* Header Badge WinpayOne */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              padding: '6px 14px', borderRadius: 99, marginBottom: 16
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#166534', letterSpacing: '0.3px' }}>
                WinpayOne
              </span>
            </div>

            {/* Main Headline exact requirement */}
            <h2 style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', margin: '0 0 8px', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.35 }}>
              Veuillez confirmer l'opération sur votre téléphone.
            </h2>
            <p style={{ color: '#475569', fontSize: 13, margin: '0 0 24px', lineHeight: 1.45, padding: '0 8px' }}>
              Une demande de débit Mobile Money a été transmise à votre téléphone. Veuillez autoriser la transaction et maintenir cet écran ouvert.
            </p>

            {/* Circular Spinner Animation & "En cours..." */}
            <div style={{
              background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
              border: '1.5px solid #E2E8F0', borderRadius: 20,
              padding: '24px 16px', marginBottom: 20,
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  border: '4px solid #E2E8F0', borderTopColor: '#10B981',
                  animation: 'spin 1s linear infinite',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
                }} />
              </div>

              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                En cours...
              </div>
            </div>

            {/* Clean Summary Card */}
            <div style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '16px', textAlign: 'left', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#64748B' }}>Montant :</span>
                <strong style={{ color: '#0F172A', fontWeight: 800 }}>{priceFormatted}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#64748B' }}>Réseau sélectionné :</span>
                <strong style={{ color: '#059669', fontWeight: 700 }}>{selectedOperator}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: '#64748B' }}>N° Téléphone :</span>
                <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{phoneSender}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingTop: 8, borderTop: '1px dashed #CBD5E1' }}>
                <span style={{ color: '#94A3B8' }}>Réf. Demande :</span>
                <strong style={{ color: '#2563EB', fontFamily: 'monospace' }}>REQ-{reqRefCode}</strong>
              </div>
            </div>

            {/* Footer exact requirement */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#64748B', fontSize: 12, fontWeight: 700 }}>
              <span>🔒</span> Paiement 100% sécurisé par WinpayOne
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
                  if (!txRef.trim()) {
                    showToast('Veuillez coller la référence ou le message SMS de transaction.', 'error');
                    return;
                  }
                  onConfirm(bot, 'WINPAY', txRef.trim(), selectedOperator);
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
  const promo = getBotPromo(bot.id);
  const isPromo = bot.isPromo || promo?.status === 'ACTIVE';
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
          <span>🔥</span> PROMO {promo?.badge || '-25%'}
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
  const [isSenepayActive, setIsSenepayActive] = useState(true);
  const [isWinpay2Active, setIsWinpay2Active] = useState(true);
  const [winpay2WhatsappPhone, setWinpay2WhatsappPhone] = useState('+1 (709) 506-4087');
  const [isWinpayOneActive, setIsWinpayOneActive] = useState(true);
  const [winpayOneSlackWebhookUrl, setWinpayOneSlackWebhookUrl] = useState('');
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
      setIsSenepayActive(res.isSenepayActive ?? true);
      setIsWinpay2Active(res.isWinpay2Active ?? true);
      setWinpay2WhatsappPhone(res.winpay2WhatsappPhone || '+1 (709) 506-4087');
      setIsWinpayOneActive(res.isWinpayOneActive ?? true);
      setWinpayOneSlackWebhookUrl(res.winpayOneSlackWebhookUrl || '');
    }).catch(() => {});
  }, [user]);

  async function handleBuy(bot: Bot, method: string, txRef: string = '', operator: string = 'BALANCE') {
    if (!user) return;
    setBuying(true);
    try {
      const op = method === 'BALANCE' ? 'BALANCE' : operator;
      const { purchase, newBalanceCents, checkoutUrl } = await apiPurchaseBot(user.id, bot.id, op, txRef);
      if (newBalanceCents !== undefined) {
        updateBalance(newBalanceCents);
      }
      addPurchase(purchase);
      if (checkoutUrl) {
        setModal(null);
        showToast('Redirection vers Sene-Pay...', 'success');
        window.location.href = checkoutUrl;
        return purchase;
      }
      if (op === 'WINPAYONE') {
        // Ne pas fermer le modal ni afficher la notification toast de demande soumise. Le client reste sur l'écran WinpayOne jusqu'à la validation.
        return purchase;
      }
      setModal(null);
      if (method === 'BALANCE') {
        showToast(`Félicitations, ${bot.name} a été activé !`, 'success');
        router.push('/products');
      } else {
        showToast("⏳ Votre demande d'activation a été soumise avec succès ! Elle est en attente d'approbation.", 'success');
        router.push('/products');
      }
      return purchase;
    } catch (err: any) {
      showToast(err.message, 'error');
      return null;
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

      {/* Promo Flash Banner */}
      <FlashSaleBanner
        bots={bots}
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
          isSenepayActive={isSenepayActive}
          isWinpay2Active={isWinpay2Active}
          winpay2WhatsappPhone={winpay2WhatsappPhone}
          isWinpayOneActive={isWinpayOneActive}
          winpayOneSlackWebhookUrl={winpayOneSlackWebhookUrl}
          userPhone={user?.phone}
          userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
          onClose={() => setModal(null)}
          onConfirm={handleBuy}
          buying={buying}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
