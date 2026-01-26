import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Midia = { id: string; tipo: string; arquivo_url: string; };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || '50');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
  if (!supabaseUrl || !serviceKey || !openaiKey) {
    return new Response(JSON.stringify({ error: 'Missing env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY)' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  // 1) Buscar eventos sem transcrição
  const { data: eventos, error: evErr } = await sb
    .from('dw_diario_refugo_evento')
    .select('evento_id, etiqueta, transcricao_detalhe, transcricao_observacao')
    .or('transcricao_detalhe.is.null,transcricao_observacao.is.null')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (evErr) {
    return new Response(JSON.stringify({ error: evErr.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  let processed = 0;
  const results: Record<string, any> = {};

  for (const ev of eventos || []) {
    const id = ev.evento_id;
    // 2) Buscar mídias
    const { data: midias } = await sb
      .from('dw_diario_refugo_midia')
      .select('tipo, arquivo_url')
      .eq('evento_id', id);

    // Helper to transcribe one audio URL
    const transcribeUrl = async (fileUrl: string) => {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const fd = new FormData();
      fd.append('file', new File([blob], 'audio.webm'));
      fd.append('model', 'whisper-1');
      fd.append('language', 'pt');
      const tr = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: fd,
      });
      if (!tr.ok) throw new Error(`Whisper ${tr.status}`);
      const json = await tr.json();
      return json.text as string;
    };

    const upd: any = {};
    try {
      const det = (midias || []).find(m => m.tipo === 'AUDIO_DETALHE');
      if (det && !ev.transcricao_detalhe) {
        upd.transcricao_detalhe = await transcribeUrl(det.arquivo_url);
      }
      const obs = (midias || []).find(m => m.tipo === 'AUDIO_OBSERVACAO');
      if (obs && !ev.transcricao_observacao) {
        upd.transcricao_observacao = await transcribeUrl(obs.arquivo_url);
      }
    } catch (e) {
      results[id] = { error: String(e) };
      continue;
    }

    if (Object.keys(upd).length) {
      const { error: upErr } = await sb.from('dw_diario_refugo_evento').update(upd).eq('evento_id', id);
      if (upErr) {
        results[id] = { error: upErr.message };
      } else {
        results[id] = { updated: upd };
        processed++;
      }
    }
  }

  return new Response(JSON.stringify({ processed, results }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
