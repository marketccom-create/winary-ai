'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Send, Loader2, Check } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { apiGetChatMessages, apiSendChatMessage } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { playWhatsappPopSound } from '@/lib/sound';

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    loadMessages();

    // ─── Supabase Realtime Channel Subscription ───
    const channel = supabase
      .channel(`chat-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Son Pop WhatsApp si le message provient du Support / Admin
          if (newMsg.sender_role === 'ADMIN') {
            playWhatsappPopSound();
            // Effet d'indicateur de frappe momentané
            setIsTyping(false);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_messages',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedMsg = payload.new;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime Chat] Connecté avec succès via WebSockets');
        }
      });

    // Fallback Polling léger toutes les 15s en cas de micro-coupure réseau
    const interval = setInterval(loadMessages, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  async function loadMessages() {
    try {
      const { messages: fetched } = await apiGetChatMessages();
      setMessages(fetched || []);
    } catch (error) {
      console.error('Erreur chargement messages chat', error);
    } finally {
      setLoading(false);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    const tempText = inputText.trim();
    setInputText('');

    // UI Optimiste instantanée
    const tempMsg = {
      id: 'temp-' + Date.now(),
      sender_role: 'USER',
      content: tempText,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    // Simulation visuelle "En train d'écrire..." côté support
    const typingTimeout = setTimeout(() => setIsTyping(true), 800);

    try {
      const { message } = await apiSendChatMessage(tempText);
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? message : m)));
    } catch (error) {
      clearTimeout(typingTimeout);
      setIsTyping(false);
      alert("Erreur lors de l'envoi du message.");
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setInputText(tempText);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#E5DDD5' }}>
      {/* Header Style WhatsApp Premium */}
      <div style={{
        background: '#075E54', color: 'white',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', position: 'sticky', top: 0, zIndex: 20
      }}>
        <button onClick={() => router.back()} style={{
          background: 'transparent', border: 'none', color: 'white',
          cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4
        }}>
          <ChevronLeft size={24} />
        </button>

        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: '#128C7E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 18, color: 'white', border: '1.5px solid rgba(255,255,255,0.3)'
        }}>
          🤖
        </div>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'white', fontFamily: 'Space Grotesk, sans-serif' }}>
            Support Client WINARY AI
          </h1>
          <p style={{ fontSize: 12, color: '#25D366', margin: '1px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#25D366', display: 'inline-block' }}></span>
            {isTyping ? 'En train d\'écrire...' : 'En ligne 24/7'}
          </p>
        </div>
      </div>

      {/* Zone de Chat avec arrière-plan motif WhatsApp */}
      <div style={{
        flex: 1, padding: '16px 14px', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 10,
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 0)',
        backgroundSize: '16px 16px'
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={26} color="#075E54" style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            alignSelf: 'center', background: '#FFF5C4', color: '#735C0F',
            padding: '10px 16px', borderRadius: 12, fontSize: 13, textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxWidth: '90%'
          }}>
            🔒 Les messages sont chiffrés et transmis en direct au support WINARY AI.
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender_role === 'USER';
            const ussdMatch = msg.content?.match(/\[USSD_PAY_CARD:(gam[1-6])\]/i);

            if (!isUser && ussdMatch) {
              const botKey = ussdMatch[1].toLowerCase();
              const botMap: Record<string, { name: string; price: string; amount: number }> = {
                gam1: { name: 'Gam 1', price: '4 000 XOF', amount: 4000 },
                gam2: { name: 'Gam 2', price: '10 000 XOF', amount: 10000 },
                gam3: { name: 'Gam 3', price: '30 000 XOF', amount: 30000 },
                gam4: { name: 'Gam 4', price: '60 000 XOF', amount: 60000 },
                gam5: { name: 'Gam 5', price: '150 000 XOF', amount: 150000 },
                gam6: { name: 'Gam 6', price: '600 000 XOF', amount: 600000 },
              };
              const bot = botMap[botKey];
              const cleanText = msg.content.replace(/\[USSD_PAY_CARD:gam[1-6]\]/gi, '').trim();

              if (bot) {
                const mtnUssd = `*880*1*3*1*4*22646410950*${bot.amount}*1#`;
                const moovUssd = `*855*1*1*3*2*22646410950*22646410950*${bot.amount}#`;

                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '88%', alignSelf: 'flex-start' }}>
                    <div style={{
                      background: '#FFFFFF', color: '#111827', padding: '12px 14px',
                      borderRadius: '0px 14px 14px 14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)', borderLeft: '4px solid #128C7E',
                      display: 'flex', flexDirection: 'column', gap: 8, width: '100%'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22 }}>🤖</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#075E54', fontFamily: 'Space Grotesk, sans-serif' }}>
                            Achat direct — Robot {bot.name}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>Tarif : {bot.price}</div>
                        </div>
                      </div>

                      {cleanText && (
                        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.4 }}>
                          {cleanText}
                        </p>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                        <a
                          href={`tel:${encodeURIComponent(mtnUssd)}`}
                          style={{
                            background: '#F59E0B', color: 'white', padding: '9px 12px', borderRadius: 8,
                            textDecoration: 'none', fontWeight: 800, fontSize: 12, textAlign: 'center',
                            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.2)'
                          }}
                        >
                          🟡 Payez par MTN
                        </a>

                        <a
                          href={`tel:${encodeURIComponent(moovUssd)}`}
                          style={{
                            background: '#2563EB', color: 'white', padding: '9px 12px', borderRadius: 8,
                            textDecoration: 'none', fontWeight: 800, fontSize: 12, textAlign: 'center',
                            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
                          }}
                        >
                          🔵 Payez par Moov
                        </a>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: '#64748B', marginTop: 3, padding: '0 4px' }}>
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              }
            }

            return (
              <div key={msg.id} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                alignSelf: isUser ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  background: isUser ? '#DCF8C6' : '#FFFFFF', // Bulles vertes WhatsApp pour l'utilisateur
                  color: '#111827',
                  padding: '9px 13px',
                  borderRadius: isUser ? '14px 14px 0px 14px' : '0px 14px 14px 14px',
                  fontSize: 14,
                  lineHeight: 1.45,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                  position: 'relative'
                }}>
                  <span>{msg.content}</span>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: 3, marginTop: 3, fontSize: 10, color: '#667781', textAlign: 'right'
                  }}>
                    <span>{new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {/* Règle utilisateur : Côté client, affichage simple sans double coche bleu */}
                    {isUser && <Check size={12} color="#8696A0" />}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Animation "En train d'écrire..." */}
        {isTyping && (
          <div style={{
            alignSelf: 'flex-start', background: '#FFFFFF', padding: '8px 14px',
            borderRadius: '0px 14px 14px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B'
          }}>
            <span style={{ fontSize: 14 }}>💬</span> Support en train d'écrire...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Barre d'envoi WhatsApp Style */}
      <div style={{ background: '#F0F2F5', padding: '10px 12px', borderTop: '1px solid #E2E8F0' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Écrivez un message..."
            style={{
              flex: 1, background: '#FFFFFF', border: 'none',
              borderRadius: 24, padding: '0 18px', fontSize: 14, height: 44,
              outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: inputText.trim() && !sending ? '#075E54' : '#CCCCCC',
              color: 'white', border: 'none', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              cursor: inputText.trim() && !sending ? 'pointer' : 'default',
              transition: 'background 0.2s', boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}
          >
            {sending ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={18} style={{ marginLeft: 2 }} />}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
