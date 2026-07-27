'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Package, Users, User, ExternalLink, X } from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '@/lib/store';
import { apiGetAnnouncements, apiGetProfile } from '@/lib/api';

// ─── Announcement Modal ───────────────────────────────────────────────────────
function AnnouncementModal({ announcements, onClose }: { announcements: any[]; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);

  if (!announcements || announcements.length === 0) return null;
  const current = announcements[currentIndex];
  const isLast = currentIndex === announcements.length - 1;

  function goTo(idx: number, dir: 'next' | 'prev') {
    if (animating || idx === currentIndex) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex(idx);
      setAnimating(false);
    }, 220);
  }

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      goTo(currentIndex + 1, 'next');
    }
  }

  const headerBg = current.headerColor || 'linear-gradient(135deg, #1A56DB, #1e3a8a)';
  const isImageLink = current.imageUrl && (current.imageUrl.startsWith('http') || current.imageUrl.startsWith('/'));
  const iconStr = current.imageUrl && !isImageLink ? current.imageUrl : '📢';

  return (
    <div className="modal-overlay centered" style={{ zIndex: 300 }}>
      <div
        className="modal-card pop-in"
        style={{ maxWidth: 360, overflow: 'hidden' }}
      >
        {/* ── Header ── */}
        <div style={{
          background: headerBg,
          padding: isImageLink ? '0' : '28px 20px 20px',
          position: 'relative',
        }}>
          {isImageLink ? (
            <img
              src={current.imageUrl}
              alt={current.title}
              style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ fontSize: 36, marginBottom: 8, marginTop: announcements.length > 1 ? 16 : 0, textAlign: 'center' }}>{iconStr}</div>
          )}

          {/* Close button */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,0.30)', border: 'none',
            borderRadius: '50%', width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'white',
          }}><X size={15} /></button>

          {/* Title bar (shown only when no image) */}
          {!isImageLink && (
            <div style={{
              color: 'white', fontSize: 18, fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif', textAlign: 'center'
            }}>{current.title}</div>
          )}

          {/* Dot navigation */}
          {announcements.length > 1 && (
            <div style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 6,
            }}>
              {announcements.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i, i > currentIndex ? 'next' : 'prev')}
                  style={{
                    width: i === currentIndex ? 20 : 8,
                    height: 8, borderRadius: 99,
                    background: i === currentIndex ? 'white' : 'rgba(255,255,255,0.4)',
                    border: 'none', cursor: 'pointer', padding: 0,
                    transition: 'all 250ms ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div
          style={{
            padding: '20px',
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${direction === 'next' ? '24px' : '-24px'})`
              : 'translateX(0)',
            transition: 'opacity 220ms ease, transform 220ms ease',
          }}
        >
          {current.imageUrl && (
            <div style={{
              color: '#111827', fontSize: 17, fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8,
            }}>{current.title}</div>
          )}
          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.65, margin: '0 0 16px' }}>
            {current.content}
          </p>

          {current.ctaUrl && (
            <a
              href={current.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#25D366', color: 'white',
                padding: '13px 20px', borderRadius: 12,
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
                marginBottom: 12,
              }}
            >
              <span>📱</span> {current.ctaLabel || 'Rejoindre'}
              <ExternalLink size={14} />
            </a>
          )}

          <button
            onClick={handleNext}
            className="btn-press"
            style={{
              width: '100%', height: 48,
              background: isLast ? '#1A56DB' : '#F3F4F6',
              border: isLast ? 'none' : '1px solid #E5E7EB',
              borderRadius: 12, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', color: isLast ? 'white' : '#374151',
              transition: 'all 200ms ease',
            }}
          >
            {isLast ? "Accéder à l'application →" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast() {
  const { toastMessage, toastType, clearToast } = useUIStore();

  useEffect(() => {
    if (toastMessage) {
      // 8 secondes pour laisser largement le temps de lire 2 à 3 fois
      const t = setTimeout(clearToast, 8000);
      return () => clearTimeout(t);
    }
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  // Design rassurant (vert émeraude apaisant)
  const isErrorOrMaintenance = toastType === 'error' || toastMessage.includes('maintenance') || toastMessage.includes('Mobile Money');

  const config = isErrorOrMaintenance ? {
    bg: '#ECFDF5',
    border: '#6EE7B7',
    text: '#065F46',
    icon: '🛡️',
  } : {
    success: { bg: '#ECFDF5', border: '#6EE7B7', text: '#065F46', icon: '✅' },
    error:   { bg: '#ECFDF5', border: '#6EE7B7', text: '#065F46', icon: '🛡️' },
    info:    { bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF', icon: '💡' },
  }[toastType];

  return (
    <div
      onClick={clearToast}
      style={{
        position: 'fixed',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 99999,
        width: '90%',
        maxWidth: 350,
        background: '#FFFFFF',
        border: `2px solid ${config.border}`,
        borderRadius: 20,
        padding: '20px 20px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2), 0 0 0 100vw rgba(0, 0, 0, 0.3)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 26,
        background: config.bg,
        border: `1px solid ${config.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, flexShrink: 0
      }}>
        {config.icon}
      </div>

      <div style={{
        fontSize: 14,
        lineHeight: 1.5,
        fontWeight: 600,
        color: '#1F2937',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {toastMessage}
      </div>

      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#059669',
        background: '#ECFDF5',
        padding: '5px 14px',
        borderRadius: 99,
        marginTop: 2,
        border: '1px solid #A7F3D0'
      }}>
        Toucher pour fermer
      </div>
    </div>
  );
}

// ─── Bottom Navigation ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'home',     label: 'Accueil',      icon: Home,    path: '/home' },
  { key: 'products', label: 'Mes produits', icon: Package, path: '/products' },
  { key: 'invite',   label: 'Inviter',      icon: Users,   path: '/invite' },
  { key: 'account',  label: 'Mon compte',   icon: User,    path: '/account' },
] as const;

function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeTab, setActiveTab } = useUIStore();

  function navigate(tab: typeof TABS[number]) {
    setActiveTab(tab.key);
    router.push(tab.path);
  }

  const currentKey = TABS.find(t => pathname.startsWith(t.path))?.key || activeTab;

  return (
    <nav className="bottom-nav safe-bottom">
      {TABS.map((tab) => {
        const active = currentKey === tab.key;
        const Icon = tab.icon;
        return (
          <button key={tab.key} onClick={() => navigate(tab)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4, padding: '8px 4px',
            color: active ? '#1A56DB' : '#9CA3AF',
            transition: 'color 150ms ease',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <div style={{ position: 'relative' }}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {active && (
                <div style={{
                  position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: '#1A56DB',
                }} />
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, lineHeight: 1 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── App Shell Layout ──────────────────────────────────────────────────────────
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, token, login } = useAuthStore();
  const { announcementSeenVersion, markAnnouncementSeen } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();
  const [activeAnnouncements, setActiveAnnouncements] = useState<any[]>([]);
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // Background profile sync to update user state (balance, status, etc.) dynamically
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    function refreshProfile() {
      if (!token) return;
      apiGetProfile()
        .then(({ user: freshUser }) => {
          login(freshUser, token);
        })
        .catch((err) => console.error("Profile refresh failed:", err));
    }

    refreshProfile(); // Initial fetch on mount
    const interval = setInterval(refreshProfile, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, token, login]);

  useEffect(() => {
    if (isAuthenticated) {
      apiGetAnnouncements().then((list) => {
        setActiveAnnouncements(list);
      });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (activeAnnouncements.length === 0) return;

    // Show popup if the newest announcement has not been seen yet
    const latestId = activeAnnouncements[0]?.id;
    if (latestId && announcementSeenVersion !== latestId) {
      const t = setTimeout(() => setShowAnnouncement(true), 600);
      return () => clearTimeout(t);
    }
  }, [_hasHydrated, isAuthenticated, announcementSeenVersion, activeAnnouncements, router]);

  function closeAnnouncement() {
    setShowAnnouncement(false);
    // Mark the latest announcement ID as seen
    if (activeAnnouncements.length > 0) {
      markAnnouncementSeen(activeAnnouncements[0].id);
    }
  }

  // Show nothing (not a spinner) while hydrating — avoids flash
  if (!_hasHydrated || !isAuthenticated) return null;

  const hideBottomNav = pathname.startsWith('/chat');

  return (
    <div style={{ minHeight: '100dvh', background: '#F9FAFB' }}>
      {children}
      {!hideBottomNav && <BottomNav />}
      <Toast />
      {showAnnouncement && activeAnnouncements.length > 0 && (
        <AnnouncementModal announcements={activeAnnouncements} onClose={closeAnnouncement} />
      )}
    </div>
  );
}
