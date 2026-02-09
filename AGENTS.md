# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Diário de Bordo (Logbook)** - A React PWA for recording manufacturing defects (refugos) in a factory setting. Operators scan product labels, record audio descriptions of defects, take photos as evidence, and submit records that are stored in Supabase with automatic audio transcription via OpenAI Whisper.

## Tech Stack

- **Frontend**: React 19 + Vite 7 (JavaScript/JSX)
- **Backend**: Supabase (PostgreSQL, Storage, Edge Functions)
- **Audio Transcription**: OpenAI Whisper API via Supabase Edge Functions (Deno)
- **Routing**: react-router-dom v7

## Commands

```bash
# Install dependencies
npm install

# Start development server (localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run ESLint
npm run lint

# Deploy Supabase Edge Functions (requires Supabase CLI)
supabase functions deploy transcribe-audio
supabase functions deploy transcribe-audio-batch
```

## Environment Variables

Create `.env` from `.env.example`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

Edge Functions require:
- `OPENAI_API_KEY` - For Whisper transcription
- `SUPABASE_SERVICE_ROLE_KEY` - For database updates

## Architecture

### Application Flow
```
LerEtiqueta (/) → DiarioBordo (/diario-bordo) → DiarioConfirmacao (/diario-confirmacao)
                         ↓
                ConsultaRegistros (/consulta)
```

1. **LerEtiqueta**: Operator scans/enters a label code, which is looked up in `dw_refugo_evento` table
2. **DiarioBordo**: Main form where operator records two audio descriptions (defect details + observations) and optionally takes a photo
3. **DiarioConfirmacao**: Success confirmation after saving
4. **ConsultaRegistros**: Query and manage past records, edit transcriptions, play back audio

### Key Services (`src/services/`)

| Service | Purpose |
|---------|---------|
| `supabase.js` | Supabase client singleton |
| `diarioRefugoService.js` | CRUD operations for events (`dw_diario_refugo_evento`) and media (`dw_diario_refugo_midia`), storage uploads |
| `transcricaoService.js` | Calls Edge Function for audio transcription |

### Custom Hooks (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useAudioRecorder` | Audio recording with RMS level metering, returns `audioBlob`, `stream` for visualization |
| `useCamera` | Camera capture via `getUserMedia` or file input fallback |

### Database Tables (Supabase)

- `dw_refugo_evento` - Source data for defects (from ELIPSE system)
- `dw_diario_refugo_evento` - Logbook entries (events)
- `dw_diario_refugo_midia` - Media files (audio/photo) linked to events

### Storage Bucket

`diario-refugo` bucket structure: `YYYY/MM/DD/{evento_id}/{tipo}_{timestamp}.{ext}`

### Edge Functions (`supabase/functions/`)

- `transcribe-audio/` - Single audio transcription (receives FormData with file, evento_id, tipo)
- `transcribe-audio-batch/` - Batch transcription for records missing transcriptions

## Code Patterns

### Media Types
- `AUDIO_DETALHE` - Defect details audio
- `AUDIO_OBSERVACAO` - Observations/diagnosis audio  
- `FOTO` - Photo evidence

### Event Status
- `PENDING` - Created, media being uploaded
- `SAVED` - Finalized with transcriptions

### Styling
Uses inline styles with CSS variables. Primary brand color is `#FDB913` (DataWake yellow). Dark theme with `#18191a` background.

### Component Pattern
Pages are in `src/pages/`, reusable components in `src/components/`. Pages use barrel export via `index.js`.

## Proxy Configuration

Development server proxies `/api/openai/*` to `https://api.openai.com` for CORS bypass (see `vite.config.js`).
