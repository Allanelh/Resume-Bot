import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Send, Loader2, Download, ChevronDown, Bot } from 'lucide-react';
import ChatMessage, { SKILLS_PREVIEW } from './components/ChatMessage';
import SplashScreen from './components/SplashScreen';
import ConfigModal from './components/ConfigModal';
import { supabase, SearchResult, SearchMetrics } from './lib/supabase';
import { parseNaturalLanguageQuery, matchResumeToQuery, findSynonymGroup, scoreForSkill, correctFuzzyTerms, extractSearchTerms } from './lib/nlp-parser';
import { normalizeResumeText } from './lib/text-normalizer';
import { detectActionQuery, generateActionResponse, type ActionQuery } from './lib/action-handler';
import {
  createSessionContext,
  resolveConversationalTurn,
  intentLabel,
  type SessionContext,
  type ConversationIntent,
} from './lib/conversation-context';
import jsPDF from 'jspdf';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  results?: SearchResult[];
  metrics?: SearchMetrics;
  timestamp: Date;
  allResults?: SearchResult[];
  displayCount?: number;
  intentLabel?: string;
  intentType?: ConversationIntent;
  actionText?: string;
  actionType?: string;
  isStreaming?: boolean;
}

const EXAMPLE_PROMPTS = [
  'Show me candidates with a Bachelor\'s degree',
  'Find applicants with PMP certification',
  'Show me candidates with Master\'s degrees in Computer Science',
  'Find executive-level experience in Finance',
  'List candidates with degrees from state universities',
];

// ── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start message-slide-left">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FE9900' }}>
        <Bot className="w-5 h-5 text-white" />
      </div>
      <div className="bg-slate-100 rounded-lg px-4 py-3 flex items-center gap-1.5" style={{ minHeight: '40px' }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

const WELCOME_VARIANTS = [
  `Hi there! I'm the Humango Solutions hiring assistant — here to help you find the right candidates, fast.\n\nI can:\n• Search and filter applicants by skills, certifications, degrees, or experience level\n• Compare candidates side-by-side or rank them by specific criteria\n• Draft interview invitation emails and generate tailored interview questions\n• Summarize a candidate's strengths and flag potential red flags\n• Answer questions about specific candidates already in view\n\nWhat role are we hiring for today?`,
  `Welcome! Ready to dig into the resume database whenever you are.\n\nHere's what I can do:\n• Find candidates by skill, certification, degree, or seniority level\n• Rank or compare applicants against each other\n• Draft emails, generate interview questions, or summarize a candidate's profile\n• Answer follow-up questions about anyone already in your results\n\nWhat are you looking for today?`,
  `Good to see you! I'm here to make candidate search faster and smarter.\n\nI can help you:\n• Filter by technical skills, certifications, education, or experience level\n• Spot leadership experience even when the title doesn't say "Manager"\n• Generate interview questions, draft outreach emails, or flag AI-written resumes\n• Dig deeper into any candidate from your last search without re-querying\n\nWhat kind of candidate are you hunting for?`,
];

const GREETING_VARIANTS = [
  "Hi! Ready to help whenever you are. I can search candidates by skills, degrees, certifications, experience level, or more nuanced criteria like leadership without a manager title or fast-paced environment experience.\n\nWhat role are we working on?",
  "Hey! Good to have you here. Point me at a role or requirement and I'll pull the right candidates — whether that's a specific skill set, a certification, or something more contextual.\n\nWhat are we looking for today?",
  "Hello! Happy to help with your search. I can filter by almost anything — tech stack, seniority, degrees, clearances, or even patterns like career growth or hands-on experience without a formal title.\n\nWhat kind of candidate do you need?",
];

// ── PDF helpers ───────────────────────────────────────────────────────────────
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const REASON_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  degree:     { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  field:      { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  cert:       { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  clearance:  { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  experience: { bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
  seniority:  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  role:       { bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
  institution:{ bg: '#FAF5FF', text: '#7C3AED', border: '#DDD6FE' },
  skill:      { bg: '#FFF5E6', text: '#E68A00', border: '#FED7AA' },
  other:      { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
};

const INTENT_PDF: Record<string, { label: string; color: string; bg: string }> = {
  NARROW:  { label: 'Filtered from previous results', color: '#1d4ed8', bg: '#eff6ff' },
  EXCLUDE: { label: 'Exclusions applied',             color: '#b91c1c', bg: '#fef2f2' },
  REPLACE: { label: 'Constraints updated',            color: '#b45309', bg: '#fffbeb' },
  EXPAND:  { label: 'Search expanded',                color: '#15803d', bg: '#f0fdf4' },
  FORMAT:  { label: 'Results reformatted',            color: '#6b7280', bg: '#f9fafb' },
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [sharePointUrl, setSharePointUrl] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [snippetCursors, setSnippetCursors] = useState<Record<string, number>>({});
  const handleSplashDone = useCallback(() => setSplashDone(true), []);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const sessionCtx = useRef<SessionContext>(createSessionContext());

  const handleToggleSkills = useCallback((resultId: string) => {
    setExpandedSkills(prev => {
      const next = new Set(prev);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  }, []);

  const handleShowNextSnippet = useCallback((resultId: string, total: number) => {
    setSnippetCursors(prev => {
      const current = prev[resultId] ?? 1;
      if (current >= total) return { ...prev, [resultId]: 1 };
      return { ...prev, [resultId]: current + 1 };
    });
  }, []);

  const postBotMessage = (msg: Message, textOnly = false) => {
    if (textOnly) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { ...msg, isStreaming: true }]);
      }, 1500);
    } else {
      setMessages(prev => [...prev, msg]);
    }
  };

  useEffect(() => {
    loadConfig();
    const welcomeText = WELCOME_VARIANTS[Math.floor(Math.random() * WELCOME_VARIANTS.length)];
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages([{
        id: 'welcome',
        type: 'bot',
        content: welcomeText,
        timestamp: new Date(),
      }]);
    }, 1500);
  }, []);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isLoading]);

  const loadConfig = async () => {
    const { data: activeData } = await supabase
      .from('app_config')
      .select('config_value')
      .eq('config_key', 'active_resume_source')
      .maybeSingle();

    const activeSource = activeData?.config_value === 'older' ? 'older' : 'new';
    const configKey = activeSource === 'older' ? 'sharepoint_folder_url_older' : 'sharepoint_folder_url';

    const { data } = await supabase
      .from('app_config')
      .select('config_value')
      .eq('config_key', configKey)
      .maybeSingle();
    if (data) setSharePointUrl(data.config_value);
  };

  // ─── Conversational helpers ────────────────────────────────────────────────

  const isGreeting = (q: string) =>
    /^\s*(hi+|hello+|hey+|howdy|good\s+(morning|afternoon|evening)|greetings|sup|what'?s\s+up|yo+)\b.{0,40}$/i.test(q);

  const isExplainQuery = (q: string) =>
    /\b(why|explain|how\s+did\s+you|what\s+criteria|reasoning|logic)\b/i.test(q) &&
    /\b(show|pick|choose|select|include|result|candidate|match|rank|find)\b/i.test(q);

  const isCandidateQuestion = (q: string): SearchResult | null => {
    const pool = sessionCtx.current.lastResults;
    if (!pool || pool.length === 0) return null;
    for (const r of pool) {
      const name = (r.candidate_name || r.file_name.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ')).trim();
      if (name.length < 3) continue;
      const firstName = name.split(/\s+/)[0];
      const lastName = name.split(/\s+/).slice(-1)[0];
      const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (
        new RegExp(`\\b${escapeRe(firstName)}\\b`, 'i').test(q) ||
        (lastName !== firstName && new RegExp(`\\b${escapeRe(lastName)}\\b`, 'i').test(q))
      ) return r;
    }
    return null;
  };

  const buildCandidateAnswer = (q: string, r: SearchResult): string => {
    const name = (r.candidate_name || r.file_name.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ')).trim();
    const content = r.content_text || '';
    const skills = (r.skills || []);
    const certs = (r.certifications || []);

    const topicMatch = q.match(/\b(?:have|has|knows?|experienced?|used?|list|mention|background\s+in|done)\s+(?:any\s+)?([a-zA-Z][a-zA-Z\s\+\#\.]{2,40}?)(?:\?|$|\s+(?:experience|background|skills?|certs?))/i);
    const topic = topicMatch?.[1]?.trim();

    if (topic) {
      const tLow = topic.toLowerCase();
      const idx = content.toLowerCase().indexOf(tLow);
      const inSkills = skills.some(s => s.toLowerCase().includes(tLow));
      const inCerts = certs.some(c => c.toLowerCase().includes(tLow));

      if (idx !== -1 || inSkills || inCerts) {
        let snippet = '';
        if (idx !== -1) {
          const s = Math.max(0, idx - 100);
          const e = Math.min(content.length, idx + 220);
          snippet = content.slice(s, e).replace(/\s+/g, ' ').trim();
          if (s > 0) snippet = '...' + snippet;
          if (e < content.length) snippet += '...';
        }
        const where = inSkills ? 'skills section' : inCerts ? 'certifications' : 'resume';
        return snippet
          ? `Yes. ${name} references ${topic} in their ${where} — specifically: "${snippet}"\n\nWould you like to see their full profile or compare them with another candidate?`
          : `Yes. ${name} lists ${topic} in their ${where}. Would you like more detail?`;
      } else {
        return `Based on the available resume text, ${name} does not appear to list ${topic} in their background.\n\nTheir documented skills include: ${skills.slice(0, 6).join(', ') || 'none extracted'}${certs.length > 0 ? `\nCertifications: ${certs.slice(0, 4).join(', ')}` : ''}\n\nWould you like to search for candidates who do have ${topic} experience?`;
      }
    }

    return `Here's a quick summary of ${name}:\n\n• **Skills:** ${skills.slice(0, 6).join(', ') || 'none extracted'}\n• **Certifications:** ${certs.slice(0, 4).join(', ') || 'none listed'}\n• **File:** ${r.file_name}\n\nWhat specifically would you like to know about them?`;
  };

  const buildExplanation = (query: import('./lib/nlp-parser').ParsedQuery, results: SearchResult[]): string => {
    const parts: string[] = [];
    if (query.degrees.phd) parts.push('a PhD / Doctorate');
    if (query.degrees.master) parts.push("a Master's degree");
    if (query.degrees.bachelor) parts.push("a Bachelor's degree");
    if (query.degrees.associate) parts.push("an Associate's degree");
    if (query.degrees.specificField) parts.push(`a field of study in ${query.degrees.specificField}`);
    if (query.certifications.specific.length > 0) parts.push(`certifications: ${query.certifications.specific.join(', ')}`);
    if (query.certifications.general.length > 0) parts.push(`cert keywords: ${query.certifications.general.join(', ')}`);
    if (query.skills.required.length > 0) parts.push(`skills: ${query.skills.required.slice(0, 6).join(', ')}`);
    if (query.experience.minYears > 0) parts.push(`${query.experience.minYears}+ years of experience`);
    if (query.experience.seniority) parts.push(`${query.experience.seniority.replace('_', '-')} level`);
    if (query.experience.clearance) parts.push(`${query.experience.clearance.replace('_', '/')} clearance`);
    if (query.semantic?.leadershipWithoutTitle) parts.push('evidence of team leadership (even without a manager title)');
    if (query.semantic?.greenfield) parts.push('"built from scratch" indicators');
    if (query.semantic?.fastPaced) parts.push('fast-paced or startup environment language');
    if (query.semantic?.customerEscalation) parts.push('customer escalation or difficult-client experience');
    if (query.semantic?.promotedInPlace) parts.push('promotion within the same company');
    if (query.experience.excludeVisaSponsorship) parts.push('(excluded: visa sponsorship required)');
    if (query.experience.excludeManagement) parts.push('(excluded: management roles)');
    const criteriaStr = parts.length > 0 ? parts.join('; ') : 'broad keyword matching across all resume text';
    return `Here's how I selected these ${results.length} candidate${results.length !== 1 ? 's' : ''}:\n\n**Criteria matched:** ${criteriaStr}\n\n**Ranking logic:** Each resume was scored based on keyword frequency, proximity to action verbs (e.g., "built", "deployed", "led"), and whether matches appeared in work experience versus just a skills list. Higher scores rank higher.\n\n**What I did not check:** Employment gaps, contact completeness, or information not present in the resume text itself.\n\nWould you like me to tighten or relax any of these criteria?`;
  };

  const buildEmptyResultsMessage = (query: import('./lib/nlp-parser').ParsedQuery): string => {
    const constraints: string[] = [];
    if (query.degrees.phd) constraints.push('a PhD requirement');
    if (query.certifications.specific.length > 1) constraints.push(`all of these certifications: ${query.certifications.specific.join(' + ')}`);
    else if (query.certifications.specific.length === 1) constraints.push(`a ${query.certifications.specific[0]} certification`);
    if (query.experience.clearance) constraints.push(`${query.experience.clearance.replace(/_/g, '/')} clearance`);
    if (query.experience.minYears >= 10) constraints.push(`${query.experience.minYears}+ years of experience`);
    if (query.semantic?.leadershipWithoutTitle) constraints.push('documented team leadership without a manager title');
    if (query.semantic?.customerEscalation) constraints.push('customer escalation experience');
    if (query.semantic?.promotedInPlace) constraints.push('a promotion-in-place history');

    if (constraints.length === 0) {
      return "I couldn't find any candidates matching your criteria. The combination of requirements may be too specific — try relaxing one constraint at a time, or ask me to show everyone and filter from there.";
    }

    const primaryConstraint = constraints[0];
    let msg = `I couldn't find any candidates who meet ${primaryConstraint}`;
    if (constraints.length > 1) msg += ` combined with ${constraints.slice(1).join(' and ')}`;
    msg += '.';

    if (query.degrees.phd) {
      msg += " However, I may be able to find candidates with a Master's degree instead. Would you like to try that?";
    } else if (query.certifications.specific.length > 1) {
      msg += ` Would you like me to search for candidates with ${query.certifications.specific[0]} only, or with either certification?`;
    } else if (query.experience.minYears >= 10) {
      msg += ` The closest candidates may have fewer years. Should I lower the threshold to ${query.experience.minYears - 3}+ years?`;
    } else {
      msg += " Try broadening the search — I can relax one requirement at a time until we find matches.";
    }
    return msg;
  };

  const buildNarrowSuggestion = (results: SearchResult[], parsedQuery: import('./lib/nlp-parser').ParsedQuery): string => {
    if (results.length <= 5) return '';
    const hasCerts = parsedQuery.certifications.specific.length > 0 || parsedQuery.certifications.general.length > 0;
    const hasSeniority = !!parsedQuery.experience.seniority;
    const hasField = !!parsedQuery.degrees.specificField;
    const options: string[] = [];
    if (!hasCerts) options.push('a specific certification (e.g., CompTIA A+, AWS, PMP)');
    if (!hasSeniority) options.push('seniority level (entry, mid, or senior)');
    if (!hasField) options.push('a specific field of study');
    if (parsedQuery.skills.required.length < 2) options.push('an additional required skill');
    if (options.length === 0) return '';
    return `\n\nWould you like me to narrow this down further? I can filter by ${options.slice(0, 2).join(' or ')}.`;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const query = inputValue.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    if (isGreeting(query)) {
      const greetingText = GREETING_VARIANTS[Math.floor(Math.random() * GREETING_VARIANTS.length)];
      postBotMessage({ id: (Date.now() + 1).toString(), type: 'bot', content: greetingText, timestamp: new Date() }, true);
      setIsLoading(false);
      return;
    }

    const candidateInContext = isCandidateQuestion(query);
    if (candidateInContext && /\b(does|did|has|have|knows?|mention|list|work|role|title|skill|cert)\b/i.test(query) && /\b(their|him|her|they|the candidate|that person)\b/i.test(query)) {
      postBotMessage({ id: (Date.now() + 1).toString(), type: 'bot', content: buildCandidateAnswer(query, candidateInContext), timestamp: new Date() }, true);
      setIsLoading(false);
      return;
    }

    const lastPQ = sessionCtx.current.lastParsedQuery;
    const lastRes = sessionCtx.current.lastResults;
    if (isExplainQuery(query) && lastPQ && lastRes && lastRes.length > 0) {
      postBotMessage({ id: (Date.now() + 1).toString(), type: 'bot', content: buildExplanation(lastPQ, lastRes), timestamp: new Date() }, true);
      setIsLoading(false);
      return;
    }

    try {
      const startTime = performance.now();
      const ctx = sessionCtx.current;
      const actionQuery: ActionQuery | null = detectActionQuery(query);
      const resolved = resolveConversationalTurn(query, ctx, []);

      let finalResults: SearchResult[] = [];
      let flaggedUnreadable: SearchResult[] = [];
      let totalResumes = 0;

      const hasPreviousResults = ctx.lastResults && ctx.lastResults.length > 0;
      const actionUsesExisting = actionQuery && hasPreviousResults &&
        /\b(the\s+)?(top\s+\d+|current|above|those|these|them|candidates?|results?|applicants?)\b/i.test(query) &&
        !/\b(find|search|show\s+me|get\s+me)\b/i.test(query);

      if (actionUsesExisting) {
        finalResults = ctx.lastResults!;
        totalResumes = ctx.lastResults!.length;
      } else if (resolved.intent === 'NEW' || resolved.intent === 'REPLACE' || resolved.intent === 'EXPAND') {
        const { results, total, flagged } = await runGlobalSearch(query, resolved.intent === 'REPLACE' ? resolved.parsedQuery! : null, resolved.intent);
        finalResults = results;
        flaggedUnreadable = flagged;
        totalResumes = total;
      } else {
        finalResults = resolved.results;
        totalResumes = resolved.totalSearched;
      }

      if (resolved.parsedQuery?.semantic?.rankByCertCount) {
        finalResults = [...finalResults].sort((a, b) => (b.certifications?.length ?? 0) - (a.certifications?.length ?? 0));
      }

      const endTime = performance.now();
      const searchTimeSeconds = ((endTime - startTime) / 1000).toFixed(2);

      try {
        await supabase.from('search_history').insert({ query, results_count: finalResults.length });
      } catch { /* non-critical */ }

      const isNewSearch = resolved.intent === 'NEW' || resolved.intent === 'REPLACE' || resolved.intent === 'EXPAND' || !!actionUsesExisting;
      const newOffset = (resolved as any).newOffset;
      sessionCtx.current = {
        ...ctx,
        lastResults: finalResults,
        fullResultPool: isNewSearch ? finalResults : ctx.fullResultPool,
        displayOffset: isNewSearch ? 0 : (newOffset ?? ctx.displayOffset),
        lastParsedQuery: resolved.parsedQuery || ctx.lastParsedQuery,
        activeSkills: resolved.parsedQuery?.skills.required || ctx.activeSkills,
        activeCerts: resolved.parsedQuery?.certifications.specific || ctx.activeCerts,
        activeFilters: resolved.parsedQuery || ctx.activeFilters,
      };

      let actionText: string | undefined;
      let actionTypeLabel: string | undefined;
      if (actionQuery) {
        actionText = generateActionResponse(actionQuery, finalResults, query);
        const ACTION_LABELS: Record<string, string> = {
          draft_email: 'Email Drafts',
          summarize: 'Candidate Summary',
          extract_links: 'Link Extraction',
          generate_questions: 'Interview Questions',
          flag_ai_generated: 'AI Content Analysis',
          compare_top2: 'Side-by-Side Comparison',
          score_candidates: 'Candidate Scoring',
        };
        actionTypeLabel = ACTION_LABELS[actionQuery.type] || 'Analysis';
      }

      let content: string;
      if (actionQuery) {
        content = finalResults.length > 0
          ? `${actionTypeLabel} — based on ${finalResults.length} candidate${finalResults.length > 1 ? 's' : ''}:`
          : `${actionTypeLabel}:`;
      } else if (finalResults.length === 0) {
        content = buildEmptyResultsMessage(resolved.parsedQuery || parseNaturalLanguageQuery(query));
      } else {
        const narrowSuggestion = buildNarrowSuggestion(finalResults, resolved.parsedQuery || parseNaturalLanguageQuery(query));
        content = `Found ${finalResults.length} candidate${finalResults.length > 1 ? 's' : ''} matching your criteria:${narrowSuggestion}`;
      }

      if (flaggedUnreadable.length > 0) {
        content += `\n\nNote: ${flaggedUnreadable.length} scanned/unreadable PDF${flaggedUnreadable.length > 1 ? 's' : ''} were flagged separately and require manual review.`;
      }

      const allResultsCombined = [
        ...finalResults,
        ...flaggedUnreadable.map((r: any) => ({ ...r, _flaggedUnreadable: true })),
      ];

      const showCards = !actionQuery || ['flag_ai_generated'].includes(actionQuery.type);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content,
        results: showCards ? allResultsCombined.slice(0, 10) : undefined,
        allResults: showCards ? allResultsCombined : undefined,
        displayCount: showCards ? 10 : undefined,
        metrics: { totalResumes, searchTimeSeconds: parseFloat(searchTimeSeconds) },
        timestamp: new Date(),
        intentLabel: resolved.intent !== 'NEW' ? intentLabel(resolved.intent, resolved.description) : undefined,
        intentType: resolved.intent,
        actionText,
        actionType: actionTypeLabel,
      };

      const isTextOnly = !showCards || allResultsCombined.length === 0;
      postBotMessage(botMessage, isTextOnly);
    } catch (error) {
      console.error('Search error:', error);
      postBotMessage({ id: (Date.now() + 1).toString(), type: 'bot', content: 'An error occurred while searching. Please try again.', timestamp: new Date() }, true);
    } finally {
      setIsLoading(false);
    }
  };

  const runGlobalSearch = async (
    query: string,
    preParsed: import('./lib/nlp-parser').ParsedQuery | null,
    intent: ConversationIntent,
  ): Promise<{ results: SearchResult[]; total: number; flagged: SearchResult[] }> => {
    const { results: dbResults, totalResumes, flaggedUnreadable } = await searchResumes(query, preParsed);
    return { results: dbResults, total: totalResumes, flagged: flaggedUnreadable || [] };
  };

  const INDUSTRY_EXPANDED: Record<string, string> = {
    'it': 'information technology',
    'finance': 'financial',
    'federal': 'federal government',
    'defense': 'defense',
    'healthcare': 'healthcare',
  };

  const parseMatchReasons = (reasons: string[]): Array<{ type: string; label: string }> => {
    return reasons.map(r => {
      const colon = r.indexOf(':');
      if (colon === -1) return { type: 'other', label: r };
      const type = r.slice(0, colon);
      const value = r.slice(colon + 1);
      switch (type) {
        case 'degree': {
          const labels: Record<string, string> = {
            "Bachelor's": "Bachelor's Degree",
            "Master's": "Master's Degree",
            "PhD/Doctorate": "PhD / Doctorate",
            "Associate's": "Associate's Degree",
            "High School Diploma/GED": "High School Diploma / GED",
            "College education": "College Education",
          };
          return { type: 'degree', label: labels[value] || `${value} Degree` };
        }
        case 'field': return { type: 'field', label: `${value} (Field of Study)` };
        case 'major': return { type: 'field', label: `Major: ${value}` };
        case 'cert': return { type: 'cert', label: `${value} Certification` };
        case 'cert_progress': return { type: 'cert', label: `${value} (In Progress)` };
        case 'exp': return { type: 'experience', label: `${value}+ Years Experience` };
        case 'seniority': {
          const labels: Record<string, string> = {
            entry_level: 'Entry Level', mid_level: 'Mid Level', senior: 'Senior Level',
            staff: 'Staff Level', principal: 'Principal Level', executive: 'Executive Level',
          };
          return { type: 'seniority', label: labels[value] || `${value.replace('_', ' ')} Level` };
        }
        case 'company': return { type: 'experience', label: `Worked at ${value}` };
        case 'role': return { type: 'role', label: `Role: ${value}` };
        case 'industry': return { type: 'experience', label: `${value} Industry` };
        case 'institution': return { type: 'institution', label: value === 'Ivy League' ? 'Ivy League Institution' : `Attended ${value}` };
        case 'clearance': return { type: 'clearance', label: `Security Clearance: ${value}` };
        case 'employment': return value === 'current'
          ? { type: 'experience', label: 'Currently Employed' }
          : { type: 'role', label: `Currently: ${value}` };
        case 'skill': return { type: 'skill', label: value };
        case 'other': return { type: 'other', label: value };
        default: return { type: 'other', label: r };
      }
    });
  };

  const searchResumes = async (query: string, preParsed?: import('./lib/nlp-parser').ParsedQuery | null): Promise<{ results: SearchResult[], totalResumes: number, flaggedUnreadable?: SearchResult[] }> => {
    const parsedQuery = preParsed || parseNaturalLanguageQuery(query);

    // ── DB-side prefilter: only download resumes whose content matches search terms ──
    // This replaces the old approach of downloading ALL resumes in 100-row pages.
    // For 760 resumes, this cuts network transfers from ~38MB to only matching rows.
    const searchTerms = extractSearchTerms(parsedQuery);

    let allResumes: any[] = [];

    if (searchTerms.length === 0) {
      // "Show all" or no specific terms — fetch all resumes via RPC (returns all rows)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('prefilter_resumes', { search_terms: [] });
      if (rpcError) {
        console.error('Prefilter RPC error:', rpcError);
        // Fallback to paginated fetch
        let start = 0;
        while (true) {
          const { data: page, error } = await supabase
            .from('resumes')
            .select('id, file_name, file_url, drive_item_id, content_text, file_type, last_modified, indexed_at, candidate_name, created_at')
            .range(start, start + 999);
          if (error || !page || page.length === 0) break;
          allResumes = allResumes.concat(page);
          if (page.length < 1000) break;
          start += 1000;
        }
      } else {
        allResumes = rpcData || [];
      }
    } else {
      // Prefiltered fetch — only resumes matching any search term
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('prefilter_resumes', { search_terms: searchTerms });
      if (rpcError) {
        console.error('Prefilter RPC error:', rpcError);
        // Fallback to paginated fetch of all resumes
        let start = 0;
        while (true) {
          const { data: page, error } = await supabase
            .from('resumes')
            .select('id, file_name, file_url, drive_item_id, content_text, file_type, last_modified, indexed_at, candidate_name, created_at')
            .range(start, start + 999);
          if (error || !page || page.length === 0) break;
          allResumes = allResumes.concat(page);
          if (page.length < 1000) break;
          start += 1000;
        }
      } else {
        allResumes = rpcData || [];
      }
    }

    if (allResumes.length === 0) return { results: [], totalResumes: 0 };

    // ── Fetch skills and certifications only for the matching resumes ──
    const resumeIds = allResumes.map(r => r.id);

    const skillsByResume = new Map<string, string[]>();
    const certsByResume = new Map<string, string[]>();

    // Fetch skills in batches of 200 IDs (Supabase .in() limit)
    for (let i = 0; i < resumeIds.length; i += 200) {
      const batchIds = resumeIds.slice(i, i + 200);
      const { data: skillsBatch, error: skillsErr } = await supabase
        .from('skills')
        .select('id, resume_id, skill_name')
        .in('resume_id', batchIds);
      if (skillsErr) { console.error('Error fetching skills:', skillsErr); break; }
      if (skillsBatch) {
        for (const s of skillsBatch) {
          const arr = skillsByResume.get(s.resume_id) || [];
          arr.push(s.skill_name);
          skillsByResume.set(s.resume_id, arr);
        }
      }
    }

    // Fetch certs in batches of 200 IDs
    for (let i = 0; i < resumeIds.length; i += 200) {
      const batchIds = resumeIds.slice(i, i + 200);
      const { data: certsBatch, error: certsErr } = await supabase
        .from('certifications')
        .select('id, resume_id, certification_name')
        .in('resume_id', batchIds);
      if (certsErr) { console.error('Error fetching certs:', certsErr); break; }
      if (certsBatch) {
        for (const c of certsBatch) {
          const arr = certsByResume.get(c.resume_id) || [];
          arr.push(c.certification_name.toLowerCase());
          certsByResume.set(c.resume_id, arr);
        }
      }
    }

    for (const resume of allResumes) {
      // Normalize before matching or slicing excerpts so every result uses the
      // same clean text, including resumes indexed before the repair existed.
      resume.content_text = normalizeResumeText(resume.content_text || '');
      resume.skills = skillsByResume.get(resume.id) || [];
      resume.certifications = certsByResume.get(resume.id) || [];
    }

    const totalResumes = allResumes.length;
    const results: SearchResult[] = [];
    const flaggedUnreadable: SearchResult[] = [];

    for (const resume of allResumes) {
      const certNames = (resume.certifications || []).map((c: any) =>
        typeof c === 'string' ? c.toLowerCase() : (c.certification_name || '').toLowerCase()
      ).filter(Boolean);
      const skillNames = (resume.skills || []).map((s: any) =>
        typeof s === 'string' ? s : (s.skill_name || '')
      ).filter(Boolean);
      const resumeMeta = { file_name: resume.file_name, indexed_at: resume.indexed_at };

      const matchResult = matchResumeToQuery(resume.content_text, parsedQuery, resumeMeta);

      if (parsedQuery.skills.flagUnreadable && matchResult.isUnreadable) {
        flaggedUnreadable.push({
          ...resume, certifications: certNames, skills: skillNames,
          matchedSnippets: ['[Scanned/unreadable PDF — text could not be extracted]'],
          matchReason: 'Unreadable/scanned resume', exactMatchScore: 0, totalScore: 0,
        } as any);
        if (!matchResult.matches) continue;
      }

      if (!matchResult.matches) continue;

      const matchedSnippets: string[] = [];
      if (matchResult.clearanceSnippet) matchedSnippets.push(normalizeResumeText(matchResult.clearanceSnippet));

      const findMatchingVariant = (term: string): string => {
        const group = findSynonymGroup(term);
        if (group) {
          const lowerContent = resume.content_text.toLowerCase();
          for (const variant of group.variants) {
            if (lowerContent.includes(variant.toLowerCase())) return variant;
          }
        }
        return term;
      };

      const pushSnippet = (keyword: string) => {
        if (matchedSnippets.length >= 5) return;
        const variant = findMatchingVariant(keyword);
        const snippet = extractSnippet(resume.content_text, variant);
        if (snippet && !matchedSnippets.includes(snippet)) matchedSnippets.push(snippet);
      };

      const degreeTermMap: Record<string, string[]> = {
        bachelor: ['bachelor', 'b.s.', 'bs', 'b.a.', 'ba', 'undergraduate', 'bachelor of science', 'bachelor of arts'],
        master: ['master', 'm.s.', 'ms', 'm.a.', 'ma', 'mba', 'master of science', 'master of arts'],
        phd: ['phd', 'ph.d', 'doctorate', 'doctoral'],
        associate: ['associate', 'a.s.', 'a.a.'],
        highSchool: ['high school', 'ged', 'diploma'],
      };
      for (const [degKey, terms] of Object.entries(degreeTermMap)) {
        if ((parsedQuery.degrees as any)[degKey]) {
          const contentLower = resume.content_text.toLowerCase();
          for (const term of terms) {
            if (contentLower.includes(term.toLowerCase())) { pushSnippet(term); break; }
          }
        }
      }

      if (parsedQuery.skills.orGroups) {
        for (const group of parsedQuery.skills.orGroups) {
          for (const term of group) pushSnippet(term);
        }
      }

      if (parsedQuery.degrees.specificField) pushSnippet(parsedQuery.degrees.specificField);
      for (const cert of parsedQuery.certifications.general) pushSnippet(cert);
      if (parsedQuery.experience.specificRole) pushSnippet(parsedQuery.experience.specificRole);
      if (parsedQuery.experience.currentlyEmployedAs && parsedQuery.experience.currentlyEmployedAs !== '__any__') {
        pushSnippet(parsedQuery.experience.currentlyEmployedAs);
      }
      if (parsedQuery.experience.industry) {
        const expanded = INDUSTRY_EXPANDED[parsedQuery.experience.industry] || parsedQuery.experience.industry;
        pushSnippet(expanded);
      }

      const degreeNoise = new Set(['bachelors', 'masters', 'bachelor', 'master', 'degree', 'degrees',
        'phd', 'doctorate', 'associates', 'associate', 'diploma', 'graduate', 'undergraduate',
        'certification', 'certifications', 'certified', 'license', 'licenses']);
      for (const skill of parsedQuery.skills.required) {
        if (!degreeNoise.has(skill.toLowerCase())) pushSnippet(skill);
      }

      for (const reason of matchResult.reasons) {
        if (reason.startsWith('Skill: ')) pushSnippet(reason.slice(7));
        if (reason.startsWith('In progress: ')) pushSnippet(reason.slice(13));
      }

      if (matchedSnippets.length === 0) {
        const cleanText = resume.content_text.replace(/\r\n|\r/g, '\n').replace(/\s{3,}/g, '  ');
        const WINDOW = 300;
        const STEP = 100;
        for (let pos = 0; pos + WINDOW <= cleanText.length; pos += STEP) {
          const w = cleanText.slice(pos, pos + WINDOW).trim();
          if (w.length < 80) continue;
          if (!isGibberishSnippet(w)) {
            matchedSnippets.push(normalizeResumeText(w) + (pos + WINDOW < cleanText.length ? '...' : ''));
            break;
          }
        }
      }

      const isShowAll = parsedQuery.skills.fields.includes('__all__');
      if (matchedSnippets.length === 0 && !isShowAll) continue;
      if (matchedSnippets.length === 0) matchedSnippets.push('[Resume text could not be extracted]');

      results.push({
        ...resume,
        certifications: certNames,
        skills: skillNames,
        matchedSnippets: matchedSnippets.slice(0, 5),
        matchReason: matchResult.reasons.join(', '),
        matchReasons: parseMatchReasons(matchResult.reasons),
        exactMatchScore: matchResult.score,
        totalScore: matchResult.score,
      } as any);
    }

    if (parsedQuery.skills.topN && parsedQuery.skills.topNSkill) {
      const rankSkill = parsedQuery.skills.topNSkill;
      results.sort((a: any, b: any) => {
        const diff = scoreForSkill(b.content_text || '', rankSkill) - scoreForSkill(a.content_text || '', rankSkill);
        return diff !== 0 ? diff : b.totalScore - a.totalScore;
      });
      return { results: results.slice(0, parsedQuery.skills.topN), totalResumes, flaggedUnreadable };
    }

    results.sort((a: any, b: any) => b.totalScore - a.totalScore);
    return { results, totalResumes, flaggedUnreadable };
  };

  const isGibberishSnippet = (snippet: string): boolean => {
    const gibberishPatterns = [
      /\d+\s+\d+\s+obj\b/, /\bendobj\b/, /\/Type\s*\//, /endstream/, /xref\s*\n/, /%%EOF/,
      /\bRoot\s+\d+\s+\d+\s+R\b/, /Content_Types\.xml/, /_rels\/.rels/, /xmlns:/,
      /\bword\/[a-z]+\d*\.xml\b/, /docProps\//, /\bFont\s+F\d+\s+\d+\s+\d+\s+R\b/,
      /\bExtGState\s+GS\d+/, /\bProcSet\s*\[PDF/, /\bMediaBox\s+\d/, /\bCropBox\s+\d/,
      /\bStructParents\b/, /\bCIDFontType\b/, /\bCIDToGIDMap\b/, /\bFontDescriptor\b/,
      /\bFontFile\d*\b/, /\bFontName\b/, /\bItalicAngle\b/, /\bStemV\b/,
      /Ordering\s+\(Identity\)/, /Registry\s+\(Adobe\)/, /rdf\s+about/i, /pdf\s+Keywords/i,
      /pdf\s+Producer/i, /Apache\s+FOP/i, /WebKitFormBoundary/, /Content-Disposition\s+form-data/,
      /Content-Type\s+application/, /file\s+C\s+Users\s+\w+\s+OneDrive/i, /OneDrive\\Documents/i,
      /Type\s+Action\s+S\s+URI/, /linkedin\.com\/in\/[a-z0-9\-]+\s+\d{5,}/i,
      /\d{6,}\s+\d+\s+[a-z0-9\-]+\s+\d+\s+\d+/, /\s*\/>\s*\/>\s*\/>/, /HYPERLINK\s+https?\s+\S+/i,
    ];
    if (gibberishPatterns.some(p => p.test(snippet))) return true;
    const words = snippet.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 5) return true;
    const shortTokens = words.filter(w => w.length <= 2);
    if (shortTokens.length / words.length > 0.55) return true;
    const numericTokens = words.filter(w => /^\d+$/.test(w));
    if (numericTokens.length / words.length > 0.25) return true;
    const xmlTags = (snippet.match(/\/>/g) || []).length;
    if (xmlTags >= 2) return true;
    const realWords = words.filter(w => /^[a-zA-Z]{4,}$/.test(w));
    if (realWords.length < 4) return true;
    const avgLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    if (avgLen < 3.0) return true;
    const nonAlphanumeric = (snippet.match(/[^a-zA-Z0-9\s.,;:'"()\-]/g) || []).length;
    if (nonAlphanumeric / snippet.length > 0.12) return true;
    return false;
  };

  const buildSnippetAt = (text: string, index: number, keywordLen: number): string => {
    const CONTEXT = 250;
    const rawStart = Math.max(0, index - CONTEXT);
    const rawEnd = Math.min(text.length, index + keywordLen + CONTEXT);
    const windowText = text.slice(rawStart, rawEnd);
    const keywordPosInWindow = index - rawStart;
    const beforeKeyword = windowText.slice(0, keywordPosInWindow);
    const afterKeyword = windowText.slice(keywordPosInWindow + keywordLen);
    const sentenceStartMatch = beforeKeyword.match(/(?:^|[.!?\n])\s*([^.!?\n]{10,})$/);
    const cleanBefore = sentenceStartMatch
      ? sentenceStartMatch[1]
      : beforeKeyword.slice(Math.max(0, beforeKeyword.length - 140));
    const sentenceEndMatch = afterKeyword.match(/^([^.!?\n]*[.!?])/);
    const cleanAfter = sentenceEndMatch ? sentenceEndMatch[1] : afterKeyword.slice(0, 140);
    const snippet = normalizeResumeText(
      cleanBefore + windowText.slice(keywordPosInWindow, keywordPosInWindow + keywordLen) + cleanAfter
    );
    if (isGibberishSnippet(snippet) || snippet.length < 20) return '';
    const addLeadingEllipsis = rawStart > 0 && !sentenceStartMatch;
    const addTrailingEllipsis = rawEnd < text.length && !sentenceEndMatch;
    return (addLeadingEllipsis ? '...' : '') + snippet + (addTrailingEllipsis ? '...' : '');
  };

  const extractSnippet = (text: string, keyword: string): string => {
    if (!keyword || keyword.trim().length < 3) return '';
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    let searchFrom = 0;
    while (searchFrom < lowerText.length) {
      const index = lowerText.indexOf(lowerKeyword, searchFrom);
      if (index === -1) break;
      const snippet = buildSnippetAt(text, index, keyword.length);
      if (snippet) return snippet;
      searchFrom = index + 1;
    }
    return '';
  };

  const handleExampleClick = (prompt: string) => setInputValue(prompt);

  const loadMoreResults = (messageId: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId && msg.allResults) {
          const newDisplayCount = (msg.displayCount || 10) + 10;
          return { ...msg, results: msg.allResults.slice(0, newDisplayCount), displayCount: newDisplayCount };
        }
        return msg;
      })
    );
  };

  // ── PDF Download — pure jsPDF, near-instant ───────────────────────────────
  const handleDownloadPDF = async () => {
    if (messages.length === 0) {
      alert('No conversation to download yet. Start chatting with the Resume Manager first!');
      return;
    }
    setIsGeneratingPDF(true);
    await new Promise(r => setTimeout(r, 30));

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const pdf = new jsPDF('p', 'mm', 'a4');
      (pdf as any).setCharSpace?.(0);
      const PAGE_W = 210;
      const PAGE_H = 297;
      const MARGIN = 10;
      const CONTENT_W = PAGE_W - MARGIN * 2;
      const FOOTER_H = 10;
      const USABLE_H = PAGE_H - FOOTER_H - 4;

      // Fetch logo
      let logoDataUrl: string | null = null;
      let logoAspect = 3.0;
      try {
        const resp = await fetch('https://raw.githubusercontent.com/Allanelh/Humango-Hiring-Manager-Assets/main/image%20(1).png');
        const blob = await resp.blob();
        logoDataUrl = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        const img = new Image();
        img.src = logoDataUrl;
        await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
        if (img.naturalWidth && img.naturalHeight) logoAspect = img.naturalWidth / img.naturalHeight;
      } catch { /* proceed without logo */ }

      // ── HEADER ──────────────────────────────────────────────────────────────
      const HDR_H = 28;
      const META_H = 14;

      pdf.setFillColor(2, 123, 123);
      pdf.rect(MARGIN, 6, CONTENT_W, HDR_H, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(254, 153, 0);
      pdf.text('HUMANGO SOLUTIONS', MARGIN + 8, 6 + 8);

      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.text('RESUME MANAGER', MARGIN + 8, 6 + 17.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(204, 234, 234);
      pdf.text('Candidate Search Report', MARGIN + 8, 6 + 24);

      if (logoDataUrl) {
        const logoH = (HDR_H - 4) * 1.14;
        const logoW = logoH * logoAspect;
        const logoX = MARGIN + CONTENT_W - logoW - 4;
        const logoY = 6 + (HDR_H - logoH) / 2;
        pdf.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH);
      }

      // Meta bar
      pdf.setFillColor(247, 247, 247);
      pdf.rect(MARGIN, 6 + HDR_H, CONTENT_W, META_H, 'F');
      pdf.setDrawColor(224, 224, 224);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN, 6 + HDR_H + META_H, MARGIN + CONTENT_W, 6 + HDR_H + META_H);

      const metaItems = [
        { label: 'DATE ISSUED', value: dateStr },
        { label: 'TIME', value: timeStr },
        { label: 'TOTAL EXCHANGES', value: String(messages.length) },
      ];
      let metaX = MARGIN + 8;
      for (const item of metaItems) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6);
        pdf.setTextColor(136, 136, 136);
        pdf.text(item.label, metaX, 6 + HDR_H + 5);
        pdf.setFontSize(9);
        pdf.setTextColor(34, 34, 34);
        pdf.text(item.value, metaX, 6 + HDR_H + 11);
        metaX += 58;
      }

      let cursorY = 6 + HDR_H + META_H + 4;
      let currentPage = 1;

      // ── FOOTER ──────────────────────────────────────────────────────────────
      const drawFooter = (pageNum: number, totalPages: number) => {
        const fy = PAGE_H - FOOTER_H;
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, fy, PAGE_W, FOOTER_H, 'F');
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.line(MARGIN, fy + 0.5, PAGE_W - MARGIN, fy + 0.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(180, 180, 180);
        pdf.text(`${dateStr}  ${timeStr}`, MARGIN, fy + 6.5);
        pdf.text('Confidential Information \u2013 Humango Solutions LLC', PAGE_W / 2, fy + 6.5, { align: 'center' });
        pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, fy + 6.5, { align: 'right' });
      };

      const checkPage = (neededH: number) => {
        if (cursorY + neededH > USABLE_H) {
          currentPage++;
          pdf.addPage();
          cursorY = 8;
        }
      };

      // Layout constants
      const GAP = 3;
      const ICON_R = 4;
      const ICON_D = ICON_R * 2;
      const BUBBLE_PAD_X = 3.5;
      const BUBBLE_PAD_Y = 2.5;
      const LINE_H = 4.2;
      const FONT_SIZE = 9;
      const MAX_BUBBLE_W = CONTENT_W * 0.75;
      const SNIP_LINE_H = 4.2;
      const SNIP_PAD_TOP = 3.5;
      const SNIP_PAD_BOT = 4.0;
      const CARD_PAD = 4;

      const toTitleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

      // ── ICONS ────────────────────────────────────────────────────────────────
      const drawUserIcon = (cx: number, cy: number) => {
        pdf.setFillColor(51, 65, 85);
        pdf.circle(cx, cy, ICON_R, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.circle(cx, cy - 1.5, 2.0, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.ellipse(cx, cy + 2.5, 3.0, 1.6, 'F');
      };

      const drawBotIcon = (cx: number, cy: number) => {
        pdf.setFillColor(254, 153, 0);
        pdf.circle(cx, cy, ICON_R, 'F');
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(cx - 2.5, cy - 2.0, 5.0, 4.0, 0.5, 0.5, 'F');
        pdf.setFillColor(254, 153, 0);
        pdf.rect(cx - 1.8, cy - 1.2, 1.2, 1.0, 'F');
        pdf.rect(cx + 0.6, cy - 1.2, 1.2, 1.0, 'F');
        pdf.rect(cx - 1.5, cy + 0.8, 3.0, 0.7, 'F');
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(0.4);
        pdf.line(cx, cy - 2.0, cx, cy - 3.5);
        pdf.setFillColor(255, 255, 255);
        pdf.circle(cx, cy - 3.7, 0.4, 'F');
      };

      // ── RENDER CHIP ROW — returns actual height used ─────────────────────────
      const renderChipRow = (
        items: string[],
        startX: number,
        startY: number,
        maxW: number,
        chipH: number,
        chipPad: number,
        bgColor: [number, number, number],
        borderColor: [number, number, number],
        textColor: [number, number, number],
        fontSize: number,
      ): number => {
        let sx = startX;
        let sy = startY;
        for (const item of items) {
          const label = toTitleCase(item);
          pdf.setFontSize(fontSize);
          const chipW = pdf.getTextWidth(label) + chipPad * 2;
          if (sx + chipW > startX + maxW) { sx = startX; sy += chipH + 1.5; }
          pdf.setFillColor(...bgColor);
          pdf.setDrawColor(...borderColor);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(sx, sy, chipW, chipH, 1, 1, 'FD');
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(fontSize);
          pdf.setTextColor(...textColor);
          pdf.text(label, sx + chipPad, sy + chipH - 1.5);
          sx += chipW + 1.5;
        }
        return sy + chipH - startY;
      };

      // Measure chip rows without drawing
      const measureChipRows = (
        items: string[],
        maxW: number,
        chipH: number,
        chipPad: number,
        fontSize: number,
      ): number => {
        let sx = 0;
        let rows = 1;
        for (const item of items) {
          pdf.setFontSize(fontSize);
          const chipW = pdf.getTextWidth(toTitleCase(item)) + chipPad * 2;
          if (sx + chipW > maxW) { sx = 0; rows++; }
          sx += chipW + 1.5;
        }
        return rows * (chipH + 1.5) - 1.5;
      };

      // Measure badge rows without drawing
      const measureBadgeRows = (
        reasons: Array<{ type: string; label: string }>,
        maxW: number,
        badgeH: number,
        badgePad: number,
      ): number => {
        let bx = 0;
        let rows = 1;
        for (const r of reasons) {
          pdf.setFontSize(6);
          const badgeW = pdf.getTextWidth(toTitleCase(r.label)) + badgePad * 2 + 3;
          if (bx + badgeW > maxW) { bx = 0; rows++; }
          bx += badgeW + 1.5;
        }
        return rows * (badgeH + 1.5) - 1.5;
      };

      // ── MESSAGES ─────────────────────────────────────────────────────────────
      for (const msg of messages) {
        const isUser = msg.type === 'user';

        if (isUser) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(FONT_SIZE);
          const maxTextW = MAX_BUBBLE_W - BUBBLE_PAD_X * 2;
          const lines = pdf.splitTextToSize(msg.content, maxTextW) as string[];

          let maxLineW = 0;
          for (const line of lines) {
            pdf.setFontSize(FONT_SIZE);
            const w = pdf.getTextWidth(line);
            if (w > maxLineW) maxLineW = w;
          }
          const bubbleW = Math.min(maxLineW + BUBBLE_PAD_X * 2, MAX_BUBBLE_W);
          const bubbleH = lines.length * LINE_H * 0.85 + BUBBLE_PAD_Y * 2;

          checkPage(Math.max(bubbleH, ICON_D) + GAP);

          const iconCx = MARGIN + CONTENT_W - ICON_R;
          const iconCy = cursorY + ICON_R;
          drawUserIcon(iconCx, iconCy);

          const bubbleX = MARGIN + CONTENT_W - ICON_D - 2 - bubbleW;
          pdf.setFillColor(254, 153, 0);
          pdf.roundedRect(bubbleX, cursorY, bubbleW, bubbleH, 2, 2, 'F');

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(FONT_SIZE);
          pdf.setTextColor(255, 255, 255);
          pdf.text(lines, bubbleX + BUBBLE_PAD_X, cursorY + BUBBLE_PAD_Y + FONT_SIZE * 0.3528, { lineHeightFactor: LINE_H * 0.85 / (FONT_SIZE * 0.3528) });

          cursorY += Math.max(bubbleH, ICON_D) + GAP;

        } else {
          // Bot message
          const iconCx = MARGIN + ICON_R;
          const botBubbleX = MARGIN + ICON_D + 2;
          const botBubbleW = CONTENT_W - ICON_D - 2;
          const maxBotTextW = botBubbleW - BUBBLE_PAD_X * 2;

          // Intent banner
          const intentCfg = msg.intentType && msg.intentType !== 'NEW' ? INTENT_PDF[msg.intentType] : null;
          if (intentCfg) {
            const intentH = 7;
            checkPage(intentH + 1);
            const [bgR, bgG, bgB] = hexToRgb(intentCfg.bg);
            const [txR, txG, txB] = hexToRgb(intentCfg.color);
            pdf.setFillColor(bgR, bgG, bgB);
            pdf.rect(botBubbleX, cursorY, botBubbleW, intentH, 'F');
            pdf.setFillColor(...hexToRgb(intentCfg.color));
            pdf.rect(botBubbleX, cursorY, 1.5, intentH, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(7);
            pdf.setTextColor(txR, txG, txB);
            pdf.text(msg.intentLabel || intentCfg.label, botBubbleX + 5, cursorY + 4.5);
            cursorY += intentH + 0.5;
          }

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(FONT_SIZE);
          const botLines = pdf.splitTextToSize(msg.content, maxBotTextW) as string[];
          const metricsH = msg.metrics ? 6 : 0;
          const bubbleH = botLines.length * LINE_H + BUBBLE_PAD_Y * 2 + metricsH;

          checkPage(Math.max(bubbleH, ICON_D) + GAP);
          drawBotIcon(iconCx, cursorY + ICON_R);

          pdf.setFillColor(241, 245, 249);
          pdf.roundedRect(botBubbleX, cursorY, botBubbleW, bubbleH, 2, 2, 'F');

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(FONT_SIZE);
          pdf.setTextColor(30, 41, 59);
          pdf.text(botLines, botBubbleX + BUBBLE_PAD_X, cursorY + BUBBLE_PAD_Y + FONT_SIZE * 0.3528, { lineHeightFactor: LINE_H / (FONT_SIZE * 0.3528) });

          if (msg.metrics) {
            const metY = cursorY + bubbleH - metricsH;
            pdf.setDrawColor(148, 163, 184);
            pdf.setLineWidth(0.2);
            pdf.line(botBubbleX + 2, metY, botBubbleX + botBubbleW - 2, metY);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(6);
            pdf.setTextColor(148, 163, 184);
            pdf.text(`Searched ${msg.metrics.totalResumes} resume${msg.metrics.totalResumes !== 1 ? 's' : ''} in ${msg.metrics.searchTimeSeconds}s`, botBubbleX + BUBBLE_PAD_X, metY + 4);
          }

          cursorY += bubbleH + GAP;

          // Action text block
          if (msg.actionText) {
            const actionTextW = botBubbleW - 8;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            const actionLines = pdf.splitTextToSize(msg.actionText, actionTextW) as string[];
            const headerH = msg.actionType ? 6 : 0;
            const actionH = actionLines.length * 3.8 + headerH + 8;
            checkPage(actionH);

            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(botBubbleX, cursorY, botBubbleW, actionH, 2, 2, 'FD');

            if (msg.actionType) {
              pdf.setFillColor(249, 250, 251);
              pdf.rect(botBubbleX, cursorY, botBubbleW, headerH, 'F');
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(6);
              pdf.setTextColor(100, 116, 139);
              pdf.text(msg.actionType.toUpperCase(), botBubbleX + 4, cursorY + 4);
            }
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(71, 85, 105);
            pdf.text(actionLines, botBubbleX + 4, cursorY + headerH + 5, { lineHeightFactor: 3.8 / (8 * 0.3528) });
            cursorY += actionH + GAP;
          }

          // Helper: manually wrap text into lines that fit within maxWidth.
          // Handles long unbreakable strings (all-caps names, titles, URLs) by
          // breaking them character-by-character. More reliable than splitTextToSize.
          const pdfSafeExcerptText = (text: string): string => text
            .normalize('NFKC')
            .replace(/[●•◦▪▸]/g, '-')
            .replace(/[–—−]/g, '-')
            .replace(/[“”„]/g, '"')
            .replace(/[‘’‚]/g, "'")
            .replace(/·/g, '-')
            .replace(/[^\x20-\x7E\n]/g, '');

          const wrapSnippetText = (text: string, maxWidth: number): string[] => {
            // Measure with the same font/size used for drawing snippets so the
            // width calculation exactly matches what jsPDF will render.
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7);
            (pdf as any).setCharSpace?.(0);
            const targetW = Math.max(1, maxWidth * 0.98);
            const lines: string[] = [];

            // Repair character-spacing corruption and sanitize non-ASCII
            // characters that jsPDF's standard fonts can't render.
            const cleanedText = pdfSafeExcerptText(normalizeResumeText(text));

            // Break into words. We add whole words until the next word would
            // exceed the target width, then start a new line. This fills the
            // box completely and never cuts mid-word.
            const words = cleanedText.split(' ').filter(Boolean);
            let currentLine = '';

            for (const word of words) {
              const candidate = currentLine ? currentLine + ' ' + word : word;
              const candidateW = pdf.getTextWidth(candidate);

              if (candidateW <= targetW) {
                currentLine = candidate;
              } else {
                // The word doesn't fit on the current line.
                if (currentLine) {
                  lines.push(currentLine);
                  currentLine = '';
                }
                // If the single word itself is wider than the target, break it
                // character-by-character so it doesn't overflow.
                const wordW = pdf.getTextWidth(word);
                if (wordW > targetW) {
                  let charLine = '';
                  for (const ch of word) {
                    const chCandidate = charLine + ch;
                    if (pdf.getTextWidth(chCandidate) > targetW && charLine) {
                      lines.push(charLine);
                      charLine = ch;
                    } else {
                      charLine = chCandidate;
                    }
                  }
                  if (charLine) currentLine = charLine;
                } else {
                  currentLine = word;
                }
              }
            }
            if (currentLine.trim()) lines.push(currentLine.trimEnd());
            return lines.length > 0 ? lines : [''];
          };

          // Result cards
          if (msg.results && msg.results.length > 0) {
            for (const result of msg.results) {
              const isUnreadable = (result as any)._flaggedUnreadable;
              const CARD_W = botBubbleW;
              const CARD_X = botBubbleX;
              const maxChipW = CARD_W - CARD_PAD * 2;
              const reasons = result.matchReasons || [];

              const skillsToShow = expandedSkills.has(result.id)
                ? (result.skills || [])
                : (result.skills || []).slice(0, SKILLS_PREVIEW);
              const visibleSnippetCount = snippetCursors[result.id] ?? 1;
              const visibleSnippets = (result.matchedSnippets || []).slice(0, visibleSnippetCount);

              // Pre-measure card height
              let cardContentH = CARD_PAD * 2;
              if (isUnreadable) cardContentH += 9;
              cardContentH += 8; // name

              if (reasons.length > 0) {
                cardContentH += measureBadgeRows(reasons, maxChipW, 5, 2.5) + 3;
              }
              if (skillsToShow.length > 0) {
                cardContentH += 6 + measureChipRows(skillsToShow, maxChipW, 5.5, 2.5, 6.5) + 3;
              }
              if (result.certifications && result.certifications.length > 0) {
                cardContentH += 6 + measureChipRows(result.certifications, maxChipW, 5.5, 2.5, 6.5) + 3;
              }
              if (visibleSnippets.length > 0) {
                cardContentH += 7;
                const snipW = CARD_W - CARD_PAD * 2 - 4;
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);
                (pdf as any).setCharSpace?.(0);
                for (const snippet of visibleSnippets) {
                  (pdf as any).setCharSpace?.(0);
                  const snipLines = wrapSnippetText(snippet, snipW);
                  cardContentH += snipLines.length * SNIP_LINE_H + SNIP_PAD_TOP + SNIP_PAD_BOT + 2;
                }
              }

              checkPage(cardContentH);

              // Card background
              pdf.setFillColor(isUnreadable ? 255 : 255, isUnreadable ? 251 : 255, isUnreadable ? 235 : 255);
              pdf.setDrawColor(isUnreadable ? 217 : 226, isUnreadable ? 183 : 232, isUnreadable ? 74 : 240);
              pdf.setLineWidth(0.4);
              pdf.roundedRect(CARD_X, cursorY, CARD_W, cardContentH, 2, 2, 'FD');

              let gy = cursorY + CARD_PAD;

              // Unreadable warning
              if (isUnreadable) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7);
                pdf.setTextColor(180, 83, 9);
                pdf.text('! Scanned / Unreadable PDF — requires manual review', CARD_X + CARD_PAD, gy + 3.5);
                gy += 7;
                pdf.setDrawColor(253, 230, 138);
                pdf.setLineWidth(0.3);
                pdf.line(CARD_X + CARD_PAD, gy, CARD_X + CARD_W - CARD_PAD, gy);
                gy += 2;
              }

              // Candidate name
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(10);
              pdf.setTextColor(15, 23, 42);
              pdf.text(result.candidate_name || result.file_name, CARD_X + CARD_PAD + 4, gy + 5.5);
              gy += 8;

              // Match reason badges
              if (reasons.length > 0) {
                const BADGE_H = 5;
                const BADGE_PAD = 2.5;
                let bx = CARD_X + CARD_PAD;
                let by = gy;
                for (const reason of reasons) {
                  const cfg = REASON_BADGE[reason.type] || REASON_BADGE.other;
                  const label = toTitleCase(reason.label);
                  pdf.setFontSize(6);
                  const badgeW = pdf.getTextWidth(label) + BADGE_PAD * 2 + 3;
                  if (bx + badgeW > CARD_X + CARD_W - CARD_PAD) { bx = CARD_X + CARD_PAD; by += BADGE_H + 1.5; }
                  const [bgR, bgG, bgB] = hexToRgb(cfg.bg);
                  const [txR, txG, txB] = hexToRgb(cfg.text);
                  const [bdR, bdG, bdB] = hexToRgb(cfg.border);
                  pdf.setFillColor(bgR, bgG, bgB);
                  pdf.setDrawColor(bdR, bdG, bdB);
                  pdf.setLineWidth(0.3);
                  pdf.roundedRect(bx, by, badgeW, BADGE_H, 1, 1, 'FD');
                  pdf.setFont('helvetica', 'bold');
                  pdf.setFontSize(6);
                  pdf.setTextColor(txR, txG, txB);
                  pdf.text(label, bx + BADGE_PAD + 1, by + BADGE_H - 1.3);
                  bx += badgeW + 1.5;
                }
                gy = by + BADGE_H + 3;
              }

              // Skills chips
              if (skillsToShow.length > 0) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7.5);
                pdf.setTextColor(71, 85, 105);
                pdf.text('Skills:', CARD_X + CARD_PAD, gy + 4);
                gy += 6;
                const usedH = renderChipRow(
                  skillsToShow, CARD_X + CARD_PAD, gy, maxChipW,
                  5.5, 2.5, [255, 245, 230], [254, 215, 170], [230, 138, 0], 6.5
                );
                gy += usedH + 3;
              }

              // Certification chips
              if (result.certifications && result.certifications.length > 0) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7.5);
                pdf.setTextColor(71, 85, 105);
                pdf.text('Certifications:', CARD_X + CARD_PAD, gy + 4);
                gy += 6;
                const usedH = renderChipRow(
                  result.certifications, CARD_X + CARD_PAD, gy, maxChipW,
                  5.5, 2.5, [255, 251, 235], [253, 230, 138], [180, 83, 9], 6.5
                );
                gy += usedH + 3;
              }

              // Excerpt boxes
              if (visibleSnippets.length > 0) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7.5);
                pdf.setTextColor(71, 85, 105);
                pdf.text('Relevant Excerpts:', CARD_X + CARD_PAD, gy + 4);
                gy += 7;

                const snipW = CARD_W - CARD_PAD * 2 - 4;
                const snipTextX = CARD_X + CARD_PAD + 4;

                for (const snippet of visibleSnippets) {
                  pdf.setFont('helvetica', 'normal');
                  pdf.setFontSize(7);
                  (pdf as any).setCharSpace?.(0);

                  const snipLines = wrapSnippetText(snippet, snipW);
                  const snipBoxH = snipLines.length * SNIP_LINE_H + SNIP_PAD_TOP + SNIP_PAD_BOT;

                  pdf.setFillColor(248, 250, 252);
                  pdf.setDrawColor(226, 232, 240);
                  pdf.setLineWidth(0.3);
                  pdf.roundedRect(CARD_X + CARD_PAD, gy, snipW + 4, snipBoxH, 1, 1, 'FD');
                  pdf.setFillColor(2, 123, 123);
                  pdf.rect(CARD_X + CARD_PAD, gy, 1.5, snipBoxH, 'F');

                  pdf.setFont('helvetica', 'normal');
                  pdf.setFontSize(7);
                  (pdf as any).setCharSpace?.(0);
                  pdf.setTextColor(100, 116, 139);
                  const snipStartY = gy + SNIP_PAD_TOP + 2.5;
                  for (let li = 0; li < snipLines.length; li++) {
                    (pdf as any).setCharSpace?.(0);
                    pdf.text(snipLines[li], snipTextX, snipStartY + li * SNIP_LINE_H);
                  }
                  gy += snipBoxH + 2;
                }
              }

              cursorY += cardContentH + GAP;
            }
          }
        }
      }

      // Draw footers on all pages
      const totalPages = currentPage;
      for (let p = 1; p <= totalPages; p++) {
        (pdf as any).setPage(p);
        drawFooter(p, totalPages);
      }

      const fileName = `Resume_Manager_${dateStr.replace(/\s/g, '_')}_${timeStr.replace(/[:\s]/g, '-')}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <>
      {!splashDone && <SplashScreen onDone={handleSplashDone} />}
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100${!splashDone ? ' app-reveal' : ''}`}>
      <div className="w-full px-6 pt-8 pb-5">
        <header className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <img
                src="https://raw.githubusercontent.com/Allanelh/Humango-Hiring-Manager-Assets/main/updatedlogo.png"
                alt="Humango Solutions"
                className="h-24 w-auto cursor-pointer"
                onClick={() => { setMessages([]); setInputValue(''); sessionCtx.current = createSessionContext(); loadConfig(); }}
                title="Clear conversation"
              />
              <h1 className="text-3xl font-bold text-slate-800">Resume Manager</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadPDF}
                disabled={messages.length === 0 || isGeneratingPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg shadow hover:shadow-md transition-shadow text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#FE9900' }}
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">Download PDF</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-slate-700"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Settings</span>
              </button>
            </div>
          </div>
          <p className="text-slate-600">Ask me anything about candidates in your resume database</p>
        </header>

        <div className="bg-white rounded-xl shadow-sm flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
          <div className="flex-1 p-6 overflow-y-auto">
            {messages.length === 0 && !isTyping ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <img
                    src="https://raw.githubusercontent.com/Allanelh/Humango-Hiring-Manager-Assets/main/Bars@1x-1.0s-200px-200px.gif"
                    alt="Loading animation"
                    className="mx-auto mb-4 w-16 h-16 opacity-70"
                  />
                  <p>No messages yet. Start by asking about candidates!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id}>
                    <ChatMessage
                      message={message}
                      onTypingTick={() => bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })}
                      expandedSkills={expandedSkills}
                      snippetCursors={snippetCursors}
                      onToggleSkills={handleToggleSkills}
                      onShowNextSnippet={handleShowNextSnippet}
                    />
                    {message.allResults && message.allResults.length > (message.displayCount || 10) && (
                      <div className="mt-4 text-center">
                        <button
                          onClick={() => loadMoreResults(message.id)}
                          className="px-6 py-2 rounded-lg shadow hover:shadow-md transition-shadow text-white font-medium"
                          style={{ backgroundColor: '#FE9900' }}
                        >
                          Load 10 More Results ({message.allResults.length - (message.displayCount || 10)} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {isTyping && <TypingIndicator />}
                {isLoading && !isTyping && (
                  <div className="flex items-center gap-2 text-slate-500 message-slide-left">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching resumes...</span>
                  </div>
                )}
                <div ref={bottomAnchorRef} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            <div className="mb-3">
              <button
                onClick={() => setShowExamples(v => !v)}
                className="flex items-center justify-between w-full mb-2 group"
                style={{ transition: 'transform 0.15s ease' } as React.CSSProperties}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                title={showExamples ? 'Hide examples' : 'Show examples'}
              >
                <p className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">Try these examples:</p>
                <ChevronDown
                  className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-all duration-200 flex-shrink-0"
                  style={{ transform: showExamples ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                />
              </button>
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: showExamples ? '1fr' : '0fr',
                  transition: 'grid-template-rows 200ms ease',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflow: 'hidden', padding: showExamples ? '2px' : '0' }}>
                  <div className="flex flex-wrap gap-2 pb-0.5">
                    {EXAMPLE_PROMPTS.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => handleExampleClick(prompt)}
                        className="text-xs px-3 py-1.5 rounded-full border border-slate-300 transition-all text-slate-700 whitespace-nowrap"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#FE9900';
                          e.currentTarget.style.backgroundColor = '#FFF5E6';
                          e.currentTarget.style.color = '#FE9900';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(254,153,0,0.25)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#334155';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about candidates (e.g., Find Java developers with AWS certification)"
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#FE9900' } as React.CSSProperties}
                onFocus={(e) => e.currentTarget.style.borderColor = '#FE9900'}
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="px-6 py-3 text-white rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                style={{ backgroundColor: isLoading ? '#cbd5e1' : '#FE9900' }}
                onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#E68A00')}
                onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = '#FE9900')}
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showConfig && (
        <ConfigModal
          onClose={() => setShowConfig(false)}
          currentUrl={sharePointUrl}
          onSave={(url) => {
            setSharePointUrl(url);
            setShowConfig(false);
          }}
        />
      )}
    </div>
    </>
  );
}

export default App;
