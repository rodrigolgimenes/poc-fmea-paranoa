// Edge Function para transcrição de áudio via OpenAI Whisper
// Recebe arquivo de áudio, transcreve e salva no banco de dados

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[transcribe-audio] Request received");

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const eventoId = formData.get("evento_id") as string | null;
    const tipo = formData.get("tipo") as string | null; // 'detalhe' ou 'observacao'
    const language = (formData.get("language") as string) || "pt";

    if (!file) {
      console.log("[transcribe-audio] No file provided");
      return new Response(
        JSON.stringify({ success: false, error: "No audio file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[transcribe-audio] Processing ${tipo} for evento ${eventoId}`);
    console.log(`[transcribe-audio] File: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

    // Get OpenAI API Key
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("[transcribe-audio] OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send to OpenAI Whisper
    console.log("[transcribe-audio] Sending to OpenAI Whisper...");
    const whisperFormData = new FormData();
    whisperFormData.append("file", file, file.name || "audio.webm");
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", language);

    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: whisperFormData,
      }
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("[transcribe-audio] Whisper API error:", errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Whisper API error: ${whisperResponse.status}`,
          details: errorText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const whisperResult = await whisperResponse.json();
    const transcription = whisperResult.text;

    console.log(`[transcribe-audio] Transcription: ${transcription}`);

    // Save to database if evento_id provided
    if (eventoId && tipo) {
      // Get Supabase credentials - use SERVICE_ROLE_KEY for database updates
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[transcribe-audio] Supabase credentials not configured");
        console.error(`[transcribe-audio] URL: ${supabaseUrl ? 'present' : 'missing'}, Key: ${supabaseServiceKey ? 'present' : 'missing'}`);
        return new Response(
          JSON.stringify({
            success: true,
            text: transcription,
            warning: "Transcription successful but could not save to database - missing credentials",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create Supabase client with service role (bypasses RLS)
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Determine which column to update
      const column = tipo === "detalhe" ? "transcricao_detalhe" : "transcricao_observacao";

      console.log(`[transcribe-audio] Updating ${column} for evento ${eventoId}`);

      const { data, error: updateError } = await supabase
        .from("dw_diario_refugo_evento")
        .update({ [column]: transcription })
        .eq("evento_id", eventoId)
        .select();

      if (updateError) {
        console.error("[transcribe-audio] Database update error:", updateError);
        return new Response(
          JSON.stringify({
            success: true,
            text: transcription,
            warning: `Transcription successful but database update failed: ${updateError.message}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[transcribe-audio] Updated ${column} for evento ${eventoId}`, data);
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        text: transcription,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[transcribe-audio] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
