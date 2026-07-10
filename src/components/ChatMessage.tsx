import React, { useState, useEffect, useRef } from 'react';
import { User, Bot, FileText, Award, Download, Code2, Filter, RefreshCw, Minus, Plus, Shuffle, AlertTriangle, GraduationCap, BookOpen, ShieldCheck, Briefcase, Building2, Star } from 'lucide-react';
import { SearchResult, SearchMetrics, MatchReason } from '../lib/supabase';
import type { ConversationIntent } from '../lib/conversation-context';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  results?: SearchResult[];
  metrics?: SearchMetrics;
  timestamp: Date;
  intentLabel?: string;
  intentType?: ConversationIntent;
  actionText?: string;
  actionType?: string;
  isStreaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
  onTypingTick?: () => void;
  expandedSkills: Set<string>;
  snippetCursors: Record<string, number>;
  onToggleSkills: (resultId: string) => void;
  onShowNextSnippet: (resultId: string, total: number) => void;
}

const INTENT_CONFIG: Record<ConversationIntent, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  NARROW:  { label: 'Filtered from previous results', icon: <Filter className="w-3.5 h-3.5" />, color: '#1d4ed8', bg: '#eff6ff' },
  EXCLUDE: { label: 'Exclusions applied',             icon: <Minus className="w-3.5 h-3.5" />,  color: '#b91c1c', bg: '#fef2f2' },
  REPLACE: { label: 'Constraints updated',            icon: <Shuffle className="w-3.5 h-3.5" />, color: '#b45309', bg: '#fffbeb' },
  EXPAND:  { label: 'Search expanded',                icon: <Plus className="w-3.5 h-3.5" />,   color: '#15803d', bg: '#f0fdf4' },
  FORMAT:  { label: 'Results reformatted',            icon: <RefreshCw className="w-3.5 h-3.5" />, color: '#6b7280', bg: '#f9fafb' },
  NEW:     { label: 'New search',                     icon: null, color: '', bg: '' },
};

export const REASON_CONFIG: Record<string, { icon: React.ReactNode; bg: string; text: string; border: string }> = {
  degree:     { icon: <GraduationCap className="w-3.5 h-3.5" />, bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  field:      { icon: <BookOpen className="w-3.5 h-3.5" />,      bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  cert:       { icon: <Award className="w-3.5 h-3.5" />,         bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  clearance:  { icon: <ShieldCheck className="w-3.5 h-3.5" />,   bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  experience: { icon: <Briefcase className="w-3.5 h-3.5" />,     bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
  seniority:  { icon: <Star className="w-3.5 h-3.5" />,          bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  role:       { icon: <Briefcase className="w-3.5 h-3.5" />,     bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
  institution:{ icon: <Building2 className="w-3.5 h-3.5" />,     bg: '#FAF5FF', text: '#7C3AED', border: '#DDD6FE' },
  skill:      { icon: <Code2 className="w-3.5 h-3.5" />,         bg: '#FFF5E6', text: '#E68A00', border: '#FED7AA' },
  other:      { icon: <FileText className="w-3.5 h-3.5" />,      bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
};

// ─── Inline bold renderer ─────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-slate-200 rounded px-1 text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// ─── Action text block ────────────────────────────────────────────────────────
function ActionTextBlock({ text, actionType }: { text: string; actionType?: string }) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="border-slate-200 my-3" />);
      i++; continue;
    }

    if (line.trim().startsWith('|') && lines[i + 1]?.trim().startsWith('|---')) {
      const headers = line.trim().split('|').filter(c => c.trim()).map(c => c.trim());
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().split('|').filter(c => c.trim()).map(c => c.trim()));
        i++;
      }
      nodes.push(
        <div key={`table-${i}`} className="overflow-x-auto my-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                {headers.map((h, hi) => (
                  <th key={hi} className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-slate-200 px-2 py-1.5 text-slate-700">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={i} className="border-l-4 border-slate-300 pl-3 my-1 text-slate-600 italic text-sm">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    if (line.startsWith('• ') || line.startsWith('  • ')) {
      const indent = line.startsWith('  ') ? 'ml-4' : '';
      nodes.push(
        <div key={i} className={`flex gap-1.5 text-sm text-slate-700 ${indent}`}>
          <span className="mt-0.5 text-slate-400 flex-shrink-0">•</span>
          <span>{renderInline(line.replace(/^\s*•\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const [num, ...rest] = line.split('. ');
      nodes.push(
        <div key={i} className="flex gap-2 text-sm text-slate-700">
          <span className="text-slate-400 flex-shrink-0 font-mono">{num}.</span>
          <span>{renderInline(rest.join('. '))}</span>
        </div>
      );
      i++; continue;
    }

    if (!line.trim()) {
      nodes.push(<div key={i} className="h-2" />);
      i++; continue;
    }

    nodes.push(
      <p key={i} className="text-sm text-slate-700 leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return (
    <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
      {actionType && (
        <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200">
          {actionType}
        </div>
      )}
      <div className="p-4 space-y-0.5 font-sans bg-white">{nodes}</div>
    </div>
  );
}

function MatchReasonDisplay({ reasons, fallback }: { reasons?: MatchReason[]; fallback?: string }) {
  if (!reasons || reasons.length === 0) {
    if (!fallback) return null;
    return (
      <div className="flex items-start gap-2">
        <span className="text-sm font-medium text-slate-600 min-w-fit">Match Reason:</span>
        <span className="text-sm text-slate-700">{toTitleCase(fallback)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="text-sm font-medium text-slate-600 min-w-fit pt-0.5">Match Reason:</span>
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((reason, idx) => {
          const cfg = REASON_CONFIG[reason.type] || REASON_CONFIG.other;
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, lineHeight: '1.4', display: 'inline-flex', alignItems: 'center' }}
            >
              {cfg.icon}
              {toTitleCase(reason.label)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const SKILLS_PREVIEW = 5;

const toTitleCase = (str: string) => str.replace(/\b\w/g, (c) => c.toUpperCase());

export default function ChatMessage({ message, onTypingTick, expandedSkills, snippetCursors, onToggleSkills, onShowNextSnippet }: ChatMessageProps) {
  const isUser = message.type === 'user';
  const [downloading, setDownloading] = useState<string | null>(null);

  // ── Typewriter effect for streamed bot messages ───────────────────────────
  const fullText = message.content;
  const [displayedText, setDisplayedText] = useState(
    message.isStreaming ? '' : fullText
  );
  const charIndexRef = useRef(message.isStreaming ? 0 : fullText.length);

  useEffect(() => {
    if (!message.isStreaming) {
      setDisplayedText(fullText);
      return;
    }
    charIndexRef.current = 0;
    setDisplayedText('');
    const interval = setInterval(() => {
      charIndexRef.current += 1;
      setDisplayedText(fullText.slice(0, charIndexRef.current));
      onTypingTick?.();
      if (charIndexRef.current >= fullText.length) {
        clearInterval(interval);
      }
    }, 14);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.isStreaming]);

  const getSnippetCount = (resultId: string) => snippetCursors[resultId] ?? 1;

  const handleDownload = async (result: SearchResult) => {
    setDownloading(result.id);
    try {
      if (!result.drive_item_id) {
        alert('This resume cannot be downloaded. Please re-index resumes.');
        setDownloading(null);
        return;
      }

      const downloadResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-resume`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            driveItemId: result.drive_item_id,
            fileName: result.file_name || `${result.candidate_name}.pdf`,
          }),
        }
      );

      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json();
        throw new Error(errorData.error || 'Failed to download file');
      }

      const blob = await downloadResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.file_name || `${result.candidate_name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download resume. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const intentCfg = message.intentType && message.intentType !== 'NEW' ? INTENT_CONFIG[message.intentType] : null;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end message-slide-right' : 'justify-start message-slide-left'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FE9900' }}>
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}

      <div className={`flex-1 max-w-3xl ${isUser ? 'flex justify-end' : ''}`}>
        {intentCfg && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium mb-0.5"
            style={{ backgroundColor: intentCfg.bg, color: intentCfg.color, borderLeft: `3px solid ${intentCfg.color}` }}
          >
            {intentCfg.icon}
            <span>{message.intentLabel || intentCfg.label}</span>
          </div>
        )}

        <div
          className={`rounded-lg p-4 ${intentCfg ? 'rounded-tl-none' : ''} ${
            isUser ? 'text-white' : 'bg-slate-100 text-slate-800'
          }`}
          style={isUser ? { backgroundColor: '#FE9900' } : undefined}
        >
          <p className="whitespace-pre-wrap">{displayedText}</p>

          {message.actionText && displayedText === fullText && (
            <ActionTextBlock text={message.actionText} actionType={message.actionType} />
          )}

          {message.metrics && displayedText === fullText && (
            <div className="mt-2 pt-2 border-t border-slate-300/50 text-xs opacity-60">
              Searched {message.metrics.totalResumes} resume{message.metrics.totalResumes !== 1 ? 's' : ''} in {message.metrics.searchTimeSeconds}s
            </div>
          )}

          {message.results && message.results.length > 0 && displayedText === fullText && (
            <div className="mt-4 space-y-4" data-pdf-results="true">
              {message.results.map((result) => {
                const isUnreadable = (result as any)._flaggedUnreadable;
                return (
                <div
                  key={result.id}
                  data-pdf-result-card="true"
                  className={`rounded-lg border p-4 shadow-sm ${isUnreadable ? 'border-amber-300 bg-amber-50' : 'bg-white border-slate-200'}`}
                >
                  {isUnreadable && (
                    <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold mb-2 pb-2 border-b border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Scanned / Unreadable PDF — requires manual review</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5" style={{ color: isUnreadable ? '#d97706' : '#FE9900' }} />
                      <h3 className="font-semibold text-slate-900">
                        {result.candidate_name || result.file_name}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleDownload(result)}
                      disabled={downloading === result.id}
                      className="flex items-center gap-1 text-sm hover:underline disabled:text-slate-400 disabled:cursor-not-allowed"
                      style={{ color: downloading === result.id ? '#94a3b8' : '#FE9900' }}
                      onMouseEnter={(e) => downloading !== result.id && (e.currentTarget.style.color = '#E68A00')}
                      onMouseLeave={(e) => downloading !== result.id && (e.currentTarget.style.color = '#FE9900')}
                    >
                      <span>{downloading === result.id ? 'Downloading...' : 'Download'}</span>
                      <Download className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <MatchReasonDisplay reasons={result.matchReasons} fallback={result.matchReason} />

                    {result.skills && result.skills.length > 0 && (
                      <div className="flex items-start gap-2 pt-2">
                        <Code2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#FE9900' }} />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-600">Skills:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {(expandedSkills.has(result.id) ? result.skills : result.skills.slice(0, SKILLS_PREVIEW)).map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 text-xs rounded-md"
                                style={{
                                  backgroundColor: '#FFF5E6',
                                  color: '#E68A00',
                                  borderColor: '#FED7AA',
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  lineHeight: '1.4',
                                }}
                              >
                                {toTitleCase(skill)}
                              </span>
                            ))}
                            {result.skills.length > SKILLS_PREVIEW && (
                              <button
                                onClick={() => onToggleSkills(result.id)}
                                className="px-2.5 py-1 text-xs rounded-md font-medium transition-colors"
                                style={{
                                  backgroundColor: '#FFF5E6',
                                  color: '#E68A00',
                                  borderColor: '#FED7AA',
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FED7AA'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFF5E6'; }}
                              >
                                {expandedSkills.has(result.id)
                                  ? '− less'
                                  : `+${result.skills.length - SKILLS_PREVIEW} more`}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {result.certifications && result.certifications.length > 0 && (
                      <div className="flex items-start gap-2 pt-1">
                        <Award className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-600">Certifications:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {result.certifications.map((cert, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs rounded-md border border-amber-200"
                                style={{ display: 'inline-flex', alignItems: 'center', lineHeight: '1.4' }}
                              >
                                {toTitleCase(cert)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {result.matchedSnippets && result.matchedSnippets.length > 0 && (() => {
                      const total = result.matchedSnippets.length;
                      const visible = getSnippetCount(result.id);
                      const showingAll = visible >= total;
                      return (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <span className="text-sm font-medium text-slate-600">Relevant Excerpts:</span>
                          <div className="mt-2 space-y-2">
                            {result.matchedSnippets.slice(0, visible).map((snippet, idx) => (
                              <div
                                key={idx}
                                className="text-sm text-slate-600 bg-slate-50 p-2 rounded italic"
                              >
                                {snippet}
                              </div>
                            ))}
                          </div>
                          {total > 1 && (
                            <button
                              onClick={() => onShowNextSnippet(result.id, total)}
                              className="mt-2 text-xs font-medium transition-colors"
                              style={{ color: '#E68A00' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#B86E00'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#E68A00'; }}
                            >
                              {showingAll ? 'See less' : `See more (${total - visible} remaining)`}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </div>
  );
}
