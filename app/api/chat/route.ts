import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAuth, unauthorized } from '@/lib/auth';

export async function GET(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const db = createAdminClient();
  const { data, error } = await db
    .from('support_messages')
    .select('*')
    .eq('user_id', payload.sub)
    .order('created_at', { ascending: true });

  // Marquer les messages de l'admin comme lus
  await db
    .from('support_messages')
    .update({ is_read: true })
    .eq('user_id', payload.sub)
    .eq('sender_role', 'ADMIN')
    .eq('is_read', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(req: Request) {
  const payload = await verifyAuth(req);
  if (!payload) return unauthorized();

  const { content } = await req.json();
  if (!content || !content.trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('support_messages')
    .insert({
      user_id: payload.sub,
      sender_role: 'USER',
      content: content.trim(),
      is_read: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ─── AI Responder ───
  try {
    const { data: aiSettings } = await db.from('ai_settings').select('*').eq('id', 1).single();
    const { data: user } = await db.from('users').select('ai_support_enabled').eq('id', payload.sub).single();

    let shouldAiRespond = false;
    if (user?.ai_support_enabled === true) {
      shouldAiRespond = true; // Forcé activé (surcharge)
    } else if (user?.ai_support_enabled === false) {
      shouldAiRespond = false; // Forcé désactivé (surcharge)
    } else {
      shouldAiRespond = !!aiSettings?.is_active; // Suit le statut global par défaut
    }

    if (shouldAiRespond) {
      const { data: history } = await db
        .from('support_messages')
        .select('sender_role, content')
        .eq('user_id', payload.sub)
        .order('created_at', { ascending: false })
        .limit(10);
        
      const chatHistory = history ? history.reverse().map(m => ({
        role: m.sender_role === 'ADMIN' ? 'assistant' : 'user',
        content: m.content
      })) : [];

      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      if (openRouterApiKey) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'WINARY AI Support',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free',
            messages: [
              { role: 'system', content: aiSettings.knowledge_base || 'Tu es un assistant.' },
              ...chatHistory
            ]
          })
        });

        if (response.ok) {
          const aiData = await response.json();
          const aiReply = aiData.choices?.[0]?.message?.content;
          if (aiReply) {
            await db.from('support_messages').insert({
              user_id: payload.sub,
              sender_role: 'ADMIN',
              content: aiReply.trim(),
              is_read: false,
            });
            // Effacer l'erreur précédente s'il y en avait une
            if (aiSettings.last_error) {
              await db.from('ai_settings').update({ last_error: null }).eq('id', 1);
            }
          }
        } else {
          const errText = await response.text();
          console.error("OpenRouter API Error:", errText);
          await db.from('ai_settings').update({ last_error: "Erreur API: " + errText.substring(0, 250) }).eq('id', 1);
        }
      } else {
        console.error("OpenRouter API Key not configured.");
        await db.from('ai_settings').update({ last_error: "La clé API OPENROUTER_API_KEY est manquante sur le serveur." }).eq('id', 1);
      }
    }
  } catch (err: any) {
    console.error("AI Logic Error:", err);
    await db.from('ai_settings').update({ last_error: "Exception: " + err.message }).eq('id', 1);
  }
  // ────────────────────

  return NextResponse.json({ message: data });
}
