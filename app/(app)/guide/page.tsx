'use client';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Info, Bot, Wallet, Users, ChevronRight, Zap, Target } from 'lucide-react';
import { useState } from 'react';

export default function GuidePage() {
  const router = useRouter();
  const [openSection, setOpenSection] = useState<number>(0);

  const SECTIONS = [
    {
      id: 0,
      title: "Qu'est-ce que WINARY AI ?",
      icon: <Info size={20} color="#1A56DB" />,
      content: (
        <p style={{ margin: 0, color: '#374151', lineHeight: 1.6, fontSize: 14 }}>
          WINARY AI est une plateforme d'investissement intelligente. Nous proposons l'achat de serveurs et de bots de trading automatisés qui travaillent pour vous générer des revenus passifs quotidiennement.
        </p>
      )
    },
    {
      id: 1,
      title: "Comment fonctionnent les Bots ?",
      icon: <Bot size={20} color="#15803D" />,
      content: (
        <div style={{ color: '#374151', lineHeight: 1.6, fontSize: 14 }}>
          <p style={{ margin: '0 0 10px' }}>
            Une fois que vous achetez un bot, il est actif pour une durée stricte de <strong>45 jours</strong>.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Vous devez vous connecter tous les jours et cliquer sur <strong>Lancer le travail</strong>.</li>
            <li>Le bot génèrera alors votre gain quotidien, qui s'ajoutera instantanément à votre solde.</li>
            <li>À la fin des 45 jours, le bot expire et ne produira plus de revenus.</li>
          </ul>
        </div>
      )
    },
    {
      id: 2,
      title: "Programme de Parrainage",
      icon: <Users size={20} color="#7C3AED" />,
      content: (
        <div style={{ color: '#374151', lineHeight: 1.6, fontSize: 14 }}>
          <p style={{ margin: '0 0 10px' }}>
            Partagez votre code de parrainage et touchez <strong>35% de commission</strong> !
          </p>
          <p style={{ margin: 0 }}>
            Chaque fois qu'une personne s'inscrit avec votre code et effectue l'achat d'un Bot, vous recevez automatiquement 35% du prix d'achat du bot directement sur votre solde retirable.
          </p>
        </div>
      )
    },
    {
      id: 3,
      title: "Dépôts et Retraits",
      icon: <Wallet size={20} color="#D97706" />,
      content: (
        <div style={{ color: '#374151', lineHeight: 1.6, fontSize: 14 }}>
          <p style={{ margin: '0 0 10px' }}>
            Les transactions se font via Mobile Money, adaptées à votre pays.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong>Recharge</strong> : Paiement instantané via code SSD ou vers un numéro marchand. Validation automatique après achat.</li>
            <li><strong>Retrait</strong> : Le minimum de retrait est fixé à <strong>3 000 XOF</strong>. Les retraits sont uniquement possibles <strong>du Lundi au Vendredi, de 08h à 21h</strong>.</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div style={{ minHeight: '100dvh', background: '#F9FAFB', paddingBottom: 100 }}>
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
            Guide Explicatif
          </h1>
        </div>
      </div>

      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #1A56DB, #1e3a8a)',
        padding: '32px 20px',
        color: 'white',
        textAlign: 'center'
      }}>
        <div style={{
          width: 56, height: 56, background: 'rgba(255,255,255,0.2)',
          borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', backdropFilter: 'blur(10px)'
        }}>
          <Target size={28} color="white" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', fontFamily: 'Space Grotesk, sans-serif' }}>
          Bienvenue sur WINARY AI
        </h2>
        <p style={{ fontSize: 14, opacity: 0.9, margin: 0, lineHeight: 1.5 }}>
          Découvrez comment optimiser vos revenus passifs grâce à nos serveurs d'intelligence artificielle.
        </p>
      </div>

      {/* Accordion Content */}
      <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SECTIONS.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div key={section.id} style={{
              background: 'white', borderRadius: 16,
              border: '1.5px solid #E5E7EB', overflow: 'hidden',
              boxShadow: isOpen ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.3s ease'
            }}>
              <button
                onClick={() => setOpenSection(isOpen ? -1 : section.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {section.icon}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{section.title}</span>
                </div>
                <ChevronRight size={18} color="#9CA3AF" style={{
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }} />
              </button>
              
              <div style={{
                maxHeight: isOpen ? 500 : 0,
                opacity: isOpen ? 1 : 0,
                transition: 'all 0.3s ease',
                background: '#F9FAFB'
              }}>
                <div style={{ padding: '0 16px 20px 64px' }}>
                  {section.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer support prompt */}
      <div style={{ padding: '0 16px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 12px' }}>
          Vous avez encore des questions ?
        </p>
        <button
          onClick={() => router.push('/chat')}
          style={{
            background: 'white', border: '1.5px solid #E5E7EB',
            borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600,
            color: '#1A56DB', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8
          }}
        >
          <Zap size={16} /> Contacter le Support
        </button>
      </div>

    </div>
  );
}
