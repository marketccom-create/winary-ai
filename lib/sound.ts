// Syntétiseur Audio Web Audio API pour le son d'évènement WhatsApp Pop / Ping

export function playWhatsappPopSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Fréquences pour un son de pop doux style WhatsApp (Deux notes harmonieuses rapides)
    const now = ctx.currentTime;

    // Note 1 (Basse)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.12);

    // Note 2 (Cloche cristalline)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.04); // D6
    gain2.gain.setValueAtTime(0.2, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.04);
    osc2.stop(now + 0.18);
  } catch (err) {
    console.warn('[Sound Error]:', err);
  }
}
