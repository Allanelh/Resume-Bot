//dummy comment
import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Send, Loader2, Download, ChevronDown, Bot } from 'lucide-react';
import ChatMessage from './components/ChatMessage';
import SplashScreen from './components/SplashScreen';
import ConfigModal from './components/ConfigModal';
import { supabase, SearchResult, SearchMetrics } from './lib/supabase';
import { parseNaturalLanguageQuery, matchResumeToQuery, findSynonymGroup, scoreForSkill, correctFuzzyTerms } from './lib/nlp-parser';
import { detectActionQuery, generateActionResponse, type ActionQuery } from './lib/action-handler';
import {
  createSessionContext,
  resolveConversationalTurn,
  intentLabel,
  type SessionContext,
  type ConversationIntent,
} from './lib/conversation-context';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const handleSplashDone = useCallback(() => setSplashDone(true), []);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  // Session context is stored in a ref so it persists across re-renders without
  // triggering re-renders itself. Updated synchronously after each search turn.
  const sessionCtx = useRef<SessionContext>(createSessionContext());

  // Deliver a bot message. textOnly=true shows typing indicator for 1.5s,
  // then streams the content letter-by-letter.
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
    // Show welcome message on first load with typing delay
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

  // Auto-scroll to bottom whenever messages update or indicators appear
  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isLoading]);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('*')
      .eq('config_key', 'sharepoint_folder_url')
      .maybeSingle();

    if (data) {
      setSharePointUrl(data.config_value);
    }
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

    // Extract what they're asking about
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

    // Generic candidate question
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
    if (constraints.length > 1) {
      msg += ` combined with ${constraints.slice(1).join(' and ')}`;
    }
    msg += '.';

    // Offer a relaxation
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

    // ── Greeting ─────────────────────────────────────────────────────────────
    if (isGreeting(query)) {
      const greetingText = GREETING_VARIANTS[Math.floor(Math.random() * GREETING_VARIANTS.length)];
      postBotMessage({
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: greetingText,
        timestamp: new Date(),
      }, true);
      setIsLoading(false);
      return;
    }

    // ── Candidate Q&A (answer from memory, no DB call) ────────────────────────
    const candidateInContext = isCandidateQuestion(query);
    if (candidateInContext && /\b(does|did|has|have|knows?|mention|list|work|role|title|skill|cert)\b/i.test(query) && /\b(their|him|her|they|the candidate|that person)\b/i.test(query)) {
      postBotMessage({
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: buildCandidateAnswer(query, candidateInContext),
        timestamp: new Date(),
      }, true);
      setIsLoading(false);
      return;
    }

    // ── Explain results (no DB call) ──────────────────────────────────────────
    const lastPQ = sessionCtx.current.lastParsedQuery;
    const lastRes = sessionCtx.current.lastResults;
    if (isExplainQuery(query) && lastPQ && lastRes && lastRes.length > 0) {
      postBotMessage({
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: buildExplanation(lastPQ, lastRes),
        timestamp: new Date(),
      }, true);
      setIsLoading(false);
      return;
    }

    try {
      const startTime = performance.now();
      const ctx = sessionCtx.current;

      // Detect action queries (draft email, summarize, extract links, etc.)
      const actionQuery: ActionQuery | null = detectActionQuery(query);

      // Resolve intent and determine whether to run a global search or operate on previous results
      const resolved = resolveConversationalTurn(query, ctx, [] /* allResumes placeholder */);

      let finalResults: SearchResult[] = [];
      let flaggedUnreadable: SearchResult[] = [];
      let totalResumes = 0;

      // Action queries that reference previous results don't need a new DB search
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

      // Sort by cert count if explicitly requested
      if (resolved.parsedQuery?.semantic?.rankByCertCount) {
        finalResults = [...finalResults].sort((a, b) => (b.certifications?.length ?? 0) - (a.certifications?.length ?? 0));
      }

      const endTime = performance.now();
      const searchTimeSeconds = ((endTime - startTime) / 1000).toFixed(2);

      try {
        await supabase.from('search_history').insert({ query, results_count: finalResults.length });
      } catch { /* non-critical */ }

      // Update session context for next turn
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

      // Generate action text if this is an action query
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

      // For action queries that produce standalone text output, don't show result cards
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

      // Text-only messages (no result cards) get the typing delay
      const isTextOnly = !showCards || allResultsCombined.length === 0;
      postBotMessage(botMessage, isTextOnly);
    } catch (error) {
      console.error('Search error:', error);
      postBotMessage({
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'An error occurred while searching. Please try again.',
        timestamp: new Date(),
      }, true);
    } finally {
      setIsLoading(false);
    }
  };

  // Runs a full global search against the database, optionally with a pre-built ParsedQuery
  const runGlobalSearch = async (
    query: string,
    preParsed: import('./lib/nlp-parser').ParsedQuery | null,
    intent: ConversationIntent,
  ): Promise<{ results: SearchResult[]; total: number; flagged: SearchResult[] }> => {
    const { results: dbResults, totalResumes, flaggedUnreadable } = await searchResumes(query, preParsed);

    // If REPLACE/EXPAND, the parsedQuery is already merged — searchResumes will use it
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
        case 'field':
          return { type: 'field', label: `${value} (Field of Study)` };
        case 'major':
          return { type: 'field', label: `Major: ${value}` };
        case 'cert':
          return { type: 'cert', label: `${value} Certification` };
        case 'cert_progress':
          return { type: 'cert', label: `${value} (In Progress)` };
        case 'exp':
          return { type: 'experience', label: `${value}+ Years Experience` };
        case 'seniority': {
          const labels: Record<string, string> = {
            entry_level: 'Entry Level',
            mid_level: 'Mid Level',
            senior: 'Senior Level',
            staff: 'Staff Level',
            principal: 'Principal Level',
            executive: 'Executive Level',
          };
          return { type: 'seniority', label: labels[value] || `${value.replace('_', ' ')} Level` };
        }
        case 'company':
          return { type: 'experience', label: `Worked at ${value}` };
        case 'role':
          return { type: 'role', label: `Role: ${value}` };
        case 'industry':
          return { type: 'experience', label: `${value} Industry` };
        case 'institution':
          return { type: 'institution', label: value === 'Ivy League' ? 'Ivy League Institution' : `Attended ${value}` };
        case 'clearance':
          return { type: 'clearance', label: `Security Clearance: ${value}` };
        case 'employment':
          return value === 'current'
            ? { type: 'experience', label: 'Currently Employed' }
            : { type: 'role', label: `Currently: ${value}` };
        case 'skill':
          return { type: 'skill', label: value };
        case 'other':
          return { type: 'other', label: value };
        default:
          return { type: 'other', label: r };
      }
    });
  };

  const searchResumes = async (query: string, preParsed?: import('./lib/nlp-parser').ParsedQuery | null): Promise<{ results: SearchResult[], totalResumes: number, flaggedUnreadable?: SearchResult[] }> => {
    const parsedQuery = preParsed || parseNaturalLanguageQuery(query);

    const { data: allResumes } = await supabase
      .from('resumes')
      .select(`*, certifications ( certification_name ), skills ( skill_name )`);

    if (!allResumes || allResumes.length === 0) {
      return { results: [], totalResumes: 0 };
    }

    const totalResumes = allResumes.length;
    const results: SearchResult[] = [];
    const flaggedUnreadable: SearchResult[] = [];

    for (const resume of allResumes) {
      const certNames = resume.certifications?.map((c: any) => c.certification_name.toLowerCase()) || [];
      const skillNames = resume.skills?.map((s: any) => s.skill_name) || [];
      const resumeMeta = { file_name: resume.file_name, indexed_at: resume.indexed_at };

      const matchResult = matchResumeToQuery(resume.content_text, parsedQuery, resumeMeta);

      // Handle flagUnreadable — collect scanned PDFs as a separate bucket
      if (parsedQuery.skills.flagUnreadable && matchResult.isUnreadable) {
        flaggedUnreadable.push({
          ...resume,
          certifications: certNames,
          skills: skillNames,
          matchedSnippets: ['[Scanned/unreadable PDF — text could not be extracted]'],
          matchReason: 'Unreadable/scanned resume',
          exactMatchScore: 0,
          totalScore: 0,
        } as any);
        if (!matchResult.matches) continue;
      }

      if (!matchResult.matches) continue;

      const matchedSnippets: string[] = [];

      // If clearance snippet was extracted, use it first
      if (matchResult.clearanceSnippet) {
        matchedSnippets.push(matchResult.clearanceSnippet);
      }

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

      // Degree terms — search for the actual variant present in the resume
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
            if (contentLower.includes(term.toLowerCase())) {
              pushSnippet(term);
              break;
            }
          }
        }
      }

      // OR group skills
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

      // Only push skills that are real technical terms — not degree/cert noise leaked from query
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

      // Fallback: slide a window through the full text looking for the first
      // clean readable passage. Step by 150 chars so we don't miss content
      // that sits between sentence boundaries.
      if (matchedSnippets.length === 0) {
        const cleanText = resume.content_text.replace(/\r\n|\r/g, '\n').replace(/\s{3,}/g, '  ');
        const WINDOW = 300;
        const STEP = 100;
        for (let pos = 0; pos + WINDOW <= cleanText.length; pos += STEP) {
          const w = cleanText.slice(pos, pos + WINDOW).trim();
          if (w.length < 80) continue;
          if (!isGibberishSnippet(w)) {
            matchedSnippets.push(w + (pos + WINDOW < cleanText.length ? '...' : ''));
            break;
          }
        }
      }

      // Hard rule: if we still can't produce a clean snippet, this result is unreliable — skip it
      // Exception: show-all queries include everyone regardless of readability
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

    // Sort — top-N by skill if requested, otherwise by total score
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
    // Hard keyword patterns that always mean binary/metadata content
    const gibberishPatterns = [
      /\d+\s+\d+\s+obj\b/,
      /\bendobj\b/,
      /\/Type\s*\//,
      /endstream/,
      /xref\s*\n/,
      /%%EOF/,
      /\bRoot\s+\d+\s+\d+\s+R\b/,
      /Content_Types\.xml/,
      /_rels\/.rels/,
      /xmlns:/,
      /\bword\/[a-z]+\d*\.xml\b/,
      /docProps\//,
      /\bFont\s+F\d+\s+\d+\s+\d+\s+R\b/,
      /\bExtGState\s+GS\d+/,
      /\bProcSet\s*\[PDF/,
      /\bMediaBox\s+\d/,
      /\bCropBox\s+\d/,
      /\bStructParents\b/,
      /\bCIDFontType\b/,
      /\bCIDToGIDMap\b/,
      /\bFontDescriptor\b/,
      /\bFontFile\d*\b/,
      /\bFontName\b/,
      /\bItalicAngle\b/,
      /\bStemV\b/,
      /Ordering\s+\(Identity\)/,
      /Registry\s+\(Adobe\)/,
      // XMP/RDF metadata
      /rdf\s+about/i,
      /pdf\s+Keywords/i,
      /pdf\s+Producer/i,
      /Apache\s+FOP/i,
      // HTTP multipart boundaries
      /WebKitFormBoundary/,
      /Content-Disposition\s+form-data/,
      /Content-Type\s+application/,
      // Local file paths
      /file\s+C\s+Users\s+\w+\s+OneDrive/i,
      /OneDrive\\Documents/i,
      // URI actions from PDFs
      /Type\s+Action\s+S\s+URI/,
      // LinkedIn/social URL noise from DOCX extraction
      /linkedin\.com\/in\/[a-z0-9\-]+\s+\d{5,}/i,
      /\d{6,}\s+\d+\s+[a-z0-9\-]+\s+\d+\s+\d+/,
      // XML self-closing tag leakage
      /\s*\/>\s*\/>\s*\/>/,
      // DOCX hyperlink noise: "HYPERLINK https ..."
      /HYPERLINK\s+https?\s+\S+/i,
    ];
    if (gibberishPatterns.some(p => p.test(snippet))) return true;

    const words = snippet.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 5) return true;

    // Reject scrambled character dumps: high ratio of very short tokens
    const shortTokens = words.filter(w => w.length <= 2);
    if (shortTokens.length / words.length > 0.55) return true;

    // Reject if too many purely numeric tokens
    const numericTokens = words.filter(w => /^\d+$/.test(w));
    if (numericTokens.length / words.length > 0.25) return true;

    // Reject XML tag leakage: too many /> tokens
    const xmlTags = (snippet.match(/\/>/g) || []).length;
    if (xmlTags >= 2) return true;

    // Must have at least 4 real English words (4+ consecutive letters)
    const realWords = words.filter(w => /^[a-zA-Z]{4,}$/.test(w));
    if (realWords.length < 4) return true;

    // Average token length below 3 = scrambled/spaced-out chars
    const avgLen = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    if (avgLen < 3.0) return true;

    // Reject binary/compressed content: high ratio of non-alphanumeric chars
    // e.g. "x Mvh' HH7< u1~y *qCK +`e@ %2Mf kI-{"
    const nonAlphanumeric = (snippet.match(/[^a-zA-Z0-9\s.,;:'"()\-]/g) || []).length;
    if (nonAlphanumeric / snippet.length > 0.12) return true;

    return false;
  };

  // Build a clean sentence-anchored snippet around a specific position in text.
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
    const cleanAfter = sentenceEndMatch
      ? sentenceEndMatch[1]
      : afterKeyword.slice(0, 140);

    const snippet = (cleanBefore + windowText.slice(keywordPosInWindow, keywordPosInWindow + keywordLen) + cleanAfter).trim();

    if (isGibberishSnippet(snippet) || snippet.length < 20) return '';

    const addLeadingEllipsis = rawStart > 0 && !sentenceStartMatch;
    const addTrailingEllipsis = rawEnd < text.length && !sentenceEndMatch;
    return (addLeadingEllipsis ? '...' : '') + snippet + (addTrailingEllipsis ? '...' : '');
  };

  // Extract a clean snippet around a keyword, trying every occurrence until one is clean.
  const extractSnippet = (text: string, keyword: string): string => {
    if (!keyword || keyword.trim().length < 3) return '';

    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    // Try each occurrence of the keyword — first match is often in PDF metadata garbage
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

  const handleExampleClick = (prompt: string) => {
    setInputValue(prompt);
  };

  const loadMoreResults = (messageId: string) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId && msg.allResults) {
          const newDisplayCount = (msg.displayCount || 10) + 10;
          return {
            ...msg,
            results: msg.allResults.slice(0, newDisplayCount),
            displayCount: newDisplayCount,
          };
        }
        return msg;
      })
    );
  };

  const handleDownloadPDF = async () => {
    if (messages.length === 0) {
      alert('No conversation to download yet. Start chatting with the Resume Manager first!');
      return;
    }

    setIsGeneratingPDF(true);

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const PAGE_W = 210;
      const PAGE_H = 297;
      const FOOTER_H = 10;
      const MARGIN_TOP = 6;
      const MARGIN_SIDE = 8;
      const CONTENT_W = PAGE_W - MARGIN_SIDE * 2;
      const USABLE_H = PAGE_H - FOOTER_H - MARGIN_TOP;
      const GAP = 2.5; // mm between items

      const h2cOpts = { scale: 2, useCORS: true, logging: false } as Parameters<typeof html2canvas>[1];

      // ── HEADER ──────────────────────────────────────────────────────────
      const HEADER_W = Math.round(CONTENT_W / PAGE_W * 860);
      const headerEl = document.createElement('div');
      headerEl.style.cssText = `position:absolute;left:-9999px;width:${HEADER_W}px;background:#ffffff;`;
      headerEl.innerHTML = `
        <div style="background:#027B7B;padding:22px 32px;display:flex;align-items:center;justify-content:space-between;border-radius:6px 6px 0 0;">
          <div>
            <div style="font-size:11px;font-weight:700;color:#FE9900;letter-spacing:3px;text-transform:uppercase;margin-bottom:3px;">Humango Solutions</div>
            <div style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:1px;line-height:1;">RESUME MANAGER</div>
            <div style="font-size:12px;color:#cceaea;letter-spacing:2px;text-transform:uppercase;margin-top:3px;">Candidate Search Report</div>
          </div>
          <img src="https://raw.githubusercontent.com/Allanelh/Humango-Hiring-Manager-Assets/main/image%20(1).png" alt="logo" style="height:96px;width:auto;margin-left:auto;" crossorigin="anonymous" />
        </div>
        <div style="background:#f7f7f7;padding:10px 32px;display:flex;gap:32px;border-bottom:1px solid #e0e0e0;">
          <div><div style="font-size:9px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;">Date Issued</div><div style="font-size:12px;font-weight:600;color:#222;">${dateStr}</div></div>
          <div><div style="font-size:9px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;">Time</div><div style="font-size:12px;font-weight:600;color:#222;">${timeStr}</div></div>
          <div><div style="font-size:9px;font-weight:700;color:#888;letter-spacing:1.5px;text-transform:uppercase;">Total Exchanges</div><div style="font-size:12px;font-weight:600;color:#222;">${messages.length}</div></div>
        </div>
      `;
      document.body.appendChild(headerEl);
      const headerCanvas = await html2canvas(headerEl, { ...h2cOpts, backgroundColor: '#ffffff', useCORS: true, allowTaint: false });
      document.body.removeChild(headerEl);

      const headerH = (headerCanvas.height * CONTENT_W) / headerCanvas.width;
      pdf.addImage(headerCanvas.toDataURL('image/png'), 'PNG', MARGIN_SIDE, MARGIN_TOP, CONTENT_W, headerH);
      let cursorY = MARGIN_TOP + headerH + GAP;
      let currentPage = 1;

      // ── FOOTER HELPER ────────────────────────────────────────────────────
      const drawFooter = (pageNum: number, totalPages: number) => {
        const fy = PAGE_H - FOOTER_H;
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, fy, PAGE_W, FOOTER_H, 'F');
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.line(MARGIN_SIDE, fy + 0.5, PAGE_W - MARGIN_SIDE, fy + 0.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(180, 180, 180);
        pdf.text(`${dateStr}  ${timeStr}`, MARGIN_SIDE, fy + 6.5);
        pdf.text('Confidential Information \u2013 Humango Solutions LLC', PAGE_W / 2, fy + 6.5, { align: 'center' });
        pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN_SIDE, fy + 6.5, { align: 'right' });
      };

      // ── PLACEMENT HELPER ─────────────────────────────────────────────────
      const place = (canvas: HTMLCanvasElement) => {
        const imgH = (canvas.height * CONTENT_W) / canvas.width;
        if (cursorY + imgH > USABLE_H) {
          currentPage++;
          pdf.addPage();
          cursorY = MARGIN_TOP;
        }
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN_SIDE, cursorY, CONTENT_W, imgH);
        cursorY += imgH + GAP;
      };

      // ── CAPTURE ALL PIECES FIRST (DOM is live and stable) ───────────────
      // All pieces must be captured at the same reference pixel width so that
      // text scales consistently when every canvas is stretched to CONTENT_W mm.
      const pieces: HTMLCanvasElement[] = [];

      // Helper: wrap an element clone in a fixed-width container and capture it.
      const captureAtWidth = async (source: Element, refWidth: number): Promise<HTMLCanvasElement> => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `position:absolute;left:-9999px;top:0;width:${refWidth}px;background:#ffffff;`;
        const clone = source.cloneNode(true) as HTMLElement;
        // Remove any absolute/fixed positioning on the clone itself
        clone.style.position = 'relative';
        clone.style.left = '0';
        clone.style.top = '0';
        clone.style.width = '100%';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);
        const c = await html2canvas(wrapper, { ...h2cOpts, backgroundColor: '#ffffff' });
        document.body.removeChild(wrapper);
        return c;
      };

      for (const msg of messages) {
        const el = messageRefs.current[msg.id];
        if (!el) continue;

        // Capture at 85% of natural width → scales up ~18% in PDF (≈ one font size larger)
        const refWidth = Math.round(el.getBoundingClientRect().width * 0.85);
        const resultsContainer = el.querySelector('[data-pdf-results]') as HTMLElement | null;
        const resultCards = el.querySelectorAll('[data-pdf-result-card]');

        if (!resultsContainer || resultCards.length === 0) {
          // User message or bot message with no result cards
          const c = await captureAtWidth(el, refWidth);
          pieces.push(c);
        } else {
          // Bot message with result cards:
          // 1. Clone the full message, remove the results container → message header only
          const headerClone = el.cloneNode(true) as HTMLElement;
          const cloneResults = headerClone.querySelector('[data-pdf-results]');
          if (cloneResults) cloneResults.remove();
          const headerWrapper = document.createElement('div');
          headerWrapper.style.cssText = `position:absolute;left:-9999px;top:0;width:${refWidth}px;background:#ffffff;`;
          headerClone.style.position = 'relative';
          headerClone.style.left = '0';
          headerClone.style.top = '0';
          headerClone.style.width = '100%';
          headerWrapper.appendChild(headerClone);
          document.body.appendChild(headerWrapper);
          const headerC = await html2canvas(headerWrapper, { ...h2cOpts, backgroundColor: '#ffffff' });
          document.body.removeChild(headerWrapper);
          pieces.push(headerC);

          // 2. Each result card wrapped at the same refWidth for consistent scale
          for (const card of Array.from(resultCards)) {
            const c = await captureAtWidth(card, refWidth);
            pieces.push(c);
          }
        }
      }

      // ── PLACE ALL PIECES WITH PER-ITEM PAGE-BREAK LOGIC ─────────────────
      for (const piece of pieces) {
        place(piece);
      }

      const totalPages = currentPage;

      // ── DRAW FOOTERS ON EVERY PAGE ───────────────────────────────────────
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
                onClick={() => { setMessages([]); setInputValue(''); sessionCtx.current = createSessionContext(); }}
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
                    <div ref={(el) => { messageRefs.current[message.id] = el; }}>
                      <ChatMessage
                        message={message}
                        onTypingTick={() => bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })}
                      />
                    </div>
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
                style={{ transition: 'transform 0.15s ease', '--hover-lift': '-2px' } as React.CSSProperties}
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
