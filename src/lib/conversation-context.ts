import { ParsedQuery, parseNaturalLanguageQuery, matchResumeToQuery } from './nlp-parser';
import { SearchResult } from './supabase';

// ─── Intent classification ─────────────────────────────────────────────────────

export type ConversationIntent =
  | 'NARROW'    // filter the existing result set: "out of those", "from that list", "just the ones who"
  | 'EXCLUDE'   // retroactively remove from result set: "drop anyone", "throw out", "remove"
  | 'REPLACE'   // swap one constraint for another: "scratch X, swap for Y", "actually, change X to Y"
  | 'EXPAND'    // add more candidates to the current set: "also include", "add to that list"
  | 'FORMAT'    // formatting command: "show top 3", "show me the snippet"
  | 'NEW';      // fresh search with no reference to prior results

// ─── Referential phrase detection ─────────────────────────────────────────────

const NARROW_PHRASES = [
  /\b(out\s+of\s+those|from\s+that\s+list|from\s+those|of\s+those|from\s+them|among\s+those|of\s+the(?:se|m)?|within\s+that|in\s+that\s+list|in\s+those|just\s+the\s+ones|narrow\s+(that|it)|filter\s+(that|those|down)|refine)\b/i,
  /\b(do\s+any\s+of\s+them|do\s+they|of\s+them|among\s+them|any\s+of\s+them|from\s+the(?:se|m)?\s+(results?|candidates?|people|list))\b/i,
  /\b(review\s+that\s+list|go\s+through\s+that|look\s+at\s+that\s+again|from\s+those\s+(results?|candidates?|people))\b/i,
  // "which of those", "who of them", "which ones have", "now show only those with"
  /\b(which\s+(of\s+those|ones?|candidates?)|who\s+(of\s+them|among\s+those)|now\s+(?:show\s+)?(?:only\s+)?those\s+with)\b/i,
  // "also require", "add the requirement", "must also have", "and have", "who also have"
  /\b(also\s+(?:require|need|must\s+have|have)|must\s+also\s+have|who\s+also\s+(?:have|has|know|knows))\b/i,
  // "keep only", "keep just", "keep the ones"
  /\b(keep\s+(?:only|just|the\s+ones?|those\s+(?:with|who|that)))\b/i,
  // "now filter", "now narrow", "now just show"
  /\bnow\s+(?:filter|narrow|just\s+show|show\s+only)\b/i,
];

const EXCLUDE_PHRASES = [
  /\b(drop\s+anyone|throw\s+out|remove\s+anyone|remove\s+those|filter\s+out|exclude\s+from\s+(that|those)|take\s+out|weed\s+out|kick\s+out)\b/i,
  /\b(drop\s+(?:the\s+)?candidates?|remove\s+(?:the\s+)?candidates?)\b/i,
  // "without X", "no X", "not X" in follow-up context
  /\b(without\s+(?:a\s+degree|clearance|aws|python|java|any)|none\s+with|exclude\s+(?:anyone|those?)\s+(?:with|who))\b/i,
  // "hide the ones without", "remove anyone who doesn't"
  /\b(hide\s+(?:the\s+)?(?:ones?|candidates?)|remove\s+anyone\s+who)\b/i,
];

const REPLACE_PHRASES = [
  /\b(scratch\s+(?:that|the)?|swap(?:\s+it)?\s+for|instead\s+of|replace\s+(?:that\s+)?with|change\s+(?:the\s+)?(?:\w+\s+)?to|switch\s+(?:from\s+)?(?:\w+\s+)?to)\b/i,
  /\b(actually[,.]?\s+(?:scratch|change|make|use|switch|no\s+(?:wait|actually)))\b/i,
  /\b(no,?\s+(?:wait|actually)|forget\s+(?:the\s+)?(?:java|python|that|previous))\b/i,
];

const EXPAND_PHRASES = [
  /\b(also\s+(?:include|add|show)|add\s+(?:to\s+)?(?:that|those|the\s+list)|and\s+also\s+include|broaden|expand\s+(?:to\s+)?include)\b/i,
];

const FORMAT_PHRASES = [
  // "show me just 3", "show me now just 3", "show only 5 of those", "give me top 10", "limit to 3"
  /\b(?:show|give|display|list)(?:\s+\w+){0,3}\s+(?:just|only|top|first|the\s+top|the\s+first)\s+\d+\b/i,
  /\b(?:just|only)\s+\d+\s+(?:of\s+(?:those|them|the(?:se|m)?|that))?\b/i,
  /\b(?:limit|cap|restrict)\s+(?:it\s+)?(?:to\s+)?\d+\b/i,
  /\btop\s+\d+\s+(?:only|candidates?|results?|of\s+(?:those|them))?\b/i,
  // "show me the best", "who's the best match", "best candidate", "highest score", "top result"
  /\b(?:show\s+(?:me\s+)?)?(?:the\s+)?best\s+(?:match|candidate|result|fit|one)\b/i,
  /\b(?:who(?:'?s|\s+is)\s+the\s+best|highest\s+(?:score|match)|top\s+result)\b/i,
  // "show more", "more results", "next page", "see the rest", "load more"
  /\b(?:show|see|load|give\s+me)\s+(?:more|the\s+rest|the\s+others?|remaining)\b/i,
  /\b(?:next\s+(?:page|batch|set)|more\s+results?|more\s+candidates?)\b/i,
  // "sort by", "rank by", "order by"
  /\b(?:sort|rank|order|arrange)\s+(?:them\s+|those\s+|the\s+results?\s+)?by\b/i,
  // snippet display
  /\b(show\s+(?:me\s+)?(?:the\s+)?(?:exact\s+)?snippet|show\s+snippets?|show\s+(?:me\s+)?(?:where|the\s+part)|pull\s+(?:the\s+)?(?:exact\s+)?(?:sentence|snippet|text))\b/i,
];

// Conversational noise to strip before parsing
const NOISE_PATTERNS = [
  /\b(my\s+bad|oops|sorry|let('?s)?\s+(look|see|take\s+a\s+look)|what\s+about|are\s+there\s+any|can\s+you|could\s+you|please|i\s+need|i\s+want|i('?m)?\s+looking\s+for|how\s+about|okay[,.]?|alright[,.]?|so[,.]?|also[,.]?|well[,.]?|hmm+[,.]?|right[,.]?)\b/gi,
  /\b(go\s+ahead\s+and|make\s+sure\s+(to\s+)?|i\s+just\s+want|do\s+me\s+a\s+favor)\b/gi,
];

// ─── Replacement extraction ────────────────────────────────────────────────────

interface Replacement {
  remove: string;
  add: string;
}

function extractReplacement(query: string): Replacement | null {
  // "scratch the Java part. Swap it for C++ instead"
  // "actually, change Java to C++"
  // "swap Java for C++"
  // "instead of Java, use C++"
  const patterns = [
    /\bscratch\s+(?:the\s+)?(\w[\w\s\+\#\.]*?)\s+(?:part|bit)?\s*[.,]?\s*(?:swap\s+(?:it\s+)?for|use|try)\s+(\w[\w\s\+\#\.]+?)(?:\s+instead|\s*[.,]|$)/i,
    /\bswap\s+(?:out\s+)?(\w[\w\s\+\#\.]*?)\s+(?:for|with)\s+(\w[\w\s\+\#\.]+?)(?:\s*[.,]|$)/i,
    /\b(?:change|switch)\s+(?:the\s+)?(\w[\w\s\+\#\.]*?)\s+to\s+(\w[\w\s\+\#\.]+?)(?:\s*[.,]|$)/i,
    /\b(?:replace|instead\s+of)\s+(\w[\w\s\+\#\.]*?)\s+(?:with|use|try)\s+(\w[\w\s\+\#\.]+?)(?:\s*[.,]|$)/i,
    /\b(?:forget|drop|no)\s+(?:the\s+)?(\w[\w\s\+\#\.]*?)[,.]?\s+(?:use|add|try|give\s+me)\s+(\w[\w\s\+\#\.]+?)(?:\s*[.,]|$)/i,
  ];
  for (const p of patterns) {
    const m = query.match(p);
    if (m) return { remove: m[1].trim(), add: m[2].trim() };
  }
  return null;
}

// ─── Constraint extraction from exclusion turn ─────────────────────────────────

interface ExclusionConstraints {
  minYears?: number;
  maxAgeDays?: number;
  excludeSkills?: string[];
  excludeManagement?: boolean;
  excludeVisaSponsorship?: boolean;
}

function extractExclusionConstraints(query: string): ExclusionConstraints {
  const constraints: ExclusionConstraints = {};
  const lq = query.toLowerCase();

  // "at least N years", "more than N years", "N+ years"
  const yearsMatch = lq.match(/(?:at\s+least|more\s+than|over|minimum)?\s*(\d+)\+?\s*(?:year[s]?|yr[s]?)\s*(?:of\s*)?(?:experience|exp)?/i);
  if (yearsMatch) constraints.minYears = parseInt(yearsMatch[1]);

  // "older than N months/days", "hasn't been touched in N months"
  const ageMatch = query.match(/(?:older\s+than|(?:not\s+)?(?:updated|touched|modified)\s+in\s+(?:the\s+)?(?:last|past)?|more\s+than)\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/i);
  if (ageMatch) {
    let days = parseInt(ageMatch[1]);
    const unit = ageMatch[2].toLowerCase();
    if (unit.startsWith('week')) days *= 7;
    if (unit.startsWith('month')) days *= 30;
    if (unit.startsWith('year')) days *= 365;
    constraints.maxAgeDays = days;
  }

  // Exclusion of management
  if (/\b(management|manager|project\s+lead|supervisor)\b/i.test(query)) {
    constraints.excludeManagement = true;
  }

  // Visa sponsorship
  if (/\b(visa|sponsorship|h1b)\b/i.test(query)) {
    constraints.excludeVisaSponsorship = true;
  }

  return constraints;
}

// ─── Format extraction from a turn ────────────────────────────────────────────

interface FormatFlags {
  topN?: number;
  showSnippet?: boolean;
  topNSkill?: string;
  sortBy?: 'score' | 'recent' | 'experience' | 'name';
  showMore?: boolean;
  showBest?: boolean;
}

function extractFormatFlags(query: string): FormatFlags {
  const flags: FormatFlags = {};

  // Match numbers after limit/slice words, allowing filler words in between
  const topNMatch = query.match(/\b(?:top|first|just|only|limit(?:\s+(?:it|to))?|cap(?:\s+to)?|restrict(?:\s+to)?|show(?:\s+me)?(?:\s+\w+){0,3})\s+(?:the\s+)?(\d+)\b/i);
  if (topNMatch) flags.topN = parseInt(topNMatch[topNMatch.length - 1]);
  // Also catch "X of those/them" patterns
  if (!flags.topN) {
    const ofThoseMatch = query.match(/\b(\d+)\s+(?:of\s+(?:those|them|the(?:se|m)?|that|the\s+results?|the\s+candidates?))\b/i);
    if (ofThoseMatch) flags.topN = parseInt(ofThoseMatch[1]);
  }

  if (/\b(snippet|exact\s+(?:sentence|text|part)|show\s+(?:me\s+)?where|pull\s+(?:the\s+)?exact)\b/i.test(query)) {
    flags.showSnippet = true;
  }

  if (/\b(?:sort|rank|order|arrange)\s+(?:them\s+|those\s+|the\s+results?\s+)?by\s+(?:score|match|relevance|rank)\b/i.test(query)) {
    flags.sortBy = 'score';
  } else if (/\b(?:sort|rank|order|arrange)\s+(?:them\s+|those\s+|the\s+results?\s+)?by\s+(?:experience|years?|seniority)\b/i.test(query)) {
    flags.sortBy = 'experience';
  } else if (/\b(?:sort|rank|order|arrange)\s+(?:them\s+|those\s+|the\s+results?\s+)?by\s+(?:name|alphabet)\b/i.test(query)) {
    flags.sortBy = 'name';
  } else if (/\b(?:sort|rank|order|arrange)\s+(?:them\s+|those\s+|the\s+results?\s+)?by\s+(?:date|recent|newest|latest)\b/i.test(query)) {
    flags.sortBy = 'recent';
  }

  if (/\b(?:show|see|load|give\s+me)\s+(?:more|the\s+rest|the\s+others?|remaining)|(?:next\s+(?:page|batch|set)|more\s+results?|more\s+candidates?)\b/i.test(query)) {
    flags.showMore = true;
  }

  if (/\b(?:best\s+(?:match|candidate|result|fit|one)|highest\s+(?:score|match)|who(?:'?s|\s+is)\s+the\s+best|top\s+result)\b/i.test(query)) {
    flags.showBest = true;
  }

  return flags;
}

// ─── Noise stripping ──────────────────────────────────────────────────────────

function stripNoise(query: string): string {
  let cleaned = query;
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

// ─── Intent classifier ────────────────────────────────────────────────────────

export function classifyIntent(query: string, hasPreviousResults: boolean): ConversationIntent {
  if (!hasPreviousResults) return 'NEW';

  if (REPLACE_PHRASES.some(p => p.test(query))) return 'REPLACE';
  if (EXCLUDE_PHRASES.some(p => p.test(query))) return 'EXCLUDE';
  if (NARROW_PHRASES.some(p => p.test(query))) return 'NARROW';
  if (EXPAND_PHRASES.some(p => p.test(query))) return 'EXPAND';
  if (FORMAT_PHRASES.some(p => p.test(query))) return 'FORMAT';

  return 'NEW';
}

// ─── Session context ──────────────────────────────────────────────────────────

export interface SessionContext {
  lastResults: SearchResult[];        // result pool from the most recent search
  fullResultPool: SearchResult[];     // unsliced pool for "show more" pagination
  displayOffset: number;              // how many already shown for pagination
  lastParsedQuery: ParsedQuery | null;
  activeSkills: string[];             // skills currently in the filter
  activeCerts: string[];
  activeFilters: Partial<ParsedQuery>;
}

export function createSessionContext(): SessionContext {
  return {
    lastResults: [],
    fullResultPool: [],
    displayOffset: 0,
    lastParsedQuery: null,
    activeSkills: [],
    activeCerts: [],
    activeFilters: {},
  };
}

// ─── Apply NARROW to previous result pool ────────────────────────────────────

export function applyNarrow(
  previousResults: SearchResult[],
  query: string,
): { results: SearchResult[]; parsedQuery: ParsedQuery } {
  const cleaned = stripNoise(query);
  const parsedQuery = parseNaturalLanguageQuery(cleaned);

  const filtered = previousResults.filter(resume => {
    const matchResult = matchResumeToQuery(
      (resume as any).content_text || '',
      parsedQuery,
      { file_name: resume.file_name, indexed_at: (resume as any).indexed_at }
    );
    return matchResult.matches;
  });

  // Preserve original scores + add new match info
  const reScored = filtered.map(resume => {
    const matchResult = matchResumeToQuery(
      (resume as any).content_text || '',
      parsedQuery,
      { file_name: resume.file_name, indexed_at: (resume as any).indexed_at }
    );
    return {
      ...resume,
      matchReason: matchResult.reasons.join(', '),
      matchedSnippets: (resume as any).matchedSnippets || [],
      exactMatchScore: matchResult.score,
      totalScore: matchResult.score + ((resume as any).totalScore || 0),
    } as SearchResult;
  });

  reScored.sort((a: any, b: any) => b.totalScore - a.totalScore);
  return { results: reScored, parsedQuery };
}

// ─── Apply EXCLUDE to previous result pool ────────────────────────────────────

export function applyExclude(
  previousResults: SearchResult[],
  query: string,
): { results: SearchResult[]; applied: string[] } {
  const constraints = extractExclusionConstraints(query);
  const applied: string[] = [];

  let filtered = previousResults.filter(resume => {
    const content = (resume as any).content_text || '';
    const indexedAt = (resume as any).indexed_at;

    // Min years filter
    if (constraints.minYears !== undefined && constraints.minYears > 0) {
      const expMatches = content.matchAll(/(\d+)\+?\s*(?:year[s]?|yr[s]?)\s*(?:of\s*)?(?:experience|exp|work|employment)/gi);
      let maxYears = 0;
      for (const m of expMatches) {
        const y = parseInt(m[1]);
        if (y > maxYears) maxYears = y;
      }
      if (maxYears < constraints.minYears) return false;
    }

    // Max age (in days) — older than N days means indexed_at is MORE than N days ago
    if (constraints.maxAgeDays !== undefined && indexedAt) {
      const indexedDate = new Date(indexedAt);
      const cutoff = new Date(Date.now() - constraints.maxAgeDays * 24 * 60 * 60 * 1000);
      // "older than 6 months" = indexed before the cutoff = EXCLUDE
      if (indexedDate < cutoff) return false;
    }

    // Management exclusion
    if (constraints.excludeManagement && /\b(project\s+manager|program\s+manager|management\s+role|manager|director|supervisor|team\s+lead)\b/i.test(content)) {
      return false;
    }

    // Visa sponsorship exclusion
    if (constraints.excludeVisaSponsorship && /\b(require[s]?\s+(visa|sponsorship)|visa\s+sponsorship\s+required|h1b|h-1b)\b/i.test(content)) {
      return false;
    }

    return true;
  });

  if (constraints.minYears) applied.push(`at least ${constraints.minYears} years experience`);
  if (constraints.maxAgeDays) applied.push(`resume within last ${constraints.maxAgeDays} days`);
  if (constraints.excludeManagement) applied.push('no management roles');
  if (constraints.excludeVisaSponsorship) applied.push('no visa sponsorship required');

  return { results: filtered, applied };
}

// ─── Apply REPLACE — mutate the last parsed query ─────────────────────────────

export function applyReplace(
  lastParsedQuery: ParsedQuery,
  query: string,
): { updatedQuery: ParsedQuery; description: string } {
  const replacement = extractReplacement(query);
  if (!replacement) {
    // Fall back to re-parsing; merge with existing
    const newParsed = parseNaturalLanguageQuery(stripNoise(query));
    return { updatedQuery: mergeParsedQueries(lastParsedQuery, newParsed), description: 'Updated filters' };
  }

  const { remove, add } = replacement;
  const updated = deepCloneParsedQuery(lastParsedQuery);

  // Remove the "remove" term from skills.required
  updated.skills.required = updated.skills.required.filter(
    s => !s.toLowerCase().includes(remove.toLowerCase()) && !remove.toLowerCase().includes(s.toLowerCase())
  );
  // Remove from OR groups
  if (updated.skills.orGroups) {
    updated.skills.orGroups = updated.skills.orGroups
      .map(group => group.filter(t => !t.toLowerCase().includes(remove.toLowerCase())))
      .filter(group => group.length > 0);
  }

  // Add the "add" term to skills.required
  if (!updated.skills.required.some(s => s.toLowerCase() === add.toLowerCase())) {
    updated.skills.required.push(add);
  }

  return {
    updatedQuery: updated,
    description: `Replaced "${remove}" with "${add}". Keeping all other filters.`,
  };
}

// ─── Apply FORMAT — limit/slice/snippet flag ──────────────────────────────────

export function applyFormat(
  previousResults: SearchResult[],
  query: string,
  previousQuery?: ParsedQuery | null,
  ctx?: SessionContext,
): { results: SearchResult[]; formatFlags: FormatFlags; narrowedQuery?: ParsedQuery; newOffset?: number } {
  const formatFlags = extractFormatFlags(query);
  const cleaned = stripNoise(query);

  // Also check if there's a new skill to look for within the subset
  let narrowedQuery: ParsedQuery | undefined;
  const hasNewConstraint = /\b(mention|built|have|worked|who|booking|scheduler|sharepoint|python|java|react|c\+\+|powershell|bash|cissp|ceh)\b/i.test(cleaned);
  if (hasNewConstraint) {
    narrowedQuery = parseNaturalLanguageQuery(cleaned);
  }

  let results = previousResults;

  // Apply narrow filter if there's a new constraint
  if (narrowedQuery) {
    results = previousResults.filter(resume => {
      const matchResult = matchResumeToQuery(
        (resume as any).content_text || '',
        narrowedQuery!,
        { file_name: resume.file_name, indexed_at: (resume as any).indexed_at }
      );
      return matchResult.matches;
    }).map(resume => {
      const matchResult = matchResumeToQuery(
        (resume as any).content_text || '',
        narrowedQuery!,
        { file_name: resume.file_name, indexed_at: (resume as any).indexed_at }
      );
      // Build snippets for the new keyword
      const snippets: string[] = [];
      const content = (resume as any).content_text || '';
      if (narrowedQuery!.skills.required.length > 0) {
        for (const skill of narrowedQuery!.skills.required.slice(0, 3)) {
          const snippet = extractSnippetFromContent(content, skill);
          if (snippet) snippets.push(snippet);
        }
      }
      return {
        ...resume,
        matchedSnippets: formatFlags.showSnippet ? snippets : (resume as any).matchedSnippets || [],
        matchReason: matchResult.reasons.join(', '),
        exactMatchScore: matchResult.score,
        totalScore: matchResult.score,
      } as SearchResult;
    });

    results.sort((a: any, b: any) => b.totalScore - a.totalScore);
  } else if (formatFlags.showSnippet) {
    // Re-extract snippets from existing results using the previous query
    results = results.map(resume => {
      const content = (resume as any).content_text || '';
      const snippets: string[] = [];
      if (previousQuery?.skills.required) {
        for (const skill of previousQuery.skills.required.slice(0, 3)) {
          const s = extractSnippetFromContent(content, skill);
          if (s) snippets.push(s);
        }
      }
      return { ...resume, matchedSnippets: snippets.length > 0 ? snippets : (resume as any).matchedSnippets };
    });
  }

  // Apply sorting
  if (formatFlags.sortBy === 'score') {
    results = [...results].sort((a: any, b: any) => b.totalScore - a.totalScore);
  } else if (formatFlags.sortBy === 'name') {
    results = [...results].sort((a: any, b: any) => (a.file_name || '').localeCompare(b.file_name || ''));
  } else if (formatFlags.sortBy === 'recent') {
    results = [...results].sort((a: any, b: any) => new Date(b.indexed_at || 0).getTime() - new Date(a.indexed_at || 0).getTime());
  } else if (formatFlags.sortBy === 'experience') {
    results = [...results].sort((a: any, b: any) => {
      const yearsRe = /(\d+)\s*\+?\s*years?/gi;
      const getMaxYears = (r: any) => {
        const matches = [...((r.content_text || '').matchAll(yearsRe))].map(m => parseInt(m[1]));
        return matches.length ? Math.max(...matches) : 0;
      };
      return getMaxYears(b) - getMaxYears(a);
    });
  }

  // "show best" — return only the top result
  if (formatFlags.showBest) {
    results = results.slice(0, 1);
  }

  // "show more" — paginate from where we left off
  let newOffset: number | undefined;
  if (formatFlags.showMore && ctx) {
    const PAGE_SIZE = 10;
    const pool = ctx.fullResultPool.length > 0 ? ctx.fullResultPool : previousResults;
    const offset = ctx.displayOffset;
    results = pool.slice(offset, offset + PAGE_SIZE);
    newOffset = offset + results.length;
    return { results, formatFlags, narrowedQuery, newOffset };
  }

  // Apply top-N limit
  if (formatFlags.topN) {
    results = results.slice(0, formatFlags.topN);
  }

  return { results, formatFlags, narrowedQuery };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSnippetFromContent(content: string, keyword: string): string {
  const lower = content.toLowerCase();
  const lowerKw = keyword.toLowerCase();
  const idx = lower.indexOf(lowerKw);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 120);
  const end = Math.min(content.length, idx + keyword.length + 120);
  let snippet = content.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet += '...';
  return snippet;
}

function deepCloneParsedQuery(q: ParsedQuery): ParsedQuery {
  return JSON.parse(JSON.stringify(q));
}

function mergeParsedQueries(base: ParsedQuery, overlay: ParsedQuery): ParsedQuery {
  const merged = deepCloneParsedQuery(base);
  // Merge skills
  for (const skill of overlay.skills.required) {
    if (!merged.skills.required.includes(skill)) merged.skills.required.push(skill);
  }
  // Merge certs
  for (const cert of overlay.certifications.specific) {
    if (!merged.certifications.specific.includes(cert)) merged.certifications.specific.push(cert);
    if (!merged.certifications.general.includes(cert)) merged.certifications.general.push(cert);
  }
  // Overlay degree
  if (overlay.degrees.bachelor) merged.degrees.bachelor = true;
  if (overlay.degrees.master) merged.degrees.master = true;
  if (overlay.degrees.phd) merged.degrees.phd = true;
  if (overlay.degrees.associate) merged.degrees.associate = true;
  if (overlay.degrees.specificField) merged.degrees.specificField = overlay.degrees.specificField;
  // Overlay experience
  if (overlay.experience.minYears > 0) merged.experience.minYears = overlay.experience.minYears;
  if (overlay.experience.clearance) merged.experience.clearance = overlay.experience.clearance;
  if (overlay.experience.seniority) merged.experience.seniority = overlay.experience.seniority;
  if (overlay.experience.excludeManagement) merged.experience.excludeManagement = true;
  if (overlay.experience.excludeVisaSponsorship) merged.experience.excludeVisaSponsorship = true;
  if (overlay.experience.recentlyUpdatedDays) merged.experience.recentlyUpdatedDays = overlay.experience.recentlyUpdatedDays;
  // OR groups
  if (overlay.skills.orGroups && overlay.skills.orGroups.length > 0) {
    merged.skills.orGroups = [...(merged.skills.orGroups || []), ...overlay.skills.orGroups];
  }
  merged.isCompound = merged.isCompound || overlay.isCompound;
  return merged;
}

// ─── Context-aware query resolution ───────────────────────────────────────────

export interface ResolvedTurn {
  intent: ConversationIntent;
  results: SearchResult[];
  parsedQuery: ParsedQuery | null;
  description: string; // Human-readable explanation of what the system did
  totalSearched: number; // how many resumes were considered
}

export function resolveConversationalTurn(
  rawQuery: string,
  ctx: SessionContext,
  allResumes: SearchResult[],
): ResolvedTurn {
  const hasPreviousResults = ctx.lastResults.length > 0;
  const intent = classifyIntent(rawQuery, hasPreviousResults);

  switch (intent) {
    case 'NARROW': {
      const { results, parsedQuery } = applyNarrow(ctx.lastResults, rawQuery);
      return {
        intent,
        results,
        parsedQuery,
        description: `Filtering ${ctx.lastResults.length} previous candidates`,
        totalSearched: ctx.lastResults.length,
      };
    }

    case 'EXCLUDE': {
      const { results, applied } = applyExclude(ctx.lastResults, rawQuery);
      // Also try NARROW in case there are extra constraints
      const hasSkillConstraint = /\b(degree|bachelor|master|phd|certified|years?\s+of\s+experience|\d+\s+years?)\b/i.test(rawQuery);
      let finalResults = results;
      let parsedQuery: ParsedQuery | null = null;
      if (hasSkillConstraint) {
        const narrow = applyNarrow(results, rawQuery);
        finalResults = narrow.results;
        parsedQuery = narrow.parsedQuery;
      }
      return {
        intent,
        results: finalResults,
        parsedQuery,
        description: `Applied exclusions to ${ctx.lastResults.length} candidates: ${applied.join(', ')}`,
        totalSearched: ctx.lastResults.length,
      };
    }

    case 'REPLACE': {
      if (!ctx.lastParsedQuery) {
        // No prior query to modify — treat as new
        const parsedQuery = parseNaturalLanguageQuery(rawQuery);
        return { intent: 'NEW', results: [], parsedQuery, description: 'New search', totalSearched: allResumes.length };
      }
      const { updatedQuery, description } = applyReplace(ctx.lastParsedQuery, rawQuery);
      // Re-run against ALL resumes with updated query
      const results: SearchResult[] = [];
      for (const resume of allResumes) {
        const mr = matchResumeToQuery(
          (resume as any).content_text || '',
          updatedQuery,
          { file_name: resume.file_name, indexed_at: (resume as any).indexed_at }
        );
        if (mr.matches) {
          results.push({
            ...resume,
            matchReason: mr.reasons.join(', '),
            exactMatchScore: mr.score,
            totalScore: mr.score,
          } as SearchResult);
        }
      }
      results.sort((a: any, b: any) => b.totalScore - a.totalScore);
      return {
        intent,
        results,
        parsedQuery: updatedQuery,
        description,
        totalSearched: allResumes.length,
      };
    }

    case 'EXPAND': {
      // Parse new query, merge with last, run against ALL resumes
      const newParsed = parseNaturalLanguageQuery(rawQuery);
      const merged = ctx.lastParsedQuery ? mergeParsedQueries(ctx.lastParsedQuery, newParsed) : newParsed;
      const results: SearchResult[] = [];
      for (const resume of allResumes) {
        const mr = matchResumeToQuery(
          (resume as any).content_text || '',
          merged,
          { file_name: resume.file_name, indexed_at: (resume as any).indexed_at }
        );
        if (mr.matches) {
          results.push({
            ...resume,
            matchReason: mr.reasons.join(', '),
            exactMatchScore: mr.score,
            totalScore: mr.score,
          } as SearchResult);
        }
      }
      results.sort((a: any, b: any) => b.totalScore - a.totalScore);
      return {
        intent,
        results,
        parsedQuery: merged,
        description: 'Expanded search with additional criteria',
        totalSearched: allResumes.length,
      };
    }

    case 'FORMAT': {
      const pool = ctx.fullResultPool.length > 0 ? ctx.fullResultPool : ctx.lastResults;
      const { results, formatFlags, narrowedQuery, newOffset } = applyFormat(pool, rawQuery, ctx.lastParsedQuery, ctx);
      let desc = `Filtered ${pool.length} previous candidates`;
      if (formatFlags.topN) desc += ` — showing top ${formatFlags.topN}`;
      if (formatFlags.showBest) desc += ' — best match';
      if (formatFlags.showMore) desc += ` — showing next batch`;
      if (formatFlags.sortBy) desc += ` — sorted by ${formatFlags.sortBy}`;
      if (formatFlags.showSnippet) desc += ' with exact snippets';
      return {
        intent,
        results,
        parsedQuery: narrowedQuery || ctx.lastParsedQuery,
        description: desc,
        totalSearched: pool.length,
        newOffset,
      };
    }

    case 'NEW':
    default: {
      const parsedQuery = parseNaturalLanguageQuery(rawQuery);
      return {
        intent,
        results: [],  // caller runs the global search
        parsedQuery,
        description: 'New search',
        totalSearched: allResumes.length,
      };
    }
  }
}

// ─── Human-readable intent label ──────────────────────────────────────────────

export function intentLabel(intent: ConversationIntent, description: string): string {
  const labels: Record<ConversationIntent, string> = {
    NARROW: `Filtered from previous results`,
    EXCLUDE: `Exclusions applied to previous results`,
    REPLACE: `Constraints updated`,
    EXPAND: `Search expanded`,
    FORMAT: `Results reformatted`,
    NEW: 'New search',
  };
  return description || labels[intent];
}
