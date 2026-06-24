import { SearchResult } from './supabase';

export type ActionType =
  | 'draft_email'
  | 'summarize'
  | 'extract_links'
  | 'generate_questions'
  | 'flag_ai_generated'
  | 'compare_top2'
  | 'score_candidates';

export interface ActionQuery {
  type: ActionType;
  targetCount?: number;
  targetCandidate?: string;
  criteria?: string;
  role?: string;
}

export function detectActionQuery(query: string): ActionQuery | null {
  // Draft interview invitation email
  if (/\b(draft|write|compose|create)\s+(?:a\s+)?(?:short\s+)?(?:professional\s+)?(?:interview\s+|invite\s+)?email\b/i.test(query)) {
    const countMatch = query.match(/\btop\s+(\d+)\b/i);
    const role = query.match(/for\s+(?:the\s+)?([a-zA-Z\s]+?)\s+(?:role|position)\b/i)?.[1];
    return { type: 'draft_email', targetCount: countMatch ? parseInt(countMatch[1]) : 5, role };
  }

  // Summarize strengths / red flags
  if (/\b(summarize|summary|strengths?\s+and|red\s+flags?|bullet\s+points?)\b/i.test(query) &&
      /\b(top|best|applicant|candidate|our)\b/i.test(query)) {
    return { type: 'summarize' };
  }

  // Extract links
  if (/\b(extract|pull|list|find|get)\s+(?:all\s+)?(?:github|portfolio|linkedin|project)\s+(?:links?|urls?|profiles?)\b/i.test(query)) {
    return { type: 'extract_links' };
  }

  // Generate interview questions
  if (/\b(generate|create|write|give\s+me|draft)\s+(?:a\s+list\s+of\s+)?(?:\d+\s+)?(?:technical\s+)?interview\s+questions?\b/i.test(query)) {
    const candidate = query.match(/for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'?s?\s+resume/i)?.[1];
    return { type: 'generate_questions', targetCandidate: candidate };
  }

  // Flag AI-generated / keyword-stuffed
  if (/\b(flag|detect|identify|find)\s+(?:any\s+)?(?:resumes?\s+)?(?:in\s+the\s+pool\s+)?(?:that\s+)?(?:appear\s+to\s+be\s+)?(?:completely\s+)?(?:ai.generated|artificially\s+generated|stuffed\s+with\s+hidden|keyword.stuffed)\b/i.test(query)) {
    return { type: 'flag_ai_generated' };
  }

  // Compare top two side-by-side
  if (/\bcompare\s+(?:the\s+)?top\s+two\b|\bside.by.side\b|\bwho\s+has\s+more\b/i.test(query)) {
    const criteria = query.match(/\b(api|python|java|react|hands.on|experience|certifications?|skills?|automation)\s+experience\b/i)?.[1];
    return { type: 'compare_top2', criteria };
  }

  // Score candidates on a scale
  if (/\bscore\s+(?:the\s+)?(?:applicants?|candidates?)\b/i.test(query) &&
      /\b(?:1\s+to\s+10|\d+\s+to\s+\d+|scale\s+of\b)/i.test(query)) {
    const criteria = query.match(/\bbased\s+(?:specifically\s+)?on\s+(?:their\s+)?([a-zA-Z\s]+?)(?:\s+skills?|\s+experience|\s*$)/i)?.[1]?.trim();
    return { type: 'score_candidates', criteria };
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function candidateName(r: SearchResult): string {
  return r.candidate_name || r.file_name.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ');
}

function experienceLevel(r: SearchResult): string {
  const c = r.content_text?.toLowerCase() || '';
  if (/\b(ceo|cto|cfo|vp|vice president|chief|director)\b/.test(c)) return 'Executive';
  if (/\bsenior\b/.test(c)) return 'Senior';
  if (/\b(manager|lead|principal)\b/.test(c)) return 'Manager / Lead';
  if (/\b(junior|entry.level|intern)\b/.test(c)) return 'Entry Level';
  return 'Mid-Level';
}

function extractLinks(content: string): string[] {
  const found = new Set<string>();
  const fullUrl = /https?:\/\/(?:www\.)?(?:github\.com|linkedin\.com|gitlab\.com|[\w-]+\.github\.io)\/[\w\-./~?=&%#]*/gi;
  const bareGithub = /(?<!\/)github\.com\/[\w-]+(?:\/[\w-]+)?/gi;
  let m: RegExpExecArray | null;
  while ((m = fullUrl.exec(content)) !== null) found.add(m[0].replace(/[.,;)\]]+$/, ''));
  while ((m = bareGithub.exec(content)) !== null) {
    const link = `https://${m[0]}`;
    if (![...found].some(f => f.includes(m![0]))) found.add(link);
  }
  return Array.from(found);
}

function scoreByCriteria(content: string, criteria: string): number {
  const lower = content.toLowerCase();
  const terms = criteria.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
  let score = 0;
  for (const term of terms) {
    let idx = lower.indexOf(term);
    while (idx !== -1) { score += 2; idx = lower.indexOf(term, idx + 1); }
  }
  const contextRe = new RegExp(
    `(experience|expert|proficient|skilled|specialist).{0,80}${criteria.replace(/\s+/g, '\\s+')}|${criteria.replace(/\s+/g, '\\s+')}.{0,80}(experience|expert|proficient|skilled)`,
    'i'
  );
  if (contextRe.test(content)) score += 10;
  return Math.min(10, Math.max(1, Math.round(score / 3)));
}

function detectAIGenerated(content: string): { flagged: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Very high bullet density relative to total lines
  const bulletLines = (content.match(/^[\s•\-*]\s+\w/gm) || []).length;
  const totalLines = content.split('\n').filter(l => l.trim()).length;
  if (totalLines > 10 && bulletLines / totalLines > 0.8) {
    reasons.push('Unusually uniform bullet structure throughout');
  }

  // Technical keyword stuffing
  const techHits = (content.match(/\b(python|java|sql|azure|aws|docker|kubernetes|react|angular|node\.?js|typescript|terraform|devops|agile|scrum)\b/gi) || []).length;
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 100 && techHits / wordCount > 0.06) {
    reasons.push(`High technical keyword density (${techHits} hits in ${wordCount} words)`);
  }

  // Lacks specific quantifiable achievements
  const specifics = (content.match(/\b(\d+%|\$\d+|\d+\s+(?:million|thousand|users?|clients?|team\s+members?|engineers?|servers?|tickets?|incidents?))\b/gi) || []).length;
  if (wordCount > 300 && specifics < 2) {
    reasons.push('Lacks specific metrics or quantifiable accomplishments');
  }

  // AI-typical phrases
  const aiPhrases = [
    /\bpassionate\s+about\s+(?:technology|innovation|delivering|creating|leveraging)\b/i,
    /\bproven\s+track\s+record\b/i,
    /\bteam\s+player\s+with\s+excellent\s+communication\b/i,
    /\bresult[s\-]?(?:driven|oriented)\s+professional\b/i,
    /\bdiverse\s+(?:skill\s+set|background|range\s+of\s+skills)\b/i,
    /\bseamlessly\s+(?:integrat|collaborat|work)\b/i,
    /\bleveraged?\s+(?:my\s+)?(?:expertise|skills|experience)\s+to\b/i,
    /\bexcellent\s+(?:verbal|written|interpersonal)\s+communication\s+skills\b/i,
  ];
  const aiHits = aiPhrases.filter(p => p.test(content)).length;
  if (aiHits >= 3) reasons.push(`Contains ${aiHits} AI-typical generic phrases`);

  return { flagged: reasons.length >= 2, reasons };
}

const QUESTION_BANK: Record<string, string[]> = {
  python: [
    'Walk me through a complex Python project you built end-to-end.',
    'How do you handle memory management and performance optimization in Python?',
    'What is your experience with async programming in Python (asyncio / aiohttp)?',
  ],
  java: [
    'Explain the difference between abstract classes and interfaces in Java.',
    'How have you used Java Streams and Lambdas in production?',
    'Describe your experience with Spring Boot and dependency injection.',
  ],
  kubernetes: [
    'Walk through a Kubernetes deployment you architected from scratch.',
    'How do you handle pod scaling and resource limits under heavy load?',
    'Describe a time a Kubernetes cluster failed in production and how you resolved it.',
  ],
  docker: [
    'How do you structure a multi-stage Docker build for production?',
    'What is your approach to container security hardening?',
    'Describe your experience using Docker Compose for local dev environments.',
  ],
  aws: [
    'Which AWS services have you used most, and what problems did they solve?',
    'How have you implemented infrastructure-as-code on AWS (CDK / CloudFormation / Terraform)?',
    'Describe an AWS architecture you designed for high-traffic workloads.',
  ],
  azure: [
    'Which Azure services have you worked with, and what problems did they solve?',
    'How have you implemented CI/CD using Azure DevOps?',
    'Describe your experience with Azure AD and role-based access control.',
  ],
  sql: [
    'What query optimization strategies have you applied to large datasets?',
    'Explain your indexing strategy and when you choose specific index types.',
    'Describe a complex stored procedure or view you wrote in a recent project.',
  ],
  react: [
    'How do you manage state in a large React application?',
    'What performance optimizations have you applied (memoization, code splitting, virtualization)?',
    'How do you approach testing React components?',
  ],
  typescript: [
    'How have you used TypeScript generics or advanced types in real projects?',
    'Describe a scenario where TypeScript caught a bug before runtime.',
    'How do you configure and enforce TypeScript strictness across a team?',
  ],
  devops: [
    'Walk through a CI/CD pipeline you designed from scratch.',
    'How have you implemented blue-green or canary deployments?',
    'Describe how you approach infrastructure observability (logging, metrics, alerts).',
  ],
  terraform: [
    'How do you manage Terraform state across multiple environments?',
    'Describe your module structure for a production Terraform codebase.',
    'How do you handle secrets and sensitive variables in Terraform?',
  ],
};

// ─── Response generators ──────────────────────────────────────────────────────

export function generateActionResponse(
  action: ActionQuery,
  results: SearchResult[],
  query: string,
): string {
  const top = results.slice(0, action.targetCount ?? 10);

  switch (action.type) {
    case 'draft_email': {
      if (top.length === 0) return 'No candidates found to draft emails for.';
      const role = action.role || query.match(/for\s+(?:the\s+)?([a-zA-Z\s]+?)\s+(?:role|position)\b/i)?.[1] || 'the open position';
      const lines: string[] = [`**Interview Invitation Emails — Top ${top.length} Candidate${top.length > 1 ? 's' : ''}**\n`];

      top.forEach((r, i) => {
        const name = candidateName(r);
        const firstName = name.split(' ')[0];
        const highlightSkills = r.skills?.slice(0, 2).join(' and ') || 'your relevant background';
        lines.push(`---\n**Candidate ${i + 1}: ${name}**\n`);
        lines.push(`Subject: Interview Invitation — ${role.charAt(0).toUpperCase() + role.slice(1)} Opportunity\n`);
        lines.push(`Dear ${firstName},\n`);
        lines.push(
          `Thank you for your interest in the ${role} role at Humango Solutions. ` +
          `After reviewing your resume, your experience with ${highlightSkills} stood out as a strong match for what our team is looking for.\n`
        );
        lines.push(
          `We would like to invite you to a brief video interview with our hiring team to learn more about your background and share details about this opportunity. ` +
          `Please reply with your availability over the next week and we will send a calendar invitation.\n`
        );
        lines.push(`We look forward to speaking with you.\n\nBest regards,\nHumango Solutions — Talent Acquisition\n`);
      });
      return lines.join('\n');
    }

    case 'summarize': {
      if (results.length === 0) return 'No candidate found to summarize.';
      const r = results[0];
      const name = candidateName(r);
      const level = experienceLevel(r);
      const topSkills = r.skills?.slice(0, 5) || [];
      const certs = r.certifications?.slice(0, 3) || [];
      const snippet = r.matchedSnippets?.[0] || '';

      const lines: string[] = [`**Candidate Summary: ${name}**\n`];
      lines.push(`**Experience Level:** ${level}`);
      if (topSkills.length > 0) lines.push(`**Top Skills:** ${topSkills.join(', ')}`);
      if (certs.length > 0) lines.push(`**Certifications:** ${certs.join(', ')}`);

      lines.push(`\n**Strengths:**`);
      if (r.matchReasons && r.matchReasons.length > 0) {
        r.matchReasons.slice(0, 3).forEach(mr => lines.push(`• ${mr.label}`));
      }
      if (topSkills.length > 0 && !r.matchReasons?.length) {
        lines.push(`• Proficiency in ${topSkills.slice(0, 3).join(', ')}`);
      }
      if (certs.length > 0) lines.push(`• Holds ${certs.length} relevant certification${certs.length > 1 ? 's' : ''}`);

      lines.push(`\n**Potential Red Flags:**`);
      const content = r.content_text || '';
      const hasGapLang = /\b(gap|unemployed|career\s+break|between\s+jobs)\b/i.test(content);
      const hasVisa = /\b(visa\s+sponsorship|h1b|h-1b|work\s+authorization\s+required|will\s+require\s+sponsorship)\b/i.test(content);
      if (hasGapLang) lines.push(`• Resume may reference an employment gap`);
      if (hasVisa) lines.push(`• Candidate may require visa sponsorship`);
      if (!hasGapLang && !hasVisa) lines.push(`• No significant red flags detected in available resume text`);

      if (snippet) {
        lines.push(`\n**Relevant Excerpt:**\n> ${snippet.length > 300 ? snippet.slice(0, 300) + '...' : snippet}`);
      }
      return lines.join('\n');
    }

    case 'extract_links': {
      if (results.length === 0) return 'No candidates found to extract links from.';
      const lines: string[] = [`**Portfolio & GitHub Links — ${results.length} Candidate${results.length > 1 ? 's' : ''}**\n`];
      let found = 0;
      for (const r of results) {
        const links = extractLinks(r.content_text || '');
        if (links.length > 0) {
          found++;
          lines.push(`**${candidateName(r)}**`);
          links.forEach(l => lines.push(`• ${l}`));
          lines.push('');
        }
      }
      if (found === 0) {
        lines.push('No GitHub or portfolio links were found in the resume text of the candidates above.');
      }
      return lines.join('\n');
    }

    case 'generate_questions': {
      if (results.length === 0) return 'No candidate found to generate questions for.';
      const r = results[0];
      const name = candidateName(r);
      const topSkills = r.skills?.slice(0, 6) || [];
      const lines: string[] = [`**Tailored Interview Questions — ${name}**\n`];
      const covered = new Set<string>();

      for (const skill of topSkills) {
        for (const [key, questions] of Object.entries(QUESTION_BANK)) {
          if (skill.toLowerCase().includes(key) && !covered.has(key)) {
            covered.add(key);
            lines.push(`**${skill}:**`);
            questions.slice(0, 2).forEach((q, i) => lines.push(`${i + 1}. ${q}`));
            lines.push('');
            if (covered.size >= 3) break;
          }
        }
        if (covered.size >= 3) break;
      }

      lines.push(`**Behavioral / General:**`);
      lines.push(`1. Describe the most technically challenging project in your recent experience and how you worked through it.`);
      lines.push(`2. Tell me about a time you had to learn a new technology quickly. How did you approach it?`);
      lines.push(`3. How do you stay current with developments in your field?`);
      return lines.join('\n');
    }

    case 'flag_ai_generated': {
      if (results.length === 0) return 'No resumes found to analyze.';
      const lines: string[] = [`**AI Content Analysis — ${results.length} Resume${results.length > 1 ? 's' : ''}**\n`];
      let flaggedCount = 0;

      for (const r of results) {
        const name = candidateName(r);
        const { flagged, reasons } = detectAIGenerated(r.content_text || '');
        if (flagged) {
          flaggedCount++;
          lines.push(`**⚑ ${name}** — Likely AI-assisted or keyword-stuffed`);
          reasons.forEach(reason => lines.push(`  • ${reason}`));
          lines.push('');
        }
      }

      if (flaggedCount === 0) {
        lines.push('No resumes in the current pool showed strong indicators of AI generation or keyword stuffing. That said, manual review is always recommended for borderline cases.');
      } else {
        lines.push(`---\n**${flaggedCount} of ${results.length}** resume${flaggedCount > 1 ? 's' : ''} flagged. Consider adding targeted screening questions for these candidates to verify claimed experience.`);
      }
      return lines.join('\n');
    }

    case 'compare_top2': {
      if (results.length < 2) {
        return results.length === 0
          ? 'No candidates found to compare.'
          : `Only one candidate matched — ${candidateName(results[0])}. A side-by-side comparison requires at least two results.`;
      }
      const [a, b] = results;
      const nameA = candidateName(a);
      const nameB = candidateName(b);
      const criteria = action.criteria || 'overall fit';
      const lines: string[] = [`**Side-by-Side Comparison: ${nameA} vs. ${nameB}**\n`];

      lines.push(`| | **${nameA}** | **${nameB}** |`);
      lines.push(`|---|---|---|`);
      lines.push(`| **Experience Level** | ${experienceLevel(a)} | ${experienceLevel(b)} |`);
      lines.push(`| **Top Skills** | ${(a.skills?.slice(0, 3) || []).join(', ') || '—'} | ${(b.skills?.slice(0, 3) || []).join(', ') || '—'} |`);
      lines.push(`| **Certifications** | ${(a.certifications?.slice(0, 3) || []).join(', ') || 'None listed'} | ${(b.certifications?.slice(0, 3) || []).join(', ') || 'None listed'} |`);
      lines.push(`| **Cert Count** | ${a.certifications?.length ?? 0} | ${b.certifications?.length ?? 0} |`);
      lines.push(`| **Skill Count** | ${a.skills?.length ?? 0} | ${b.skills?.length ?? 0} |`);

      if (criteria && criteria !== 'overall fit') {
        const sA = scoreByCriteria(a.content_text || '', criteria);
        const sB = scoreByCriteria(b.content_text || '', criteria);
        lines.push(`| **${criteria} fit (1–10)** | ${sA} | ${sB} |`);
      }

      const totalA = (a as any).totalScore ?? 0;
      const totalB = (b as any).totalScore ?? 0;
      const stronger = totalA >= totalB ? nameA : nameB;
      lines.push(`\n**Verdict:** Based on available resume data, **${stronger}** presents the stronger overall profile for this search. Both candidates are worth considering depending on additional context gathered during interviews.`);
      return lines.join('\n');
    }

    case 'score_candidates': {
      if (results.length === 0) return 'No candidates found to score.';
      const criteria = action.criteria || 'overall fit';
      const lines: string[] = [`**Candidate Scores — Criteria: "${criteria}"**\n`];

      const scored = results.slice(0, 10)
        .map(r => ({ name: candidateName(r), score: scoreByCriteria(r.content_text || '', criteria), skills: r.skills?.slice(0, 3) || [] }))
        .sort((a, b) => b.score - a.score);

      scored.forEach((s, i) => {
        const filled = Math.round(s.score);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        lines.push(`**${i + 1}. ${s.name}** — ${s.score}/10`);
        lines.push(`\`[${bar}]\``);
        if (s.skills.length > 0) lines.push(`Key skills: ${s.skills.join(', ')}`);
        lines.push('');
      });
      return lines.join('\n');
    }

    default:
      return 'Action not recognized.';
  }
}
