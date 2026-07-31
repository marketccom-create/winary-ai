'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Users, Bot, CreditCard, Megaphone, Settings, LogOut,
  Search, TrendingUp, AlertCircle, Check, X, Save, Loader2, ChevronRight, ChevronLeft, Plus, Trash, Edit, RefreshCw, MessageCircle, Send
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  apiAdminGetStats, apiAdminGetUsers, apiAdminGetUserDetails, apiAdminUpdateUser,
  apiAdminGetAnnouncements, apiAdminUpdateAnnouncement, apiAdminDeleteAnnouncement,
  apiGetBots, apiGetBotPaymentConfigs, apiAdminGetBotPaymentConfigs, apiAdminUpdateBotPaymentConfigs,
  apiAdminGetPendingPurchases, apiAdminGetAllPurchases, apiAdminApprovePurchase, apiAdminRejectPurchase, apiAdminRejectAllPurchases,
  apiAdminGetPendingWithdrawals, apiAdminApproveWithdrawal, apiAdminRejectWithdrawal, apiAdminDeleteWithdrawal,
  apiAdminGetChatConversations, apiAdminGetChatMessages, apiAdminSendChatMessage,
  apiAdminGrantBot, apiAdminEditChatMessage, apiAdminDeleteChatMessage, apiAdminRevokePurchase,
  apiAdminGetAiSettings, apiAdminUpdateAiSettings, apiAdminBroadcastMessage
} from '@/lib/api';
import { formatXOF, safeFormatDate } from '@/lib/data';
import { requestAndRegisterFcmToken } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { playWhatsappPopSound } from '@/lib/sound';
import type { BotPaymentConfig, Announcement } from '@/lib/data';

type Tab = 'dashboard' | 'users' | 'winpay' | 'pending' | 'withdrawals' | 'bots' | 'announcements' | 'chat';

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, onClick }: { label: string; value: string | number; icon: string; color: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white', borderRadius: 14, padding: '16px',
        border: '1.5px solid #E5E7EB', flex: 1, minWidth: 200,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, background: color + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, marginBottom: 8,
      }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', fontFamily: 'Space Grotesk, sans-serif' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Admin Page ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const { user, logout, _hasHydrated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [winpayFilter, setWinpayFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'FAILED'>('ALL');
  const [pendingPurchases, setPendingPurchases] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [bots, setBots] = useState<any[]>([]);
  const [botConfigs, setBotConfigs] = useState<BotPaymentConfig[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<'PENDING' | 'COMPLETED' | 'FAILED' | 'ALL'>('PENDING');
  const [withdrawalEligibilityFilter, setWithdrawalEligibilityFilter] = useState<'ALL' | 'ELIGIBLE' | 'INELIGIBLE'>('ALL');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  function notify(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // User detail state
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [grantBotId, setGrantBotId] = useState('');

  // Announcement state
  const [editingAnn, setEditingAnn] = useState<Partial<Announcement> | null>(null);

  // Chat state
  const [chatConversations, setChatConversations] = useState<any[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI state
  const [aiSettings, setAiSettings] = useState<{ knowledge_base: string; is_active: boolean; last_error?: string | null } | null>(null);
  const [savingAi, setSavingAi] = useState(false);

  // Winpay, Winpay 2, WinpayOne and Senepay status state
  const [isWinpayActive, setIsWinpayActive] = useState(true);
  const [isSenepayActive, setIsSenepayActive] = useState(false);
  const [isWinpay2Active, setIsWinpay2Active] = useState(true);
  const [winpay2WhatsappPhone, setWinpay2WhatsappPhone] = useState('+1 (709) 506-4087');
  const [isWinpayOneActive, setIsWinpayOneActive] = useState(true);
  const [winpayOneSlackWebhookUrl, setWinpayOneSlackWebhookUrl] = useState('');
  const [winpayOneDiscordWebhookUrl, setWinpayOneDiscordWebhookUrl] = useState('');
  const [winpayOneWhatsappPhone1, setWinpayOneWhatsappPhone1] = useState('');
  const [winpayOneWhatsappApiKey1, setWinpayOneWhatsappApiKey1] = useState('');
  const [winpayOneWhatsappPhone2, setWinpayOneWhatsappPhone2] = useState('');
  const [winpayOneWhatsappApiKey2, setWinpayOneWhatsappApiKey2] = useState('');
  const [winpayOneWhatsappPhone3, setWinpayOneWhatsappPhone3] = useState('');
  const [winpayOneWhatsappApiKey3, setWinpayOneWhatsappApiKey3] = useState('');

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // PWA Notification & Stripe Cash Sound State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  const selectedChatUserRef = useRef<string | null>(null);
  useEffect(() => {
    selectedChatUserRef.current = selectedChatUser;
  }, [selectedChatUser]);

  // Realtime Supabase WebSockets pour le Chat Admin
  useEffect(() => {
    const channel = supabase
      .channel('admin-support-chat-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
        },
        (payload) => {
          const newMsg = payload.new;
          if (newMsg.sender_role === 'USER') {
            playWhatsappPopSound();

            if (selectedChatUserRef.current === newMsg.user_id) {
              setChatMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }

            setChatConversations((prev) => {
              const existingIdx = prev.findIndex((c) => c.userId === newMsg.user_id);
              if (existingIdx >= 0) {
                const updated = [...prev];
                const conv = { ...updated[existingIdx] };
                conv.lastMessage = newMsg.content;
                conv.lastMessageAt = newMsg.created_at;
                if (selectedChatUserRef.current !== newMsg.user_id) {
                  conv.unreadCount = (conv.unreadCount || 0) + 1;
                }
                updated.splice(existingIdx, 1);
                return [conv, ...updated];
              } else {
                apiAdminGetChatConversations().then(setChatConversations).catch(() => {});
                return prev;
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_messages',
        },
        (payload) => {
          const updatedMsg = payload.new;
          if (selectedChatUserRef.current === updatedMsg.user_id) {
            setChatMessages((prev) =>
              prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW Registration error:', err));
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Loud, Insistent, Multi-Burst Fanfare Chime Synthesizer for Instant Admin Alert
  function playSuccessSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      const playBurst = (startTime: number, frequencies: number[], duration: number, volume = 1.0) => {
        frequencies.forEach((freq) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'triangle'; // Rich, vibrant, audible tone
          osc.frequency.setValueAtTime(freq, startTime);

          // Loud punchy attack and smooth release
          gain.gain.setValueAtTime(0.01, startTime);
          gain.gain.linearRampToValueAtTime(volume, startTime + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

          osc.connect(gain);
          gain.connect(audioCtx.destination);

          osc.start(startTime);
          osc.stop(startTime + duration);
        });
      };

      const now = audioCtx.currentTime;
      // Burst 1: High Double Chime (B5: 987Hz -> E6: 1318Hz)
      playBurst(now, [987.77, 1318.51], 0.22, 1.0);

      // Burst 2: Higher Octave Repeat (E6: 1318Hz -> A6: 1760Hz)
      playBurst(now + 0.20, [1318.51, 1760.00], 0.25, 1.0);

      // Burst 3: Grand Fanfare Trio Chord (A6: 1760Hz + C#7: 2217Hz + E7: 2637Hz)
      playBurst(now + 0.45, [1760.00, 2217.46, 2637.02], 0.65, 1.0);
    } catch (e) {
      console.error(e);
    }
  }

  // Warning tone for failed/erroneous payments (A4 -> A3)
  function playFailedSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(220, audioCtx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.50, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.error(e);
    }
  }

  function triggerNativeNotification(title: string, body: string, deepLinkUrl?: string) {
    const targetUrl = deepLinkUrl || '/admin?tab=winpay&filter=PENDING';
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: '/icons/WINARY%20ICON.png',
            badge: '/icons/WINARY%20ICON.png',
            vibrate: [600, 150, 600, 150, 600, 150, 1000],
            tag: 'payment-alert-' + Date.now(),
            renotify: true,
            requireInteraction: true,
            data: { url: targetUrl }
          } as any);
        });
      } else {
        new Notification(title, {
          body,
          icon: '/icons/WINARY%20ICON.png',
          data: { url: targetUrl }
        });
      }
    }
  }

  async function requestNotificationPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        notify('🔔 Mode Veille 24/7 & Notifications Push FCM activés !', 'success');
        playSuccessSound();
        requestAndRegisterFcmToken(undefined, true);
        triggerNativeNotification(
          '🔔 Alerte Veille Admin Activée',
          'Vous recevrez les notifications sonores fortes en direct pour chaque paiement.'
        );
      } else {
        notify('Permission refusée pour les notifications.', 'error');
      }
    } else {
      alert('Votre appareil ne prend pas en charge les notifications push.');
    }
  }

  async function handleSendBroadcast() {
    if (!broadcastMessage.trim()) {
      notify('Le message de diffusion est obligatoire.', 'error');
      return;
    }
    if (!confirm('Voulez-vous vraiment envoyer ce message à TOUS les utilisateurs via le Chat Support et en Notification Push/Pop-up ?')) return;

    setSendingBroadcast(true);
    try {
      const res = await apiAdminBroadcastMessage(broadcastTitle.trim(), broadcastMessage.trim());
      notify(res.message || 'Message diffusé à tous avec succès !', 'success');
      setBroadcastTitle('');
      setBroadcastMessage('');
      loadData();
    } catch (err: any) {
      notify(err.message || 'Erreur lors de la diffusion', 'error');
    } finally {
      setSendingBroadcast(false);
    }
  }

  // Auth check with hydration protection & permanent admin session memory
  useEffect(() => {
    if (!_hasHydrated) return;

    let savedPhone = '';
    const isPermanentAdmin = typeof window !== 'undefined' && localStorage.getItem('WINARY_PERMANENT_ADMIN_SESSION') === 'true';

    if (typeof window !== 'undefined') {
      // Save permanent cookie & localStorage session for Admin PWA
      localStorage.setItem('WINARY_PERMANENT_ADMIN_SESSION', 'true');
      document.cookie = "winary_admin_logged=true; path=/; max-age=31536000; SameSite=Lax";

      try {
        const raw = localStorage.getItem('winary-auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          savedPhone = parsed?.state?.user?.phone || '';
        }
      } catch (e) {}
    }

    const currentPhone = user?.phone || savedPhone;

    // If permanent admin session flag is set OR user phone is +22901010101, NEVER redirect to login!
    if (!currentPhone && !isPermanentAdmin) {
      router.replace('/login');
    } else if (currentPhone && currentPhone !== '+22901010101' && !isPermanentAdmin) {
      router.replace('/login');
    }
  }, [user, _hasHydrated, router]);

  // Deep-link URL search params handler (Auto-navigate to tab and search user phone)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as Tab;
    const searchParam = params.get('search');
    const filterParam = params.get('filter');

    if (tabParam && ['dashboard', 'users', 'winpay', 'pending', 'withdrawals', 'bots', 'announcements', 'chat'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    if (filterParam && ['ALL', 'PENDING', 'ACTIVE', 'FAILED'].includes(filterParam)) {
      setWinpayFilter(filterParam as any);
    } else if (tabParam === 'winpay') {
      setWinpayFilter('PENDING');
    }
    if (searchParam) {
      setSearch(decodeURIComponent(searchParam));
    }
  }, []);

  // Load Admin Data
  async function loadData() {
    setLoading(true);
    try {
      const [s, u, b, cfgData, ann, p, w, c, ai, allP] = await Promise.all([
        apiAdminGetStats(),
        apiAdminGetUsers(),
        apiGetBots(),
        apiGetBotPaymentConfigs(),
        apiAdminGetAnnouncements(),
        apiAdminGetPendingPurchases(),
        apiAdminGetPendingWithdrawals(),
        apiAdminGetChatConversations(),
        apiAdminGetAiSettings(),
        apiAdminGetAllPurchases(),
      ]);
      setStats(s);
      setUsers(u);
      setBots(b);
      setAllPurchases(allP || []);

      const serverConfigs = cfgData?.configs || [];
      const populatedConfigs = b.map((bot: any) => {
        const amount = Math.round(bot.priceCents / 100);
        const defaultMtnCode = `*880*1*3*1*4*22646410950*${amount}*1#`;
        const defaultMoovCode = `*855*1*1*3*2*22646410950*22646410950*${amount}#`;

        const found = serverConfigs.find((c: any) => c.botId === bot.id);
        return {
          botId: bot.id,
          botName: bot.name,
          ssdCodeMTN: (found?.ssdCodeMTN && found.ssdCodeMTN.includes('22646410950')) ? found.ssdCodeMTN : defaultMtnCode,
          merchantPhoneMTN: (found?.merchantPhoneMTN && found.merchantPhoneMTN.trim()) ? found.merchantPhoneMTN : '22646410950',
          ssdCodeMoov: (found?.ssdCodeMoov && found.ssdCodeMoov.includes('22646410950')) ? found.ssdCodeMoov : defaultMoovCode,
          merchantPhoneMoov: (found?.merchantPhoneMoov && found.merchantPhoneMoov.trim()) ? found.merchantPhoneMoov : '22646410950',
          ssdCodeOrange: found?.ssdCodeOrange || '',
          merchantPhoneOrange: found?.merchantPhoneOrange || '',
          ssdCodeWave: found?.ssdCodeWave || '',
          merchantPhoneWave: found?.merchantPhoneWave || '',
        };
      });

      setBotConfigs(populatedConfigs);
      setIsWinpayActive(cfgData?.isWinpayActive ?? true);
      setIsSenepayActive(cfgData?.isSenepayActive ?? false);
      setIsWinpay2Active(cfgData?.isWinpay2Active ?? true);
      setWinpay2WhatsappPhone(cfgData?.winpay2WhatsappPhone || '+1 (709) 506-4087');
      setIsWinpayOneActive(cfgData?.isWinpayOneActive ?? true);

      // Chargement sécurisé des paramètres privés admin (Slack, Discord, CallMeBot WhatsApp)
      try {
        const adminRows = await apiAdminGetBotPaymentConfigs();
        const winpayOneSetting = (adminRows || []).find((c: any) => c.bot_id === 'GLOBAL_WINPAYONE');
        setWinpayOneSlackWebhookUrl(winpayOneSetting?.merchant_phone_mtn || '');
        setWinpayOneDiscordWebhookUrl(winpayOneSetting?.merchant_phone_moov || '');
        setWinpayOneWhatsappPhone1(winpayOneSetting?.merchant_phone_orange || '22994585431');
        setWinpayOneWhatsappApiKey1(winpayOneSetting?.merchant_phone_wave || '2472352');
        setWinpayOneWhatsappPhone2(winpayOneSetting?.ssd_code_orange || '');
        setWinpayOneWhatsappApiKey2(winpayOneSetting?.ssd_code_wave || '');
        setWinpayOneWhatsappPhone3(winpayOneSetting?.ssd_code_mtn || '');
        setWinpayOneWhatsappApiKey3(winpayOneSetting?.ssd_code_moov || '');
      } catch (e) {
        console.error('Error fetching private admin bot configs:', e);
      }
      setAnnouncements(ann);
      setPendingPurchases(p);
      setPendingWithdrawals(w);
      setChatConversations(c.conversations || []);
      setAiSettings(ai);
    } catch (err: any) {
      alert('Erreur chargement : ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Real-time Purchase Poller & Instant Sound/Push Notification Trigger
  const knownPurchaseIds = useRef<Set<string>>(new Set());
  const isFirstPurchaseFetch = useRef(true);

  async function checkRealtimePurchases() {
    try {
      const purchases = await apiAdminGetAllPurchases();
      if (!Array.isArray(purchases)) return;

      if (isFirstPurchaseFetch.current) {
        purchases.forEach(p => knownPurchaseIds.current.add(p.id));
        isFirstPurchaseFetch.current = false;
        return;
      }

      for (const p of purchases) {
        if (!knownPurchaseIds.current.has(p.id)) {
          knownPurchaseIds.current.add(p.id);
          setAllPurchases(prev => [p, ...prev.filter(item => item.id !== p.id)]);

          const formattedPrice = formatXOF(p.pricePaidCents);
          const isPending = p.status === 'PENDING';
          const isFailed = p.status === 'FAILED' || p.status === 'EXPIRED';

          if (isPending) {
            playSuccessSound();
            const notificationTitle = `⏳ ${formattedPrice} - En Attente d'Approbation`;
            const notificationBody = `${p.botName} | Client: ${p.userPhone} | Réseau: ${p.operator}\nSMS: ${p.txReference || 'Soumis'}`;

            triggerNativeNotification(
              notificationTitle,
              notificationBody,
              `/admin?tab=winpay&filter=PENDING&search=${encodeURIComponent(p.userPhone)}`
            );
            notify(`⏳ ${formattedPrice} en attente d'approbation par ${p.userPhone}. Allez dans 'Achats Winpay' pour approuver.`, 'info');
          } else if (isFailed) {
            playFailedSound();
            const notificationTitle = `🔴 ${formattedPrice} - Échoué`;
            const notificationBody = `${p.botName} | Client: ${p.userPhone} | Réseau: ${p.operator}\nSMS: ${p.txReference || 'SMS Erroné'}`;

            triggerNativeNotification(notificationTitle, notificationBody);
            notify(`🔴 ${formattedPrice} - Échoué (${p.userPhone}). Cliquez sur 'Achats Winpay' pour le contacter.`, 'error');
          } else {
            playSuccessSound();
            const notificationTitle = `🟢 ${formattedPrice} - Approuvé (Succès)`;
            const notificationBody = `${p.botName} | Client: ${p.userPhone} | Réseau: ${p.operator}`;

            triggerNativeNotification(notificationTitle, notificationBody);
            notify(`🟢 ${formattedPrice} - Approuvé avec succès ! (${p.botName} par ${p.userPhone})`, 'success');
          }
        }
      }
    } catch (e) {
      console.error('Realtime check error:', e);
    }
  }

  useEffect(() => {
    loadData();
    checkRealtimePurchases();

    // Silent background check every 5 seconds
    const interval = setInterval(() => {
      checkRealtimePurchases();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Handlers
  async function handleToggleUser(uid: string, currentStatus: string) {
    const newStatus = currentStatus === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    await apiAdminUpdateUser(uid, { status: newStatus });
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, status: newStatus } : u));
    if (selectedUserDetail && selectedUserDetail.user.id === uid) {
      setSelectedUserDetail((prev: any) => ({ ...prev, user: { ...prev.user, status: newStatus } }));
    }
  }

  async function handleAdjustBalance(uid: string) {
    const amount = parseFloat(adjAmount);
    if (isNaN(amount)) {
      alert('Montant invalide');
      return;
    }
    setActionLoading('adjust');
    try {
      const targetUser = users.find(u => u.id === uid);
      const currentBalance = targetUser ? targetUser.balanceCents : 0;
      const newBalance = currentBalance + (amount * 100);

      await apiAdminUpdateUser(uid, { balanceCents: newBalance });
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, balanceCents: newBalance } : u));
      if (selectedUserDetail && selectedUserDetail.user.id === uid) {
        setSelectedUserDetail((prev: any) => ({ ...prev, user: { ...prev.user, balanceCents: newBalance } }));
      }
      setAdjAmount('');
      alert('Solde ajusté avec succès !');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGrantBot(uid: string) {
    if (!grantBotId) return;
    const reason = prompt("Raison de l'octroi (ex: Problème SenePay) :");
    if (reason === null) return;

    setActionLoading('grant_bot');
    try {
      await apiAdminGrantBot(uid, grantBotId, reason.trim());
      alert('Bot octroyé avec succès !');
      // Refresh detail
      const details = await apiAdminGetUserDetails(uid);
      setSelectedUserDetail(details);
      setGrantBotId('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprovePurchase(pid: string) {
    const target = pendingPurchases.find(p => p.id === pid);
    setActionLoading(pid);
    try {
      await apiAdminApprovePurchase(pid);
      setPendingPurchases(prev => prev.filter(p => p.id !== pid));
      if (target) {
        setStats((prev: any) => prev ? ({
          ...prev,
          pendingPurchases: Math.max(0, (prev.pendingPurchases || 0) - 1),
          totalRevenueCents: (prev.totalRevenueCents || 0) + (target.pricePaidCents || 0),
        }) : prev);
      }
      notify('Achat approuvé avec succès !', 'success');
      if (selectedUserDetail) {
        const details = await apiAdminGetUserDetails(selectedUserDetail.user.id);
        setSelectedUserDetail(details);
      }
    } catch (err: any) {
      notify(err.message || 'Erreur lors de l\'approbation', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectPurchase(pid: string) {
    const reason = prompt("Veuillez saisir la raison du rejet pour cet achat (obligatoire) :");
    if (reason === null) return;
    if (!reason.trim()) {
      notify("La raison du rejet est obligatoire.", 'error');
      return;
    }

    setActionLoading(pid);
    try {
      await apiAdminRejectPurchase(pid, reason.trim());
      setPendingPurchases(prev => prev.filter(p => p.id !== pid));
      if (stats) {
        setStats((prev: any) => prev ? ({
          ...prev,
          pendingPurchases: Math.max(0, (prev.pendingPurchases || 0) - 1),
        }) : prev);
      }
      notify('Achat rejeté.', 'info');
      if (selectedUserDetail) {
        const details = await apiAdminGetUserDetails(selectedUserDetail.user.id);
        setSelectedUserDetail(details);
      }
    } catch (err: any) {
      notify(err.message || 'Erreur lors du rejet', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectAllPurchases() {
    const pendingOnly = pendingPurchases.filter(p => p.status === 'PENDING');
    const count = pendingOnly.length;
    if (count === 0) { notify('Aucune demande en attente.', 'info'); return; }
    if (count <= 3) {
      notify(`Les ${count} demande(s) les plus récentes sont protégées contre le rejet en masse.`, 'info');
      return;
    }
    const rejectCount = count - 3;
    if (!confirm(`Rejeter ${rejectCount} demande(s) non aboutie(s) ?\n\n⚠️ Les 3 plus récentes seront conservées (protection anti-erreur).\n\nCette action est irréversible.`)) return;
    setActionLoading('reject_all');
    try {
      const result = await apiAdminRejectAllPurchases();
      notify(`✅ ${result.count} demande(s) rejetée(s). 🛡️ ${result.protected} conservée(s).`, 'success');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Erreur lors du rejet en masse', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevokePurchase(pid: string) {
    if (!confirm("Voulez-vous vraiment révoquer ce bot ? Cela le supprimera définitivement.")) return;
    setActionLoading(pid);
    try {
      await apiAdminRevokePurchase(pid);
      notify('Bot révoqué avec succès !', 'success');
      await loadData();
      if (selectedUserDetail) {
        const details = await apiAdminGetUserDetails(selectedUserDetail.user.id);
        setSelectedUserDetail(details);
      }
    } catch (err: any) {
      notify(err.message || 'Erreur lors de la révocation', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApproveWithdrawal(txId: string) {
    const target = pendingWithdrawals.find(w => w.id === txId);
    setActionLoading(txId);
    try {
      await apiAdminApproveWithdrawal(txId);

      // Update pendingWithdrawals state locally instantly without reloading whole page
      setPendingWithdrawals(prev => prev.filter(w => w.id !== txId));

      // Update stats locally
      if (target) {
        const amount = Math.abs(target.amountCents || 0);
        const isEligible = target.isEligible;
        setStats((prev: any) => prev ? ({
          ...prev,
          pendingWithdrawals: Math.max(0, (prev.pendingWithdrawals || 0) - 1),
          pendingWithdrawalsTotalCents: Math.max(0, (prev.pendingWithdrawalsTotalCents || 0) - amount),
          eligiblePendingWithdrawalsTotalCents: isEligible
            ? Math.max(0, (prev.eligiblePendingWithdrawalsTotalCents || 0) - amount)
            : (prev.eligiblePendingWithdrawalsTotalCents || 0),
          ineligiblePendingWithdrawalsTotalCents: !isEligible
            ? Math.max(0, (prev.ineligiblePendingWithdrawalsTotalCents || 0) - amount)
            : (prev.ineligiblePendingWithdrawalsTotalCents || 0),
          totalWithdrawalsCents: (prev.totalWithdrawalsCents || 0) + amount,
        }) : prev);
      }

      notify(`Retrait de ${formatXOF(Math.abs(target?.amountCents || 0))} approuvé avec succès !`, 'success');
    } catch (err: any) {
      notify(err.message || 'Erreur lors de l\'approbation du retrait', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectWithdrawal(txId: string) {
    const target = pendingWithdrawals.find(w => w.id === txId);
    const defaultReason = !target?.isEligible
      ? "Vous n'avez aucun parrainage actif, parrainez un ami et relancez votre retrait, votre solde vous a été retourné sur votre compte."
      : "";

    const reason = prompt("Veuillez saisir la raison du rejet pour ce retrait (obligatoire) :", defaultReason);
    if (reason === null) return;
    if (!reason.trim()) {
      notify("La raison du rejet est obligatoire.", 'error');
      return;
    }

    setActionLoading(txId);
    try {
      await apiAdminRejectWithdrawal(txId, reason.trim());

      // Update pendingWithdrawals state locally instantly without reloading whole page
      setPendingWithdrawals(prev => prev.filter(w => w.id !== txId));

      // Update stats locally
      if (target) {
        const amount = Math.abs(target.amountCents || 0);
        const isEligible = target.isEligible;
        setStats((prev: any) => prev ? ({
          ...prev,
          pendingWithdrawals: Math.max(0, (prev.pendingWithdrawals || 0) - 1),
          pendingWithdrawalsTotalCents: Math.max(0, (prev.pendingWithdrawalsTotalCents || 0) - amount),
          eligiblePendingWithdrawalsTotalCents: isEligible
            ? Math.max(0, (prev.eligiblePendingWithdrawalsTotalCents || 0) - amount)
            : (prev.eligiblePendingWithdrawalsTotalCents || 0),
          ineligiblePendingWithdrawalsTotalCents: !isEligible
            ? Math.max(0, (prev.ineligiblePendingWithdrawalsTotalCents || 0) - amount)
            : (prev.ineligiblePendingWithdrawalsTotalCents || 0),
        }) : prev);
      }

      notify('Retrait rejeté.', 'info');
    } catch (err: any) {
      notify(err.message || 'Erreur lors du rejet du retrait', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectIneligibleWithdrawals() {
    const ineligibleList = pendingWithdrawals.filter(w => w.status === 'PENDING' && !w.isEligible);
    const count = ineligibleList.length;

    if (count === 0) {
      notify('Aucune demande de retrait non éligible en attente.', 'info');
      return;
    }

    const defaultReason = "Vous n'avez aucun parrainage actif, parrainez un ami et relancez votre retrait, votre solde vous a été retourné sur votre compte.";

    const customReason = prompt(`⚠️ REJET EN BLOC DE ${count} DEMANDE(S) NON ÉLIGIBLES :\n\nPersonnalisez ou modifiez le motif ci-dessous avant d'envoyer aux clients :`, defaultReason);
    if (customReason === null) return;

    const finalReason = customReason.trim() || defaultReason;

    if (!confirm(`Confirmer le rejet en bloc de ${count} demande(s) avec le motif :\n\n"${finalReason}"`)) {
      return;
    }

    setActionLoading('reject_ineligible');
    try {
      let rejectedCount = 0;
      for (const w of ineligibleList) {
        await apiAdminRejectWithdrawal(w.id, finalReason);
        rejectedCount++;
      }

      setPendingWithdrawals(prev => prev.filter(w => !(w.status === 'PENDING' && !w.isEligible)));
      await loadData();

      notify(`✅ ${rejectedCount} retrait(s) non éligible(s) rejeté(s) en bloc avec succès !`, 'success');
    } catch (err: any) {
      notify(err.message || 'Erreur lors du rejet en bloc', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteWithdrawal(txId: string) {
    if (!confirm('Supprimer définitivement ce retrait rejeté de l\'historique ?')) return;
    setActionLoading('del_' + txId);
    try {
      await apiAdminDeleteWithdrawal(txId);
      setPendingWithdrawals(prev => prev.filter(w => w.id !== txId));
      notify('Retrait supprimé de l\'historique.', 'info');
    } catch (err: any) {
      notify(err.message || 'Erreur lors de la suppression', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveBotConfigs() {
    setActionLoading('bots');
    try {
      await apiAdminUpdateBotPaymentConfigs(
        botConfigs,
        isWinpayActive,
        isSenepayActive,
        isWinpay2Active,
        winpay2WhatsappPhone,
        isWinpayOneActive,
        winpayOneSlackWebhookUrl,
        winpayOneDiscordWebhookUrl,
        winpayOneWhatsappPhone1,
        winpayOneWhatsappApiKey1,
        winpayOneWhatsappPhone2,
        winpayOneWhatsappApiKey2,
        winpayOneWhatsappPhone3,
        winpayOneWhatsappApiKey3
      );
      notify('Configuration Winpay, Winpay 2, WinpayOne, Sene-Pay & Slack Webhook mise à jour !', 'success');
    } catch (err: any) {
      notify(err.message || 'Erreur lors de la mise à jour', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveAnnouncement() {
    if (!editingAnn?.title || !editingAnn?.content) {
      alert('Remplissez le titre et le contenu');
      return;
    }
    setActionLoading('announcement');
    try {
      await apiAdminUpdateAnnouncement(editingAnn);
      alert('Annonce enregistrée !');
      setEditingAnn(null);
      const ann = await apiAdminGetAnnouncements();
      setAnnouncements(ann);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    if (!confirm('Supprimer cette annonce ?')) return;
    setActionLoading(id);
    try {
      await apiAdminDeleteAnnouncement(id);
      const ann = await apiAdminGetAnnouncements();
      setAnnouncements(ann);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleAnnStatus(ann: Announcement) {
    setActionLoading('status-' + ann.id);
    try {
      await apiAdminUpdateAnnouncement({ ...ann, isActive: !ann.isActive });
      const list = await apiAdminGetAnnouncements();
      setAnnouncements(list);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleOpenUserDetails(uid: string) {
    setLoadingDetail(true);
    setSelectedUserDetail(null);
    try {
      const details = await apiAdminGetUserDetails(uid);
      setSelectedUserDetail(details);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  // Chat Handlers
  async function handleSelectChatUser(userId: string) {
    setSelectedChatUser(userId);
    setLoadingChat(true);
    try {
      const { messages } = await apiAdminGetChatMessages(userId);
      setChatMessages(messages);

      setChatConversations(prev => prev.map(c =>
        c.userId === userId ? { ...c, unreadCount: 0 } : c
      ));

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingChat(false);
    }
  }

  async function handleSendAdminMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !selectedChatUser || actionLoading === 'send-chat') return;

    setActionLoading('send-chat');
    const tempText = chatInput.trim();
    setChatInput('');

    const tempMsg = {
      id: 'temp-' + Date.now(),
      sender_role: 'ADMIN',
      content: tempText,
      created_at: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, tempMsg]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const { message } = await apiAdminSendChatMessage(selectedChatUser, tempText);
      setChatMessages(prev => prev.map(m => m.id === tempMsg.id ? message : m));

      setChatConversations(prev => prev.map(c =>
        c.userId === selectedChatUser
          ? { ...c, lastMessage: message.content, lastMessageAt: message.created_at }
          : c
      ));
    } catch (err: any) {
      alert("Erreur lors de l'envoi.");
      setChatMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setChatInput(tempText);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEditMessage(msgId: string) {
    if (!editingMessageContent.trim()) return;
    setActionLoading(`edit-${msgId}`);
    try {
      await apiAdminEditChatMessage(msgId, editingMessageContent.trim());
      setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: editingMessageContent.trim() } : m));
      setEditingMessageId(null);
      setEditingMessageContent('');
    } catch (err: any) {
      alert("Erreur lors de la modification.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteMessage(msgId: string) {
    if (!confirm("Voulez-vous vraiment supprimer ce message ?")) return;
    setActionLoading(`delete-${msgId}`);
    try {
      await apiAdminDeleteChatMessage(msgId);
      setChatMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err: any) {
      alert("Erreur lors de la suppression.");
    } finally {
      setActionLoading(null);
    }
  }

  function handleInitiateChat(u: any, prefillMessage?: string) {
    // Check if conversation exists
    if (!chatConversations.find(c => c.userId === u.id)) {
      setChatConversations(prev => [{
        userId: u.id,
        userPhone: u.phone,
        userName: u.firstName ? `${u.firstName} ${u.lastName || ''}` : null,
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0
      }, ...prev]);
    }
    handleSelectChatUser(u.id);
    if (prefillMessage) {
      setChatInput(prefillMessage);
    }
    setActiveTab('chat');
  }

  // AI Handler
  async function handleSaveAiSettings() {
    if (!aiSettings) return;
    setSavingAi(true);
    try {
      await apiAdminUpdateAiSettings({
        knowledge_base: aiSettings.knowledge_base,
        is_active: aiSettings.is_active
      });
      alert('Configuration IA sauvegardée avec succès !');
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setSavingAi(false);
    }
  }

  // Filter
  const filteredUsers = users.filter(u => {
    const term = search.toLowerCase();
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    return u.phone?.includes(term) || u.referralCode?.toLowerCase().includes(term) || fullName.includes(term);
  });

  const filteredWithdrawals = pendingWithdrawals.filter(w => {
    // Status filter
    if (withdrawalStatusFilter !== 'ALL' && w.status !== withdrawalStatusFilter) {
      return false;
    }
    // Eligibility filter
    if (withdrawalEligibilityFilter === 'ELIGIBLE' && !w.isEligible) {
      return false;
    }
    if (withdrawalEligibilityFilter === 'INELIGIBLE' && w.isEligible) {
      return false;
    }
    // Search filter
    const term = withdrawalSearch.toLowerCase();
    const userName = (w.userName || '').toLowerCase();
    const userPhone = (w.userPhone || '').toLowerCase();
    return userName.includes(term) || userPhone.includes(term);
  }).sort((a, b) => (b.isPriorityBoost ? 1 : 0) - (a.isPriorityBoost ? 1 : 0));

  const pendingWithdrawalsCount = pendingWithdrawals.filter(w => w.status === 'PENDING').length;
  const pendingPurchasesOnly = pendingPurchases.filter(p => p.status === 'PENDING');
  const winpayPendingCount = allPurchases.filter(p => p.status === 'PENDING').length || pendingPurchasesOnly.length;

  const NAV_ITEMS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Tableau de bord', icon: TrendingUp },
    { key: 'users', label: 'Utilisateurs', icon: Users },
    { key: 'winpay', label: 'Achats Winpay', icon: CreditCard },
    { key: 'withdrawals', label: `Retraits (${pendingWithdrawalsCount})`, icon: CreditCard },
    { key: 'bots', label: 'Configuration Bots/SSD', icon: Settings },
    { key: 'announcements', label: 'Annonces Popups', icon: Megaphone },
    { key: 'chat', label: 'Support Client', icon: MessageCircle },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: '#F9FAFB', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Toast Notification Banner */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 99999,
          background: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#DC2626' : '#2563EB',
          color: 'white', padding: '14px 22px', borderRadius: 14,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10,
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Mobile Top Bar */}
      <div className="mobile-header" style={{
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: '#111827',
        color: 'white',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <button
          onClick={() => setMobileMenuOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {/* Hamburger menu icon */}
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>WINARY AI</div>
        <div style={{ width: 24 }} /> {/* Balance spacer */}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 95,
            }}
          />
        )}

        {/* Sidebar */}
        <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          {/* Logo */}
          <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden' }}>
                <Image src="/logo.png" alt="Logo" width={32} height={32} style={{ objectFit: 'cover' }} />
              </div>
              <div style={{
                fontSize: 18, fontWeight: 800, color: 'white',
                fontFamily: 'Space Grotesk, sans-serif',
              }}>WINARY AI</div>
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Administration</div>
          </div>

          {/* Nav */}
          <nav style={{ padding: '16px 12px', flex: 1 }}>
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => { setActiveTab(key); setSearch(''); setMobileMenuOpen(false); }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, marginBottom: 4,
                background: activeTab === key ? '#1A56DB' : 'transparent',
                color: activeTab === key ? 'white' : '#9CA3AF',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 13, fontWeight: activeTab === key ? 700 : 400,
                transition: 'all 150ms ease',
              }}>
                <Icon size={16} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{label}</span>
                  {key === 'winpay' && winpayPendingCount > 0 && (
                    <span style={{
                      background: '#EF4444', color: 'white', fontSize: 10,
                      fontWeight: 700, borderRadius: 99, padding: '2px 7px',
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                    }}>{winpayPendingCount}</span>
                  )}
                  {key === 'withdrawals' && pendingWithdrawals.length > 0 && (
                    <span style={{
                      background: '#EF4444', color: 'white', fontSize: 10,
                      fontWeight: 700, borderRadius: 99, padding: '2px 6px',
                    }}>{pendingWithdrawals.length}</span>
                  )}
                  {key === 'chat' && stats?.pendingSupportMessages > 0 && (
                    <span style={{
                      background: '#EF4444', color: 'white', fontSize: 10,
                      fontWeight: 700, borderRadius: 99, padding: '2px 6px',
                    }}>{stats.pendingSupportMessages}</span>
                  )}
                </div>
              </button>
            ))}
          </nav>

          {/* Reload & Logout */}
          <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => { loadData(); setMobileMenuOpen(false); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.05)', color: '#D1D5DB',
              border: 'none', cursor: 'pointer', fontSize: 13,
            }}>
              <RefreshCw size={16} /> Actualiser
            </button>
            <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: 'transparent', color: '#9CA3AF',
              border: 'none', cursor: 'pointer', fontSize: 13,
            }}>
              <LogOut size={16} /> Déconnexion
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="admin-main">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <Loader2 size={32} color="#1A56DB" style={{ animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* ── Dashboard ── */}
              {activeTab === 'dashboard' && (
                <div>
                  {/* ── PWA Web Push Notification Banner ── */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1E3A8A, #1D4ED8)',
                    color: 'white', borderRadius: 16, padding: '16px 20px', marginBottom: 24,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
                    boxShadow: '0 4px 14px rgba(29, 78, 216, 0.25)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 26 }}>📲</span>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>
                          Application PWA & Notifications Instantanées (Alerte Stripe)
                        </h3>
                        <p style={{ fontSize: 12, opacity: 0.9, margin: 0 }}>
                          Compatible Android, iPhone & Windows. Recevez un son Stripe et une alerte push à chaque paiement validé.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      {notificationPermission !== 'granted' ? (
                        <button
                          onClick={requestNotificationPermission}
                          style={{
                            background: '#10B981', color: 'white', border: 'none', borderRadius: 10,
                            padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          🔔 Activer les Notifications Push
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => {
                              playSuccessSound();
                              triggerNativeNotification(
                                '🟢 10.000 F - Succès',
                                'Bot Gam 3 | Client: +22997000000 | Réseau: MTN MoMo'
                              );
                              notify('🟢 Test notification Succès (10.000 F)', 'success');
                            }}
                            style={{
                              background: '#10B981', color: 'white', border: 'none',
                              borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                            }}
                          >
                            🟢 Test Succès (10.000 F)
                          </button>
                          <button
                            onClick={() => {
                              playFailedSound();
                              triggerNativeNotification(
                                '🔴 4.000 F - Échoué',
                                'Bot Gam 1 | Client: +22997000000 | SMS erroné'
                              );
                              notify('🔴 Test notification Échoué (4.000 F)', 'error');
                            }}
                            style={{
                              background: '#EF4444', color: 'white', border: 'none',
                              borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                            }}
                          >
                            🔴 Test Échec (4.000 F)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                    <StatCard label="Utilisateurs" value={stats?.totalUsers || 0} icon="👥" color="#1A56DB" />
                    <StatCard label="Total Revenu Approuvé" value={formatXOF(stats?.totalRevenueCents || 0)} icon="💰" color="#15803D" />
                    <StatCard label="Total Retraits Approuvés" value={formatXOF(stats?.totalWithdrawalsCents || 0)} icon="💸" color="#10B981" />
                    <StatCard label="Achats en attente SSD" value={pendingPurchasesOnly.length} icon="🤖" color="#7C3AED" onClick={() => setActiveTab('pending')} />
                    <StatCard
                      label={`Retraits en attente (${stats?.pendingWithdrawals || 0})`}
                      value={formatXOF(stats?.pendingWithdrawalsTotalCents || 0)}
                      icon="⏳"
                      color="#D97706"
                      onClick={() => setActiveTab('withdrawals')}
                    />
                    <StatCard
                      label="Retraits Éligibles"
                      value={formatXOF(stats?.eligiblePendingWithdrawalsTotalCents || 0)}
                      icon="✅"
                      color="#16A34A"
                      onClick={() => setActiveTab('withdrawals')}
                    />
                    <StatCard
                      label="Retraits Non Éligibles"
                      value={formatXOF(stats?.ineligiblePendingWithdrawalsTotalCents || 0)}
                      icon="⛔"
                      color="#DC2626"
                      onClick={() => setActiveTab('withdrawals')}
                    />
                  </div>

                  {/* AI Config Block */}
                  <div style={{
                    background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB', padding: 24, marginBottom: 24,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#111827' }}>Configuration Intelligence Artificielle</h2>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#4B5563' }}>Activer l'IA Globale</span>
                        <div style={{
                          width: 44, height: 24, borderRadius: 12, position: 'relative', transition: 'background 0.3s',
                          background: aiSettings?.is_active ? '#10B981' : '#D1D5DB'
                        }} onClick={() => aiSettings && setAiSettings({ ...aiSettings, is_active: !aiSettings.is_active })}>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%', background: 'white',
                            position: 'absolute', top: 2, left: aiSettings?.is_active ? 22 : 2,
                            transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }} />
                        </div>
                      </label>
                    </div>
                    {aiSettings?.last_error && (
                      <div style={{
                        background: '#FEF2F2', border: '1px solid #F87171', borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                        display: 'flex', alignItems: 'center', gap: 10, color: '#B91C1C', fontSize: 13, fontWeight: 600
                      }}>
                        <AlertCircle size={20} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: 2 }}>⚠️ Dernière erreur système (invisible pour les clients) :</div>
                          <div style={{ fontWeight: 400, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-word' }}>
                            {aiSettings.last_error}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            const updated = { ...aiSettings, last_error: null };
                            setAiSettings(updated);
                            await apiAdminUpdateAiSettings({ knowledge_base: updated.knowledge_base, is_active: updated.is_active });
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#B91C1C', cursor: 'pointer', padding: 4 }}
                          title="Effacer l'erreur"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                        Base de connaissances (Instructions pour l'IA)
                      </label>
                      <textarea
                        value={aiSettings?.knowledge_base || ''}
                        onChange={e => aiSettings && setAiSettings({ ...aiSettings, knowledge_base: e.target.value })}
                        style={{
                          width: '100%', minHeight: 150, padding: 16, borderRadius: 12, border: '1px solid #D1D5DB',
                          fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'monospace'
                        }}
                        placeholder="Décrivez les règles, prix, et le rôle de l'IA ici..."
                      />
                      <p style={{ fontSize: 12, color: '#6B7280', margin: '8px 0 0' }}>
                        Cette base sera lue par l'IA à chaque fois qu'un utilisateur enverra un message.
                        Ne dites pas à l'IA d'inventer des informations, dites-lui de demander de l'aide si elle ne sait pas.
                      </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={handleSaveAiSettings}
                        disabled={savingAi}
                        style={{
                          background: '#1A56DB', color: 'white', border: 'none', borderRadius: 8,
                          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: savingAi ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 8
                        }}
                      >
                        {savingAi && <Loader2 size={16} style={{ animation: 'spin 0.8s linear' }} />}
                        Enregistrer la configuration IA
                      </button>
                    </div>
                  </div>

                  {pendingPurchasesOnly.length > 0 && (
                    <div style={{
                      background: '#EFF6FF', border: '1.5px solid #BFDBFE',
                      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
                      display: 'flex', alignItems: 'center', gap: 10, color: '#1D4ED8', cursor: 'pointer',
                    }} onClick={() => setActiveTab('pending')}>
                      <AlertCircle size={18} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {pendingPurchasesOnly.length} demande(s) d'achats de bot SSD en attente de vérification
                      </span>
                    </div>
                  )}

                  {pendingWithdrawals.length > 0 && (
                    <div style={{
                      background: '#FEF3C7', border: '1.5px solid #FDE68A',
                      borderRadius: 14, padding: '14px 16px', marginBottom: 12,
                      display: 'flex', alignItems: 'center', gap: 10, color: '#D97706', cursor: 'pointer',
                    }} onClick={() => setActiveTab('withdrawals')}>
                      <AlertCircle size={18} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {pendingWithdrawals.length} demande(s) de retrait en attente de traitement
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Users ── */}
              {activeTab === 'users' && (
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 20px', fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
                    Gestion des Utilisateurs
                  </h1>
                  <div style={{ position: 'relative', marginBottom: 16 }}>
                    <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                    <input
                      className="input-field"
                      placeholder="Rechercher par nom, téléphone ou code..."
                      value={search} onChange={e => setSearch(e.target.value)}
                      style={{ paddingLeft: 40 }}
                    />
                  </div>

                  <div className="table-container" style={{ background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB' }}>
                    <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                          {['Utilisateur', 'Code Parrainage', 'Filleuls', 'Solde', 'Commissions', 'Retraits', 'Statut', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u, i) => (
                          <tr key={u.id} style={{ borderBottom: i < filteredUsers.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: '#111827' }}>
                              <div style={{ fontWeight: 600 }}>{u.firstName ? `${u.firstName} ${u.lastName || ''}` : '—'}</div>
                              <div style={{ fontSize: 12, color: '#6B7280' }}>{u.phone}</div>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>
                              {u.referralCode}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                              {u.referralsCount}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1A56DB' }}>
                              {formatXOF(u.balanceCents || 0)}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#10B981' }}>
                              {formatXOF(u.commissionsCents || 0)}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 13 }}>
                              <div style={{ fontWeight: 700, color: '#D97706' }}>
                                {formatXOF(u.withdrawalsTotalCents || 0)}
                              </div>
                              <div style={{ fontSize: 11, color: '#6B7280' }}>
                                {u.withdrawalsCount || 0} validé(s)
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span className={u.status === 'BLOCKED' ? 'badge-expired' : 'badge-active'} style={{
                                padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                              }}>
                                {u.status || 'ACTIVE'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => handleInitiateChat(u)}
                                style={{
                                  background: '#F3F4F6', border: 'none', borderRadius: 8,
                                  padding: '6px 12px', fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', color: '#4B5563',
                                }}
                              >
                                Contacter
                              </button>
                              <button
                                onClick={() => handleOpenUserDetails(u.id)}
                                style={{
                                  background: '#EFF6FF', border: 'none', borderRadius: 8,
                                  padding: '6px 12px', fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', color: '#1A56DB',
                                }}
                              >
                                Fiche / Détails
                              </button>
                              <button
                                onClick={() => handleToggleUser(u.id, u.status || 'ACTIVE')}
                                style={{
                                  background: u.status === 'BLOCKED' ? '#DCFCE7' : '#FEE2E2',
                                  border: 'none', borderRadius: 8, padding: '6px 12px',
                                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                  color: u.status === 'BLOCKED' ? '#15803D' : '#DC2626',
                                }}
                              >
                                {u.status === 'BLOCKED' ? 'Débloquer' : 'Bloquer'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Achats Winpay Tab ── */}
              {activeTab === 'winpay' && (() => {
                // Filter purchases starting strictly from 25/07/2026 (00:00:00)
                const startDateMs = new Date('2026-07-25T00:00:00.000Z').getTime();
                const todayPurchases = allPurchases.filter(p => {
                  if (!p.purchasedAt) return false;
                  return new Date(p.purchasedAt).getTime() >= startDateMs;
                });

                return (
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
                      ⚡ Suivi des Achats Winpay (À partir du 25/07/2026)
                    </h1>
                    <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 20px' }}>
                      Historique en temps réel des transactions du jour (25/07/2026+). Glissez horizontalement si nécessaire. Cliquez sur "Contacter Client" pour aider immédiatement !
                    </p>

                    {/* Summary Cards */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                      <StatCard label="Total Tentatives Aujourd'hui" value={todayPurchases.length} icon="⚡" color="#1A56DB" />
                      <StatCard label="⏳ En Attente d'Approbation" value={todayPurchases.filter(p => p.status === 'PENDING').length} icon="⏳" color="#D97706" />
                      <StatCard label="🟢 Paiements Validés" value={todayPurchases.filter(p => p.status === 'ACTIVE').length} icon="✅" color="#15803D" />
                      <StatCard label="🔴 Messages Erronés / Échoués" value={todayPurchases.filter(p => p.status === 'FAILED' || p.status === 'EXPIRED').length} icon="⚠️" color="#DC2626" />
                    </div>

                    {/* Filters & Search */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                          { key: 'ALL', label: 'Tous' },
                          { key: 'PENDING', label: '⏳ En Attente d\'Approbation' },
                          { key: 'ACTIVE', label: '🟢 Validés (Succès)' },
                          { key: 'FAILED', label: '🔴 SMS Erronés / Échoués' },
                        ].map(f => (
                          <button
                            key={f.key}
                            onClick={() => setWinpayFilter(f.key as any)}
                            style={{
                              padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              border: winpayFilter === f.key ? '2px solid #1A56DB' : '1px solid #E5E7EB',
                              background: winpayFilter === f.key ? '#EFF6FF' : '#FFFFFF',
                              color: winpayFilter === f.key ? '#1A56DB' : '#4B5563',
                            }}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <input
                        className="input-field"
                        placeholder="Rechercher par téléphone, bot ou SMS..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: 280, fontSize: 13 }}
                      />
                    </div>

                    {/* Data Table Container with Smooth Horizontal Scroll */}
                    <div style={{
                      background: 'white',
                      borderRadius: 16,
                      border: '1.5px solid #E5E7EB',
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                    }}>
                      <table style={{ width: '100%', minWidth: 950, borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280', fontWeight: 700 }}>
                            <th style={{ padding: '12px 16px', minWidth: 110 }}>Date</th>
                            <th style={{ padding: '12px 16px', minWidth: 150 }}>Client</th>
                            <th style={{ padding: '12px 16px', minWidth: 130 }}>Bot & Prix</th>
                            <th style={{ padding: '12px 16px', minWidth: 120 }}>Réseau</th>
                            <th style={{ padding: '12px 16px', minWidth: 220 }}>Message / Référence SMS</th>
                            <th style={{ padding: '12px 16px', minWidth: 150 }}>Statut</th>
                            <th style={{ padding: '12px 16px', minWidth: 220, textAlign: 'center' }}>Actions Support</th>
                          </tr>
                        </thead>
                        <tbody>
                          {todayPurchases.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                                Aucun achat Winpay enregistré pour la journée du 25/07/2026.
                              </td>
                            </tr>
                          ) : (
                            todayPurchases
                              .filter(p => {
                                if (winpayFilter === 'PENDING') return p.status === 'PENDING';
                                if (winpayFilter === 'ACTIVE') return p.status === 'ACTIVE';
                                if (winpayFilter === 'FAILED') return p.status === 'FAILED' || p.status === 'EXPIRED';
                                return true;
                              })
                              .filter(p => {
                                if (!search.trim()) return true;
                                const q = search.toLowerCase();
                                return (
                                  p.userPhone?.toLowerCase().includes(q) ||
                                  p.botName?.toLowerCase().includes(q) ||
                                  p.txReference?.toLowerCase().includes(q) ||
                                  p.userName?.toLowerCase().includes(q)
                                );
                              })
                              .map(p => {
                                const isPending = p.status === 'PENDING';
                                const isFailed = p.status === 'FAILED' || p.status === 'EXPIRED';
                                const formattedDate = new Date(p.purchasedAt).toLocaleString('fr-FR', {
                                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                });

                                return (
                                  <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6', background: isPending ? '#FFFBEB' : (isFailed ? '#FEF2F2' : 'white') }}>
                                    <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: 12 }}>{formattedDate}</td>
                                    <td style={{ padding: '14px 16px' }}>
                                      <div style={{ fontWeight: 700, color: '#111827' }}>{p.userPhone}</div>
                                      {p.userName && <div style={{ fontSize: 11, color: '#6B7280' }}>{p.userName}</div>}
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      <div style={{ fontWeight: 700, color: '#1A56DB' }}>{p.botName}</div>
                                      <div style={{ fontSize: 11, color: '#4B5563' }}>{formatXOF(p.pricePaidCents)}</div>
                                    </td>
                                    <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                                      {p.operator === 'WINPAY2' ? '📲 WINPAY 2 (WhatsApp)' : p.operator === 'MTN' ? '🟡 MTN MoMo' : p.operator === 'MOOV' ? '🔵 Moov Money' : (p.operator === 'CELTIIS' || p.operator?.includes('Celtiis')) ? '🟣 Celtiis Cash' : p.operator === 'SENEPAY' ? '💳 Sene-Pay (API)' : p.operator}
                                    </td>
                                    <td style={{ padding: '14px 16px', maxWidth: 350, wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
                                      <div style={{
                                        background: isPending ? '#FEF3C7' : (isFailed ? '#FEE2E2' : '#F8FAFC'),
                                        padding: '10px 14px', borderRadius: 12, color: isPending ? '#92400E' : (isFailed ? '#991B1B' : '#0F172A'),
                                        border: isPending ? '1.5px solid #FDE68A' : '1px solid #E2E8F0',
                                        display: 'flex', flexDirection: 'column', gap: 6
                                      }}>
                                        <div style={{ fontWeight: 700, fontSize: 13, wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                          {p.txReference || 'Aucun message transmis'}
                                        </div>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(p.txReference || '');
                                            notify('📋 Message copié dans le presse-papier !', 'info');
                                          }}
                                          style={{
                                            alignSelf: 'flex-end', background: 'white', border: '1px solid #CBD5E1',
                                            borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                                            fontWeight: 700, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 4
                                          }}
                                          title="Copier le message complet"
                                        >
                                          📋 Copier le message
                                        </button>
                                      </div>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                      {isPending ? (
                                        <span style={{ background: '#FEF3C7', color: '#D97706', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>
                                          ⏳ En Attente d'Approbation
                                        </span>
                                      ) : isFailed ? (
                                        <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>
                                          🔴 SMS Erroné / Échoué
                                        </span>
                                      ) : (
                                        <span style={{ background: '#DCFCE7', color: '#15803D', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>
                                          🟢 Validé (Succès)
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                                        {isPending && (
                                          <>
                                            <button
                                              onClick={() => handleApprovePurchase(p.id)}
                                              disabled={actionLoading === p.id}
                                              style={{
                                                background: '#16A34A', color: 'white', border: 'none',
                                                borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                                                display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
                                              }}
                                            >
                                              {actionLoading === p.id ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear' }} /> : '✅ Approuver'}
                                            </button>
                                            <button
                                              onClick={() => handleRejectPurchase(p.id)}
                                              disabled={actionLoading === p.id}
                                              style={{
                                                background: '#DC2626', color: 'white', border: 'none',
                                                borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                                                display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                                              }}
                                            >
                                              ❌ Rejeter
                                            </button>
                                          </>
                                        )}
                                        <button
                                          onClick={() => handleInitiateChat({ id: p.userId, phone: p.userPhone, firstName: p.userName }, `Bonjour, concernant votre achat du bot ${p.botName} via ${p.operator} (${formatXOF(p.pricePaidCents)})...`)}
                                          className="btn-press"
                                          style={{
                                            background: isPending ? '#1D4ED8' : (isFailed ? '#DC2626' : '#64748B'), color: 'white', border: 'none',
                                            borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                            display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                                          }}
                                        >
                                          <MessageCircle size={13} /> Contacter
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ── Pending Purchases Approval ── */}
              {activeTab === 'pending' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
                        Demandes d'achats SSD
                      </h1>
                      <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>
                        Vérifiez la transaction Mobile Money reçue sur votre téléphone et validez l'achat du bot.
                      </p>
                    </div>
                    {pendingPurchasesOnly.length > 0 && (
                      <button
                        onClick={handleRejectAllPurchases}
                        disabled={actionLoading === 'reject_all'}
                        style={{
                          background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                          color: 'white', border: 'none', borderRadius: 10,
                          padding: '10px 18px', fontSize: 13, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                          boxShadow: '0 4px 12px rgba(185,28,28,0.3)',
                          flexShrink: 0,
                        }}
                      >
                        {actionLoading === 'reject_all'
                          ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                          : <X size={14} />}
                        Tout rejeter ({pendingPurchasesOnly.length})
                      </button>
                    )}
                  </div>

                  {pendingPurchasesOnly.length === 0 ? (
                    <div style={{
                      background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB',
                      padding: '40px 20px', textAlign: 'center',
                    }}>
                      <span style={{ fontSize: 32 }}>💤</span>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '8px 0 2px' }}>Aucun achat en attente</h3>
                      <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Toutes les demandes de bot ont été traitées.</p>
                    </div>
                  ) : (
                    <div className="table-container" style={{ background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB' }}>
                      <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                            {['Acheteur', 'Bot', 'Montant', 'Opérateur', 'Réf. Transaction', 'Date de demande', 'Actions'].map(h => (
                              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pendingPurchasesOnly.map((p, i) => (
                            <tr key={p.id} style={{ borderBottom: i < pendingPurchasesOnly.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                              <td style={{ padding: '12px 16px', fontSize: 13, color: '#111827' }}>
                                <div style={{ fontWeight: 600 }}>{p.userName || '—'}</div>
                                <div style={{ fontSize: 12, color: '#6B7280' }}>{p.userPhone}</div>
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                                {p.botName}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1A56DB' }}>
                                {formatXOF(p.pricePaidCents)}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: 13 }}>
                                <span style={{ fontSize: 15, marginRight: 4 }}>{p.operator === 'MTN' ? '🟡' : '🔵'}</span>
                                {p.operator}
                              </td>
                              <td style={{ padding: '12px 16px', maxWidth: 280, wordBreak: 'break-word', fontFamily: 'monospace', fontSize: 12 }}>
                                <div style={{
                                  background: '#FEF3C7', color: '#92400E', padding: '6px 10px',
                                  borderRadius: 8, border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6
                                }}>
                                  <span style={{ fontWeight: 700, fontSize: 12, wordBreak: 'break-all' }}>{p.txReference || 'N/A'}</span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(p.txReference || '');
                                      notify('📋 Message copié !', 'info');
                                    }}
                                    style={{ background: 'white', border: '1px solid #CBD5E1', borderRadius: 6, padding: '3px 6px', fontSize: 10, cursor: 'pointer', flexShrink: 0, fontWeight: 700, color: '#334155' }}
                                    title="Copier le message"
                                  >
                                    📋 Copier
                                  </button>
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>
                                {new Date(p.purchasedAt).toLocaleString('fr-BJ')}
                              </td>
                              <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                                <button
                                  onClick={() => handleApprovePurchase(p.id)}
                                  disabled={actionLoading === p.id}
                                  style={{
                                    background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
                                    padding: '6px 12px', fontSize: 12, fontWeight: 700,
                                    cursor: 'pointer', color: '#1A56DB', display: 'flex', alignItems: 'center', gap: 4,
                                  }}
                                >
                                  {actionLoading === p.id ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear' }} /> : <Check size={12} />}
                                  Approuver
                                </button>
                                <button
                                  onClick={() => handleRejectPurchase(p.id)}
                                  disabled={actionLoading === p.id}
                                  style={{
                                    background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 8,
                                    padding: '6px 12px', fontSize: 12, fontWeight: 700,
                                    cursor: 'pointer', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 4,
                                  }}
                                >
                                  <X size={12} />
                                  Rejeter
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Pending Withdrawals & History Approval ── */}
              {activeTab === 'withdrawals' && (() => {
                const pendingCount = pendingWithdrawals.filter(w => w.status === 'PENDING').length;
                const approvedCount = pendingWithdrawals.filter(w => w.status === 'COMPLETED').length;
                const rejectedCount = pendingWithdrawals.filter(w => w.status === 'FAILED').length;
                const totalWithdrawalsCount = pendingWithdrawals.length;

                const eligiblePendingCount = pendingWithdrawals.filter(w => w.status === 'PENDING' && w.isEligible).length;
                const ineligiblePendingCount = pendingWithdrawals.filter(w => w.status === 'PENDING' && !w.isEligible).length;

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                      <div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
                          Demandes & Historique des retraits
                        </h1>
                        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
                          Traitez les demandes en attente ou filtrez pour consulter l'historique des retraits validés et rejetés.
                        </p>
                      </div>

                      {ineligiblePendingCount > 0 && (
                        <button
                          onClick={handleRejectIneligibleWithdrawals}
                          disabled={actionLoading === 'reject_ineligible'}
                          style={{
                            background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                            color: 'white', border: 'none', borderRadius: 12,
                            padding: '10px 18px', fontSize: 13, fontWeight: 800,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)', flexShrink: 0
                          }}
                        >
                          {actionLoading === 'reject_ineligible'
                            ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                            : <X size={16} />}
                          ⛔ Rejeter les {ineligiblePendingCount} non éligibles en bloc
                        </button>
                      )}
                    </div>

                    {/* Onglets de Filtrage par Statut (En attente, Approuvés, Rejetés, Tous) */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                      {[
                        { id: 'PENDING', label: '⏳ En attente', count: pendingCount, color: '#D97706', bg: '#FFFBEB' },
                        { id: 'COMPLETED', label: '✅ Approuvés', count: approvedCount, color: '#15803D', bg: '#F0FDF4' },
                        { id: 'FAILED', label: '⛔ Rejetés', count: rejectedCount, color: '#B91C1C', bg: '#FEF2F2' },
                        { id: 'ALL', label: '📋 Tous les retraits', count: totalWithdrawalsCount, color: '#1D4ED8', bg: '#EFF6FF' },
                      ].map(tab => {
                        const isActive = withdrawalStatusFilter === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setWithdrawalStatusFilter(tab.id as any);
                              setWithdrawalEligibilityFilter('ALL');
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                              border: isActive ? `2px solid ${tab.color}` : '1.5px solid #E5E7EB',
                              background: isActive ? tab.bg : 'white',
                              color: isActive ? tab.color : '#374151',
                              cursor: 'pointer', transition: 'all 0.15s ease',
                              boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                            }}
                          >
                            <span>{tab.label}</span>
                            <span style={{
                              background: isActive ? tab.color : '#E5E7EB',
                              color: isActive ? 'white' : '#6B7280',
                              padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 800,
                            }}>
                              {tab.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Sous-filtres par éligibilité (parrainage) quand on consulte les retraits en attente ou tous */}
                    {(withdrawalStatusFilter === 'PENDING' || withdrawalStatusFilter === 'ALL') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Éligibilité :</span>
                        {[
                          { id: 'ALL', label: 'Tous', count: withdrawalStatusFilter === 'PENDING' ? pendingCount : totalWithdrawalsCount },
                          { id: 'ELIGIBLE', label: '✅ Éligibles (Parrain actif)', count: eligiblePendingCount },
                          { id: 'INELIGIBLE', label: '⛔ Non éligibles (Sans parrain)', count: ineligiblePendingCount },
                        ].map(sub => {
                          const isActive = withdrawalEligibilityFilter === sub.id;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => setWithdrawalEligibilityFilter(sub.id as any)}
                              style={{
                                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                                border: isActive ? '1.5px solid #1A56DB' : '1px solid #D1D5DB',
                                background: isActive ? '#EFF6FF' : 'white',
                                color: isActive ? '#1A56DB' : '#4B5563',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                              }}
                            >
                              {sub.label}
                              <span style={{ fontSize: 11, opacity: 0.8 }}>({sub.count})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Synthèse rapide pour l'onglet En attente */}
                    {withdrawalStatusFilter === 'PENDING' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                        <div style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total En Attente</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#92400E', fontFamily: 'Space Grotesk, sans-serif', marginTop: 2 }}>
                            {formatXOF(stats?.pendingWithdrawalsTotalCents || 0)}
                          </div>
                          <div style={{ fontSize: 12, color: '#B45309', marginTop: 4, fontWeight: 600 }}>
                            {pendingCount} demande(s) au total
                          </div>
                        </div>

                        <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.5 }}>✅ Retraits Éligibles</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#166534', fontFamily: 'Space Grotesk, sans-serif', marginTop: 2 }}>
                            {formatXOF(pendingWithdrawals.filter(w => w.status === 'PENDING' && w.isEligible).reduce((sum, w) => sum + Math.abs(w.amountCents), 0))}
                          </div>
                          <div style={{ fontSize: 12, color: '#15803D', marginTop: 4, fontWeight: 600 }}>
                            {eligiblePendingCount} demande(s) (Parrain actif)
                          </div>
                        </div>

                        <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: 0.5 }}>⛔ Retraits Non Éligibles</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#991B1B', fontFamily: 'Space Grotesk, sans-serif', marginTop: 2 }}>
                            {formatXOF(pendingWithdrawals.filter(w => w.status === 'PENDING' && !w.isEligible).reduce((sum, w) => sum + Math.abs(w.amountCents), 0))}
                          </div>
                          <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 4, fontWeight: 600 }}>
                            {ineligiblePendingCount} demande(s) (Sans parrainage)
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Search Bar for Withdrawals */}
                    {pendingWithdrawals.length > 0 && (
                      <div style={{ position: 'relative', marginBottom: 16 }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                        <input
                          className="input-field"
                          placeholder="Rechercher par nom d'utilisateur ou numéro de téléphone..."
                          value={withdrawalSearch}
                          onChange={e => setWithdrawalSearch(e.target.value)}
                          style={{ paddingLeft: 40 }}
                        />
                      </div>
                    )}

                    {pendingWithdrawals.length === 0 ? (
                      <div style={{
                        background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB',
                        padding: '40px 20px', textAlign: 'center',
                      }}>
                        <span style={{ fontSize: 32 }}>💤</span>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '8px 0 2px' }}>Aucun retrait enregistré</h3>
                        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Aucune demande de retrait n'a été soumise pour le moment.</p>
                      </div>
                    ) : filteredWithdrawals.length === 0 ? (
                      <div style={{
                        background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB',
                        padding: '40px 20px', textAlign: 'center',
                      }}>
                        <span style={{ fontSize: 32 }}>🔍</span>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '8px 0 2px' }}>Aucun résultat trouvé</h3>
                        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                          {withdrawalSearch
                            ? `Aucun retrait ne correspond à votre recherche "${withdrawalSearch}".`
                            : withdrawalStatusFilter === 'PENDING'
                              ? 'Toutes les demandes de retrait ont été traitées.'
                              : withdrawalStatusFilter === 'COMPLETED'
                                ? 'Aucun retrait approuvé enregistré.'
                                : withdrawalStatusFilter === 'FAILED'
                                  ? 'Aucun retrait rejeté enregistré.'
                                  : 'Aucun retrait ne correspond aux filtres sélectionnés.'}
                        </p>
                      </div>
                    ) : (
                      <div className="table-container" style={{ background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB' }}>
                        <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                              {['Utilisateur', 'Éligibilité', 'Description', 'Montant', 'Date', 'Statut / Actions'].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredWithdrawals.map((w, i) => (
                              <tr key={w.id} style={{
                                borderBottom: i < filteredWithdrawals.length - 1 ? '1px solid #F3F4F6' : 'none',
                                background: w.isPriorityBoost ? '#FEFCE8' : 'transparent',
                              }}>
                                <td style={{ padding: '12px 16px', fontSize: 13, color: '#111827' }}>
                                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {w.userName || '—'}
                                    {w.isPriorityBoost && <span title="Priority Boost Actif">⚡</span>}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#6B7280' }}>{w.userPhone}</div>
                                </td>
                                {/* ── Badge éligibilité parrainage & Retraits antérieurs ── */}
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {w.isPriorityBoost && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800,
                                        background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white', width: 'fit-content',
                                        boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)'
                                      }}>
                                        ⚡ RETRAIT PRIORITAIRE (PRIORITY BOOST)
                                      </span>
                                    )}
                                    {w.isEligible ? (
                                      <>
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 4,
                                          padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                                          background: '#DCFCE7', color: '#15803D', width: 'fit-content',
                                        }}>
                                          ✅ Parrain actif
                                        </span>
                                        <span style={{ fontSize: 11, color: '#6B7280' }}>
                                          {formatXOF(w.commissionsCents)} gagné(s)
                                        </span>
                                      </>
                                    ) : (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                                        background: '#FEE2E2', color: '#B91C1C', width: 'fit-content',
                                      }}>
                                        ⛔ Non éligible
                                      </span>
                                    )}

                                    {/* Badges de retraits déjà effectués */}
                                    <div style={{
                                      fontSize: 11, fontWeight: 600,
                                      color: (w.approvedWithdrawalsCount || 0) > 0 ? '#1D4ED8' : '#6B7280',
                                      background: (w.approvedWithdrawalsCount || 0) > 0 ? '#EFF6FF' : '#F3F4F6',
                                      padding: '2px 8px', borderRadius: 6, width: 'fit-content', marginTop: 2,
                                      border: (w.approvedWithdrawalsCount || 0) > 0 ? '1px solid #BFDBFE' : '1px solid #E5E7EB',
                                    }}>
                                      {(w.approvedWithdrawalsCount || 0) > 0
                                        ? `💳 ${w.approvedWithdrawalsCount} retrait(s) déjà effectué(s)`
                                        : `🆕 1er retrait (0 effectué)`}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                                  {w.description}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
                                  {formatXOF(Math.abs(w.amountCents))}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>
                                  {new Date(w.createdAt).toLocaleString('fr-BJ')}
                                </td>
                                <td style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                                  {w.status === 'PENDING' ? (
                                    <>
                                      <button
                                        onClick={() => handleApproveWithdrawal(w.id)}
                                        disabled={actionLoading === w.id}
                                        style={{
                                          background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
                                          padding: '6px 12px', fontSize: 12, fontWeight: 700,
                                          cursor: 'pointer', color: '#1A56DB', display: 'flex', alignItems: 'center', gap: 4,
                                        }}
                                      >
                                        {actionLoading === w.id ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear' }} /> : <Check size={12} />}
                                        Approuver
                                      </button>
                                      <button
                                        onClick={() => handleRejectWithdrawal(w.id)}
                                        disabled={actionLoading === w.id}
                                        style={{
                                          background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 8,
                                          padding: '6px 12px', fontSize: 12, fontWeight: 700,
                                          cursor: 'pointer', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 4,
                                        }}
                                      >
                                        <X size={12} />
                                        Rejeter
                                      </button>
                                    </>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{
                                        padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                                        background: w.status === 'COMPLETED' ? '#DCFCE7' : '#FEE2E2',
                                        color: w.status === 'COMPLETED' ? '#15803D' : '#B91C1C',
                                      }}>
                                        {w.status === 'COMPLETED' ? 'Approuvé' : 'Rejeté'}
                                      </span>
                                      {w.status === 'FAILED' && (
                                        <button
                                          onClick={() => handleDeleteWithdrawal(w.id)}
                                          disabled={actionLoading === 'del_' + w.id}
                                          title="Supprimer de l'historique"
                                          style={{
                                            background: '#FEE2E2', border: 'none', borderRadius: 6,
                                            padding: '4px 8px', fontSize: 11, fontWeight: 700,
                                            cursor: 'pointer', color: '#DC2626',
                                            display: 'flex', alignItems: 'center', gap: 3,
                                          }}
                                        >
                                          {actionLoading === 'del_' + w.id
                                            ? <Loader2 size={10} style={{ animation: 'spin 0.8s linear infinite' }} />
                                            : <Trash size={10} />}
                                          Supprimer
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Bots Config & SSD (Winpay) ── */}
              {activeTab === 'bots' && (
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
                    Configuration Winpay (Code USSD par Tarif & Réseau)
                  </h1>
                  <p style={{ color: '#9CA3AF', fontSize: 13, margin: '0 0 20px' }}>
                    Configurez l'activation de Winpay et personnalisez les codes USSD et numéros marchands par opérateur pour chaque bot.
                  </p>

                  {/* ── Winpay Global Status Toggle ── */}
                  <div style={{
                    background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB',
                    padding: 20, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
                  }}>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#111827' }}>
                        ⚡ Statut Général de Winpay (Paiements USSD / SMS)
                      </h2>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                        Permet de rendre le système de paiement Winpay immédiatement disponible ou en maintenance sur l'application client.
                      </p>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isWinpayActive ? '#15803D' : '#D97706' }}>
                        {isWinpayActive ? '🟢 Winpay Disponible (Actif)' : '🟠 Winpay en Maintenance'}
                      </span>
                      <div style={{
                        width: 50, height: 26, borderRadius: 14, position: 'relative', transition: 'background 0.3s',
                        background: isWinpayActive ? '#10B981' : '#F59E0B'
                      }} onClick={() => setIsWinpayActive(!isWinpayActive)}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', background: 'white',
                          position: 'absolute', top: 2, left: isWinpayActive ? 26 : 2,
                          transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                      </div>
                    </label>
                  </div>

                  {/* ── Sene-Pay API Toggle ── */}
                  <div style={{
                    background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB',
                    padding: 20, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
                  }}>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#111827' }}>
                        💳 Statut de Sene-Pay API (Agrégateur Automatique)
                      </h2>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                        Activez ce bouton le jour où Sene-Pay sort de maintenance. Les paiements automatiques par API seront réautorisés.
                      </p>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isSenepayActive ? '#15803D' : '#DC2626' }}>
                        {isSenepayActive ? '🟢 Sene-Pay Disponible (API Actif)' : '🔴 Sene-Pay en Maintenance'}
                      </span>
                      <div style={{
                        width: 50, height: 26, borderRadius: 14, position: 'relative', transition: 'background 0.3s',
                        background: isSenepayActive ? '#10B981' : '#EF4444'
                      }} onClick={() => setIsSenepayActive(!isSenepayActive)}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', background: 'white',
                          position: 'absolute', top: 2, left: isSenepayActive ? 26 : 2,
                          transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                      </div>
                    </label>
                  </div>

                  {/* ── WinpayOne (Slack Webhook & Bot Approval) Config ── */}
                  <div style={{
                    background: 'white', borderRadius: 16, border: '1.5px solid #10B981',
                    padding: 20, marginBottom: 24, boxShadow: '0 4px 14px rgba(16, 185, 129, 0.08)',
                    display: 'flex', flexDirection: 'column', gap: 14
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>⚡ WinpayOne (Bouton Slack & Approval Direct en 1-Clic)</span>
                          <span style={{ background: '#ECFDF5', color: '#065F46', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99 }}>NOUVEAU — BÊTA 3</span>
                        </h2>
                        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                          Envoie chaque commande d'achat directement sur Slack avec les boutons [✅ Approuver] et [⛔ Rejeter]. Le client attend sur son écran sans être redirigé vers WhatsApp.
                        </p>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isWinpayOneActive ? '#15803D' : '#DC2626' }}>
                          {isWinpayOneActive ? '🟢 WinpayOne Activé' : '🔴 WinpayOne Désactivé'}
                        </span>
                        <div style={{
                          width: 50, height: 26, borderRadius: 14, position: 'relative', transition: 'background 0.3s',
                          background: isWinpayOneActive ? '#10B981' : '#EF4444'
                        }} onClick={() => setIsWinpayOneActive(!isWinpayOneActive)}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', background: 'white',
                            position: 'absolute', top: 2, left: isWinpayOneActive ? 26 : 2,
                            transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                        </div>
                      </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Slack Webhook Input */}
                      <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', display: 'block', marginBottom: 4 }}>
                          📢 URL Webhook Slack (Incoming Webhook) :
                        </label>
                        <input
                          type="text"
                          value={winpayOneSlackWebhookUrl}
                          onChange={e => setWinpayOneSlackWebhookUrl(e.target.value)}
                          placeholder="https://hooks.slack.com/services/..."
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                            fontSize: 13, fontFamily: 'monospace', color: '#0F172A', outline: 'none', background: '#FFFFFF'
                          }}
                        />
                      </div>

                      {/* Discord Webhook Input */}
                      <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                        <label style={{ fontSize: 13, fontWeight: 700, color: '#4338CA', display: 'block', marginBottom: 4 }}>
                          🟣 URL Webhook Discord (Discord Integration) :
                        </label>
                        <input
                          type="text"
                          value={winpayOneDiscordWebhookUrl}
                          onChange={e => setWinpayOneDiscordWebhookUrl(e.target.value)}
                          placeholder="https://discord.com/api/webhooks/..."
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                            fontSize: 13, fontFamily: 'monospace', color: '#0F172A', outline: 'none', background: '#FFFFFF'
                          }}
                        />
                        <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 4 }}>
                          💡 Créez un salon Discord ➔ Paramètres du salon ➔ Intégrations ➔ Créer un Webhook.
                        </span>
                      </div>

                      {/* CallMeBot WhatsApp Section (Up to 3 Admins) */}
                      <div style={{ background: '#F0FDF4', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #BBF7D0' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#166534', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🟢</span> CallMeBot WhatsApp Notifications (Jusqu'à 3 Administrateurs)
                        </div>
                        <p style={{ fontSize: 12, color: '#15803D', margin: '0 0 12px', lineHeight: 1.4 }}>
                          💡 <strong>Comment obtenir votre clé CallMeBot gratuite (en 10 secondes) :</strong><br />
                          1. Enregistrez le contact <strong>+34 644 10 55 84</strong> dans votre téléphone (sur WhatsApp).<br />
                          2. Envoyez-lui le message exact : <code style={{ background: '#DCFCE7', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>I allow callmebot to send me messages</code><br />
                          3. Le bot vous répond sur WhatsApp avec votre <strong>apikey</strong> !
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {/* Admin 1 */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'white', padding: 10, borderRadius: 8, border: '1px solid #CBD5E1' }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 2 }}>N° WhatsApp Admin 1 (ex: 22997000000)</label>
                              <input className="input-field" placeholder="ex: 22997000000" value={winpayOneWhatsappPhone1} onChange={e => setWinpayOneWhatsappPhone1(e.target.value)} style={{ fontSize: 12 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 2 }}>Clé API CallMeBot 1</label>
                              <input className="input-field" placeholder="ex: 123456" value={winpayOneWhatsappApiKey1} onChange={e => setWinpayOneWhatsappApiKey1(e.target.value)} style={{ fontSize: 12, fontFamily: 'monospace' }} />
                            </div>
                          </div>

                          {/* Admin 2 */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'white', padding: 10, borderRadius: 8, border: '1px solid #CBD5E1' }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 2 }}>N° WhatsApp Admin 2 (Optionnel)</label>
                              <input className="input-field" placeholder="ex: 22998000000" value={winpayOneWhatsappPhone2} onChange={e => setWinpayOneWhatsappPhone2(e.target.value)} style={{ fontSize: 12 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 2 }}>Clé API CallMeBot 2 (Optionnel)</label>
                              <input className="input-field" placeholder="ex: 654321" value={winpayOneWhatsappApiKey2} onChange={e => setWinpayOneWhatsappApiKey2(e.target.value)} style={{ fontSize: 12, fontFamily: 'monospace' }} />
                            </div>
                          </div>

                          {/* Admin 3 */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'white', padding: 10, borderRadius: 8, border: '1px solid #CBD5E1' }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 2 }}>N° WhatsApp Admin 3 (Optionnel)</label>
                              <input className="input-field" placeholder="ex: 22999000000" value={winpayOneWhatsappPhone3} onChange={e => setWinpayOneWhatsappPhone3(e.target.value)} style={{ fontSize: 12 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 2 }}>Clé API CallMeBot 3 (Optionnel)</label>
                              <input className="input-field" placeholder="ex: 987654" value={winpayOneWhatsappApiKey3} onChange={e => setWinpayOneWhatsappApiKey3(e.target.value)} style={{ fontSize: 12, fontFamily: 'monospace' }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Gmail API Auto-Approve Integration Card */}
                      <div style={{ background: '#F0F9FF', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #BAE6FD' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0369A1', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>📧</span> Gmail API Auto-Approve (Validation Automatique sans Intervention)
                        </div>
                        <p style={{ fontSize: 12, color: '#0284C7', margin: '0 0 10px', lineHeight: 1.5 }}>
                          💡 <strong>Validation Automatique MyTouchPoint via Google Apps Script :</strong><br />
                          Gmail n'accepte que des adresses email dans son champ de transfert. Pour relier Gmail au Webhook Winary AI :<br />
                          1. Rendez-vous sur <strong><a href="https://script.google.com" target="_blank" rel="noreferrer" style={{ color: '#0369A1', textDecoration: 'underline' }}>script.google.com</a></strong> avec votre compte <strong>marketccom@gmail.com</strong>.<br />
                          2. Créez un <strong>Nouveau projet</strong> et collez le script d'envoi Webhook vers :<br />
                          <code style={{ background: '#E0F2FE', padding: '6px 10px', borderRadius: 6, fontWeight: 800, display: 'inline-block', margin: '4px 0', color: '#0369A1', fontSize: 12, fontFamily: 'monospace' }}>
                            https://winary.live/api/webhooks/gmail
                          </code><br />
                          3. Ajoutez un ⏰ <strong>Déclencheur (Minuteur 1 min)</strong>. Dès réception de l'email MyTouchPoint, le serveur valide l'achat et <strong>active le bot instantanément !</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Winpay 2 Status & WhatsApp Phone Config ── */}
                  <div style={{
                    background: 'white', borderRadius: 16, border: '1.5px solid #25D366',
                    padding: 20, marginBottom: 24, boxShadow: '0 4px 14px rgba(37, 211, 102, 0.08)',
                    display: 'flex', flexDirection: 'column', gap: 14
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>📲 Winpay 2 (Mode WhatsApp Direct par Défaut)</span>
                          <span style={{ background: '#DCFCE7', color: '#166534', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99 }}>PAR DÉFAUT</span>
                        </h2>
                        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                          Propose automatiquement à l'utilisateur de valider son achat de bot sur WhatsApp avec le récap complet (Bot, Pays, Réseau, Numéro).
                        </p>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isWinpay2Active ? '#15803D' : '#DC2626' }}>
                          {isWinpay2Active ? '🟢 Winpay 2 Activé' : '🔴 Winpay 2 Désactivé'}
                        </span>
                        <div style={{
                          width: 50, height: 26, borderRadius: 14, position: 'relative', transition: 'background 0.3s',
                          background: isWinpay2Active ? '#25D366' : '#EF4444'
                        }} onClick={() => setIsWinpay2Active(!isWinpay2Active)}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', background: 'white',
                            position: 'absolute', top: 2, left: isWinpay2Active ? 26 : 2,
                            transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                        </div>
                      </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8FAFC', padding: '12px 16px', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap' }}>
                        💬 Numéro WhatsApp de réception des commandes :
                      </label>
                      <input
                        type="text"
                        value={winpay2WhatsappPhone}
                        onChange={e => setWinpay2WhatsappPhone(e.target.value)}
                        placeholder="Ex: +1 (709) 506-4087"
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid #CBD5E1',
                          fontSize: 14, fontWeight: 700, color: '#0F172A', outline: 'none', background: '#FFFFFF'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
                    {bots.map((bot: any) => {
                      const cfgIndex = botConfigs.findIndex(c => c.botId === bot.id);
                      if (cfgIndex === -1) return null;
                      const cfg = botConfigs[cfgIndex];

                      return (
                        <div key={bot.id} style={{
                          background: 'white', borderRadius: 16, padding: '20px',
                          border: '1.5px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 14,
                        }}>
                          {/* Bot header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 24 }}>🤖</span>
                            <div>
                              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#111827' }}>{bot.name}</h3>
                              <span style={{ fontSize: 12, color: '#1A56DB', fontWeight: 600 }}>Prix : {formatXOF(bot.priceCents)}</span>
                            </div>
                          </div>

                          {/* MTN Config */}
                          <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, color: '#111827' }}>
                              <span>🟡</span> MTN MoMo SSD
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div>
                                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Code SSD</label>
                                <input
                                  className="input-field"
                                  value={cfg.ssdCodeMTN}
                                  onChange={e => {
                                    const updated = [...botConfigs];
                                    updated[cfgIndex].ssdCodeMTN = e.target.value;
                                    setBotConfigs(updated);
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Numéro Marchand</label>
                                <input
                                  className="input-field"
                                  value={cfg.merchantPhoneMTN}
                                  onChange={e => {
                                    const updated = [...botConfigs];
                                    updated[cfgIndex].merchantPhoneMTN = e.target.value;
                                    setBotConfigs(updated);
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Moov Config */}
                          <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, color: '#111827' }}>
                              <span>🔵</span> Moov Money SSD
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div>
                                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Code SSD</label>
                                <input
                                  className="input-field"
                                  value={cfg.ssdCodeMoov}
                                  onChange={e => {
                                    const updated = [...botConfigs];
                                    updated[cfgIndex].ssdCodeMoov = e.target.value;
                                    setBotConfigs(updated);
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Numéro Marchand</label>
                                <input
                                  className="input-field"
                                  value={cfg.merchantPhoneMoov}
                                  onChange={e => {
                                    const updated = [...botConfigs];
                                    updated[cfgIndex].merchantPhoneMoov = e.target.value;
                                    setBotConfigs(updated);
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Orange Config */}
                          <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, color: '#111827' }}>
                              <span>🟧</span> Orange Money SSD
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div>
                                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Code SSD</label>
                                <input
                                  className="input-field"
                                  placeholder="*144*...#"
                                  value={cfg.ssdCodeOrange || ''}
                                  onChange={e => {
                                    const updated = [...botConfigs];
                                    updated[cfgIndex].ssdCodeOrange = e.target.value;
                                    setBotConfigs(updated);
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Wave Config */}
                          <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, color: '#111827' }}>
                              <span>🌊</span> Wave / Autre SSD
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div>
                                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>Code SSD</label>
                                <input
                                  className="input-field"
                                  placeholder="Code ou lien Wave"
                                  value={cfg.ssdCodeWave || ''}
                                  onChange={e => {
                                    const updated = [...botConfigs];
                                    updated[cfgIndex].ssdCodeWave = e.target.value;
                                    setBotConfigs(updated);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Save button */}
                  <div style={{ background: 'white', border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleSaveBotConfigs}
                      disabled={actionLoading === 'bots'}
                      className="btn-press"
                      style={{
                        background: 'linear-gradient(135deg, #1A56DB, #1D4ED8)',
                        color: 'white', border: 'none', borderRadius: 10,
                        padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {actionLoading === 'bots' ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear' }} /> : <Save size={16} />}
                      Enregistrer les configurations SSD
                    </button>
                  </div>
                </div>
              )}

              {/* ── Announcements & Broadcast ── */}
              {activeTab === 'announcements' && (
                <div>
                  {/* ── Broadcast Message to ALL Users Card ── */}
                  <div style={{
                    background: 'linear-gradient(135deg, #1E1B4B, #312E81)',
                    borderRadius: 16, padding: 24, marginBottom: 28, color: 'white',
                    boxShadow: '0 10px 25px rgba(49, 46, 129, 0.2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 24 }}>📢</span>
                      <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'white', fontFamily: 'Space Grotesk, sans-serif' }}>
                        Diffusion de Message Général (Chat Support + Push Pop-up)
                      </h2>
                    </div>
                    <p style={{ color: '#C7D2FE', fontSize: 13, margin: '0 0 16px' }}>
                      Rédigez un message qui sera envoyé <strong>en même temps</strong> à TOUS les utilisateurs sur leur <strong>Chat Support</strong> et affiché en <strong>Notification Pop-up</strong> sur leur écran.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <input
                        className="input-field"
                        placeholder="Titre de la notification (ex: 📢 Notification Importante)"
                        value={broadcastTitle}
                        onChange={e => setBroadcastTitle(e.target.value)}
                        style={{ background: '#FFFFFF', color: '#111827', fontWeight: 600 }}
                      />
                      <textarea
                        className="input-field"
                        rows={3}
                        placeholder="Rédigez votre message à diffuser à l'ensemble des clients..."
                        value={broadcastMessage}
                        onChange={e => setBroadcastMessage(e.target.value)}
                        style={{ background: '#FFFFFF', color: '#111827', resize: 'vertical', fontFamily: 'Inter, sans-serif' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleSendBroadcast}
                          disabled={sendingBroadcast}
                          className="btn-press"
                          style={{
                            background: sendingBroadcast ? '#818CF8' : 'linear-gradient(135deg, #10B981, #059669)',
                            color: 'white', border: 'none', borderRadius: 12,
                            padding: '12px 24px', fontSize: 13, fontWeight: 800, cursor: sendingBroadcast ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          {sendingBroadcast ? (
                            <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                          ) : (
                            <>🚀 Diffuser à TOUS les utilisateurs</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
                        Gestionnaire d'Annonces Popups
                      </h1>
                      <p style={{ color: '#9CA3AF', fontSize: 13, margin: '4px 0 0' }}>
                        Créez et organisez les fenêtres contextuelles affichées aux utilisateurs lors de l'accès à l'application.
                      </p>
                    </div>
                    <button
                      onClick={() => setEditingAnn({ title: '', content: '', ctaLabel: '', ctaUrl: '', isActive: true })}
                      style={{
                        background: '#1A56DB', color: 'white', border: 'none', borderRadius: 10,
                        padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Plus size={16} /> Nouvelle annonce
                    </button>
                  </div>

                  <div className="table-container" style={{ background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB' }}>
                    <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                          {['Titre', 'CTA Bouton', 'CTA Lien', 'Date de création', 'Statut', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {announcements.map((ann, i) => (
                          <tr key={ann.id} style={{ borderBottom: i < announcements.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                            <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#111827' }}>{ann.title}</td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{ann.ctaLabel || '—'}</td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ann.ctaUrl || '—'}</td>
                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>{safeFormatDate(ann?.createdAt)}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <button
                                onClick={() => handleToggleAnnStatus(ann)}
                                style={{
                                  border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                                  display: 'inline-flex',
                                }}
                              >
                                <span className={ann.isActive ? 'badge-active' : 'badge-expired'} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                                  {ann.isActive ? 'Actif' : 'Désactivé'}
                                </span>
                              </button>
                            </td>
                            <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => setEditingAnn(ann)}
                                style={{
                                  background: '#F3F4F6', border: 'none', borderRadius: 8,
                                  padding: '6px 12px', fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 4,
                                }}
                              >
                                <Edit size={12} /> Modifier
                              </button>
                              <button
                                onClick={() => handleDeleteAnnouncement(ann.id)}
                                style={{
                                  background: '#FEE2E2', border: 'none', borderRadius: 8,
                                  padding: '6px 12px', fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4,
                                }}
                              >
                                <Trash size={12} /> Supprimer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Announcement Modal (Create/Edit) ── */}
        {editingAnn && (
          <div className="modal-overlay centered" style={{ zIndex: 1000 }} onClick={() => setEditingAnn(null)}>
            <div className="modal-card pop-in" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editingAnn.id ? 'Modifier l\'annonce' : 'Créer une annonce'}</h3>
                <button onClick={() => setEditingAnn(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70dvh', overflowY: 'auto' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Titre de l'annonce</label>
                  <input
                    className="input-field"
                    value={editingAnn.title || ''}
                    onChange={e => setEditingAnn({ ...editingAnn, title: e.target.value })}
                    placeholder="Ex: 🎉 Promotion de Bienvenue !"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Contenu</label>
                  <textarea
                    value={editingAnn.content || ''}
                    onChange={e => setEditingAnn({ ...editingAnn, content: e.target.value })}
                    rows={4}
                    style={{
                      width: '100%', border: '1.5px solid #E5E7EB',
                      borderRadius: 12, padding: '12px 14px',
                      fontSize: 13, fontFamily: 'Inter, sans-serif',
                      outline: 'none', resize: 'vertical',
                      color: '#111827', background: '#FAFAFA',
                    }}
                    placeholder="Écrivez le message de la popup..."
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Label du bouton CTA</label>
                  <input
                    className="input-field"
                    value={editingAnn.ctaLabel || ''}
                    onChange={e => setEditingAnn({ ...editingAnn, ctaLabel: e.target.value })}
                    placeholder="Ex: Rejoindre le groupe WhatsApp"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Lien du bouton CTA (URL)</label>
                  <input
                    className="input-field"
                    value={editingAnn.ctaUrl || ''}
                    onChange={e => setEditingAnn({ ...editingAnn, ctaUrl: e.target.value })}
                    placeholder="Ex: https://chat.whatsapp.com/..."
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Icône (ex: 🎉) OU URL de bannière (http...) <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optionnel)</span>
                  </label>
                  <input
                    className="input-field"
                    value={(editingAnn as any).imageUrl || ''}
                    onChange={e => setEditingAnn({ ...editingAnn, imageUrl: e.target.value } as any)}
                    placeholder="Ex: 🎉 ou https://example.com/banniere.jpg"
                  />
                  {(editingAnn as any).imageUrl && ((editingAnn as any).imageUrl.startsWith('http') || (editingAnn as any).imageUrl.startsWith('/')) && (
                    <img
                      src={(editingAnn as any).imageUrl}
                      alt="Aperçu"
                      style={{ marginTop: 8, width: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid #E5E7EB' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Couleur/Gradient de l'en-tête <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optionnel — ex: #FF6B00 ou linear-gradient(…))</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input-field"
                      value={(editingAnn as any).headerColor || ''}
                      onChange={e => setEditingAnn({ ...editingAnn, headerColor: e.target.value } as any)}
                      placeholder="Ex: linear-gradient(135deg,#FF6B00,#EE0979)"
                      style={{ flex: 1 }}
                    />
                    <div style={{
                      width: 48, borderRadius: 10, border: '1px solid #E5E7EB',
                      background: (editingAnn as any).headerColor || 'linear-gradient(135deg,#1A56DB,#1e3a8a)',
                      flexShrink: 0,
                    }} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={editingAnn.isActive !== false}
                    onChange={e => setEditingAnn({ ...editingAnn, isActive: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: '#1A56DB' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Rendre cette annonce active immédiatement</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, padding: '16px 20px', borderTop: '1px solid #E5E7EB', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingAnn(null)} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
                <button
                  onClick={handleSaveAnnouncement}
                  disabled={actionLoading === 'announcement'}
                  style={{
                    background: '#1A56DB', color: 'white', border: 'none', borderRadius: 8,
                    padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {actionLoading === 'announcement' && <Loader2 size={12} style={{ animation: 'spin 0.8s linear' }} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── User Detail Modal (FICHE USER) ── */}
        {selectedUserDetail && (
          <div className="modal-overlay centered" style={{ zIndex: 1000 }} onClick={() => setSelectedUserDetail(null)}>
            <div className="modal-card pop-in" style={{ maxWidth: 650, width: '90%' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
                  Fiche Utilisateur : {selectedUserDetail.user.firstName ? `${selectedUserDetail.user.firstName} ${selectedUserDetail.user.lastName || ''}` : selectedUserDetail.user.phone}
                </h3>
                <button onClick={() => setSelectedUserDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '75dvh', overflowY: 'auto' }}>

                {/* User details columns */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {selectedUserDetail.user.firstName && (
                    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, gridColumn: 'span 2' }}>
                      <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block' }}>Nom & Prénom</span>
                      <strong style={{ fontSize: 14, color: '#111827' }}>{selectedUserDetail.user.firstName} {selectedUserDetail.user.lastName || ''}</strong>
                    </div>
                  )}
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block' }}>Téléphone</span>
                    <strong style={{ fontSize: 14, color: '#111827' }}>{selectedUserDetail.user.phone}</strong>
                  </div>
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block' }}>Code Invitation</span>
                    <strong style={{ fontSize: 14, color: '#1A56DB', fontFamily: 'monospace' }}>{selectedUserDetail.user.referralCode}</strong>
                  </div>
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block' }}>Parrain</span>
                    <strong style={{ fontSize: 14, color: '#374151' }}>{selectedUserDetail.user.sponsorPhone}</strong>
                  </div>
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block' }}>Inscrit le</span>
                    <strong style={{ fontSize: 13, color: '#374151' }}>{safeFormatDate(selectedUserDetail.user?.createdAt)}</strong>
                  </div>
                </div>

                {/* Adjust Balance section */}
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: '#1D4ED8' }}>Ajuster le Solde</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: '#1E40AF' }}>Solde actuel :</span>
                    <strong style={{ fontSize: 16, color: '#1A56DB' }}>{formatXOF(selectedUserDetail.user.balanceCents)}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      className="input-field"
                      type="number"
                      placeholder="Ex: -500 ou +2000 (en XOF)"
                      value={adjAmount}
                      onChange={e => setAdjAmount(e.target.value)}
                      style={{ background: 'white' }}
                    />
                    <button
                      onClick={() => handleAdjustBalance(selectedUserDetail.user.id)}
                      disabled={actionLoading === 'adjust'}
                      className="btn-press"
                      style={{
                        background: '#1A56DB', color: 'white', border: 'none', borderRadius: 10,
                        padding: '0 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                      }}
                    >
                      {actionLoading === 'adjust' && <Loader2 size={12} style={{ animation: 'spin 0.8s linear' }} />}
                      Ajuster
                    </button>
                  </div>
                </div>

                {/* Grant Bot section */}
                <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px', color: '#6D28D9' }}>Octroyer un Bot</h4>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <select
                      className="input-field"
                      value={grantBotId}
                      onChange={e => setGrantBotId(e.target.value)}
                      style={{ background: 'white', flex: 1 }}
                    >
                      <option value="">Sélectionner un bot...</option>
                      {bots.map(b => <option key={b.id} value={b.id}>{b.name} - {formatXOF(b.priceCents)}</option>)}
                    </select>
                    <button
                      onClick={() => handleGrantBot(selectedUserDetail.user.id)}
                      disabled={actionLoading === 'grant_bot' || !grantBotId}
                      className="btn-press"
                      style={{
                        background: '#7C3AED', color: 'white', border: 'none', borderRadius: 10,
                        padding: '0 16px', fontSize: 12, fontWeight: 700, cursor: (!grantBotId || actionLoading === 'grant_bot') ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                      }}
                    >
                      {actionLoading === 'grant_bot' && <Loader2 size={12} style={{ animation: 'spin 0.8s linear' }} />}
                      Octroyer
                    </button>
                  </div>
                </div>

                {/* Referred Users List */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: '#111827', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Filleuls ({selectedUserDetail.referees.length})</span>
                  </h4>
                  {selectedUserDetail.referees.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, padding: 10, background: '#F9FAFB', borderRadius: 8, textAlign: 'center' }}>
                      Aucun filleul parrainé.
                    </p>
                  ) : (
                    <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', maxHeight: 150, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <tbody>
                          {selectedUserDetail.referees.map((ref: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: idx < selectedUserDetail.referees.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#111827' }}>{ref.phone}</td>
                              <td style={{ padding: '8px 12px', color: '#9CA3AF', textAlign: 'right' }}>
                                Inscrit le {safeFormatDate(ref?.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Purchased Bots List */}
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: '#111827' }}>
                    Bots Achetés ({selectedUserDetail.purchases.length})
                  </h4>
                  {selectedUserDetail.purchases.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, padding: 10, background: '#F9FAFB', borderRadius: 8, textAlign: 'center' }}>
                      Aucun bot acheté.
                    </p>
                  ) : (
                    <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', maxHeight: 200, overflowY: 'auto', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
                        <thead>
                          <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                            {['Bot', 'Prix', 'Activations', 'Gains', 'Statut', 'Actions'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#6B7280', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUserDetail.purchases.map((p: any, idx: number) => (
                            <tr key={p.id} style={{ borderBottom: idx < selectedUserDetail.purchases.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#111827' }}>{p.botName}</td>
                              <td style={{ padding: '8px 12px', color: '#374151' }}>{formatXOF(p.pricePaidCents)}</td>
                              <td style={{ padding: '8px 12px', color: '#374151' }}>{p.workCount} activations</td>
                              <td style={{ padding: '8px 12px', color: '#15803D', fontWeight: 600 }}>{formatXOF(p.totalEarnedCents)}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span className={p.status === 'PENDING' ? 'badge-expired' : (p.status === 'EXPIRED' ? 'badge-expired' : 'badge-active')} style={{
                                  padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                                  background: p.status === 'PENDING' ? '#FEF3C7' : undefined,
                                  color: p.status === 'PENDING' ? '#D97706' : undefined,
                                }}>
                                  {p.status}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {p.status === 'PENDING' && (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      onClick={() => handleApprovePurchase(p.id)}
                                      disabled={actionLoading === p.id}
                                      style={{
                                        background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6,
                                        padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#1A56DB',
                                      }}
                                    >
                                      Approuver
                                    </button>
                                    <button
                                      onClick={() => handleRejectPurchase(p.id)}
                                      disabled={actionLoading === p.id}
                                      style={{
                                        background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 6,
                                        padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#B91C1C',
                                      }}
                                    >
                                      Rejeter
                                    </button>
                                  </div>
                                )}
                                {p.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleRevokePurchase(p.id)}
                                    disabled={actionLoading === p.id}
                                    style={{
                                      background: '#FFF1F2', border: '1px solid #FECACA', borderRadius: 6,
                                      padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: '#B91C1C',
                                    }}
                                  >
                                    {actionLoading === p.id ? '...' : 'Révoquer'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', padding: '16px 20px', borderTop: '1px solid #E5E7EB', justifyContent: 'flex-end' }}>
                <button onClick={() => setSelectedUserDetail(null)} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Fermer</button>
              </div>
            </div>
          </div>
        )}

        {loadingDetail && (
          <div className="modal-overlay centered" style={{ zIndex: 1100 }}>
            <div style={{ background: 'white', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <Loader2 size={20} color="#1A56DB" style={{ animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Chargement de la fiche utilisateur...</span>
            </div>
          </div>
        )}

        {/* ── Chat ── */}
        {activeTab === 'chat' && (() => {
          const totalUnread = chatConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
          const activeUserObj = users.find(u => u.id === selectedChatUser);
          const activeUserBotsCount = allPurchases.filter(p => p.userId === selectedChatUser && p.status === 'ACTIVE').length;

          const getInitials = (name?: string | null, phone?: string) => {
            if (name && name.trim()) {
              const parts = name.trim().split(' ');
              if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
              return name.substring(0, 2).toUpperCase();
            }
            if (phone) return phone.substring(phone.length - 2);
            return 'CL';
          };

          return (
            <div style={{ display: 'flex', gap: 16, height: 'calc(100dvh - 110px)', width: '100%' }}>
              {/* Conversation List */}
              <div className={`chat-list-panel ${selectedChatUser ? 'mobile-chat-list-hidden' : 'mobile-chat-full-width'}`} style={{
                width: 330, background: 'white', borderRadius: 20, border: '1.5px solid #E5E7EB',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0F172A', fontFamily: 'Space Grotesk, sans-serif' }}>
                    💬 Messages Support
                  </h2>
                  {totalUnread > 0 ? (
                    <span style={{ background: '#EF4444', color: 'white', fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '3px 10px', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)' }}>
                      {totalUnread} non lu(s)
                    </span>
                  ) : (
                    <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 9px' }}>
                      À jour
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {chatConversations.length === 0 ? (
                    <p style={{ padding: 30, textAlign: 'center', color: '#94A3B8', fontSize: 13, margin: 0 }}>
                      Aucun message reçu.
                    </p>
                  ) : (
                    chatConversations.map(c => {
                      const isSelected = selectedChatUser === c.userId;
                      const initials = getInitials(c.userName, c.userPhone);

                      return (
                        <button
                          key={c.userId}
                          onClick={() => handleSelectChatUser(c.userId)}
                          style={{
                            width: '100%', padding: '14px 16px', border: 'none',
                            borderBottom: '1px solid #F8FAFC', background: isSelected ? '#EFF6FF' : 'white',
                            textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s ease',
                            display: 'flex', alignItems: 'center', gap: 12
                          }}
                        >
                          {/* User Avatar Circle */}
                          <div style={{
                            width: 42, height: 42, borderRadius: '50%',
                            background: isSelected ? 'linear-gradient(135deg, #1D4ED8, #1E40AF)' : '#F1F5F9',
                            color: isSelected ? 'white' : '#334155',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 800, flexShrink: 0,
                            boxShadow: isSelected ? '0 2px 8px rgba(29, 78, 216, 0.3)' : 'none'
                          }}>
                            {initials}
                          </div>

                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.userName || c.userPhone}
                              </span>
                              {c.unreadCount > 0 && (
                                <span style={{ background: '#EF4444', color: 'white', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '2px 7px', flexShrink: 0 }}>
                                  {c.unreadCount}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{c.userPhone}</div>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {c.lastMessage}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Chat Area */}
              <div className={`chat-area-panel ${!selectedChatUser ? 'mobile-chat-area-hidden' : 'mobile-chat-full-width'}`} style={{
                flex: 1, background: 'white', borderRadius: 20, border: '1.5px solid #E5E7EB',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
              }}>
                {selectedChatUser ? (
                  <>
                    {/* Header Bar with Action Controls */}
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        
                        {/* Back Button & Client Avatar/Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button onClick={() => setSelectedChatUser(null)} style={{
                            background: '#1D4ED8', color: 'white', border: 'none', borderRadius: 12,
                            padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            boxShadow: '0 2px 8px rgba(29, 78, 216, 0.25)'
                          }}>
                            <ChevronLeft size={18} /> Conversations
                          </button>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: '50%',
                              background: '#DBEAFE', color: '#1D4ED8',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 800
                            }}>
                              {getInitials(chatConversations.find(c => c.userId === selectedChatUser)?.userName, chatConversations.find(c => c.userId === selectedChatUser)?.userPhone)}
                            </div>
                            <div>
                              <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#0F172A', fontFamily: 'Space Grotesk, sans-serif' }}>
                                {chatConversations.find(c => c.userId === selectedChatUser)?.userName || chatConversations.find(c => c.userId === selectedChatUser)?.userPhone || 'Client'}
                              </h2>
                              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                                {chatConversations.find(c => c.userId === selectedChatUser)?.userPhone}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Top Action Pills (Fiche Client & AI Toggle) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button onClick={() => handleOpenUserDetails(selectedChatUser)} style={{
                            background: '#FFFFFF', color: '#1D4ED8', border: '1.5px solid #BFDBFE',
                            borderRadius: 10, padding: '7px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'inline-flex', alignItems: 'center', gap: 5
                          }}>
                            📋 Fiche Client
                          </button>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: '1.5px solid #E2E8F0', padding: '5px 12px', borderRadius: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>IA Réponse</span>
                            <button
                              onClick={() => {
                                const currentAiState = activeUserObj?.ai_support_enabled ?? true;
                                const newAiState = !currentAiState;

                                apiAdminUpdateUser(selectedChatUser, { aiSupportEnabled: newAiState }).then(() => {
                                  setUsers(prev => prev.map(u => u.id === selectedChatUser ? { ...u, ai_support_enabled: newAiState } : u));
                                  if (selectedUserDetail?.user?.id === selectedChatUser) {
                                    setSelectedUserDetail((prev: any) => ({ ...prev, user: { ...prev.user, aiSupportEnabled: newAiState } }));
                                  }
                                });
                              }}
                              style={{
                                width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: (activeUserObj?.ai_support_enabled ?? true) ? '#10B981' : '#CBD5E1',
                                position: 'relative', transition: 'background 0.3s'
                              }}
                            >
                              <div style={{
                                width: 16, height: 16, borderRadius: '50%', background: 'white',
                                position: 'absolute', top: 2, left: (activeUserObj?.ai_support_enabled ?? true) ? 20 : 2,
                                transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                              }} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Live User Quotidien Mini-Cards Banner */}
                      {activeUserObj && (
                        <div style={{
                          display: 'flex', overflowX: 'auto', gap: 8, flexWrap: 'nowrap',
                          background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '8px 10px',
                          WebkitOverflowScrolling: 'touch'
                        }}>
                          <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '6px 10px', border: '1px solid #DBEAFE', flexShrink: 0 }}>
                            <span style={{ color: '#1E40AF', fontSize: 9, fontWeight: 700, display: 'block' }}>SOLDE</span>
                            <strong style={{ color: '#1D4ED8', fontSize: 12, fontWeight: 800 }}>{formatXOF(activeUserObj.balanceCents || 0)}</strong>
                          </div>

                          <div style={{ background: '#ECFDF5', borderRadius: 8, padding: '6px 10px', border: '1px solid #A7F3D0', flexShrink: 0 }}>
                            <span style={{ color: '#065F46', fontSize: 9, fontWeight: 700, display: 'block' }}>PARRAINAGE</span>
                            <strong style={{ color: '#047857', fontSize: 12, fontWeight: 800 }}>{activeUserObj.referralsCount || 0} filleul(s)</strong>
                          </div>

                          <div style={{ background: '#F5F3FF', borderRadius: 8, padding: '6px 10px', border: '1px solid #DDD6FE', flexShrink: 0 }}>
                            <span style={{ color: '#5B21B6', fontSize: 9, fontWeight: 700, display: 'block' }}>BOTS ACTIFS</span>
                            <strong style={{ color: '#6D28D9', fontSize: 12, fontWeight: 800 }}>{activeUserBotsCount} bot(s)</strong>
                          </div>

                          <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '6px 10px', border: '1px solid #FDE68A', flexShrink: 0 }}>
                            <span style={{ color: '#92400E', fontSize: 9, fontWeight: 700, display: 'block' }}>RETRAITS TOTAL</span>
                            <strong style={{ color: '#B45309', fontSize: 12, fontWeight: 800 }}>
                              {formatXOF(activeUserObj.withdrawalsTotalCents || 0)} ({activeUserObj.withdrawalsCount || 0})
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Messages Scroll Area */}
                    <div style={{ flex: 1, padding: '14px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, background: '#F8FAFC' }}>
                      {loadingChat ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                          <Loader2 size={24} color="#1D4ED8" style={{ animation: 'spin 0.8s linear infinite' }} />
                        </div>
                      ) : (
                        chatMessages.map(msg => {
                          const isAdmin = msg.sender_role === 'ADMIN';
                          const isEditing = editingMessageId === msg.id;

                          return (
                            <div key={msg.id} style={{
                              display: 'flex', flexDirection: 'column',
                              alignItems: isAdmin ? 'flex-end' : 'flex-start',
                              maxWidth: '85%', alignSelf: isAdmin ? 'flex-end' : 'flex-start'
                            }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 250, background: 'white', padding: 12, borderRadius: 12, border: '1px solid #1D4ED8' }}>
                                  <textarea
                                    value={editingMessageContent}
                                    onChange={e => setEditingMessageContent(e.target.value)}
                                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #CBD5E1', outline: 'none', resize: 'vertical', minHeight: 60, fontSize: 13 }}
                                  />
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button onClick={() => setEditingMessageId(null)} style={{ background: '#F1F5F9', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Annuler</button>
                                    <button onClick={() => handleEditMessage(msg.id)} disabled={actionLoading === `edit-${msg.id}`} style={{ background: '#1D4ED8', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                                      {actionLoading === `edit-${msg.id}` ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear' }} /> : 'Sauvegarder'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {isAdmin && (
                                    <div style={{ display: 'flex', gap: 2, opacity: 0.7, background: '#FFFFFF', padding: '2px 4px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                                      <button onClick={() => { setEditingMessageId(msg.id); setEditingMessageContent(msg.content); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#64748B' }} title="Modifier">
                                        <Edit size={13} />
                                      </button>
                                      <button onClick={() => handleDeleteMessage(msg.id)} disabled={actionLoading === `delete-${msg.id}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#EF4444' }} title="Supprimer">
                                        {actionLoading === `delete-${msg.id}` ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear' }} /> : <Trash size={13} />}
                                      </button>
                                    </div>
                                  )}
                                  <div style={{
                                    background: isAdmin ? 'linear-gradient(135deg, #1D4ED8, #1E40AF)' : '#FFFFFF',
                                    color: isAdmin ? '#FFFFFF' : '#0F172A',
                                    padding: '12px 16px',
                                    borderRadius: isAdmin ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                    fontSize: 14, lineHeight: 1.5,
                                    border: isAdmin ? 'none' : '1px solid #E2E8F0',
                                    boxShadow: isAdmin ? '0 3px 10px rgba(29, 78, 216, 0.2)' : '0 1px 3px rgba(0,0,0,0.03)'
                                  }}>
                                    {msg.content}
                                  </div>
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>
                                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isAdmin && (
                                  <span style={{ fontSize: 12, fontWeight: 800, marginLeft: 2 }} title={msg.is_read ? 'Lu par le client' : 'Envoyé (Non lu)'}>
                                    {msg.is_read ? (
                                      <span style={{ color: '#0284C7' }}>✓✓</span>
                                    ) : (
                                      <span style={{ color: '#94A3B8' }}>✓</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input Form with Ultra-Compact Horizontal Scrollable USSD Action Toolbar */}
                    <div style={{ padding: '10px 14px', borderTop: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                      {/* Quick USSD Bot Buttons Bar - Compact Single Row Horizontal Scroll */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch',
                        marginBottom: 8, padding: '6px 8px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0'
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          ⚡ USSD :
                        </span>
                        {[
                          { key: 'gam1', name: 'Gam 1', label: '🤖 Gam 1' },
                          { key: 'gam2', name: 'Gam 2', label: '🤖 Gam 2' },
                          { key: 'gam3', name: 'Gam 3', label: '🤖 Gam 3' },
                          { key: 'gam4', name: 'Gam 4', label: '🤖 Gam 4' },
                          { key: 'gam5', name: 'Gam 5', label: '🤖 Gam 5' },
                          { key: 'gam6', name: 'Gam 6', label: '🤖 Gam 6' },
                        ].map(b => (
                          <button
                            key={b.key}
                            type="button"
                            onClick={async () => {
                              if (!selectedChatUser) return;
                              const msgContent = `[USSD_PAY_CARD:${b.key}] Cliquez ci-dessous pour payer :`;
                              setActionLoading('send-chat');
                              try {
                                await apiAdminSendChatMessage(selectedChatUser, msgContent);
                                const data = await apiAdminGetChatMessages(selectedChatUser);
                                setChatMessages(data.messages || []);
                                notify(`✅ Bouton ${b.name} envoyé !`, 'success');
                              } catch (e: any) {
                                notify(e.message || "Erreur d'envoi du bouton", 'error');
                              } finally {
                                setActionLoading(null);
                              }
                            }}
                            style={{
                              background: 'linear-gradient(135deg, #1E293B, #0F172A)',
                              color: '#38BDF8', border: '1px solid #334155', borderRadius: 8,
                              padding: '5px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.1)', whiteSpace: 'nowrap', flexShrink: 0
                            }}
                          >
                            <span>{b.label}</span>
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleSendAdminMessage} style={{ display: 'flex', gap: 10 }}>
                        <input
                          type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                          placeholder="Tapez votre réponse au client..."
                          style={{
                            flex: 1, padding: '12px 18px', borderRadius: 99,
                            border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 14,
                            background: '#F8FAFC', color: '#0F172A'
                          }}
                        />
                        <button type="submit" disabled={!chatInput.trim()} style={{
                          width: 46, height: 46, borderRadius: '50%',
                          background: chatInput.trim() ? 'linear-gradient(135deg, #1D4ED8, #1E40AF)' : '#E2E8F0',
                          color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: chatInput.trim() ? 'pointer' : 'default',
                          boxShadow: chatInput.trim() ? '0 4px 12px rgba(29, 78, 216, 0.3)' : 'none',
                          flexShrink: 0
                        }}>
                          {actionLoading === 'send-chat' ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={18} />}
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14, padding: 20, textAlign: 'center', background: '#F8FAFC' }}>
                    👈 Sélectionnez une conversation pour afficher le tchat et les statistiques du client.
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>

      <style>{`
        .admin-sidebar {
          width: 220px;
          background: #111827;
          padding: 24px 0;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          min-height: 100dvh;
          position: sticky;
          top: 0;
          z-index: 100;
          transition: transform 0.2s ease-in-out;
        }
        .admin-main {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          max-height: 100dvh;
        }
        .mobile-header {
          display: none;
        }
        .table-container {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 16px;
        }
        @media (max-width: 768px) {
          .admin-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            transform: translateX(-100%);
            min-height: 100vh;
            z-index: 100;
          }
          .admin-sidebar.open {
            transform: translateX(0);
          }
          .admin-main {
            padding: 8px !important;
            max-height: calc(100dvh - 48px);
          }
          .mobile-header {
            display: flex;
          }
          .mobile-chat-list-hidden {
            display: none !important;
          }
          .mobile-chat-area-hidden {
            display: none !important;
          }
          .mobile-chat-full-width {
            width: 100% !important;
            flex: 1 !important;
          }
        }
        @keyframes spin { to { transform: rotate(360deg); }}
      `}</style>
    </div>
  );
}
