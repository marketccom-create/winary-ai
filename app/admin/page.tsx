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
  apiGetBots, apiGetBotPaymentConfigs, apiAdminUpdateBotPaymentConfigs,
  apiAdminGetPendingPurchases, apiAdminApprovePurchase, apiAdminRejectPurchase, apiAdminRejectAllPurchases,
  apiAdminGetPendingWithdrawals, apiAdminApproveWithdrawal, apiAdminRejectWithdrawal, apiAdminDeleteWithdrawal,
  apiAdminGetChatConversations, apiAdminGetChatMessages, apiAdminSendChatMessage,
  apiAdminGrantBot, apiAdminEditChatMessage, apiAdminDeleteChatMessage, apiAdminRevokePurchase,
  apiAdminGetAiSettings, apiAdminUpdateAiSettings, apiAdminBroadcastMessage
} from '@/lib/api';
import { formatXOF } from '@/lib/data';
import type { BotPaymentConfig, Announcement } from '@/lib/data';

type Tab = 'dashboard' | 'users' | 'pending' | 'withdrawals' | 'bots' | 'announcements' | 'chat';

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
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [bots, setBots] = useState<any[]>([]);
  const [botConfigs, setBotConfigs] = useState<BotPaymentConfig[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [search, setSearch] = useState('');
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

  // Winpay status state
  const [isWinpayActive, setIsWinpayActive] = useState(true);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // PWA Notification & Stripe Cash Sound State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW Registration error:', err));
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  function playStripeCashSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5 note
      osc1.frequency.exponentialRampToValueAtTime(1318.51, audioCtx.currentTime + 0.15); // E6 note

      gain1.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);

      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.error(e);
    }
  }

  function triggerNativeNotification(title: string, body: string) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: '/icons/WINARY%20ICON.png',
            badge: '/icons/WINARY%20ICON.png',
            vibrate: [300, 100, 300, 100, 400],
            tag: 'payment-alert-' + Date.now(),
            renotify: true,
            data: { url: '/admin' }
          } as any);
        });
      } else {
        new Notification(title, {
          body,
          icon: '/icons/WINARY%20ICON.png',
        });
      }
    }
  }

  async function requestNotificationPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        notify('🔔 Notifications PWA activées avec succès !', 'success');
        playStripeCashSound();
        triggerNativeNotification(
          '💰 Notifications Stripe Activées !',
          'Vous recevrez un son Stripe et une alerte push sur votre téléphone à chaque nouveau paiement validé.'
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

  // Auth check
  useEffect(() => {
    if (!user || user.phone !== '+22901010101') {
      router.replace('/login');
    }
  }, [user, router]);

  // Load Admin Data
  async function loadData() {
    setLoading(true);
    try {
      const [s, u, b, cfgData, ann, p, w, c, ai] = await Promise.all([
        apiAdminGetStats(),
        apiAdminGetUsers(),
        apiGetBots(),
        apiGetBotPaymentConfigs(),
        apiAdminGetAnnouncements(),
        apiAdminGetPendingPurchases(),
        apiAdminGetPendingWithdrawals(),
        apiAdminGetChatConversations(),
        apiAdminGetAiSettings(),
      ]);
      setStats(s);
      setUsers(u);
      setBots(b);

      const serverConfigs = cfgData.configs || [];
      const populatedConfigs = b.map((bot: any) => {
        const amount = Math.round(bot.priceCents / 100);
        const defaultMtnCode = `*880*1*3*1*4*22646410950*${amount}*1#`;
        const defaultMoovCode = `*855*1*1*3*2*22646410950*22646410950*${amount}#`;

        const found = serverConfigs.find((c: any) => c.botId === bot.id);
        return {
          botId: bot.id,
          botName: bot.name,
          ssdCodeMTN: (found?.ssdCodeMTN && found.ssdCodeMTN.trim()) ? found.ssdCodeMTN : defaultMtnCode,
          merchantPhoneMTN: (found?.merchantPhoneMTN && found.merchantPhoneMTN.trim()) ? found.merchantPhoneMTN : '22646410950',
          ssdCodeMoov: (found?.ssdCodeMoov && found.ssdCodeMoov.trim()) ? found.ssdCodeMoov : defaultMoovCode,
          merchantPhoneMoov: (found?.merchantPhoneMoov && found.merchantPhoneMoov.trim()) ? found.merchantPhoneMoov : '22646410950',
          ssdCodeOrange: found?.ssdCodeOrange || '',
          merchantPhoneOrange: found?.merchantPhoneOrange || '',
          ssdCodeWave: found?.ssdCodeWave || '',
          merchantPhoneWave: found?.merchantPhoneWave || '',
        };
      });

      setBotConfigs(populatedConfigs);
      setIsWinpayActive(cfgData.isWinpayActive ?? true);
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

  useEffect(() => {
    loadData();
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
    const count = pendingPurchasesOnly.length;
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
    const reason = prompt("Veuillez saisir la raison du rejet pour ce retrait (obligatoire) :");
    if (reason === null) return;
    if (!reason.trim()) {
      notify("La raison du rejet est obligatoire.", 'error');
      return;
    }

    const target = pendingWithdrawals.find(w => w.id === txId);
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
      await apiAdminUpdateBotPaymentConfigs(botConfigs, isWinpayActive);
      notify('Configuration Winpay & codes USSD des bots mise à jour !', 'success');
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

  function handleInitiateChat(u: any) {
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

  const pendingPurchasesOnly = pendingPurchases.filter(p => p.status === 'PENDING');

  const NAV_ITEMS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Tableau de bord', icon: TrendingUp },
    { key: 'users', label: 'Utilisateurs', icon: Users },
    { key: 'pending', label: 'Achats en attente', icon: Bot },
    { key: 'withdrawals', label: 'Retraits en attente', icon: CreditCard },
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
                  {key === 'pending' && pendingPurchasesOnly.length > 0 && (
                    <span style={{
                      background: '#EF4444', color: 'white', fontSize: 10,
                      fontWeight: 700, borderRadius: 99, padding: '2px 6px',
                    }}>{pendingPurchasesOnly.length}</span>
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
                        <button
                          onClick={() => {
                            playStripeCashSound();
                            triggerNativeNotification(
                              '💰 Test Notification Stripe Admin !',
                              'Ceci est un test de notification push pour les paiements validés sur Android, iPhone et Windows.'
                            );
                            notify('🔔 Test de notification Stripe effectué avec son !', 'success');
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)',
                            borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          🔊 Tester le Son Stripe & Push
                        </button>
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
                              <td style={{ padding: '12px 16px', fontSize: 13, color: '#DC2626', fontWeight: 700, fontFamily: 'monospace' }}>
                                {p.txReference}
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

              {/* ── Pending Withdrawals Approval ── */}
              {activeTab === 'withdrawals' && (
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', fontFamily: 'Space Grotesk, sans-serif', color: '#111827' }}>
                    Demandes de retraits
                  </h1>
                  <p style={{ color: '#9CA3AF', fontSize: 13, margin: '0 0 20px' }}>
                    Vérifiez le numéro bénéficiaire Mobile Money et validez ou rejetez le retrait.
                  </p>

                  {/* Synthèse des retraits en attente */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total En Attente</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#92400E', fontFamily: 'Space Grotesk, sans-serif', marginTop: 2 }}>
                        {formatXOF(stats?.pendingWithdrawalsTotalCents || 0)}
                      </div>
                      <div style={{ fontSize: 12, color: '#B45309', marginTop: 4, fontWeight: 600 }}>
                        {pendingWithdrawals.filter(w => w.status === 'PENDING').length} demande(s) au total
                      </div>
                    </div>

                    <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.5 }}>✅ Retraits Éligibles</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#166534', fontFamily: 'Space Grotesk, sans-serif', marginTop: 2 }}>
                        {formatXOF(pendingWithdrawals.filter(w => w.status === 'PENDING' && w.isEligible).reduce((sum, w) => sum + Math.abs(w.amountCents), 0))}
                      </div>
                      <div style={{ fontSize: 12, color: '#15803D', marginTop: 4, fontWeight: 600 }}>
                        {pendingWithdrawals.filter(w => w.status === 'PENDING' && w.isEligible).length} demande(s) (Parrain actif)
                      </div>
                    </div>

                    <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 14, padding: '14px 18px', flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: 0.5 }}>⛔ Retraits Non Éligibles</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#991B1B', fontFamily: 'Space Grotesk, sans-serif', marginTop: 2 }}>
                        {formatXOF(pendingWithdrawals.filter(w => w.status === 'PENDING' && !w.isEligible).reduce((sum, w) => sum + Math.abs(w.amountCents), 0))}
                      </div>
                      <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 4, fontWeight: 600 }}>
                        {pendingWithdrawals.filter(w => w.status === 'PENDING' && !w.isEligible).length} demande(s) (Sans parrainage)
                      </div>
                    </div>
                  </div>

                  {pendingWithdrawals.length === 0 ? (
                    <div style={{
                      background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB',
                      padding: '40px 20px', textAlign: 'center',
                    }}>
                      <span style={{ fontSize: 32 }}>💤</span>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '8px 0 2px' }}>Aucun retrait en attente</h3>
                      <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Toutes les demandes de retrait ont été traitées.</p>
                    </div>
                  ) : (
                    <div className="table-container" style={{ background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB' }}>
                      <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                            {['Utilisateur', 'Éligibilité', 'Description', 'Montant', 'Date de demande', 'Actions'].map(h => (
                              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pendingWithdrawals.map((w, i) => (
                            <tr key={w.id} style={{ borderBottom: i < pendingWithdrawals.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                              <td style={{ padding: '12px 16px', fontSize: 13, color: '#111827' }}>
                                <div style={{ fontWeight: 600 }}>{w.userName || '—'}</div>
                                <div style={{ fontSize: 12, color: '#6B7280' }}>{w.userPhone}</div>
                              </td>
                              {/* ── Badge éligibilité parrainage & Retraits antérieurs ── */}
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
              )}

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
                    padding: 20, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
                  }}>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#111827' }}>
                        ⚡ Statut Général de Winpay (Mode Maintenance On/Off)
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
                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF' }}>{new Date(ann.createdAt).toLocaleDateString('fr-BJ')}</td>
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
                    <strong style={{ fontSize: 13, color: '#374151' }}>{new Date(selectedUserDetail.user.createdAt).toLocaleDateString('fr-BJ')}</strong>
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
                                Inscrit le {new Date(ref.createdAt).toLocaleDateString('fr-BJ')}
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
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', gap: 20, height: 'calc(100dvh - 120px)' }}>
            {/* Conversation List */}
            <div className={`chat-list-panel ${selectedChatUser ? 'mobile-chat-list-hidden' : 'mobile-chat-full-width'}`} style={{
              width: 320, background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>Conversations</h2>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {chatConversations.length === 0 ? (
                  <p style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13, margin: 0 }}>
                    Aucun message reçu.
                  </p>
                ) : (
                  chatConversations.map(c => (
                    <button
                      key={c.userId}
                      onClick={() => handleSelectChatUser(c.userId)}
                      style={{
                        width: '100%', padding: '16px', border: 'none',
                        borderBottom: '1px solid #F3F4F6', background: selectedChatUser === c.userId ? '#EFF6FF' : 'white',
                        textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s',
                        display: 'flex', flexDirection: 'column', gap: 4
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                          {c.userName || c.userPhone}
                        </span>
                        {c.unreadCount > 0 && (
                          <span style={{ background: '#EF4444', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '2px 6px' }}>
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.lastMessage}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={`chat-area-panel ${!selectedChatUser ? 'mobile-chat-area-hidden' : 'mobile-chat-full-width'}`} style={{
              flex: 1, background: 'white', borderRadius: 16, border: '1.5px solid #E5E7EB',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              {selectedChatUser ? (
                <>
                  <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="mobile-only-inline-flex" onClick={() => setSelectedChatUser(null)} style={{
                      background: 'white', border: '1px solid #E5E7EB', borderRadius: '50%', width: 36, height: 36,
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#111827'
                    }}>
                      <ChevronLeft size={20} />
                    </button>
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
                        {chatConversations.find(c => c.userId === selectedChatUser)?.userName || chatConversations.find(c => c.userId === selectedChatUser)?.userPhone || 'Utilisateur'}
                      </h2>
                    </div>
                    {selectedChatUser && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: '#4B5563' }}>IA Activable</span>
                        <button
                          onClick={() => {
                            const userObj = users.find(u => u.id === selectedChatUser);
                            const currentAiState = userObj?.ai_support_enabled ?? true; // Defaults to true in DB
                            const newAiState = !currentAiState;

                            apiAdminUpdateUser(selectedChatUser, { aiSupportEnabled: newAiState }).then(() => {
                              setUsers(prev => prev.map(u => u.id === selectedChatUser ? { ...u, ai_support_enabled: newAiState } : u));
                              if (selectedUserDetail?.user?.id === selectedChatUser) {
                                setSelectedUserDetail((prev: any) => ({ ...prev, user: { ...prev.user, aiSupportEnabled: newAiState } }));
                              }
                            });
                          }}
                          style={{
                            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: (users.find(u => u.id === selectedChatUser)?.ai_support_enabled ?? true) ? '#10B981' : '#D1D5DB',
                            position: 'relative', transition: 'background 0.3s'
                          }}
                        >
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%', background: 'white',
                            position: 'absolute', top: 2, left: (users.find(u => u.id === selectedChatUser)?.ai_support_enabled ?? true) ? 22 : 2,
                            transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {loadingChat ? (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <Loader2 size={24} color="#1A56DB" style={{ animation: 'spin 0.8s linear infinite' }} />
                      </div>
                    ) : (
                      chatMessages.map(msg => {
                        const isAdmin = msg.sender_role === 'ADMIN';
                        const isEditing = editingMessageId === msg.id;

                        return (
                          <div key={msg.id} style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: isAdmin ? 'flex-end' : 'flex-start',
                            maxWidth: '75%', alignSelf: isAdmin ? 'flex-end' : 'flex-start'
                          }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 250 }}>
                                <textarea
                                  value={editingMessageContent}
                                  onChange={e => setEditingMessageContent(e.target.value)}
                                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #1A56DB', outline: 'none', resize: 'vertical', minHeight: 60 }}
                                />
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  <button onClick={() => setEditingMessageId(null)} style={{ background: '#F3F4F6', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Annuler</button>
                                  <button onClick={() => handleEditMessage(msg.id)} disabled={actionLoading === `edit-${msg.id}`} style={{ background: '#1A56DB', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                    {actionLoading === `edit-${msg.id}` ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear' }} /> : 'Sauvegarder'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isAdmin && (
                                  <div style={{ display: 'flex', gap: 4, opacity: 0.6 }}>
                                    <button onClick={() => { setEditingMessageId(msg.id); setEditingMessageContent(msg.content); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#6B7280' }} title="Modifier">
                                      <Edit size={14} />
                                    </button>
                                    <button onClick={() => handleDeleteMessage(msg.id)} disabled={actionLoading === `delete-${msg.id}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#EF4444' }} title="Supprimer">
                                      {actionLoading === `delete-${msg.id}` ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear' }} /> : <Trash size={14} />}
                                    </button>
                                  </div>
                                )}
                                <div style={{
                                  background: isAdmin ? '#1A56DB' : '#F3F4F6',
                                  color: isAdmin ? 'white' : '#111827',
                                  padding: '10px 14px',
                                  borderRadius: isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                  fontSize: 14, lineHeight: 1.5
                                }}>
                                  {msg.content}
                                </div>
                              </div>
                            )}
                            <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                              {new Date(msg.created_at).toLocaleTimeString('fr-BJ', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div style={{ padding: 16, borderTop: '1px solid #E5E7EB' }}>
                    <form onSubmit={handleSendAdminMessage} style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                        placeholder="Tapez votre réponse..."
                        style={{ flex: 1, padding: '0 16px', borderRadius: 24, border: '1px solid #E5E7EB', outline: 'none' }}
                      />
                      <button type="submit" disabled={!chatInput.trim()} style={{
                        width: 44, height: 44, borderRadius: '50%', background: chatInput.trim() ? '#1A56DB' : '#E5E7EB',
                        color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: chatInput.trim() ? 'pointer' : 'default'
                      }}>
                        {actionLoading === 'send-chat' ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={18} />}
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>
                  Sélectionnez une conversation pour afficher les messages.
                </div>
              )}
            </div>
          </div>
        )}

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
          padding: 28px;
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
            padding: 16px;
            max-height: calc(100dvh - 48px);
          }
          .mobile-header {
            display: flex;
          }
        }
        @keyframes spin { to { transform: rotate(360deg); }}
      `}</style>
    </div>
  );
}
