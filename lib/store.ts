'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserPurchase, Transaction } from './data';

// ─── Auth Store ───────────────────────────────────────────────────────────────
type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  _hasHydrated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateBalance: (newBalanceCents: number) => void;
  setHasHydrated: (v: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,
      _hasHydrated: false,
      login: (user, token) => set({ user, isAuthenticated: true, token }),
      logout: () => set({ user: null, isAuthenticated: false, token: null }),
      updateBalance: (newBalanceCents) =>
        set((s) => s.user ? { user: { ...s.user, balanceCents: newBalanceCents } } : {}),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'winary-auth',
      // Called once localStorage has been read and state restored
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// ─── App Store (purchases, transactions) ──────────────────────────────────────
type AppState = {
  purchases: UserPurchase[];
  transactions: Transaction[];
  // Stores the ID of the last announcement seen — so new announcements always re-appear
  announcementSeenVersion: string | null;
  setPurchases: (p: UserPurchase[]) => void;
  setTransactions: (t: Transaction[]) => void;
  addPurchase: (p: UserPurchase) => void;
  updatePurchase: (id: string, patch: Partial<UserPurchase>) => void;
  addTransaction: (t: Transaction) => void;
  markAnnouncementSeen: (version: string) => void;
  resetAnnouncementSeen: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      purchases: [],
      transactions: [],
      announcementSeenVersion: null,
      setPurchases: (purchases) => set({ purchases }),
      setTransactions: (transactions) => set({ transactions }),
      addPurchase: (p) => set((s) => ({ purchases: [p, ...s.purchases] })),
      updatePurchase: (id, patch) =>
        set((s) => ({
          purchases: s.purchases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      addTransaction: (t) =>
        set((s) => ({ transactions: [t, ...s.transactions] })),
      // Store latest announcement ID so any NEW announcement triggers a re-show
      markAnnouncementSeen: (version) => set({ announcementSeenVersion: version }),
      resetAnnouncementSeen: () => set({ announcementSeenVersion: null }),
    }),
    { name: 'winary-app' }
  )
);

// ─── UI Store ─────────────────────────────────────────────────────────────────
type UIState = {
  activeTab: 'home' | 'products' | 'invite' | 'account';
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info';
  setActiveTab: (tab: UIState['activeTab']) => void;
  showToast: (msg: string, type?: UIState['toastType']) => void;
  clearToast: () => void;
};

export const useUIStore = create<UIState>()((set) => ({
  activeTab: 'home',
  toastMessage: null,
  toastType: 'success',
  setActiveTab: (tab) => set({ activeTab: tab }),
  showToast: (msg, type = 'success') => set({ toastMessage: msg, toastType: type }),
  clearToast: () => set({ toastMessage: null }),
}));
