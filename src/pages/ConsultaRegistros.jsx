import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  listarEventosRecentes,
  buscarEventosPorEtiqueta,
  buscarResumoKgraph,
  enviarFeedbackUtil,
  marcarFeedbackUtil,
  desmarcarFeedbackUtil,
  consultarFeedbackBatch,
  atualizarTranscricao, 
  excluirEvento, 
  transcreverRetroativo 
} from '../services/diarioRefugoService';

// Normaliza arquivo_url absoluta para path relativo (/uploads/...)
// Para que o servidor local possa servir ou fazer proxy para a VM
function normalizeMediaUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.pathname; // ex: /uploads/fotos/FOTO_123.jpg
  } catch {
    return url; // já é relativo
  }
}

// Renderiza texto markdown da API como elementos React formatados
function RenderedMarkdown({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;

  // Regex via construtor para evitar conflito de backticks com JSX
  const codeRe = new RegExp('^(.*?)' + '`' + '([^' + '`' + ']+)' + '`');
  const boldRe = /^(.*?)\*\*([^*]+)\*\*/;

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems.map((item, i) => (
      <li key={i} style={{ marginBottom: '4px' }}>{formatInline(item)}</li>
    ));
    if (listType === 'ol') {
      elements.push(<ol key={`list-${elements.length}`} style={{ margin: '8px 0', paddingLeft: '20px', color: '#ccc' }}>{items}</ol>);
    } else {
      elements.push(<ul key={`list-${elements.length}`} style={{ margin: '8px 0', paddingLeft: '20px', color: '#ccc' }}>{items}</ul>);
    }
    listItems = [];
    listType = null;
  };

  const formatInline = (str) => {
    const parts = [];
    let remaining = str;
    let key = 0;
    while (remaining.length > 0) {
      const codeMatch = remaining.match(codeRe);
      const boldMatch = remaining.match(boldRe);
      let match = null, type = null;
      if (codeMatch && (!boldMatch || codeMatch.index <= boldMatch.index)) {
        match = codeMatch; type = 'code';
      } else if (boldMatch) {
        match = boldMatch; type = 'bold';
      }
      if (match) {
        if (match[1]) parts.push(<span key={key++}>{match[1]}</span>);
        if (type === 'code') {
          parts.push(
            <code key={key++} style={{
              background: '#2a2f3e', padding: '1px 6px', borderRadius: '4px',
              fontSize: '11px', color: '#7eb8f7', fontFamily: 'monospace',
            }}>{match[2]}</code>
          );
        } else {
          parts.push(<strong key={key++} style={{ color: '#fff' }}>{match[2]}</strong>);
        }
        remaining = remaining.slice(match[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        remaining = '';
      }
    }
    return parts;
  };

  // Detecta se uma linha é linha de tabela markdown: | algo | algo |
  const isTableRow = (l) => l.trim().startsWith('|') && l.trim().endsWith('|') && l.includes('|');
  const isSeparatorRow = (l) => /^\|[\s\-:|]+\|$/.test(l.trim());
  const parseTableCells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  // Detecta bloco de dados brutos (dict/JSON longo)
  const isRawDataLine = (l) => {
    const t = l.trim();
    return (t.startsWith('{') && t.length > 120) || (t.startsWith("{") && t.includes("'variables'"));
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Linha vazia
    if (!trimmed) { flushList(); i++; continue; }

    // ---- Tabela markdown ----
    if (isTableRow(trimmed)) {
      flushList();
      const tableRows = [];
      let hasHeader = false;
      const startI = i;

      // Coletar todas as linhas da tabela
      while (i < lines.length && isTableRow(lines[i].trim())) {
        const row = lines[i].trim();
        if (isSeparatorRow(row)) {
          hasHeader = true;
          i++; continue;
        }
        tableRows.push(parseTableCells(row));
        i++;
      }

      if (tableRows.length > 0) {
        const headerRow = hasHeader ? tableRows[0] : null;
        const bodyRows = hasHeader ? tableRows.slice(1) : tableRows;
        const cellStyle = {
          padding: '8px 10px', fontSize: '11px', borderBottom: '1px solid #2a2f3e',
        };

        elements.push(
          <div key={`tbl-${startI}`} style={{
            background: '#141825', border: '1px solid #2d3a5a', borderRadius: '8px',
            overflow: 'auto', margin: '10px 0',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              {headerRow && (
                <thead>
                  <tr style={{ background: '#1e2540' }}>
                    {headerRow.map((cell, ci) => (
                      <th key={ci} style={{
                        ...cellStyle, color: '#7eb8f7', fontWeight: '700',
                        textAlign: 'left', fontSize: '10px', textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>{formatInline(cell)}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? '#141825' : '#181d30' }}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ ...cellStyle, color: '#ccc' }}>
                        {formatInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // ---- Bloco de dados brutos (JSON/dict) ----
    if (isRawDataLine(trimmed)) {
      flushList();
      let rawBlock = '';
      while (i < lines.length && lines[i].trim().length > 0) {
        rawBlock += (rawBlock ? '\n' : '') + lines[i];
        i++;
      }
      elements.push(
        <div key={`raw-${i}`} style={{
          background: '#0d1117', border: '1px solid #2d3a5a', borderRadius: '8px',
          padding: '12px', margin: '10px 0', maxHeight: '200px', overflowY: 'auto',
          overflowX: 'auto',
        }}>
          <pre style={{
            margin: 0, fontSize: '10px', color: '#888', fontFamily: 'monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.5',
          }}>{rawBlock}</pre>
        </div>
      );
      continue;
    }

    // ---- Separador somente tracos ----
    if (/^[-|]+$/.test(trimmed) || /^-{3,}$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid #2d3a5a', margin: '12px 0' }} />);
      i++; continue;
    }

    // ---- Heading ----
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const fontSize = level === 1 ? '15px' : level === 2 ? '13px' : '12px';
      elements.push(
        <div key={`h-${i}`} style={{
          fontSize, fontWeight: '700', color: '#7eb8f7',
          marginTop: '14px', marginBottom: '6px',
          borderBottom: level <= 2 ? '1px solid #2d3a5a' : 'none',
          paddingBottom: level <= 2 ? '6px' : '0',
        }}>
          {formatInline(headingMatch[2].replace(/[\u2705\u2757\u26a0\ufe0f\u2714\u274c\ud83d\udfe2\ud83d\udfe1\ud83d\udd34]/gu, '').trim())}
        </div>
      );
      i++; continue;
    }

    // ---- Lista não-ordenada ----
    const ulMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      i++; continue;
    }

    // ---- Lista ordenada ----
    const olMatch = trimmed.match(/^\d+\.\s+(.*)/);
    if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listItems.push(olMatch[1]);
      i++; continue;
    }

    // ---- Parágrafo normal ----
    flushList();
    elements.push(
      <p key={`p-${i}`} style={{ margin: '6px 0', color: '#ccc', lineHeight: '1.6' }}>
        {formatInline(trimmed)}
      </p>
    );
    i++;
  }
  flushList();

  return <>{elements}</>;
}

// Audio player component
function AudioPlayer({ url, label }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time) => {
    if (!time || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!url) return null;

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px',
      padding: '10px 14px',
      background: '#2d2d2d',
      borderRadius: '8px',
      marginTop: '8px',
    }}>
      <audio ref={audioRef} src={normalizeMediaUrl(url)} preload="metadata" />
      <button 
        onClick={togglePlay}
        style={{
          background: '#f5a623',
          color: '#1a1a1a',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 'bold',
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: '#fff' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          {formatTime(currentTime)} / {formatTime(duration || 0)}
        </div>
      </div>
    </div>
  );
}

// Single event card within an etiqueta group
function EventoItem({ evento, isFirst, onChanged, queryTag, diarioTag, initialFeedback }) {
  const [isUseful, setIsUseful] = useState(initialFeedback || false);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [fotoFullscreen, setFotoFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(isFirst);
  const [editDet, setEditDet] = useState(false);
  const [editObs, setEditObs] = useState(false);
  const [detText, setDetText] = useState(evento.transcricao_detalhe || '');
  const [obsText, setObsText] = useState(evento.transcricao_observacao || '');
  const [busy, setBusy] = useState(false);
  
  const audioDetalhe = evento.midias?.find(m => m.tipo === 'AUDIO_DETALHE');
  const audioObservacao = evento.midias?.find(m => m.tipo === 'AUDIO_OBSERVACAO');
  const foto = evento.midias?.find(m => m.tipo === 'FOTO');

  return (
    <div style={{
      borderTop: isFirst ? 'none' : '1px solid #3a3a3a',
      paddingTop: isFirst ? 0 : '16px',
      marginTop: isFirst ? 0 : '16px',
    }}>
      {/* Event header */}
      <div 
        style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
          gap: '12px'
        }}
      >
        <div>
          <div style={{ fontSize: '14px', color: '#f5a623', fontWeight: '600' }}>
            {new Date(evento.created_at).toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>
            Defeito: {evento.desc_defeito} ({evento.cod_defeito})
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: '#3a3a3a', color: '#f5a623', border: 'none', borderRadius: 6,
              padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700
            }}
          >{expanded ? 'Recolher' : 'Detalhes'}</button>
          <button
            disabled={busy}
            onClick={async () => {
              if (!confirm('Excluir este registro e suas mídias?')) return;
              setBusy(true);
              const { ok, error } = await excluirEvento(evento.evento_id);
              setBusy(false);
              if (!ok) return alert('Erro ao excluir: ' + (error?.message || ''));
              onChanged?.();
            }}
            style={{ background: '#e63946', color: 'white', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}
          >Excluir</button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ paddingTop: '12px' }}>
          {/* Info grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '12px',
            marginBottom: '16px',
          }}>
            <div style={{ background: '#2d2d2d', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#888' }}>Produto</div>
              <div style={{ fontSize: '14px', color: '#fff' }}>{evento.cod_produto || '-'}</div>
            </div>
            <div style={{ background: '#2d2d2d', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#888' }}>OP</div>
              <div style={{ fontSize: '14px', color: '#fff' }}>{evento.op || '-'}</div>
            </div>
            <div style={{ background: '#2d2d2d', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', color: '#888' }}>Linha</div>
              <div style={{ fontSize: '14px', color: '#fff' }}>{evento.linha || '-'}</div>
            </div>
          </div>

          {/* Transcriptions */}
          <div style={{ marginBottom: '16px' }}>
            {/* Detalhe */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: '600', 
                marginBottom: '6px',
                color: '#f5a623',
              }}>
                📝 Detalhes do Defeito
              </div>
              {!editDet ? (
                <div style={{ 
                  padding: '12px',
                  background: '#2d2d2d',
                  borderRadius: '8px',
                  borderLeft: '3px solid #f5a623',
                  fontSize: '14px',
                  fontStyle: detText ? 'normal' : 'italic',
                  color: detText ? '#fff' : '#666',
                }}>
                  {detText || '(Sem transcrição disponível)'}
                </div>
              ) : (
                <textarea
                  value={detText}
                  onChange={e => setDetText(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: 12, background: '#2d2d2d', color: '#fff', border: '1px solid #3a3a3a', borderRadius: 8 }}
                />
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <AudioPlayer url={audioDetalhe?.arquivo_url} label="Ouvir áudio do detalhe" />
                <button
                  onClick={async () => {
                    if (!editDet) { setEditDet(true); return; }
                    setBusy(true);
                    const { error } = await atualizarTranscricao(evento.evento_id, { detalhe: detText });
                    setBusy(false);
                    if (error) return alert('Erro ao salvar: ' + error.message);
                    setEditDet(false);
                    onChanged?.();
                  }}
                  style={{ background: '#f5a623', color: '#1a1a1a', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', height: 40 }}
                >{editDet ? 'Salvar' : 'Editar'}</button>
              </div>
            </div>

            {/* Observação */}
            <div>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: '600', 
                  color: '#f5a623',
                }}>
                  💬 Observações / Diagnóstico
                </div>
                <button
                  disabled={sendingFeedback}
                  onClick={async () => {
                    setSendingFeedback(true);
                    if (isUseful) {
                      await desmarcarFeedbackUtil(evento.evento_id);
                      setIsUseful(false);
                    } else {
                      await marcarFeedbackUtil(evento.evento_id, queryTag || diarioTag, diarioTag);
                      enviarFeedbackUtil(queryTag || diarioTag, diarioTag).catch(() => {});
                      setIsUseful(true);
                    }
                    setSendingFeedback(false);
                  }}
                  style={{
                    background: isUseful ? '#22c55e' : '#f5a623',
                    color: isUseful ? '#fff' : '#1a1a1a',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    cursor: sendingFeedback ? 'default' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '700',
                    fontFamily: "'Exo', sans-serif",
                    opacity: sendingFeedback ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                    boxShadow: isUseful ? '0 0 8px rgba(34,197,94,0.4)' : '0 2px 6px rgba(245,166,35,0.3)',
                  }}
                >
                  {sendingFeedback ? '⏳...' : isUseful ? '✅ Útil  ✔' : '👍 Útil'}
                </button>
              </div>
              {!editObs ? (
                <div style={{ 
                  padding: '12px',
                  background: '#2d2d2d',
                  borderRadius: '8px',
                  borderLeft: '3px solid #f5a623',
                  fontSize: '14px',
                  fontStyle: obsText ? 'normal' : 'italic',
                  color: obsText ? '#fff' : '#666',
                }}>
                  {obsText || '(Sem transcrição disponível)'}
                </div>
              ) : (
                <textarea
                  value={obsText}
                  onChange={e => setObsText(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: 12, background: '#2d2d2d', color: '#fff', border: '1px solid #3a3a3a', borderRadius: 8 }}
                />
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <AudioPlayer url={audioObservacao?.arquivo_url} label="Ouvir áudio da observação" />
                <button
                  onClick={async () => {
                    if (!editObs) { setEditObs(true); return; }
                    setBusy(true);
                    const { error } = await atualizarTranscricao(evento.evento_id, { observacao: obsText });
                    setBusy(false);
                    if (error) return alert('Erro ao salvar: ' + error.message);
                    setEditObs(false);
                    onChanged?.();
                  }}
                  style={{ background: '#f5a623', color: '#1a1a1a', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', height: 40 }}
                >{editObs ? 'Salvar' : 'Editar'}</button>
              </div>
            </div>
          </div>

          {/* Photo */}
          {foto && (
            <div>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: '600', 
                marginBottom: '6px',
                color: '#f5a623',
              }}>
                📷 Foto Evidência
              </div>
              <div
                onClick={() => setFotoFullscreen(true)}
                style={{ cursor: 'pointer', display: 'inline-block' }}
              >
                <img 
                  src={normalizeMediaUrl(foto.arquivo_url)} 
                  alt="Evidência"
                  style={{
                    width: '120px',
                    height: '90px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: '2px solid #3a3a3a',
                  }}
                />
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  🔍 Clique na foto para expandir
                </div>
              </div>
            </div>
          )}

          {/* Lightbox fullscreen da foto */}
          {fotoFullscreen && foto && (
            <div
              onClick={() => setFotoFullscreen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                cursor: 'pointer',
              }}
            >
              {/* Botão fechar */}
              <button
                onClick={(e) => { e.stopPropagation(); setFotoFullscreen(false); }}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
              <img
                src={normalizeMediaUrl(foto.arquivo_url)}
                alt="Evidência"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '95vw',
                  height: '90vh',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}

          {/* Metadata */}
          <div style={{ 
            marginTop: '12px', 
            paddingTop: '12px', 
            borderTop: '1px solid #3a3a3a',
            fontSize: '11px',
            color: '#666',
          }}>
            Usuário: {evento.usuario_nome || evento.usuario_matricula || '-'} | 
            Centro Custo: {evento.centro_custo || '-'}
          </div>
        </div>
      )}
    </div>
  );
}

// Grouped etiqueta card
function EtiquetaCard({ etiqueta, eventos, onChanged, queryTag }) {
  const [expanded, setExpanded] = useState(true);
  const [feedbackSet, setFeedbackSet] = useState(new Set());
  const count = eventos.length;
  const lastEvento = eventos[0]; // Most recent

  // Carregar feedback em lote (na montagem e ao expandir)
  useEffect(() => {
    if (!expanded) return;
    const ids = eventos.map(e => e.evento_id).filter(Boolean);
    if (ids.length === 0) return;
    consultarFeedbackBatch(ids).then(res => {
      if (res.data) setFeedbackSet(new Set(res.data));
    });
  }, [expanded, eventos]);

  return (
    <div style={{
      background: '#242424',
      borderRadius: '12px',
      marginBottom: '12px',
      overflow: 'hidden',
      border: '1px solid #3a3a3a',
    }}>
      {/* Header - always visible */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: expanded ? '#2d2d2d' : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Etiqueta badge */}
          <div style={{
            background: '#f5a623',
            color: '#1a1a1a',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: '700',
            fontSize: '16px',
            fontFamily: 'monospace',
          }}>
            {etiqueta}
          </div>
          
          {/* Counter badge */}
          <div style={{
            background: '#3a3a3a',
            color: '#f5a623',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
          }}>
            {count} registro{count > 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Last defect info */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', color: '#fff' }}>
              {lastEvento.desc_defeito}
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              Último: {new Date(lastEvento.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          
          {/* Expand icon */}
          <span style={{ 
            color: '#f5a623', 
            fontSize: '18px',
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Expanded content - list of events */}
      {expanded && (
        <div style={{ padding: '0 20px 20px 20px' }}>
          {eventos.map((evento, index) => (
            <EventoItem 
              key={evento.evento_id} 
              evento={evento} 
              isFirst={index === 0}
              onChanged={onChanged}
              queryTag={queryTag}
              diarioTag={etiqueta}
              initialFeedback={feedbackSet.has(evento.evento_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConsultaRegistros() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');
  const [modoBusca, setModoBusca] = useState('recentes'); // 'recentes' | 'etiqueta'
  const [codEtiqueta, setCodEtiqueta] = useState('');
  const [etiquetaBuscada, setEtiquetaBuscada] = useState('');
  const [resumoIA, setResumoIA] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [resumoExpandido, setResumoExpandido] = useState(false);

  // Load registros recentes
  useEffect(() => {
    if (modoBusca === 'recentes') loadRegistros();
  }, [modoBusca]);

  const loadRegistros = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await listarEventosRecentes(100);
      if (fetchError) throw fetchError;
      setRegistros(data || []);
    } catch (err) {
      console.error('Erro ao carregar registros:', err);
      setError('Erro ao carregar registros');
    } finally {
      setIsLoading(false);
    }
  };

  const buscarPorEtiqueta = async () => {
    if (!codEtiqueta.trim()) return;
    const tag = codEtiqueta.trim();
    setIsLoading(true);
    setError(null);
    setResumoIA(null);
    setResumoExpandido(false);
    setEtiquetaBuscada(tag);

    try {
      // Busca local e Kgraph em paralelo
      const [localResult, kgraphResult] = await Promise.all([
        buscarEventosPorEtiqueta(tag),
        (async () => {
          setLoadingResumo(true);
          const r = await buscarResumoKgraph(tag);
          setLoadingResumo(false);
          return r;
        })(),
      ]);

      if (localResult.error) throw localResult.error;
      setRegistros(localResult.data || []);
      if (!localResult.data || localResult.data.length === 0) {
        setError(`Nenhum registro local encontrado para a etiqueta "${tag}"`);
      }

      if (!kgraphResult.error && kgraphResult.data) {
        setResumoIA(kgraphResult.data);
      }
    } catch (err) {
      console.error('Erro ao buscar por etiqueta:', err);
      setError('Erro ao buscar registros da etiqueta');
    } finally {
      setIsLoading(false);
      setLoadingResumo(false);
    }
  };

  // Group registros by etiqueta
  const groupByEtiqueta = (registros) => {
    const groups = {};
    registros.forEach(registro => {
      const etiqueta = registro.etiqueta || 'SEM_ETIQUETA';
      if (!groups[etiqueta]) {
        groups[etiqueta] = [];
      }
      groups[etiqueta].push(registro);
    });
    return groups;
  };

  // Filter and group registros
  const registrosFiltrados = filtroEtiqueta
    ? registros.filter(r => 
        r.etiqueta?.toLowerCase().includes(filtroEtiqueta.toLowerCase()) ||
        r.desc_defeito?.toLowerCase().includes(filtroEtiqueta.toLowerCase())
      )
    : registros;

  const groupedRegistros = groupByEtiqueta(registrosFiltrados);
  const etiquetas = Object.keys(groupedRegistros).sort((a, b) => {
    // Sort by most recent event date
    const dateA = new Date(groupedRegistros[a][0].created_at);
    const dateB = new Date(groupedRegistros[b][0].created_at);
    return dateB - dateA;
  });

  const totalEtiquetas = etiquetas.length;
  const totalRegistros = registrosFiltrados.length;

  return (
    <div style={{
      height: '100vh',
      maxHeight: '100vh',
      background: '#18191a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'Exo', sans-serif",
    }}>
      {/* Header - DataDriven Style */}
      <header style={{
        padding: '12px 16px',
        background: '#242526',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        boxShadow: '2px 2px 5px 1px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img 
            src="/datawake_logo.svg" 
            alt="DataWake" 
            style={{ height: 36 }} 
            onError={(e) => { e.currentTarget.style.display='none'; }} 
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ccc' }}>Consulta de Registros</span>
            <span style={{ fontSize: 10, color: '#707070' }}>Diário de Bordo</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={async () => {
              const res = await transcreverRetroativo(50);
              if (!res.ok) alert('Erro ao transcrever pendentes');
              else alert(`Processados: ${res.data?.processed ?? 0}`);
              loadRegistros();
            }}
            style={{ background: '#3a3b3c', color: '#FDB913', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', fontFamily: "'Exo', sans-serif" }}
          >Transcrever</button>
          <div style={{
            background: '#3a3b3c',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '10px',
            color: '#707070',
            border: '1px solid #3a3b3c',
          }}>
            Ambiente: <span style={{ color: '#FDB913', fontWeight: 600 }}>TESTES</span>
          </div>
        </div>
      </header>

      {/* Page content */}
      <div style={{ flex: 1, padding: '12px', overflow: 'auto', minHeight: 0 }}>
        {/* Title and search */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#fff',
              margin: 0,
            }}>
              📋 Consulta de Registros
            </h2>
            <button 
              onClick={modoBusca === 'recentes' ? loadRegistros : buscarPorEtiqueta}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                background: '#f5a623',
                border: 'none',
                borderRadius: '6px',
                color: '#1a1a1a',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              🔄
            </button>
          </div>

          {/* Modo de busca toggle */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['recentes', 'etiqueta'].map(modo => (
              <button
                key={modo}
                onClick={() => {
                  setModoBusca(modo);
                  setRegistros([]);
                  setError(null);
                  setFiltroEtiqueta('');
                  setEtiquetaBuscada('');
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: modoBusca === modo ? '#f5a623' : '#2d2d2d',
                  color: modoBusca === modo ? '#1a1a1a' : '#888',
                  border: '1px solid ' + (modoBusca === modo ? '#f5a623' : '#3a3a3a'),
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: modoBusca === modo ? '700' : '400',
                  fontFamily: "'Exo', sans-serif",
                }}
              >
                {modo === 'recentes' ? '🕐 Recentes' : '🔎 Por Etiqueta'}
              </button>
            ))}
          </div>

          {/* Busca por etiqueta/defeito (modo recentes) */}
          {modoBusca === 'recentes' && (
            <input
              type="text"
              placeholder="🔍 Filtrar etiqueta ou defeito..."
              value={filtroEtiqueta}
              onChange={(e) => setFiltroEtiqueta(e.target.value)}
              style={{
                padding: '10px 14px',
                background: '#242424',
                border: '1px solid #3a3a3a',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                width: '100%',
              }}
            />
          )}

          {/* Busca por etiqueta */}
          {modoBusca === 'etiqueta' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Etiqueta (ex: 0016645564)"
                value={codEtiqueta}
                onChange={(e) => setCodEtiqueta(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarPorEtiqueta()}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: '#242424',
                  border: '1px solid #3a3a3a',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: "'Exo', sans-serif",
                }}
              />
              <button
                onClick={buscarPorEtiqueta}
                disabled={isLoading || !codEtiqueta.trim()}
                style={{
                  padding: '10px 18px',
                  background: codEtiqueta.trim() ? '#f5a623' : '#3a3a3a',
                  color: codEtiqueta.trim() ? '#1a1a1a' : '#555',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: codEtiqueta.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '700',
                  fontSize: '13px',
                  fontFamily: "'Exo', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                Buscar
              </button>
            </div>
          )}

          {/* Indicador de etiqueta sendo exibida */}
          {modoBusca === 'etiqueta' && etiquetaBuscada && !isLoading && (
            <div style={{
              padding: '8px 12px',
              background: '#1a2a1a',
              border: '1px solid #2d5a2d',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#6fcf6f',
            }}>
              Exibindo histórico da etiqueta: <strong>{etiquetaBuscada}</strong>
            </div>
          )}
        </div>

        {/* ===== CARD RESUMO IA ===== */}
        {modoBusca === 'etiqueta' && (loadingResumo || resumoIA) && (
          <div style={{
            background: '#1a1f2e',
            border: '1px solid #2d3a5a',
            borderRadius: '12px',
            marginBottom: '12px',
            overflow: 'hidden',
          }}>
            {/* Header do card */}
            <div
              onClick={() => !loadingResumo && setResumoExpandido(!resumoExpandido)}
              style={{
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: loadingResumo ? 'default' : 'pointer',
                background: '#1e2540',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🤖</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#7eb8f7' }}>
                    Resumo IA — Kgraph
                  </div>
                  <div style={{ fontSize: '11px', color: '#555' }}>
                    {loadingResumo ? 'Carregando análise...' : `Etiqueta: ${resumoIA?.tag || etiquetaBuscada}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Badge violações */}
                {resumoIA?.violations_recommended?.length > 0 && (
                  <div style={{
                    background: '#5a2020',
                    color: '#f87171',
                    border: '1px solid #7a3030',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: '700',
                  }}>
                    ⚠️ {resumoIA.violations_recommended.length} alerta{resumoIA.violations_recommended.length > 1 ? 's' : ''}
                  </div>
                )}
                {!loadingResumo && (
                  <span style={{ color: '#7eb8f7', fontSize: '14px' }}>
                    {resumoExpandido ? '▲' : '▼'}
                  </span>
                )}
                {loadingResumo && (
                  <span style={{ color: '#555', fontSize: '12px' }}>⏳</span>
                )}
              </div>
            </div>

            {/* Corpo colapsável */}
            {!loadingResumo && resumoExpandido && resumoIA && (
              <div style={{ padding: '16px' }}>

                {/* Tabela de parâmetros fora da faixa */}
                {resumoIA.violations_recommended?.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '12px', fontWeight: '700', color: '#f87171',
                      marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <span style={{
                        background: '#5a2020', borderRadius: '50%', width: '20px', height: '20px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                      }}>⚠️</span>
                      Parâmetros Fora da Faixa Ótima
                    </div>
                    <div style={{
                      background: '#1a1020',
                      border: '1px solid #3a2040',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}>
                      {/* Cabeçalho da tabela */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1.5fr 80px',
                        background: '#251530',
                        padding: '8px 12px',
                        fontSize: '10px',
                        fontWeight: '700',
                        color: '#888',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        <div>Parâmetro</div>
                        <div style={{ textAlign: 'center' }}>Atual</div>
                        <div style={{ textAlign: 'center' }}>Faixa Ótima</div>
                        <div style={{ textAlign: 'center' }}>Status</div>
                      </div>
                      {/* Linhas */}
                      {resumoIA.violations_recommended.map((v, i) => {
                        const actual = parseFloat(v.actual_value);
                        const min = v.expected_range?.[0];
                        const max = v.expected_range?.[1];
                        const isAbove = actual > max;
                        return (
                          <div key={i} style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1.5fr 80px',
                            padding: '10px 12px',
                            fontSize: '12px',
                            borderTop: '1px solid #2a1530',
                            alignItems: 'center',
                          }}>
                            <div style={{ color: '#f87171', fontWeight: '600', fontFamily: 'monospace', fontSize: '11px' }}>
                              {v.parameter}
                            </div>
                            <div style={{ textAlign: 'center', color: '#fff', fontWeight: '700' }}>
                              {v.actual_value}
                            </div>
                            <div style={{ textAlign: 'center', color: '#888', fontSize: '11px' }}>
                              {min != null && max != null ? `${Number(min).toFixed(2)} – ${Number(max).toFixed(2)}` : '-'}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{
                                background: '#5a2020',
                                color: '#f87171',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '10px',
                                fontWeight: '700',
                              }}>
                                {isAbove ? '▲ ALTO' : '▼ BAIXO'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recomendações IA - renderizado com markdown */}
                {resumoIA.recommendations && (
                  <div>
                    <div style={{
                      fontSize: '12px', fontWeight: '700', color: '#7eb8f7',
                      marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <span style={{
                        background: '#1e2a50', borderRadius: '50%', width: '20px', height: '20px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                      }}>📋</span>
                      Análise e Recomendações
                    </div>
                    <div style={{
                      background: '#131825',
                      border: '1px solid #1e2a50',
                      borderRadius: '8px',
                      padding: '16px',
                      fontSize: '12px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                    }}>
                      <RenderedMarkdown text={resumoIA.recommendations} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '12px',
        }}>
          <div style={{ 
            padding: '8px 12px', 
            background: '#242424', 
            borderRadius: '6px',
            border: '1px solid #3a3a3a',
            flex: 1,
            textAlign: 'center',
          }}>
            <span style={{ color: '#888', fontSize: '11px' }}>Etiquetas: </span>
            <span style={{ color: '#f5a623', fontWeight: '700', fontSize: '14px' }}>{totalEtiquetas}</span>
          </div>
          <div style={{ 
            padding: '8px 12px', 
            background: '#242424', 
            borderRadius: '6px',
            border: '1px solid #3a3a3a',
            flex: 1,
            textAlign: 'center',
          }}>
            <span style={{ color: '#888', fontSize: '11px' }}>Registros: </span>
            <span style={{ color: '#f5a623', fontWeight: '700', fontSize: '14px' }}>{totalRegistros}</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ 
            padding: '16px',
            background: 'rgba(230, 57, 70, 0.1)', 
            borderLeft: '4px solid #e63946',
            borderRadius: '8px',
            marginBottom: '24px',
            color: '#e63946',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ 
              fontSize: '48px', 
              marginBottom: '16px',
              animation: 'spin 1s linear infinite',
            }}>⏳</div>
            <p style={{ color: '#888' }}>Carregando registros...</p>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && totalEtiquetas === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px',
            background: '#242424',
            borderRadius: '12px',
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>Nenhum registro encontrado</h3>
            <p style={{ color: '#888', marginBottom: '24px' }}>
              {filtroEtiqueta 
                ? 'Tente outro termo de busca' 
                : 'Comece registrando uma etiqueta no Diário de Bordo'}
            </p>
            <button 
              onClick={() => navigate('/')}
              style={{
                padding: '14px 28px',
                background: '#f5a623',
                border: 'none',
                borderRadius: '8px',
                color: '#1a1a1a',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              📋 Novo Registro
            </button>
          </div>
        )}

        {/* Etiquetas list */}
        {!isLoading && etiquetas.map(etiqueta => (
          <EtiquetaCard 
            key={etiqueta} 
            etiqueta={etiqueta}
            eventos={groupedRegistros[etiqueta]}
            onChanged={loadRegistros}
            queryTag={modoBusca === 'etiqueta' ? etiquetaBuscada : null}
          />
        ))}
      </div>

      {/* Bottom navigation - fixo no rodapé */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px',
        borderTop: '1px solid #3a3b3c',
        background: '#242526',
      }}>
        <button 
          onClick={() => navigate('/')}
          style={{
            width: '100%',
            padding: '14px',
            background: '#FDB913',
            border: 'none',
            borderRadius: '8px',
            color: '#18191a',
            fontSize: '16px',
            fontWeight: '700',
            fontFamily: "'Exo', sans-serif",
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📋 NOVO REGISTRO
        </button>
      </div>
    </div>
  );
}
