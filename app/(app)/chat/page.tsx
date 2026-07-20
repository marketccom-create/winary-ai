'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Send, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { apiGetChatMessages, apiSendChatMessage } from '@/lib/api';

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadMessages();
    
    // Poll for new messages every 10 seconds (simple fallback for realtime)
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function loadMessages() {
    try {
      const { messages } = await apiGetChatMessages();
      setMessages(messages);
    } catch (error) {
      console.error('Failed to load messages', error);
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

    // Optimistic UI
    const tempMsg = {
      id: 'temp-' + Date.now(),
      sender_role: 'USER',
      content: tempText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const { message } = await apiSendChatMessage(tempText);
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? message : m));
    } catch (error) {
      alert("Erreur lors de l'envoi du message.");
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setInputText(tempText);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#F9FAFB' }}>
      {/* Header */}
      <div style={{
        background: 'white', borderBottom: '1px solid #E5E7EB',
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <button onClick={() => router.back()} style={{
          background: '#F3F4F6', border: 'none', width: 36, height: 36,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#111827'
        }}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
            Support Client
          </h1>
          <p style={{ fontSize: 12, color: '#16A34A', margin: '2px 0 0', fontWeight: 600 }}>En ligne</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, padding: '20px 16px', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 12
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} color="#1A56DB" style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
            <span style={{ fontSize: 40, display: 'block', marginBottom: 10 }}>👋</span>
            <p style={{ fontSize: 14, margin: 0 }}>Bonjour ! Comment pouvons-nous vous aider aujourd'hui ?</p>
          </div>
        ) : (
          messages.map(msg => {
            const isUser = msg.sender_role === 'USER';
            return (
              <div key={msg.id} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                alignSelf: isUser ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  background: isUser ? 'linear-gradient(135deg, #1A56DB, #1D4ED8)' : 'white',
                  color: isUser ? 'white' : '#111827',
                  padding: '12px 16px',
                  borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  border: isUser ? 'none' : '1px solid #E5E7EB',
                  fontSize: 14,
                  lineHeight: 1.5,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}>
                  {msg.content}
                </div>
                <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, padding: '0 4px' }}>
                  {new Date(msg.created_at).toLocaleTimeString('fr-BJ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ background: 'white', padding: '12px 16px', borderTop: '1px solid #E5E7EB' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Écrivez votre message..."
            style={{
              flex: 1, background: '#F3F4F6', border: '1px solid #E5E7EB',
              borderRadius: 24, padding: '0 16px', fontSize: 14, height: 48,
              outline: 'none', transition: 'border 0.2s'
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: inputText.trim() && !sending ? '#1A56DB' : '#E5E7EB',
              color: inputText.trim() && !sending ? 'white' : '#9CA3AF',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: inputText.trim() && !sending ? 'pointer' : 'default',
              transition: 'all 0.2s'
            }}
          >
            {sending ? <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={20} style={{ marginLeft: 2 }} />}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
    </div>
  );
}
