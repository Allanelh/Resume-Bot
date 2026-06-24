export interface DegreeRequirements {
  any: boolean;
  highSchool: boolean;
  associate: boolean;
  bachelor: boolean;
  master: boolean;
  phd: boolean;
  excludeAssociate?: boolean;
  excludeMaster?: boolean;
  specificMajor?: string;
  specificField?: string;
  requireGPA?: boolean; // must have a GPA explicitly stated
}

export interface CertificationRequirements {
  general: string[];
  specific: string[];
  inProgress?: string[];       // certs being studied for
  excludeFoundational?: boolean; // exclude AWS CP, AZ-900, etc.
  vendors?: string[];           // broad vendor requests like "any AWS cert", "Cisco certified"
}

export interface InstitutionRequirements {
  type?: 'ivy_league' | 'state_university' | 'public' | 'private' | 'community_college' | 'trade_school' | 'liberal_arts' | 'technical_institute' | 'international' | 'bootcamp';
  specificName?: string;
}

export interface ExperienceRequirements {
  minYears: number;
  maxYears?: number;
  seniority?: 'entry_level' | 'mid_level' | 'senior' | 'executive' | 'intern' | 'manager' | 'director' | 'freelance' | 'military';
  specificCompany?: string;
  specificRole?: string;
  industry?: string;
  clearance?: 'secret' | 'top_secret' | 'ts_sci' | 'ts_eligible' | 'any';
  requireClearanceSnippet?: boolean; // must have exact text explaining clearance
  actionVerbs?: string[];          // e.g. ['built', 'deployed', 'led']
  excludeActionVerbs?: string[];   // skip if only these verbs appear
  currentlyEmployedAs?: string;
  excludeManagement?: boolean;
  excludeVisaSponsorship?: boolean;
  recentlyUpdatedDays?: number;    // indexed_at within N days
  careerTransitionFrom?: string[]; // from unrelated fields
}

export interface SkillRequirements {
  required: string[];
  fields: string[];
  orGroups?: string[][];   // ANY one from each group (OR logic)
  excluded?: string[];     // hard-exclude if resume mentions these
  fileType?: 'docx' | 'pdf' | 'any';
  excludeFileType?: 'docx' | 'pdf'; // exclude a specific file type
  showUnreadable?: boolean;
  flagUnreadable?: boolean;        // flag scanned PDFs separately, don't exclude
  topN?: number;
  topNSkill?: string;
  requireGitHub?: boolean;
  preferTitleMatch?: boolean;      // rank exact title matches higher
  requireNot?: string[];           // skills that must NOT appear
}

export interface SemanticRequirements {
  leadershipWithoutTitle?: boolean;  // team leadership language without formal "Manager" title
  greenfield?: boolean;              // "built from scratch" indicators
  handsOnTech?: boolean;             // hands-on technical action verb density
  fastPaced?: boolean;               // startup / fast-paced / high-pressure environment
  customerEscalation?: boolean;      // dealing with difficult clients / escalations
  promotedInPlace?: boolean;         // promoted within same company
  studiedWhileWorking?: boolean;     // balanced full-time work while completing degree
  excludeCurrentlyEnrolled?: boolean; // exclude still-in-school candidates
  exactTitle?: string;               // require exact job title match
  detectAIGenerated?: boolean;       // heuristic AI-content analysis pass-through
  rankByCertCount?: boolean;         // sort results by total certification count
  excludeFrontendOnly?: boolean;     // exclude candidates with purely front-end background
  purelyFrontend?: boolean;          // for internal matching: resume appears front-end only
}

export interface ParsedQuery {
  degrees: DegreeRequirements;
  certifications: CertificationRequirements;
  institutions: InstitutionRequirements;
  experience: ExperienceRequirements;
  skills: SkillRequirements;
  semantic: SemanticRequirements;
  isCompound: boolean;
}

type SynonymGroup = {
  primary: string;
  variants: string[];
  pattern?: RegExp;
};

const DEGREE_SYNONYMS: SynonymGroup[] = [
  {
    primary: 'Bachelor of Science',
    variants: ['b.s.', 'bs', 'b.sc.', 'bachelor of science', 'bachelors of science'],
    pattern: /\b(b\.s\.|bs|b\.sc\.|bachelor'?s?\s+of\s+science)\b/i
  },
  {
    primary: 'Bachelor of Arts',
    variants: ['b.a.', 'ba', 'bachelor of arts', 'bachelors of arts'],
    pattern: /\b(b\.a\.|ba|bachelor'?s?\s+of\s+arts)\b/i
  },
  {
    primary: 'Master of Science',
    variants: ['m.s.', 'ms', 'master of science', 'masters of science'],
    pattern: /\b(m\.s\.|ms|master'?s?\s+of\s+science)\b/i
  },
  {
    primary: 'MBA',
    variants: ['mba', 'm.b.a.', 'master of business administration', 'masters of business administration'],
    pattern: /\b(mba|m\.b\.a\.|master'?s?\s+of\s+business\s+administration)\b/i
  },
  {
    primary: 'PhD',
    variants: ['ph.d.', 'phd', 'doctorate', 'doctor of philosophy', 'doctoral'],
    pattern: /\b(ph\.?d\.?|doctorate|doctoral|doctor\s+of\s+philosophy)\b/i
  },
  {
    primary: 'Associate Degree',
    variants: ['assoc.', 'a.a.', 'a.s.', "associate's degree", 'associate of arts', 'associate of science', 'aa', 'as'],
    pattern: /\b(assoc\.?|a\.a\.|a\.s\.|associate'?s?\s+degree|associate\s+of\s+(arts|science)|aa|as)\b/i
  },
  {
    primary: 'GED',
    variants: ['ged', 'general educational development', 'high school equivalency'],
    pattern: /\b(ged|general\s+educational\s+development|high\s+school\s+equivalency)\b/i
  },
];

const CERTIFICATION_SYNONYMS: SynonymGroup[] = [
  // ── CompTIA ───────────────────────────────────────────────────────────────────
  { primary: 'CompTIA A+', variants: ['comptia a+', 'a+ certification', 'comptia a plus'], pattern: /\b(comptia\s+a\s*\+|a\s*\+\s+certif|comptia\s+a\s+plus)\b/i },
  { primary: 'CompTIA Network+', variants: ['comptia network+', 'network+', 'net+', 'comptia net+', 'comptia network plus'], pattern: /\b(comptia\s+net(work)?\s*\+|net(work)?\s*\+)\b/i },
  { primary: 'CompTIA Security+', variants: ['comptia security+', 'security+', 'sec+', 'comptia sec+', 'comptia security plus'], pattern: /\b(comptia\s+sec(urity)?\s*\+|sec(urity)?\s*\+)\b/i },
  { primary: 'CompTIA Linux+', variants: ['comptia linux+', 'linux+', 'comptia linux plus'], pattern: /\b(comptia\s+linux\s*\+|linux\s*\+)\b/i },
  { primary: 'CompTIA Cloud+', variants: ['comptia cloud+', 'cloud+', 'comptia cloud plus'], pattern: /\b(comptia\s+cloud\s*\+|cloud\s*\+)\b/i },
  { primary: 'CompTIA PenTest+', variants: ['comptia pentest+', 'pentest+', 'comptia pentest plus'], pattern: /\b(comptia\s+pentest\s*\+|pentest\s*\+)\b/i },
  { primary: 'CompTIA CySA+', variants: ['comptia cysa+', 'cysa+', 'cysa', 'comptia cybersecurity analyst', 'comptia cysa plus'], pattern: /\b(comptia\s+cysa\s*\+?|cysa\s*\+)\b/i },
  { primary: 'CompTIA CASP+', variants: ['comptia casp+', 'casp+', 'casp', 'comptia advanced security practitioner'], pattern: /\b(comptia\s+casp\s*\+?|casp\s*\+?)\b/i },
  { primary: 'CompTIA Server+', variants: ['comptia server+', 'server+', 'server plus'], pattern: /\b(comptia\s+server\s*\+|server\s*\+)\b/i },
  { primary: 'CompTIA ITF+', variants: ['comptia itf+', 'itf+', 'comptia it fundamentals', 'it fundamentals+'], pattern: /\b(comptia\s+itf\s*\+|itf\s*\+|comptia\s+it\s+fundamentals)\b/i },
  { primary: 'CompTIA Project+', variants: ['comptia project+', 'project+', 'comptia project plus'], pattern: /\b(comptia\s+project\s*\+|project\s*\+)\b/i },
  { primary: 'CompTIA Data+', variants: ['comptia data+', 'data+', 'comptia data plus', 'comptia datasys+', 'datasys+'], pattern: /\b(comptia\s+data\s*\+|data\s*\+|datasys\s*\+)\b/i },
  // ── ISC2 ──────────────────────────────────────────────────────────────────────
  { primary: 'CISSP', variants: ['cissp', 'certified information systems security professional', 'isc2 cissp'], pattern: /\b(cissp|certified\s+information\s+systems\s+security\s+professional)\b/i },
  { primary: 'SSCP', variants: ['sscp', 'systems security certified practitioner'], pattern: /\b(sscp|systems\s+security\s+certified\s+practitioner)\b/i },
  { primary: 'CCSP', variants: ['ccsp', 'certified cloud security professional', 'isc2 ccsp'], pattern: /\b(ccsp|certified\s+cloud\s+security\s+professional)\b/i },
  { primary: 'CAP', variants: ['cap', 'certified authorization professional', 'isc2 cap'], pattern: /\b(cap\b|certified\s+authorization\s+professional)\b/i },
  { primary: 'CSSLP', variants: ['csslp', 'certified secure software lifecycle professional'], pattern: /\b(csslp|certified\s+secure\s+software\s+lifecycle\s+professional)\b/i },
  { primary: 'HCISPP', variants: ['hcispp', 'healthcare information security and privacy practitioner'], pattern: /\b(hcispp|healthcare\s+information\s+security\s+and\s+privacy\s+practitioner)\b/i },
  { primary: 'ISSAP', variants: ['issap', 'information systems security architecture professional'], pattern: /\b(issap|information\s+systems\s+security\s+architecture\s+professional)\b/i },
  { primary: 'ISSEP', variants: ['issep', 'information systems security engineering professional'], pattern: /\b(issep|information\s+systems\s+security\s+engineering\s+professional)\b/i },
  { primary: 'ISSMP', variants: ['issmp', 'information systems security management professional'], pattern: /\b(issmp|information\s+systems\s+security\s+management\s+professional)\b/i },
  { primary: 'CC (ISC2)', variants: ['isc2 cc', 'certified in cybersecurity', 'cc isc2'], pattern: /\b(certified\s+in\s+cybersecurity|isc2\s+cc)\b/i },
  // ── ISACA ─────────────────────────────────────────────────────────────────────
  { primary: 'CISA', variants: ['cisa', 'certified information systems auditor', 'isaca cisa'], pattern: /\b(cisa|certified\s+information\s+systems\s+auditor)\b/i },
  { primary: 'CISM', variants: ['cism', 'certified information security manager', 'isaca cism'], pattern: /\b(cism|certified\s+information\s+security\s+manager)\b/i },
  { primary: 'CRISC', variants: ['crisc', 'certified in risk and information systems control', 'isaca crisc'], pattern: /\b(crisc|certified\s+in\s+risk\s+and\s+information\s+systems\s+control)\b/i },
  { primary: 'CGEIT', variants: ['cgeit', 'certified in the governance of enterprise it', 'isaca cgeit'], pattern: /\b(cgeit|certified\s+in\s+the\s+governance\s+of\s+enterprise\s+it)\b/i },
  { primary: 'CDPSE', variants: ['cdpse', 'certified data privacy solutions engineer', 'isaca cdpse'], pattern: /\b(cdpse|certified\s+data\s+privacy\s+solutions\s+engineer)\b/i },
  // ── Cisco ─────────────────────────────────────────────────────────────────────
  { primary: 'CCNA', variants: ['ccna', 'cisco certified network associate', 'cisco ccna', 'ccna routing and switching', 'ccna collaboration', 'ccna industrial', 'ccna security'], pattern: /\b(ccna(\s+(routing\s+and\s+switching|collaboration|industrial|security))?|cisco\s+certified\s+network\s+associate)\b/i },
  { primary: 'CCNA Routing and Switching', variants: ['ccna routing and switching', 'ccna r&s', 'ccna rs'], pattern: /\b(ccna\s+routing\s+and\s+switching|ccna\s+r&s)\b/i },
  { primary: 'CCNA Collaboration', variants: ['ccna collaboration', 'cisco ccna collaboration'], pattern: /\b(ccna\s+collaboration)\b/i },
  { primary: 'CCNA Industrial', variants: ['ccna industrial', 'cisco ccna industrial'], pattern: /\b(ccna\s+industrial)\b/i },
  { primary: 'CCNA Security', variants: ['ccna security', 'cisco ccna security'], pattern: /\b(ccna\s+security)\b/i },
  { primary: 'CCNP', variants: ['ccnp', 'cisco certified network professional', 'cisco ccnp', 'ccnp enterprise', 'ccnp security', 'ccnp data center', 'ccnp collaboration', 'ccnp routing and switching', 'ccnp rs'], pattern: /\b(ccnp(\s+(enterprise|security|data\s+center|collaboration|routing\s+and\s+switching))?|cisco\s+certified\s+network\s+professional)\b/i },
  { primary: 'CCNP Routing and Switching', variants: ['ccnp routing and switching', 'ccnp r&s', 'ccnp rs'], pattern: /\b(ccnp\s+routing\s+and\s+switching|ccnp\s+r&s)\b/i },
  { primary: 'CCENT', variants: ['ccent', 'cisco certified entry networking technician', 'cisco entry networking'], pattern: /\b(ccent|cisco\s+certified\s+entry\s+networking\s+technician)\b/i },
  { primary: 'CCST Networking', variants: ['ccst networking', 'cisco certified support technician networking', 'ccst-networking'], pattern: /\b(ccst\s+networking|cisco\s+certified\s+support\s+technician\s+networking)\b/i },
  { primary: 'CCST Cybersecurity', variants: ['ccst cybersecurity', 'cisco certified support technician cybersecurity', 'ccst-cybersecurity'], pattern: /\b(ccst\s+cybersecurity|cisco\s+certified\s+support\s+technician\s+cybersecurity)\b/i },
  { primary: 'Cisco Certified Specialist', variants: ['cisco certified specialist', 'cisco specialist'], pattern: /\b(cisco\s+certified\s+specialist)\b/i },
  { primary: 'CCIE', variants: ['ccie', 'cisco certified internetwork expert', 'cisco ccie'], pattern: /\b(ccie|cisco\s+certified\s+internetwork\s+expert)\b/i },
  { primary: 'Cisco CyberOps Associate', variants: ['cisco cyberops associate', 'cisco certified cyberops associate', 'cyberops associate'], pattern: /\b(cisco\s+(certified\s+)?cyberops\s+associate|cyberops\s+associate)\b/i },
  { primary: 'Cisco DevNet Associate', variants: ['cisco devnet associate', 'cisco certified devnet associate', 'devnet associate'], pattern: /\b(cisco\s+(certified\s+)?devnet\s+associate|devnet\s+associate)\b/i },
  { primary: 'Cisco DevNet Professional', variants: ['cisco devnet professional', 'cisco certified devnet professional', 'devnet professional'], pattern: /\b(cisco\s+(certified\s+)?devnet\s+professional|devnet\s+professional)\b/i },
  // ── Palo Alto Networks ────────────────────────────────────────────────────────
  { primary: 'PCCSA', variants: ['pccsa', 'palo alto certified cybersecurity associate', 'palo alto pccsa'], pattern: /\b(pccsa|palo\s+alto\s+(networks\s+)?certified\s+cybersecurity\s+associate)\b/i },
  { primary: 'PCNSA', variants: ['pcnsa', 'palo alto networks certified network security administrator', 'palo alto pcnsa'], pattern: /\b(pcnsa|palo\s+alto\s+(networks\s+)?certified\s+network\s+security\s+administrator)\b/i },
  { primary: 'PCNSE', variants: ['pcnse', 'palo alto networks certified network security engineer', 'palo alto pcnse'], pattern: /\b(pcnse|palo\s+alto\s+(networks\s+)?certified\s+network\s+security\s+engineer)\b/i },
  { primary: 'PCSAE', variants: ['pcsae', 'palo alto networks certified security automation engineer', 'palo alto pcsae'], pattern: /\b(pcsae|palo\s+alto\s+(networks\s+)?certified\s+security\s+automation\s+engineer)\b/i },
  { primary: 'Palo Alto ACE', variants: ['palo alto ace', 'accredited configuration engineer', 'palo alto accredited configuration engineer'], pattern: /\b(palo\s+alto\s+(networks\s+)?ace\b|accredited\s+configuration\s+engineer)\b/i },
  // ── Juniper ───────────────────────────────────────────────────────────────────
  { primary: 'JNCIA-Junos', variants: ['jncia-junos', 'jncia junos', 'jncia', 'juniper networks certified internet associate', 'juniper associate'], pattern: /\b(jncia(-junos)?|juniper\s+networks\s+certified\s+internet\s+associate)\b/i },
  // ── AWS ───────────────────────────────────────────────────────────────────────
  { primary: 'AWS Cloud Practitioner', variants: ['aws cloud practitioner', 'aws certified cloud practitioner', 'aws cp', 'cloud practitioner', 'clf-c01', 'clf-c02'], pattern: /\b(aws\s+(certified\s+)?cloud\s+practitioner|aws\s+cp|clf-c0[12])\b/i },
  { primary: 'AWS Solutions Architect Associate', variants: ['aws solutions architect associate', 'aws certified solutions architect associate', 'aws saa', 'saa-c02', 'saa-c03', 'solutions architect associate'], pattern: /\b(aws\s+(certified\s+)?solutions\s+architect\s*[-\u2013]?\s*associate|aws\s+saa|saa-c0[23])\b/i },
  { primary: 'AWS Developer Associate', variants: ['aws developer associate', 'aws certified developer associate', 'dva-c01', 'dva-c02'], pattern: /\b(aws\s+(certified\s+)?developer\s*[-\u2013]?\s*associate|dva-c0[12])\b/i },
  { primary: 'AWS SysOps Administrator', variants: ['aws sysops administrator', 'aws certified sysops administrator', 'soa-c01', 'soa-c02', 'sysops administrator'], pattern: /\b(aws\s+(certified\s+)?sysops\s+administrator|soa-c0[12])\b/i },
  { primary: 'AWS Solutions Architect Professional', variants: ['aws solutions architect professional', 'aws certified solutions architect professional', 'aws sap', 'sap-c01', 'sap-c02'], pattern: /\b(aws\s+(certified\s+)?solutions\s+architect\s*[-\u2013]?\s*professional|aws\s+sap|sap-c0[12])\b/i },
  { primary: 'AWS DevOps Engineer Professional', variants: ['aws devops engineer professional', 'aws certified devops engineer', 'dop-c01', 'dop-c02'], pattern: /\b(aws\s+(certified\s+)?devops\s+engineer\s*[-\u2013]?\s*professional|dop-c0[12])\b/i },
  { primary: 'AWS Advanced Networking Specialty', variants: ['aws advanced networking specialty', 'aws certified advanced networking', 'ans-c00', 'ans-c01'], pattern: /\b(aws\s+(certified\s+)?advanced\s+networking|ans-c0[01])\b/i },
  { primary: 'AWS Data Analytics Specialty', variants: ['aws data analytics specialty', 'aws certified data analytics', 'das-c01'], pattern: /\b(aws\s+(certified\s+)?data\s+analytics|das-c01)\b/i },
  { primary: 'AWS Database Specialty', variants: ['aws database specialty', 'aws certified database', 'dbs-c01'], pattern: /\b(aws\s+(certified\s+)?database\s*[-\u2013]?\s*specialty|dbs-c01)\b/i },
  { primary: 'AWS Machine Learning Specialty', variants: ['aws machine learning specialty', 'aws certified machine learning', 'mls-c01'], pattern: /\b(aws\s+(certified\s+)?machine\s+learning|mls-c01)\b/i },
  { primary: 'AWS Security Specialty', variants: ['aws security specialty', 'aws certified security', 'scs-c01', 'scs-c02'], pattern: /\b(aws\s+(certified\s+)?security\s*[-\u2013]?\s*specialty|scs-c0[12])\b/i },
  { primary: 'AWS Certified AI Practitioner', variants: ['aws certified ai practitioner', 'aws ai practitioner', 'aws ai-p', 'aif-c01'], pattern: /\b(aws\s+(certified\s+)?ai\s+practitioner|aif-c01)\b/i },
  { primary: 'AWS Certified Data Engineer Associate', variants: ['aws certified data engineer associate', 'aws data engineer associate', 'dea-c01'], pattern: /\b(aws\s+(certified\s+)?data\s+engineer\s*[-\u2013]?\s*associate|dea-c01)\b/i },
  { primary: 'AWS Certified Big Data Specialty', variants: ['aws certified big data specialty', 'aws big data specialty', 'aws big data', 'bds-c00'], pattern: /\b(aws\s+(certified\s+)?big\s+data\s*[-\u2013]?\s*specialty|bds-c00)\b/i },
  { primary: 'AWS Certified Machine Learning Engineer Associate', variants: ['aws certified machine learning engineer associate', 'aws machine learning engineer associate', 'mla-c01'], pattern: /\b(aws\s+(certified\s+)?machine\s+learning\s+engineer\s*[-\u2013]?\s*associate|mla-c01)\b/i },
  { primary: 'AWS Certified Generative AI Developer', variants: ['aws certified generative ai developer', 'aws generative ai developer', 'aws gen ai developer'], pattern: /\b(aws\s+(certified\s+)?generative\s+ai\s+developer)\b/i },
  { primary: 'AWS Certified Alexa Skill Builder Specialty', variants: ['aws certified alexa skill builder', 'aws alexa skill builder', 'alexa skill builder specialty'], pattern: /\b(aws\s+(certified\s+)?alexa\s+skill\s+builder)\b/i },
  { primary: 'AWS Certified CloudOps Engineer Associate', variants: ['aws certified cloudops engineer associate', 'aws cloudops engineer', 'aws cloudops'], pattern: /\b(aws\s+(certified\s+)?cloudops\s+engineer)\b/i },
  { primary: 'AWS Certified SAP on AWS Specialty', variants: ['aws certified sap on aws', 'aws sap on aws specialty', 'aws sap specialty', 'pas-c01'], pattern: /\b(aws\s+(certified\s+)?sap\s+on\s+aws|pas-c01)\b/i },
  { primary: 'AWS Partner Accreditation Technical', variants: ['aws partner accreditation technical', 'aws partner accreditation', 'aws technical accreditation'], pattern: /\b(aws\s+partner:?\s+accreditation\s*([-\u2013]\s*)?technical|aws\s+partner\s+accreditation)\b/i },
  { primary: 'AWS Partner Generative AI Essentials', variants: ['aws partner generative ai on aws essentials', 'aws generative ai on aws essentials', 'aws gen ai essentials'], pattern: /\b(aws\s+partner:?\s+generative\s+ai\s+on\s+aws\s+essentials)\b/i },
  { primary: 'AWS GovCloud Essentials', variants: ['aws govcloud us essentials', 'aws govcloud essentials', 'aws govcloud'], pattern: /\b(aws\s+govcloud\s+(\(us\)\s+)?essentials)\b/i },
  { primary: 'AWS Cloud Technical Essentials', variants: ['aws cloud technical essentials', 'aws technical essentials'], pattern: /\b(aws\s+cloud\s+technical\s+essentials)\b/i },
  { primary: 'AWS Machine Learning Foundations', variants: ['aws machine learning foundations', 'aws ml foundations'], pattern: /\b(aws\s+machine\s+learning\s+foundations)\b/i },
  { primary: 'AWS Knowledge Amazon Connect', variants: ['aws knowledge amazon connect communications specialist', 'aws amazon connect specialist', 'amazon connect communications specialist'], pattern: /\b(aws\s+knowledge:?\s+amazon\s+connect|amazon\s+connect\s+communications\s+specialist)\b/i },
  { primary: 'Practical Data Science on AWS', variants: ['practical data science on the aws cloud', 'practical data science aws', 'aws practical data science specialization'], pattern: /\b(practical\s+data\s+science\s+on\s+(the\s+)?aws\s+cloud)\b/i },
  // ── Microsoft / Azure ─────────────────────────────────────────────────────────
  { primary: 'AZ-900', variants: ['az-900', 'az900', 'azure fundamentals', 'microsoft certified azure fundamentals'], pattern: /\b(az-?900|azure\s+fundamentals)\b/i },
  { primary: 'AZ-104', variants: ['az-104', 'az104', 'azure administrator associate', 'microsoft certified azure administrator'], pattern: /\b(az-?104|azure\s+administrator\s+associate)\b/i },
  { primary: 'AZ-204', variants: ['az-204', 'az204', 'azure developer associate', 'microsoft certified azure developer'], pattern: /\b(az-?204|azure\s+developer\s+associate)\b/i },
  { primary: 'AZ-305', variants: ['az-305', 'az305', 'azure solutions architect expert', 'microsoft certified azure solutions architect'], pattern: /\b(az-?305|azure\s+solutions\s+architect\s+expert)\b/i },
  { primary: 'AZ-500', variants: ['az-500', 'az500', 'azure security engineer associate', 'microsoft certified azure security engineer'], pattern: /\b(az-?500|azure\s+security\s+engineer\s+associate)\b/i },
  { primary: 'DP-203', variants: ['dp-203', 'dp203', 'azure data engineer associate', 'microsoft certified azure data engineer'], pattern: /\b(dp-?203|azure\s+data\s+engineer\s+associate)\b/i },
  { primary: 'AI-102', variants: ['ai-102', 'ai102', 'azure ai engineer associate', 'microsoft certified azure ai engineer'], pattern: /\b(ai-?102|azure\s+ai\s+engineer\s+associate)\b/i },
  { primary: 'MS-900', variants: ['ms-900', 'ms900', 'microsoft 365 fundamentals'], pattern: /\b(ms-?900|microsoft\s+365\s+fundamentals)\b/i },
  { primary: 'SC-300', variants: ['sc-300', 'sc300', 'azure identity access administrator', 'microsoft certified identity and access administrator'], pattern: /\b(sc-?300|identity\s+and\s+access\s+administrator)\b/i },
  { primary: 'SC-100', variants: ['sc-100', 'sc100', 'azure cybersecurity architect expert', 'microsoft certified cybersecurity architect'], pattern: /\b(sc-?100|cybersecurity\s+architect\s+expert)\b/i },
  { primary: 'DP-900', variants: ['dp-900', 'dp900', 'azure data fundamentals', 'microsoft certified azure data fundamentals'], pattern: /\b(dp-?900|azure\s+data\s+fundamentals)\b/i },
  { primary: 'DP-300', variants: ['dp-300', 'dp300', 'azure database administrator associate'], pattern: /\b(dp-?300|azure\s+database\s+administrator\s+associate)\b/i },
  { primary: 'DP-100', variants: ['dp-100', 'dp100', 'azure data scientist associate'], pattern: /\b(dp-?100|azure\s+data\s+scientist\s+associate)\b/i },
  { primary: 'PL-300', variants: ['pl-300', 'pl300', 'power bi data analyst', 'microsoft power bi data analyst associate'], pattern: /\b(pl-?300|power\s+bi\s+data\s+analyst)\b/i },
  { primary: 'AI-900', variants: ['ai-900', 'ai900', 'azure ai fundamentals', 'microsoft certified azure ai fundamentals'], pattern: /\b(ai-?900|azure\s+ai\s+fundamentals)\b/i },
  // ── Google Cloud ──────────────────────────────────────────────────────────────
  { primary: 'Google Cloud Digital Leader', variants: ['google cloud digital leader', 'cloud digital leader', 'gcp digital leader'], pattern: /\b(google\s+cloud\s+digital\s+leader|cloud\s+digital\s+leader)\b/i },
  { primary: 'Google Cloud Associate Engineer', variants: ['google cloud associate cloud engineer', 'associate cloud engineer', 'gcp associate', 'ace gcp'], pattern: /\b(google\s+cloud\s+associate\s+cloud\s+engineer|associate\s+cloud\s+engineer)\b/i },
  { primary: 'Google Cloud Professional Architect', variants: ['google cloud professional cloud architect', 'gcp professional architect', 'gcp architect', 'professional cloud architect'], pattern: /\b(google\s+cloud\s+professional\s+cloud\s+architect|professional\s+cloud\s+architect)\b/i },
  { primary: 'Google Cloud Professional Data Engineer', variants: ['google cloud professional data engineer', 'gcp data engineer', 'professional data engineer'], pattern: /\b(google\s+cloud\s+professional\s+data\s+engineer|professional\s+data\s+engineer)\b/i },
  { primary: 'Google Cloud Professional Developer', variants: ['google cloud professional cloud developer', 'gcp developer', 'professional cloud developer'], pattern: /\b(google\s+cloud\s+professional\s+(cloud\s+)?developer)\b/i },
  { primary: 'Google Cloud Professional Network Engineer', variants: ['google cloud professional cloud network engineer', 'gcp network engineer', 'professional cloud network engineer'], pattern: /\b(google\s+cloud\s+professional\s+(cloud\s+)?network\s+engineer)\b/i },
  { primary: 'Google Cloud Professional Security Engineer', variants: ['google cloud professional cloud security engineer', 'gcp security engineer', 'professional cloud security engineer'], pattern: /\b(google\s+cloud\s+professional\s+(cloud\s+)?security\s+engineer)\b/i },
  { primary: 'Google Cloud Professional ML Engineer', variants: ['google cloud professional machine learning engineer', 'gcp ml engineer', 'professional machine learning engineer'], pattern: /\b(google\s+cloud\s+professional\s+(machine\s+learning|ml)\s+engineer)\b/i },
  { primary: 'Google Data Analytics Certificate', variants: ['google data analytics professional certificate', 'google data analytics certificate', 'google data analytics'], pattern: /\b(google\s+data\s+analytics\s+(professional\s+)?certificate)\b/i },
  // ── Offensive Security ────────────────────────────────────────────────────────
  { primary: 'OSCP', variants: ['oscp', 'offensive security certified professional'], pattern: /\b(oscp|offensive\s+security\s+certified\s+professional)\b/i },
  { primary: 'OSWE', variants: ['oswe', 'offensive security web expert'], pattern: /\b(oswe|offensive\s+security\s+web\s+expert)\b/i },
  { primary: 'OSEP', variants: ['osep', 'offensive security experienced penetration tester'], pattern: /\b(osep|offensive\s+security\s+experienced\s+penetration\s+tester)\b/i },
  { primary: 'OSED', variants: ['osed', 'offensive security exploit developer'], pattern: /\b(osed|offensive\s+security\s+exploit\s+developer)\b/i },
  { primary: 'OSWP', variants: ['oswp', 'offensive security wireless professional'], pattern: /\b(oswp|offensive\s+security\s+wireless\s+professional)\b/i },
  // ── EC-Council ────────────────────────────────────────────────────────────────
  { primary: 'CEH', variants: ['ceh', 'certified ethical hacker', 'ec-council ceh'], pattern: /\b(ceh|certified\s+ethical\s+hacker)\b/i },
  { primary: 'CHFI', variants: ['chfi', 'computer hacking forensic investigator', 'ec-council chfi'], pattern: /\b(chfi|computer\s+hacking\s+forensic\s+investigator)\b/i },
  { primary: 'CND', variants: ['cnd', 'certified network defender'], pattern: /\b(cnd|certified\s+network\s+defender)\b/i },
  { primary: 'CCISO', variants: ['cciso', 'certified chief information security officer', 'ec-council cciso'], pattern: /\b(cciso|certified\s+chief\s+information\s+security\s+officer)\b/i },
  { primary: 'ECSA', variants: ['ecsa', 'ec-council certified security analyst'], pattern: /\b(ecsa|ec-?council\s+certified\s+security\s+analyst)\b/i },
  // ── GIAC / SANS ───────────────────────────────────────────────────────────────
  { primary: 'GSEC', variants: ['gsec', 'giac security essentials'], pattern: /\b(gsec|giac\s+security\s+essentials)\b/i },
  { primary: 'GCIH', variants: ['gcih', 'giac certified incident handler'], pattern: /\b(gcih|giac\s+certified\s+incident\s+handler)\b/i },
  { primary: 'GCIA', variants: ['gcia', 'giac certified intrusion analyst'], pattern: /\b(gcia|giac\s+certified\s+intrusion\s+analyst)\b/i },
  { primary: 'GCFA', variants: ['gcfa', 'giac certified forensic analyst'], pattern: /\b(gcfa|giac\s+certified\s+forensic\s+analyst)\b/i },
  { primary: 'GREM', variants: ['grem', 'giac reverse engineering malware'], pattern: /\b(grem|giac\s+reverse\s+engineering\s+malware)\b/i },
  { primary: 'GPEN', variants: ['gpen', 'giac penetration tester'], pattern: /\b(gpen|giac\s+penetration\s+tester)\b/i },
  { primary: 'GWAPT', variants: ['gwapt', 'giac web application penetration tester'], pattern: /\b(gwapt|giac\s+web\s+application\s+penetration\s+tester)\b/i },
  { primary: 'GSLC', variants: ['gslc', 'giac security leadership'], pattern: /\b(gslc|giac\s+security\s+leadership)\b/i },
  { primary: 'GCFE', variants: ['gcfe', 'giac certified forensic examiner'], pattern: /\b(gcfe|giac\s+certified\s+forensic\s+examiner)\b/i },
  { primary: 'GCED', variants: ['gced', 'giac certified enterprise defender'], pattern: /\b(gced|giac\s+certified\s+enterprise\s+defender)\b/i },
  // ── Red Hat & HashiCorp ───────────────────────────────────────────────────────
  { primary: 'RHCSA', variants: ['rhcsa', 'red hat certified system administrator'], pattern: /\b(rhcsa|red\s+hat\s+certified\s+system\s+administrator)\b/i },
  { primary: 'RHCE', variants: ['rhce', 'red hat certified engineer'], pattern: /\b(rhce|red\s+hat\s+certified\s+engineer)\b/i },
  { primary: 'RHCA', variants: ['rhca', 'red hat certified architect'], pattern: /\b(rhca|red\s+hat\s+certified\s+architect)\b/i },
  { primary: 'Terraform Associate', variants: ['terraform associate', 'hashicorp certified terraform associate', 'hashicorp terraform'], pattern: /\b(hashicorp\s+(certified:?\s+)?terraform\s+associate|terraform\s+associate)\b/i },
  { primary: 'Vault Associate', variants: ['vault associate', 'hashicorp certified vault associate', 'hashicorp vault'], pattern: /\b(hashicorp\s+(certified:?\s+)?vault\s+associate|vault\s+associate)\b/i },
  // ── Kubernetes & Linux Foundation ─────────────────────────────────────────────
  { primary: 'CKA', variants: ['cka', 'certified kubernetes administrator'], pattern: /\b(cka|certified\s+kubernetes\s+administrator)\b/i },
  { primary: 'CKAD', variants: ['ckad', 'certified kubernetes application developer'], pattern: /\b(ckad|certified\s+kubernetes\s+application\s+developer)\b/i },
  { primary: 'CKS', variants: ['cks', 'certified kubernetes security specialist'], pattern: /\b(cks|certified\s+kubernetes\s+security\s+specialist)\b/i },
  { primary: 'LFCA', variants: ['lfca', 'linux foundation certified it associate'], pattern: /\b(lfca|linux\s+foundation\s+certified\s+it\s+associate)\b/i },
  { primary: 'LFCS', variants: ['lfcs', 'linux foundation certified system administrator'], pattern: /\b(lfcs|linux\s+foundation\s+certified\s+system\s+administrator)\b/i },
  { primary: 'LPIC', variants: ['lpic', 'linux professional institute certification', 'lpic-1', 'lpic-2', 'lpic-3'], pattern: /\b(lpic(-[123])?|linux\s+professional\s+institute\s+certif)\b/i },
  // ── VMware, Oracle & Salesforce ───────────────────────────────────────────────
  { primary: 'VCP-DCV', variants: ['vcp-dcv', 'vcp dcv', 'vmware certified professional data center virtualization', 'vmware vcp'], pattern: /\b(vcp-?dcv|vmware\s+certified\s+professional\s*([-\u2013]\s*)?data\s+center\s+virtualization)\b/i },
  { primary: 'VCP-NV', variants: ['vcp-nv', 'vcp nv', 'vmware certified professional network virtualization'], pattern: /\b(vcp-?nv|vmware\s+certified\s+professional\s*([-\u2013]\s*)?network\s+virtualization)\b/i },
  { primary: 'Oracle Java SE 8', variants: ['oracle certified associate java se 8', 'oca java', 'java se 8 programmer', 'oracle java associate'], pattern: /\b(oracle\s+certified\s+associate[,\s]+java\s+se\s+8|oca\s+java|java\s+se\s+8\s+programmer)\b/i },
  { primary: 'Oracle Java SE 11', variants: ['oracle certified professional java se 11', 'ocp java', 'java se 11 developer', 'oracle java professional'], pattern: /\b(oracle\s+certified\s+professional[,\s]+java\s+se\s+11|ocp\s+java|java\s+se\s+11\s+developer)\b/i },
  { primary: 'Salesforce Administrator', variants: ['salesforce certified administrator', 'salesforce admin', 'salesforce administrator certification'], pattern: /\b(salesforce\s+(certified\s+)?administrator)\b/i },
  { primary: 'Salesforce Platform Developer I', variants: ['salesforce certified platform developer i', 'salesforce platform developer', 'salesforce developer i'], pattern: /\b(salesforce\s+(certified\s+)?platform\s+developer\s+i)\b/i },
  { primary: 'Salesforce Marketing Cloud', variants: ['salesforce certified marketing cloud', 'salesforce marketing cloud administrator', 'sfmc'], pattern: /\b(salesforce\s+(certified\s+)?marketing\s+cloud|sfmc)\b/i },
  { primary: 'Salesforce Sales Cloud', variants: ['salesforce certified sales cloud consultant', 'salesforce sales cloud'], pattern: /\b(salesforce\s+(certified\s+)?sales\s+cloud)\b/i },
  // ── ITIL ──────────────────────────────────────────────────────────────────────
  { primary: 'ITIL 4 Foundation', variants: ['itil 4 foundation', 'itil foundation', 'itil v4', 'itil4', 'itil', 'information technology infrastructure library'], pattern: /\b(itil\s*(v?4)?\s*foundation|itil\s*v?4\b|itil\b|information\s+technology\s+infrastructure\s+library)\b/i },
  { primary: 'ITIL 4 Managing Professional', variants: ['itil 4 managing professional', 'itil managing professional'], pattern: /\b(itil\s*4?\s+managing\s+professional)\b/i },
  { primary: 'ITIL 4 CDS', variants: ['itil 4 cds', 'itil cds', 'itil create deliver support'], pattern: /\b(itil\s*4?\s+cds|itil\s*(4\s+)?specialist:?\s+create,?\s+deliver\s+and\s+support)\b/i },
  { primary: 'ITIL 4 DSV', variants: ['itil 4 dsv', 'itil dsv', 'itil drive stakeholder value'], pattern: /\b(itil\s*4?\s+dsv|itil\s*(4\s+)?specialist:?\s+drive\s+stakeholder\s+value)\b/i },
  { primary: 'ITIL v3 Foundation', variants: ['itil v3 foundation', 'itil 2011 foundation', 'itil v3', 'itil 2011', 'itil version 3'], pattern: /\b(itil\s*v3\s*(foundation)?|itil\s*2011(\s+foundation)?|itil\s+version\s+3)\b/i },
  { primary: 'ITIL v2', variants: ['itil v2', 'itil version 2', 'itil 2'], pattern: /\b(itil\s*v2|itil\s+version\s+2)\b/i },
  // ── PMP & PMI ─────────────────────────────────────────────────────────────────
  { primary: 'PMP', variants: ['pmp', 'project management professional', 'pmi pmp'], pattern: /\b(pmp|project\s+management\s+professional)\b/i },
  { primary: 'CAPM', variants: ['capm', 'certified associate in project management', 'pmi capm'], pattern: /\b(capm|certified\s+associate\s+in\s+project\s+management)\b/i },
  { primary: 'PMI-ACP', variants: ['pmi-acp', 'pmi acp', 'pmi agile certified practitioner'], pattern: /\b(pmi-?acp|pmi\s+agile\s+certified\s+practitioner)\b/i },
  { primary: 'PMI-PBA', variants: ['pmi-pba', 'pmi pba', 'pmi professional in business analysis'], pattern: /\b(pmi-?pba|pmi\s+professional\s+in\s+business\s+analysis)\b/i },
  { primary: 'PgMP', variants: ['pgmp', 'program management professional', 'pmi pgmp'], pattern: /\b(pgmp|program\s+management\s+professional)\b/i },
  { primary: 'PfMP', variants: ['pfmp', 'portfolio management professional', 'pmi pfmp'], pattern: /\b(pfmp|portfolio\s+management\s+professional)\b/i },
  { primary: 'PMI-RMP', variants: ['pmi-rmp', 'pmi rmp', 'pmi risk management professional'], pattern: /\b(pmi-?rmp|pmi\s+risk\s+management\s+professional)\b/i },
  // ── Scrum Alliance ────────────────────────────────────────────────────────────
  { primary: 'CSM', variants: ['csm', 'certified scrummaster', 'certified scrum master'], pattern: /\b(csm|certified\s+scrum\s*master)\b/i },
  { primary: 'A-CSM', variants: ['a-csm', 'acsm', 'advanced certified scrummaster', 'advanced certified scrum master'], pattern: /\b(a-?csm|advanced\s+certified\s+scrum\s*master)\b/i },
  { primary: 'CSPO', variants: ['cspo', 'certified scrum product owner'], pattern: /\b(cspo|certified\s+scrum\s+product\s+owner)\b/i },
  { primary: 'A-CSPO', variants: ['a-cspo', 'acspo', 'advanced certified scrum product owner'], pattern: /\b(a-?cspo|advanced\s+certified\s+scrum\s+product\s+owner)\b/i },
  { primary: 'CSD', variants: ['csd', 'certified scrum developer'], pattern: /\b(csd|certified\s+scrum\s+developer)\b/i },
  // ── Scrum.org ─────────────────────────────────────────────────────────────────
  { primary: 'PSM I', variants: ['psm i', 'psm1', 'professional scrum master i', 'professional scrum master 1'], pattern: /\b(psm\s*(i|1)|professional\s+scrum\s+master\s*(i|1))\b/i },
  { primary: 'PSM II', variants: ['psm ii', 'psm2', 'professional scrum master ii'], pattern: /\b(psm\s*(ii|2)|professional\s+scrum\s+master\s*(ii|2))\b/i },
  { primary: 'PSM III', variants: ['psm iii', 'psm3', 'professional scrum master iii'], pattern: /\b(psm\s*(iii|3)|professional\s+scrum\s+master\s*(iii|3))\b/i },
  { primary: 'PSPO I', variants: ['pspo i', 'pspo1', 'professional scrum product owner i'], pattern: /\b(pspo\s*(i|1)|professional\s+scrum\s+product\s+owner\s*(i|1))\b/i },
  { primary: 'PSPO II', variants: ['pspo ii', 'pspo2', 'professional scrum product owner ii'], pattern: /\b(pspo\s*(ii|2)|professional\s+scrum\s+product\s+owner\s*(ii|2))\b/i },
  { primary: 'PSD', variants: ['psd', 'professional scrum developer'], pattern: /\b(psd|professional\s+scrum\s+developer)\b/i },
  { primary: 'SPS', variants: ['sps', 'scaled professional scrum'], pattern: /\b(sps|scaled\s+professional\s+scrum)\b/i },
  { primary: 'PSK', variants: ['psk', 'professional scrum with kanban'], pattern: /\b(psk|professional\s+scrum\s+with\s+kanban)\b/i },
  // ── SAFe ──────────────────────────────────────────────────────────────────────
  { primary: 'SAFe Agilist', variants: ['safe agilist', 'safe', 'sa safe', 'scaled agile framework agilist', 'scaled agile'], pattern: /\b(safe\s+agilist|safe\b|scaled\s+agile(\s+framework(\s+agilist)?)?)\b/i },
  { primary: 'SAFe Scrum Master', variants: ['safe scrum master', 'ssm safe', 'safe ssm'], pattern: /\b(safe\s+scrum\s+master|ssm\s+safe|safe\s+ssm)\b/i },
  { primary: 'SAFe Advanced Scrum Master', variants: ['safe advanced scrum master', 'sasm', 'safe sasm'], pattern: /\b(sasm|safe\s+(advanced\s+)?scrum\s+master)\b/i },
  { primary: 'SAFe RTE', variants: ['safe rte', 'rte safe', 'safe release train engineer', 'release train engineer'], pattern: /\b(safe\s+rte|rte\s+safe|safe\s+release\s+train\s+engineer|release\s+train\s+engineer)\b/i },
  { primary: 'SAFe POPM', variants: ['safe popm', 'popm safe', 'safe product owner product manager'], pattern: /\b(safe\s+popm|popm\s+safe|safe\s+product\s+owner\s*[/]\s*product\s+manager)\b/i },
  { primary: 'SAFe LPM', variants: ['safe lpm', 'lpm safe', 'safe lean portfolio management'], pattern: /\b(safe\s+lpm|lpm\s+safe|safe\s+lean\s+portfolio\s+management)\b/i },
  { primary: 'SAFe SPC', variants: ['safe spc', 'spc safe', 'safe program consultant'], pattern: /\b(safe\s+spc|spc\s+safe|safe\s+program\s+consultant)\b/i },
  // ── Six Sigma & Quality ───────────────────────────────────────────────────────
  { primary: 'Six Sigma White Belt', variants: ['six sigma white belt', 'csswb'], pattern: /\b(six\s+sigma\s+white\s+belt|csswb)\b/i },
  { primary: 'Six Sigma Yellow Belt', variants: ['six sigma yellow belt', 'cssyb', 'yellow belt six sigma'], pattern: /\b(six\s+sigma\s+yellow\s+belt|cssyb)\b/i },
  { primary: 'Six Sigma Green Belt', variants: ['six sigma green belt', 'cssgb', 'green belt', 'lssgb', 'lean six sigma green belt'], pattern: /\b(six\s+sigma\s+green\s+belt|cssgb|green\s+belt|lssgb|lean\s+six\s+sigma\s+green\s+belt)\b/i },
  { primary: 'Six Sigma Black Belt', variants: ['six sigma black belt', 'cssbb', 'black belt', 'lssbb', 'lean six sigma black belt'], pattern: /\b(six\s+sigma\s+black\s+belt|cssbb|black\s+belt|lssbb|lean\s+six\s+sigma\s+black\s+belt)\b/i },
  { primary: 'Master Black Belt', variants: ['master black belt', 'mbb', 'certified master black belt'], pattern: /\b(master\s+black\s+belt|mbb)\b/i },
  { primary: 'Lean Six Sigma', variants: ['lean six sigma', 'lss', 'iso lean six sigma'], pattern: /\b(lean\s+six\s+sigma|lss)\b/i },
  { primary: 'CQE', variants: ['cqe', 'certified quality engineer'], pattern: /\b(cqe|certified\s+quality\s+engineer)\b/i },
  { primary: 'CQA', variants: ['cqa', 'certified quality auditor'], pattern: /\b(cqa|certified\s+quality\s+auditor)\b/i },
  // ── Business Analysis (IIBA) ──────────────────────────────────────────────────
  { primary: 'CBAP', variants: ['cbap', 'certified business analysis professional', 'iiba cbap'], pattern: /\b(cbap|certified\s+business\s+analysis\s+professional)\b/i },
  { primary: 'CCBA', variants: ['ccba', 'certification of capability in business analysis'], pattern: /\b(ccba|certification\s+of\s+capability\s+in\s+business\s+analysis)\b/i },
  { primary: 'ECBA', variants: ['ecba', 'entry certificate in business analysis'], pattern: /\b(ecba|entry\s+certificate\s+in\s+business\s+analysis)\b/i },
  { primary: 'IIBA-AAC', variants: ['iiba-aac', 'iiba aac', 'agile analysis certification'], pattern: /\b(iiba-?aac|agile\s+analysis\s+certification)\b/i },
  { primary: 'IIBA-CBDA', variants: ['iiba-cbda', 'iiba cbda', 'certification in business data analytics'], pattern: /\b(iiba-?cbda|certification\s+in\s+business\s+data\s+analytics)\b/i },
  // ── PRINCE2 ───────────────────────────────────────────────────────────────────
  { primary: 'PRINCE2 Foundation', variants: ['prince2 foundation', 'prince 2 foundation'], pattern: /\b(prince\s*2\s+foundation)\b/i },
  { primary: 'PRINCE2 Practitioner', variants: ['prince2 practitioner', 'prince 2 practitioner', 'prince2'], pattern: /\b(prince\s*2\s+practitioner|prince\s*2)\b/i },
  { primary: 'PRINCE2 Agile', variants: ['prince2 agile', 'prince2 agile foundation', 'prince2 agile practitioner'], pattern: /\b(prince\s*2\s+agile)\b/i },
  // ── Data Science & Analytics ──────────────────────────────────────────────────
  { primary: 'Snowflake SnowPro Core', variants: ['snowflake snowpro core', 'snowpro core', 'snowflake certified', 'snowflake core'], pattern: /\b(snowflake\s+snowpro\s+core|snowpro\s+core|snowflake\s+certified)\b/i },
  { primary: 'Databricks Data Engineer', variants: ['databricks certified data engineer', 'databricks data engineer associate', 'databricks data engineer professional'], pattern: /\b(databricks\s+(certified\s+)?data\s+engineer)\b/i },
  { primary: 'Databricks ML Associate', variants: ['databricks certified machine learning associate', 'databricks ml associate'], pattern: /\b(databricks\s+(certified\s+)?machine\s+learning\s+associate|databricks\s+ml\s+associate)\b/i },
  { primary: 'Tableau Desktop Specialist', variants: ['tableau desktop specialist', 'tableau specialist', 'tableau certified'], pattern: /\b(tableau\s+(desktop\s+)?specialist|tableau\s+certified)\b/i },
  { primary: 'Tableau Data Analyst', variants: ['tableau certified data analyst', 'tableau data analyst'], pattern: /\b(tableau\s+(certified\s+)?data\s+analyst)\b/i },
  { primary: 'Splunk Core Certified', variants: ['splunk core certified user', 'splunk certified', 'splunk core', 'splunk enterprise certified'], pattern: /\b(splunk\s+(core\s+)?certified\s+(user|power\s+user|admin|architect)?|splunk\s+enterprise\s+certified)\b/i },
  { primary: 'Kafka CCDAK', variants: ['ccdak', 'confluent certified developer for apache kafka', 'kafka certified developer'], pattern: /\b(ccdak|confluent\s+certified\s+developer\s+for\s+apache\s+kafka)\b/i },
  { primary: 'CDMP', variants: ['cdmp', 'certified data management professional', 'dama cdmp'], pattern: /\b(cdmp|certified\s+data\s+management\s+professional)\b/i },
  { primary: 'SAS Certified', variants: ['sas certified', 'sas base programmer', 'sas advanced programmer', 'sas certified data scientist'], pattern: /\b(sas\s+certified(\s+(base|advanced|data|statistical)\s+\w+)?)\b/i },
  // ── Finance & Accounting ──────────────────────────────────────────────────────
  { primary: 'CPA', variants: ['cpa', 'certified public accountant'], pattern: /\b(cpa|certified\s+public\s+accountant)\b/i },
  { primary: 'CMA', variants: ['cma', 'certified management accountant'], pattern: /\b(cma|certified\s+management\s+accountant)\b/i },
  { primary: 'CIA', variants: ['cia', 'certified internal auditor'], pattern: /\b(cia|certified\s+internal\s+auditor)\b/i },
  { primary: 'CFA', variants: ['cfa', 'chartered financial analyst'], pattern: /\b(cfa|chartered\s+financial\s+analyst)\b/i },
  { primary: 'CFP', variants: ['cfp', 'certified financial planner'], pattern: /\b(cfp|certified\s+financial\s+planner)\b/i },
  { primary: 'FRM', variants: ['frm', 'financial risk manager', 'garp frm'], pattern: /\b(frm|financial\s+risk\s+manager)\b/i },
  { primary: 'CFE', variants: ['cfe', 'certified fraud examiner'], pattern: /\b(cfe|certified\s+fraud\s+examiner)\b/i },
  { primary: 'CAMS', variants: ['cams', 'certified anti-money laundering specialist', 'acams cams'], pattern: /\b(cams|certified\s+anti-?money\s+laundering\s+specialist)\b/i },
  { primary: 'CAIA', variants: ['caia', 'chartered alternative investment analyst'], pattern: /\b(caia|chartered\s+alternative\s+investment\s+analyst)\b/i },
  { primary: 'FMVA', variants: ['fmva', 'financial modeling valuation analyst'], pattern: /\b(fmva|financial\s+modeling\s+(&|and)\s+valuation\s+analyst)\b/i },
  { primary: 'Series 7', variants: ['series 7', 'series-7', 'finra series 7', 'general securities representative'], pattern: /\b(series\s*[-\u2013]?\s*7|general\s+securities\s+representative)\b/i },
  { primary: 'Series 63', variants: ['series 63', 'series-63', 'finra series 63'], pattern: /\b(series\s*[-\u2013]?\s*63)\b/i },
  { primary: 'Series 65', variants: ['series 65', 'series-65', 'finra series 65'], pattern: /\b(series\s*[-\u2013]?\s*65)\b/i },
  { primary: 'Series 66', variants: ['series 66', 'series-66', 'finra series 66'], pattern: /\b(series\s*[-\u2013]?\s*66)\b/i },
  { primary: 'SIE', variants: ['sie', 'securities industry essentials', 'finra sie'], pattern: /\b(sie|securities\s+industry\s+essentials)\b/i },
  // ── HR ────────────────────────────────────────────────────────────────────────
  { primary: 'SHRM-CP', variants: ['shrm-cp', 'shrm cp', 'shrm certified professional'], pattern: /\b(shrm-?cp|shrm\s+certified\s+professional)\b/i },
  { primary: 'SHRM-SCP', variants: ['shrm-scp', 'shrm scp', 'shrm senior certified professional'], pattern: /\b(shrm-?scp|shrm\s+senior\s+certified\s+professional)\b/i },
  { primary: 'PHR', variants: ['phr', 'professional in human resources', 'hrci phr'], pattern: /\b(phr|professional\s+in\s+human\s+resources)\b/i },
  { primary: 'SPHR', variants: ['sphr', 'senior professional in human resources', 'hrci sphr'], pattern: /\b(sphr|senior\s+professional\s+in\s+human\s+resources)\b/i },
  { primary: 'aPHR', variants: ['aphr', 'associate professional in human resources'], pattern: /\b(aphr|associate\s+professional\s+in\s+human\s+resources)\b/i },
  { primary: 'GPHR', variants: ['gphr', 'global professional in human resources'], pattern: /\b(gphr|global\s+professional\s+in\s+human\s+resources)\b/i },
  { primary: 'CCP', variants: ['ccp', 'certified compensation professional'], pattern: /\b(ccp|certified\s+compensation\s+professional)\b/i },
  { primary: 'CPP', variants: ['cpp', 'certified payroll professional'], pattern: /\b(cpp|certified\s+payroll\s+professional)\b/i },
  { primary: 'CPTD', variants: ['cptd', 'certified professional in talent development', 'atd cptd'], pattern: /\b(cptd|certified\s+professional\s+in\s+talent\s+development)\b/i },
  // ── Healthcare ────────────────────────────────────────────────────────────────
  { primary: 'BLS', variants: ['bls', 'basic life support', 'bls certification'], pattern: /\b(bls|basic\s+life\s+support)\b/i },
  { primary: 'ACLS', variants: ['acls', 'advanced cardiovascular life support'], pattern: /\b(acls|advanced\s+cardiovascular\s+life\s+support)\b/i },
  { primary: 'PALS', variants: ['pals', 'pediatric advanced life support'], pattern: /\b(pals|pediatric\s+advanced\s+life\s+support)\b/i },
  { primary: 'CPR', variants: ['cpr', 'cardiopulmonary resuscitation', 'cpr certified', 'cpr aed'], pattern: /\b(cpr|cardiopulmonary\s+resuscitation)\b/i },
  { primary: 'EMT', variants: ['emt', 'emergency medical technician', 'emt-basic'], pattern: /\b(emt(-basic)?|emergency\s+medical\s+technician)\b/i },
  { primary: 'CNA', variants: ['cna', 'certified nursing assistant'], pattern: /\b(cna|certified\s+nursing\s+assistant)\b/i },
  { primary: 'CPC', variants: ['cpc', 'certified professional coder', 'aapc cpc'], pattern: /\b(cpc|certified\s+professional\s+coder)\b/i },
  { primary: 'CCS', variants: ['ccs', 'certified coding specialist', 'ahima ccs'], pattern: /\b(ccs|certified\s+coding\s+specialist)\b/i },
  { primary: 'RHIA', variants: ['rhia', 'registered health information administrator'], pattern: /\b(rhia|registered\s+health\s+information\s+administrator)\b/i },
  { primary: 'RHIT', variants: ['rhit', 'registered health information technician'], pattern: /\b(rhit|registered\s+health\s+information\s+technician)\b/i },
  { primary: 'CPhT', variants: ['cpht', 'certified pharmacy technician', 'ptcb cpht'], pattern: /\b(cpht|certified\s+pharmacy\s+technician)\b/i },
  { primary: 'BCBA', variants: ['bcba', 'board certified behavior analyst'], pattern: /\b(bcba|board\s+certified\s+behavior\s+analyst)\b/i },
  { primary: 'Certified Medical Assistant', variants: ['certified medical assistant', 'cma medical', 'aama cma'], pattern: /\b(certified\s+medical\s+assistant)\b/i },
  // ── Supply Chain & Logistics ──────────────────────────────────────────────────
  { primary: 'CPIM', variants: ['cpim', 'certified in planning and inventory management', 'apics cpim'], pattern: /\b(cpim|certified\s+in\s+planning\s+and\s+inventory\s+management)\b/i },
  { primary: 'CSCP', variants: ['cscp', 'certified supply chain professional', 'apics cscp'], pattern: /\b(cscp|certified\s+supply\s+chain\s+professional)\b/i },
  { primary: 'CLTD', variants: ['cltd', 'certified in logistics transportation and distribution', 'apics cltd'], pattern: /\b(cltd|certified\s+in\s+logistics,?\s+transportation\s+and\s+distribution)\b/i },
  { primary: 'CPSM', variants: ['cpsm', 'certified professional in supply management', 'ism cpsm'], pattern: /\b(cpsm|certified\s+professional\s+in\s+supply\s+management)\b/i },
  { primary: 'CPPO', variants: ['cppo', 'certified public procurement officer'], pattern: /\b(cppo|certified\s+public\s+procurement\s+officer)\b/i },
  { primary: 'CPCM', variants: ['cpcm', 'certified professional contracts manager', 'ncma cpcm'], pattern: /\b(cpcm|certified\s+professional\s+contracts\s+manager)\b/i },
  { primary: 'CFCM', variants: ['cfcm', 'certified federal contracts manager', 'ncma cfcm'], pattern: /\b(cfcm|certified\s+federal\s+contracts\s+manager)\b/i },
  { primary: 'CDL Class A', variants: ['cdl class a', 'cdl-a', 'commercial driver license class a', 'class a cdl'], pattern: /\b(cdl\s*([-\u2013]\s*)?class\s+a|class\s+a\s+cdl|cdl-a)\b/i },
  { primary: 'CDL Class B', variants: ['cdl class b', 'cdl-b', 'commercial driver license class b', 'class b cdl'], pattern: /\b(cdl\s*([-\u2013]\s*)?class\s+b|class\s+b\s+cdl|cdl-b)\b/i },
  // ── Privacy & Legal ───────────────────────────────────────────────────────────
  { primary: 'CIPP/US', variants: ['cipp/us', 'cipp us', 'certified information privacy professional us', 'iapp cipp'], pattern: /\b(cipp\s*\/\s*us|cipp\s+us|certified\s+information\s+privacy\s+professional)\b/i },
  { primary: 'CIPP/E', variants: ['cipp/e', 'cipp e', 'certified information privacy professional europe'], pattern: /\b(cipp\s*\/\s*e|cipp\s+e)\b/i },
  { primary: 'CIPM', variants: ['cipm', 'certified information privacy manager', 'iapp cipm'], pattern: /\b(cipm|certified\s+information\s+privacy\s+manager)\b/i },
  { primary: 'CIPT', variants: ['cipt', 'certified information privacy technologist'], pattern: /\b(cipt|certified\s+information\s+privacy\s+technologist)\b/i },
  { primary: 'CCEP', variants: ['ccep', 'certified compliance and ethics professional', 'scce ccep'], pattern: /\b(ccep|certified\s+compliance\s+(&|and)\s+ethics\s+professional)\b/i },
  { primary: 'CHC', variants: ['chc', 'certified in healthcare compliance'], pattern: /\b(chc|certified\s+in\s+healthcare\s+compliance)\b/i },
  { primary: 'CRCM', variants: ['crcm', 'certified regulatory compliance manager'], pattern: /\b(crcm|certified\s+regulatory\s+compliance\s+manager)\b/i },
  { primary: 'CEDS', variants: ['ceds', 'certified e-discovery specialist', 'aceds ceds'], pattern: /\b(ceds|certified\s+e-?discovery\s+specialist)\b/i },
  // ── Marketing & Sales ─────────────────────────────────────────────────────────
  { primary: 'Google Analytics Certification', variants: ['google analytics certification', 'google analytics certified', 'ga4 certified'], pattern: /\b(google\s+analytics\s+certif(ied|ication)|ga4\s+certified)\b/i },
  { primary: 'Google Ads Certification', variants: ['google ads certification', 'google ads certified', 'google ads search', 'google ads display'], pattern: /\b(google\s+ads\s+(search\s+|display\s+|video\s+|measurement\s+)?certif(ied|ication))\b/i },
  { primary: 'HubSpot Certification', variants: ['hubspot inbound marketing', 'hubspot certified', 'hubspot inbound', 'hubspot content', 'hubspot email', 'hubspot seo', 'hubspot social'], pattern: /\b(hubspot\s+(inbound\s+marketing|content\s+marketing|email\s+marketing|seo|social\s+media|digital\s+marketing)\s+certif(ied|ication)?|hubspot\s+certified)\b/i },
  { primary: 'Meta Blueprint Certification', variants: ['meta certified', 'meta blueprint', 'facebook blueprint', 'facebook certified'], pattern: /\b(meta\s+certified|meta\s+blueprint|facebook\s+blueprint|facebook\s+certified)\b/i },
  // ── Engineering & Safety ──────────────────────────────────────────────────────
  { primary: 'PE License', variants: ['professional engineer', 'pe license', 'pe - civil', 'pe - mechanical', 'pe - electrical', 'licensed professional engineer'], pattern: /\b(professional\s+engineer\s+licens|pe\s+(licens|[-\u2013]\s*(civil|mechanical|electrical|chemical|structural|environmental))|licensed\s+professional\s+engineer)\b/i },
  { primary: 'FE Exam', variants: ['fundamentals of engineering', 'fe exam', 'eit', 'engineer in training'], pattern: /\b(fundamentals\s+of\s+engineering|fe\s+exam|eit\b|engineer\s+in\s+training)\b/i },
  { primary: 'LEED', variants: ['leed', 'leed ap', 'leed green associate', 'leed bd+c', 'leed o+m', 'leed id+c', 'leadership in energy and environmental design'], pattern: /\b(leed(\s+(ap|green\s+associate|bd\+c|o\+m|id\+c|nd))?|leadership\s+in\s+energy\s+and\s+environmental\s+design)\b/i },
  { primary: 'OSHA 10', variants: ['osha 10', 'osha 10-hour', 'osha10'], pattern: /\b(osha\s+10(-?hour)?)\b/i },
  { primary: 'OSHA 30', variants: ['osha 30', 'osha 30-hour', 'osha30'], pattern: /\b(osha\s+30(-?hour)?)\b/i },
  { primary: 'HAZWOPER', variants: ['hazwoper', 'hazwoper 40', 'hazwoper 24'], pattern: /\b(hazwoper(\s+(40|24)(-hour)?)?)\b/i },
  { primary: 'CSP', variants: ['csp', 'certified safety professional', 'bcsp csp'], pattern: /\b(csp|certified\s+safety\s+professional)\b/i },
  { primary: 'CWI', variants: ['cwi', 'certified welding inspector', 'aws cwi'], pattern: /\b(cwi|certified\s+welding\s+inspector)\b/i },
  { primary: 'NICET', variants: ['nicet', 'nicet certification', 'nicet fire alarm'], pattern: /\b(nicet(\s+(fire\s+alarm|video\s+security|electrical\s+power))?)\b/i },
  { primary: 'CFM', variants: ['cfm', 'certified facility manager', 'ifma cfm'], pattern: /\b(cfm|certified\s+facility\s+manager)\b/i },
  { primary: 'CEM', variants: ['cem', 'certified energy manager', 'aee cem'], pattern: /\b(cem|certified\s+energy\s+manager)\b/i },
  { primary: 'Part 107 (FAA)', variants: ['part 107', 'faa part 107', 'remote pilot certificate', 'drone certification', 'uas certification'], pattern: /\b(part\s+107|faa\s+part\s+107|remote\s+pilot\s+certificate)\b/i },
  // ── ISO Standards ─────────────────────────────────────────────────────────────
  { primary: 'ISO 27001', variants: ['iso 27001', 'iso/iec 27001', 'iso27001', 'information security management system', 'isms'], pattern: /\b(iso\s*\/?\s*iec\s*27001|iso\s*27001|isms|information\s+security\s+management\s+system)\b/i },
  { primary: 'ISO 9001', variants: ['iso 9001', 'iso9001', 'quality management system', 'qms'], pattern: /\b(iso\s*9001)\b/i },
  { primary: 'ISO 14001', variants: ['iso 14001', 'iso14001', 'environmental management system'], pattern: /\b(iso\s*14001)\b/i },
  { primary: 'ISO 45001', variants: ['iso 45001', 'iso45001', 'occupational health and safety management'], pattern: /\b(iso\s*45001)\b/i },
  // ── ServiceNow ────────────────────────────────────────────────────────────────
  { primary: 'ServiceNow', variants: ['servicenow', 'service now', 'snow', 'servicenow itsm', 'servicenow certified'], pattern: /\b(servicenow|service\s+now|snow)\b/i },
  { primary: 'ServiceNow CIS-SAM', variants: ['servicenow certified implementation specialist sam', 'servicenow cis-sam', 'servicenow software asset management specialist', 'snow cis-sam'], pattern: /\b(servicenow\s+(certified\s+)?implementation\s+specialist\s+([-\u2013]\s*)?software\s+asset\s+management|servicenow\s+cis-?sam)\b/i },
  { primary: 'ServiceNow CIS-HAM', variants: ['servicenow certified implementation specialist ham', 'servicenow cis-ham', 'servicenow hardware asset management specialist', 'snow cis-ham'], pattern: /\b(servicenow\s+(certified\s+)?implementation\s+specialist\s+([-\u2013]\s*)?hardware\s+asset\s+management|servicenow\s+cis-?ham)\b/i },
  // ── Security Management ───────────────────────────────────────────────────────
  { primary: 'CISMP', variants: ['cismp', 'certificate in information security management principles', 'bcs cismp'], pattern: /\b(cismp|certificate\s+in\s+information\s+security\s+management\s+principles)\b/i },
  { primary: 'Certified Information Security Analyst', variants: ['certified information security analyst', 'cisa security analyst'], pattern: /\b(certified\s+information\s+security\s+analyst)\b/i },
];


// Foundational/entry-level certs to exclude when user says "exclude foundational"
const FOUNDATIONAL_CERT_PATTERNS = [
  /\baws\s+certified\s+cloud\s+practitioner\b/i,
  /\bcloud\s+practitioner\b/i,
  /\baws\s+cp\b/i,
  /\baz-?900\b/i,
  /\bazure\s+fundamentals\b/i,
  /\bcompTIA\s+it\s+fundamentals\b/i,
  /\bitf\+?\b/i,
  /\bfoundational\b/i,
];

// ── Vendor groupings for broad cert queries ────────────────────────────────
// Maps canonical vendor keyword → the primary names of all certs from that vendor.
// Used when the user says "any AWS cert", "Cisco certified", "palo alto certifications", etc.
export const CERT_VENDOR_GROUPS: Record<string, string[]> = {
  'AWS': [
    'AWS Cloud Practitioner',
    'AWS Solutions Architect Associate',
    'AWS Developer Associate',
    'AWS SysOps Administrator',
    'AWS Solutions Architect Professional',
    'AWS DevOps Engineer Professional',
    'AWS Advanced Networking Specialty',
    'AWS Data Analytics Specialty',
    'AWS Database Specialty',
    'AWS Machine Learning Specialty',
    'AWS Security Specialty',
    'AWS Certified AI Practitioner',
    'AWS Certified Data Engineer Associate',
    'AWS Certified Big Data Specialty',
    'AWS Certified Machine Learning Engineer Associate',
    'AWS Certified Generative AI Developer',
    'AWS Certified Alexa Skill Builder Specialty',
    'AWS Certified CloudOps Engineer Associate',
    'AWS Certified SAP on AWS Specialty',
    'AWS Partner Accreditation Technical',
    'AWS Partner Generative AI Essentials',
    'AWS GovCloud Essentials',
    'AWS Cloud Technical Essentials',
    'AWS Machine Learning Foundations',
    'AWS Knowledge Amazon Connect',
    'Practical Data Science on AWS',
  ],
  'Azure': [
    'AZ-900', 'AZ-104', 'AZ-204', 'AZ-305', 'AZ-500',
    'DP-203', 'AI-102', 'MS-900', 'SC-300', 'SC-100',
    'DP-900', 'DP-300', 'DP-100', 'PL-300', 'AI-900',
  ],
  'Microsoft': [
    'AZ-900', 'AZ-104', 'AZ-204', 'AZ-305', 'AZ-500',
    'DP-203', 'AI-102', 'MS-900', 'SC-300', 'SC-100',
    'DP-900', 'DP-300', 'DP-100', 'PL-300', 'AI-900',
  ],
  'Google Cloud': [
    'Google Cloud Digital Leader',
    'Google Cloud Associate Engineer',
    'Google Cloud Professional Architect',
    'Google Cloud Professional Data Engineer',
    'Google Cloud Professional Developer',
    'Google Cloud Professional Network Engineer',
    'Google Cloud Professional Security Engineer',
    'Google Cloud Professional ML Engineer',
    'Google Data Analytics Certificate',
  ],
  'GCP': [
    'Google Cloud Digital Leader',
    'Google Cloud Associate Engineer',
    'Google Cloud Professional Architect',
    'Google Cloud Professional Data Engineer',
    'Google Cloud Professional Developer',
    'Google Cloud Professional Network Engineer',
    'Google Cloud Professional Security Engineer',
    'Google Cloud Professional ML Engineer',
    'Google Data Analytics Certificate',
  ],
  'Cisco': [
    'CCNA', 'CCNA Routing and Switching', 'CCNA Collaboration', 'CCNA Industrial', 'CCNA Security',
    'CCNP', 'CCNP Routing and Switching',
    'CCIE', 'CCENT',
    'CCST Networking', 'CCST Cybersecurity',
    'Cisco Certified Specialist',
    'Cisco CyberOps Associate',
    'Cisco DevNet Associate',
    'Cisco DevNet Professional',
  ],
  'CompTIA': [
    'CompTIA A+', 'CompTIA Network+', 'CompTIA Security+', 'CompTIA Linux+',
    'CompTIA Cloud+', 'CompTIA PenTest+', 'CompTIA CySA+', 'CompTIA CASP+',
    'CompTIA Server+', 'CompTIA ITF+', 'CompTIA Project+', 'CompTIA Data+',
  ],
  'ISC2': [
    'CISSP', 'SSCP', 'CCSP', 'CAP', 'CSSLP', 'HCISPP', 'ISSAP', 'ISSEP', 'ISSMP', 'CC',
  ],
  'ISACA': [
    'CISA', 'CISM', 'CRISC', 'CGEIT', 'CDPSE',
  ],
  'Palo Alto': [
    'PCCSA', 'PCNSA', 'PCNSE', 'PCSAE', 'Palo Alto ACE',
  ],
  'GIAC': [
    'GSEC', 'GCIH', 'GCIA', 'GCFA', 'GREM', 'GPEN', 'GWAPT', 'GSLC', 'GCFE', 'GCED',
  ],
  'SANS': [
    'GSEC', 'GCIH', 'GCIA', 'GCFA', 'GREM', 'GPEN', 'GWAPT', 'GSLC', 'GCFE', 'GCED',
  ],
  'Offensive Security': [
    'OSCP', 'OSWE', 'OSEP', 'OSED', 'OSWP',
  ],
  'EC-Council': [
    'CEH', 'CHFI', 'CND', 'CCISO', 'ECSA',
  ],
  'Red Hat': [
    'RHCSA', 'RHCE', 'RHCA',
  ],
  'HashiCorp': [
    'Terraform Associate', 'Vault Associate',
  ],
  'Kubernetes': [
    'CKA', 'CKAD', 'CKS',
  ],
  'Linux Foundation': [
    'CKA', 'CKAD', 'CKS', 'LFCA', 'LFCS', 'LPIC',
  ],
  'PMI': [
    'PMP', 'CAPM', 'PMI-ACP', 'PMI-PBA', 'PgMP', 'PfMP', 'PMI-RMP',
  ],
  'Scrum': [
    'CSM', 'A-CSM', 'CSPO', 'A-CSPO', 'CSD',
    'PSM I', 'PSM II', 'PSM III', 'PSPO I', 'PSPO II', 'PSD', 'SPS', 'PSK',
  ],
  'SAFe': [
    'SAFe Agilist', 'SAFe Scrum Master', 'SAFe Advanced Scrum Master',
    'SAFe RTE', 'SAFe POPM', 'SAFe LPM', 'SAFe SPC',
  ],
  'ITIL': [
    'ITIL 4 Foundation', 'ITIL 4 Managing Professional', 'ITIL 4 CDS', 'ITIL 4 DSV',
    'ITIL v3 Foundation', 'ITIL v2',
  ],
  'Salesforce': [
    'Salesforce Administrator', 'Salesforce Platform Developer I',
    'Salesforce Marketing Cloud', 'Salesforce Sales Cloud',
  ],
  'ServiceNow': [
    'ServiceNow', 'ServiceNow CIS-SAM', 'ServiceNow CIS-HAM',
  ],
  'VMware': [
    'VCP-DCV', 'VCP-NV',
  ],
  'Juniper': [
    'JNCIA-Junos',
  ],
  'Six Sigma': [
    'Six Sigma White Belt', 'Six Sigma Yellow Belt', 'Six Sigma Green Belt',
    'Six Sigma Black Belt', 'Six Sigma Master Black Belt', 'Lean Six Sigma',
  ],
  'PMI-ACP': ['PMI-ACP'],
};

// Patterns that signal a vendor-level cert request (case-insensitive)
// e.g. "cisco certifications", "aws certified", "any palo alto cert", "holds a giac cert"
const VENDOR_QUERY_PATTERNS: Array<{ vendors: string[]; pattern: RegExp }> = [
  { vendors: ['AWS'],               pattern: /\baws\b/i },
  { vendors: ['Azure', 'Microsoft'], pattern: /\b(azure|microsoft\s+azure)\b/i },
  { vendors: ['Microsoft'],         pattern: /\bmicrosoft\b(?!\s+azure)/i },
  { vendors: ['Google Cloud', 'GCP'], pattern: /\b(google\s+cloud|gcp)\b/i },
  { vendors: ['Cisco'],             pattern: /\bcisco\b/i },
  { vendors: ['CompTIA'],           pattern: /\bcomptia\b/i },
  { vendors: ['ISC2'],              pattern: /\b(isc2|isc\s*2|\(isc\)\s*2)\b/i },
  { vendors: ['ISACA'],             pattern: /\bisaca\b/i },
  { vendors: ['Palo Alto'],         pattern: /\bpalo\s+alto\b/i },
  { vendors: ['GIAC'],              pattern: /\bgiac\b/i },
  { vendors: ['SANS'],              pattern: /\bsans\b/i },
  { vendors: ['Offensive Security'], pattern: /\boffensive\s+security\b/i },
  { vendors: ['EC-Council'],        pattern: /\bec-?council\b/i },
  { vendors: ['Red Hat'],           pattern: /\bred\s+hat\b/i },
  { vendors: ['HashiCorp'],         pattern: /\bhashicorp\b/i },
  { vendors: ['Kubernetes'],        pattern: /\bkubernetes\b/i },
  { vendors: ['Linux Foundation'],  pattern: /\blinux\s+foundation\b/i },
  { vendors: ['PMI'],               pattern: /\bpmi\b/i },
  { vendors: ['Scrum'],             pattern: /\bscrum\b/i },
  { vendors: ['SAFe'],              pattern: /\bsafe\b/i },
  { vendors: ['ITIL'],              pattern: /\bitil\b/i },
  { vendors: ['Salesforce'],        pattern: /\bsalesforce\b/i },
  { vendors: ['ServiceNow'],        pattern: /\b(servicenow|service\s+now)\b/i },
  { vendors: ['VMware'],            pattern: /\bvmware\b/i },
  { vendors: ['Juniper'],           pattern: /\bjuniper\b/i },
  { vendors: ['Six Sigma'],         pattern: /\bsix\s+sigma\b/i },
];

// Linguistic phrases that signal the user wants cert-holders regardless of specific cert name.
// These extend broad-vendor matching to natural language queries.
const CERT_LINGUISTIC_PATTERNS = /\b(certif(ied|ication|ications)|cert\b|certs\b|licensed|accredited|credentialed|holds?\s+a\s+cert|has\s+a\s+cert|earned\s+a\s+cert|obtained\s+a\s+cert|passed\s+the|holds?\s+the)\b/i;

const TECH_SYNONYMS: SynonymGroup[] = [
  {
    primary: 'Kubernetes',
    variants: ['k8s', 'kubernetes'],
    pattern: /\b(k8s|kubernetes)\b/i
  },
  {
    primary: 'JavaScript',
    variants: ['js', 'javascript'],
    pattern: /\b(js|javascript)\b/i
  },
  {
    primary: 'VBScript',
    variants: ['vbs', 'vbscript', 'visual basic scripting edition'],
    pattern: /\b(vbs|vbscript|visual\s+basic\s+scripting\s+edition)\b/i
  },
  {
    primary: 'Frontend',
    variants: ['front-end', 'frontend', 'client-side'],
    pattern: /\b(front-?end|client-?side)\b/i
  },
  {
    primary: 'Backend',
    variants: ['back-end', 'backend', 'server-side'],
    pattern: /\b(back-?end|server-?side)\b/i
  },
  {
    primary: 'Full-stack',
    variants: ['full-stack', 'fullstack', 'full stack'],
    pattern: /\b(full-?stack|full\s+stack)\b/i
  },
  {
    primary: 'AI',
    variants: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'ai-enabled', 'ai-powered', 'ai workflow', 'ai workflows'],
    pattern: /\b(ai|artificial\s+intelligence|machine\s+learning|ml|ai-?enabled|ai-?powered)\b/i
  },
  {
    primary: 'SDET',
    variants: ['sdet', 'software development engineer in test', 'qa automation'],
    pattern: /\b(sdet|software\s+development\s+engineer\s+in\s+test|qa\s+automation)\b/i
  },
  {
    primary: 'Zero Trust',
    variants: ['zero trust', 'zero-trust', 'zt', 'zta', 'zero trust architecture', 'zero trust network access', 'ztna'],
    pattern: /\b(zero[\s-]trust(\s+architecture|\s+network\s+access)?|ztna?|zta)\b/i
  },
  {
    primary: 'FedRAMP',
    variants: ['fedramp', 'federal risk and authorization management program', 'fed ramp'],
    pattern: /\b(fedramp|federal\s+risk\s+and\s+authorization\s+management\s+program)\b/i
  },
  {
    primary: 'FISMA',
    variants: ['fisma', 'federal information security management act', 'federal information security modernization act'],
    pattern: /\b(fisma|federal\s+information\s+security\s+(management|modernization)\s+act)\b/i
  },
  {
    primary: 'NIST',
    variants: ['nist', 'national institute of standards and technology', 'nist 800-53', 'nist csf', 'nist cybersecurity framework'],
    pattern: /\b(nist(\s+800-\d+|\s+csf|\s+cybersecurity\s+framework)?|national\s+institute\s+of\s+standards\s+and\s+technology)\b/i
  },
  {
    primary: 'SAFe',
    variants: ['safe', 'safe agilist', 'scaled agile', 'scaled agile framework', 'scaled agile framework agilist', 'sa5', 'safe 5', 'safe 6'],
    pattern: /\b(safe(\s+agilist|\s+[56])?|scaled\s+agile(\s+framework(\s+agilist)?)?)\b/i
  },
  {
    primary: 'Power Platform',
    variants: ['power platform', 'microsoft power platform', 'power apps', 'powerapps', 'power automate', 'power virtual agents', 'low-code', 'low code'],
    pattern: /\b(power\s+platform|microsoft\s+power\s+platform|power\s+apps|powerapps|power\s+automate|low-?code)\b/i
  },
  {
    primary: 'SharePoint',
    variants: ['sharepoint', 'share point', 'moss', 'microsoft sharepoint', 'sharepoint migration', 'sharepoint migrations'],
    pattern: /\b(sharepoint|share\s+point|microsoft\s+sharepoint)\b/i
  },
  {
    primary: 'MS Office',
    variants: ['ms office', 'microsoft office', 'office 365', 'microsoft 365', 'm365', 'o365'],
    pattern: /\b(ms\s+office|microsoft\s+office|office\s+365|microsoft\s+365|m365|o365)\b/i
  },
  {
    primary: 'Active Directory',
    variants: ['active directory', 'ad', 'ldap', 'azure ad', 'entra id'],
    pattern: /\b(active\s+directory|azure\s+ad|entra\s+id)\b/i
  },
  {
    primary: 'React',
    variants: ['react', 'react.js', 'reactjs'],
    pattern: /\b(react(\.?js)?)\b/i
  },
  {
    primary: 'Python',
    variants: ['python'],
    pattern: /\bpython\b/i
  },
  {
    primary: 'Bash',
    variants: ['bash', 'bash scripting', 'shell scripting', 'bash script', 'shell script'],
    pattern: /\b(bash(\s+script(ing)?)?|shell\s+script(ing)?)\b/i
  },
  {
    primary: 'PowerShell',
    variants: ['powershell', 'power shell', 'ps1'],
    pattern: /\b(powershell|power\s+shell|\.ps1)\b/i
  },
  {
    primary: 'Java',
    variants: ['java'],
    pattern: /\bjava\b(?!\s*script)/i
  },
  {
    primary: 'C++',
    variants: ['c++', 'cpp', 'c plus plus'],
    pattern: /\b(c\+\+|cpp|c\s+plus\s+plus)\b/i
  },
  {
    primary: 'Automation',
    variants: ['automation', 'automated', 'rpa', 'robotic process automation'],
    pattern: /\b(automation|automated|rpa|robotic\s+process\s+automation)\b/i
  },
  {
    primary: 'OOP',
    variants: ['oop', 'object-oriented', 'object oriented', 'object-oriented programming'],
    pattern: /\b(oop|object-?oriented(\s+programming)?)\b/i
  },
  {
    primary: 'Help Desk',
    variants: ['help desk', 'helpdesk', 'service desk', 'it support', 'desktop support', 'technical support'],
    pattern: /\b(help\s*desk|service\s+desk|it\s+support|desktop\s+support|technical\s+support)\b/i
  },
  {
    primary: 'Information Technology',
    variants: ['information technology', 'information tech'],
    pattern: /\binformation\s+tech(nology)?\b/i
  },
  {
    primary: 'Cybersecurity',
    variants: ['cybersecurity', 'cyber security', 'information security', 'infosec', 'cyber analyst', 'cybersecurity analyst', 'information security analyst'],
    pattern: /\b(cybersecurity|cyber\s+security|information\s+security|infosec|cybersecurity\s+analyst|information\s+security\s+analyst)\b/i
  },
  {
    primary: 'Data Pipeline',
    variants: ['data pipeline', 'data pipelines', 'etl', 'data flow', 'data engineering'],
    pattern: /\b(data\s+pipeline[s]?|etl|data\s+flow|data\s+engineering)\b/i
  },
  {
    primary: 'GitHub',
    variants: ['github', 'git hub', 'github.com'],
    pattern: /\b(github(\.com)?)\b/i
  },
  {
    primary: 'AI Support Analyst',
    variants: ['ai support analyst', 'ai analyst', 'ai support'],
    pattern: /\b(ai\s+support\s+analyst|ai\s+analyst)\b/i
  },
];

const DOMAIN_SYNONYMS: SynonymGroup[] = [
  {
    primary: 'DoD',
    variants: ['dod', 'department of defense', 'dept of defense', 'u.s. department of defense', 'us department of defense'],
    pattern: /\b(dod|department\s+of\s+defense|dept\.?\s+of\s+defense)\b/i
  },
  {
    primary: 'DHS',
    variants: ['dhs', 'department of homeland security', 'dept of homeland security', 'homeland security'],
    pattern: /\b(dhs|department\s+of\s+homeland\s+security|homeland\s+security)\b/i
  },
  {
    primary: 'Coast Guard',
    variants: ['coast guard', 'uscg', 'u.s. coast guard', 'us coast guard', 'united states coast guard'],
    pattern: /\b(coast\s+guard|uscg|u\.?s\.?\s+coast\s+guard|united\s+states\s+coast\s+guard)\b/i
  },
  {
    primary: 'SIPR',
    variants: ['sipr', 'siprnet', 'sipr net', 'secret internet protocol router', 'secret ip router network', 'classified network'],
    pattern: /\b(sipr(net)?|secret\s+internet\s+protocol\s+router|secret\s+ip\s+router)\b/i
  },
  {
    primary: 'Network Administration',
    variants: ['network administration', 'network admin', 'netadmin', 'network administrator', 'network management', 'networking'],
    pattern: /\b(network\s+admin(istration|istrator)?|netadmin|network\s+management)\b/i
  },
  {
    primary: 'Project Management',
    variants: ['project management', 'project manager', 'pm', 'project lead', 'project director', 'managing projects'],
    pattern: /\b(project\s+mana(gement|ger|ging)|project\s+lead|project\s+director)\b/i
  },
  {
    primary: 'Program Management',
    variants: ['program management', 'program manager', 'pgm', 'programme management', 'programme manager', 'managing programs'],
    pattern: /\b(program(me)?\s+mana(gement|ger|ging)|pgm)\b/i
  },
  {
    primary: 'Strategic Planning',
    variants: ['strategic planning', 'strategy', 'strategic', 'strategic management', 'strategic direction', 'strategic advisor', 'strategic initiatives'],
    pattern: /\b(strateg(y|ic|ics|ic\s+planning|ic\s+management|ic\s+direction|ic\s+advisor|ic\s+initiatives))\b/i
  },
  {
    primary: 'GovCon',
    variants: ['govcon', 'government contracting', 'government contractor', 'gov con', 'federal contracting', 'federal contractor', 'defense contracting', 'defense contractor'],
    pattern: /\b(govcon|gov\s+con|government\s+contract(ing|or)?|federal\s+contract(ing|or)?|defense\s+contract(ing|or)?)\b/i
  },
  {
    primary: 'RFI',
    variants: ['rfi', 'request for information', 'requests for information'],
    pattern: /\b(rfi|request\s+for\s+information)\b/i
  },
  {
    primary: 'RFP',
    variants: ['rfp', 'request for proposal', 'requests for proposals', 'request for proposals'],
    pattern: /\b(rfp|request\s+for\s+proposal)\b/i
  },
  {
    primary: 'FAR',
    variants: ['far', 'federal acquisition regulation', 'federal acquisition regulations', 'dfar', 'dfars', 'defense federal acquisition regulation supplement'],
    pattern: /\b(far\b|dfars?|federal\s+acquisition\s+regulations?|defense\s+federal\s+acquisition\s+regulation)\b/i
  },
  {
    primary: 'Communications',
    variants: ['communications', 'communication', 'corporate communications', 'strategic communications', 'public affairs', 'stakeholder communications'],
    pattern: /\b(communications?|corporate\s+communications|strategic\s+communications|public\s+affairs|stakeholder\s+communications)\b/i
  },
  {
    primary: 'Modeling',
    variants: ['modeling', 'modelling', 'systems modeling', 'process modeling', 'data modeling', 'simulation', 'threat modeling'],
    pattern: /\b(model(ing|ling)|systems?\s+model(ing|ling)|process\s+model(ing|ling)|data\s+model(ing|ling)|simulation|threat\s+model(ing|ling))\b/i
  },
];

const ROLE_SYNONYMS: SynonymGroup[] = [
  {
    primary: 'IT Support',
    variants: ['help desk', 'it support', 'desktop support', 'technical support', 'service desk', 'classroom support technician'],
    pattern: /\b(help\s+desk|it\s+support|desktop\s+support|technical\s+support|service\s+desk|classroom\s+support\s+technician)\b/i
  },
  {
    primary: 'System Administrator',
    variants: ['sysadmin', 'system administrator', 'systems admin', 'sys admin'],
    pattern: /\b(sysadmin|system\s+administrator|systems\s+admin|sys\s+admin)\b/i
  },
  {
    primary: 'Network Administrator',
    variants: ['netadmin', 'network administrator'],
    pattern: /\b(netadmin|network\s+administrator)\b/i
  },
  {
    primary: 'Information Security',
    variants: ['infosec', 'information security', 'it security', 'cybersecurity'],
    pattern: /\b(infosec|information\s+security|it\s+security|cybersecurity)\b/i
  },
  {
    primary: 'Human Resources',
    variants: ['hr', 'human resources', 'people operations', 'talent acquisition', 'recruiting'],
    pattern: /\b(hr|human\s+resources|people\s+operations|talent\s+acquisition|recruiting)\b/i
  },
  {
    primary: 'Public Relations',
    variants: ['pr', 'public relations', 'corporate communications'],
    pattern: /\b(pr|public\s+relations|corporate\s+communications)\b/i
  },
  {
    primary: 'Executive',
    variants: ['c-suite', 'executive', 'ceo', 'cto', 'cfo', 'coo', 'ciso'],
    pattern: /\b(c-suite|executive|ceo|cto|cfo|coo|ciso)\b/i
  },
  {
    primary: 'BC/DR',
    variants: ['bc/dr', 'bcdr', 'business continuity and disaster recovery', 'disaster recovery'],
    pattern: /\b(bc\/dr|bcdr|business\s+continuity\s+and\s+disaster\s+recovery|disaster\s+recovery)\b/i
  },
];

const ALL_SYNONYMS = [
  ...DEGREE_SYNONYMS,
  ...CERTIFICATION_SYNONYMS,
  ...TECH_SYNONYMS,
  ...DOMAIN_SYNONYMS,
  ...ROLE_SYNONYMS,
];

export function findSynonymGroup(text: string): SynonymGroup | null {
  const lowerText = text.toLowerCase();
  for (const group of ALL_SYNONYMS) {
    if (group.pattern && group.pattern.test(text)) {
      return group;
    }
    if (group.variants.some(variant => lowerText.includes(variant.toLowerCase()))) {
      return group;
    }
  }
  return null;
}

export function matchesAnySynonym(text: string, searchTerm: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  const searchGroup = findSynonymGroup(searchTerm);
  if (searchGroup) {
    return searchGroup.variants.some(variant => lowerText.includes(variant.toLowerCase())) ||
           (searchGroup.pattern ? searchGroup.pattern.test(text) : false);
  }
  return lowerText.includes(lowerSearch);
}

export function standardizeTerm(text: string): string {
  const group = findSynonymGroup(text);
  return group ? group.primary : text;
}

const DEGREE_PATTERNS = {
  highSchool: /\b(high\s+school|hs\s+diploma|ged|general\s+educational\s+development|high\s+school\s+equivalency|secondary\s+education|diploma)\b/i,
  associate: /\b(associate'?s?|associates?|aa\b|as\b|a\.a\.|a\.s\.|assoc\.)\b/i,
  bachelor: /\b(bachelor'?s?|bachelors?|ba\b|bs\b|b\.s\.|b\.a\.|b\.sc\.|undergraduate)\b/i,
  master: /\b(master'?s?|masters?|ma\b|ms\b|m\.s\.|m\.a\.|mba\b|m\.b\.a\.|graduate\s+degree)\b/i,
  phd: /\b(phd|ph\.?d\.?|doctorate|doctoral|doctor\s+of\s+philosophy)\b/i,
};

const MAJOR_FIELDS: Record<string, string[]> = {
  'computer science': ['computer science', 'computing', 'informatics', 'cs'],
  'cybersecurity': ['cybersecurity', 'cyber security', 'information security', 'infosec'],
  'human resources': ['human resources', 'personnel management', 'people operations', 'talent acquisition', 'hr'],
  'nursing': ['nursing', 'registered nurse', 'rn', 'bsn'],
  'economics': ['economics', 'economist', 'econ'],
  'finance': ['finance', 'financial'],
  'data analytics': ['data analytics', 'data analysis', 'analytics', 'business intelligence', 'bi'],
  'mechanical engineering': ['mechanical engineering', 'mechanical engineer', 'me'],
  'business administration': ['business administration', 'business management', 'bba', 'mba'],
  'customer service': ['customer service', 'customer support', 'client services'],
  'graphic design': ['graphic design', 'visual design'],
  'marketing': ['marketing', 'digital marketing', 'brand management'],
  'supply chain': ['supply chain', 'logistics', 'operations management'],
  'network administration': ['network administration', 'network administrator', 'networking'],
  'project management': ['project management', 'project manager', 'managing projects', 'project lead', 'pmp'],
  'program management': ['program management', 'program manager', 'programme management', 'managing programs', 'pgm'],
  'strategic planning': ['strategic planning', 'strategic management', 'strategic initiatives'],
  'government contracting': ['government contracting', 'federal contracting', 'defense contracting', 'govcon'],
  'information technology': ['information technology', 'information systems', 'mis'],
  'accounting': ['accounting', 'accountant', 'cpa'],
  'public administration': ['public administration', 'public policy', 'pa'],
  'communications': ['communications', 'communication studies', 'comm'],
  'education': ['education', 'teaching', 'pedagogy', 'educ'],
  'social work': ['social work', 'social worker', 'msw'],
  'psychology': ['psychology', 'psych'],
  'sociology': ['sociology', 'soc'],
  'criminal justice': ['criminal justice', 'criminology', 'law enforcement', 'cj'],
  'healthcare administration': ['healthcare administration', 'health administration', 'hca'],
  'electrical engineering': ['electrical engineering', 'ee', 'ece'],
  'civil engineering': ['civil engineering', 'ce'],
  'software engineering': ['software engineering', 'software development', 'swe'],
  'mathematics': ['mathematics', 'math', 'numerical analysis', 'applied mathematics'],
  // Law & legal
  'law': ['law', 'legal', 'attorney', 'lawyer', 'paralegal', 'juris doctor', 'j.d.', 'llb', 'llm', 'litigation', 'legal counsel', 'contract law', 'corporate law'],
  // Humanities & liberal arts
  'humanities': ['humanities', 'liberal arts', 'history', 'philosophy', 'english literature', 'literature', 'art history', 'cultural studies', 'classics'],
  // Arts & design
  'arts': ['fine arts', 'visual arts', 'graphic arts', 'studio art', 'performing arts', 'music', 'theater', 'film studies', 'media arts'],
  // Environmental & science
  'environmental science': ['environmental science', 'environmental studies', 'ecology', 'sustainability', 'earth science', 'geology'],
  'biology': ['biology', 'life sciences', 'biochemistry', 'microbiology', 'biotechnology', 'bioinformatics'],
  'chemistry': ['chemistry', 'chemical engineering', 'pharmaceutical'],
  'physics': ['physics', 'astrophysics', 'applied physics'],
  // Language
  'foreign language': ['foreign language', 'linguistics', 'translation', 'interpreter', 'spanish', 'french', 'mandarin', 'arabic', 'german'],
  // Construction & trades
  'construction': ['construction', 'architecture', 'civil construction', 'building management', 'facilities management'],
  'trades': ['plumbing', 'electrical trades', 'hvac', 'carpentry', 'welding', 'automotive'],
  // Business & management
  'real estate': ['real estate', 'property management', 'real estate agent', 'realtor'],
  'insurance': ['insurance', 'underwriting', 'claims adjuster', 'actuary'],
  // Healthcare
  'medicine': ['medicine', 'physician', 'medical doctor', 'md', 'surgery', 'radiology', 'pharmacy'],
  'physical therapy': ['physical therapy', 'occupational therapy', 'speech therapy', 'rehab'],
  // Security & public safety
  'public safety': ['public safety', 'fire science', 'emergency management', 'ems', 'paramedic', 'firefighter', 'police'],
};

const IVY_LEAGUE = ['harvard', 'yale', 'princeton', 'columbia', 'brown', 'dartmouth', 'cornell', 'penn', 'university of pennsylvania'];

const INSTITUTION_PATTERNS = {
  ivy_league: IVY_LEAGUE,
  state_university: /\b(state university|state college|public university)\b/i,
  community_college: /\b(community college|junior college|2-year)\b/i,
  trade_school: /\b(trade school|vocational school|technical school)\b/i,
  liberal_arts: /\b(liberal arts college)\b/i,
  technical_institute: /\b(technical institute|tech|institute of technology|polytechnic)\b/i,
  bootcamp: /\b(bootcamp|boot camp|accelerated program|intensive program)\b/i,
};

const SENIORITY_PATTERNS = {
  executive: /\b(executive|c-suite|ceo|cto|cfo|coo|ciso|president|vp|vice president|chief)\b/i,
  senior: /\b(senior|sr\.|lead|principal|10\+?\s*years?)\b/i,
  director: /\b(director)\b/i,
  manager: /\b(manager|management|lead|supervisor|supervisory)\b/i,
  mid_level: /\b(mid-level|mid level|3-7\s*years?|intermediate)\b/i,
  entry_level: /\b(entry-level|entry level|junior|0-2\s*years?|recent graduate)\b/i,
  intern: /\b(intern|internship|co-op|coop)\b/i,
  freelance: /\b(freelance|freelancer|self-employed|contractor|independent)\b/i,
  military: /\b(military|veteran|army|navy|air force|marines|coast guard)\b/i,
};

const CLEARANCE_PATTERNS = {
  ts_sci: /\b(ts\s*\/?\s*sci|top\s+secret\s*\/?\s*sci|sensitive\s+compartmented\s+information)\b/i,
  top_secret: /\b(top\s+secret|ts\b(?!\s*\/?\s*sci))\b/i,
  secret: /\b(secret\s+clearance|active\s+secret|holds?\s+a?\s*secret|secret)\b/i,
  ts_eligible: /\b(ts\s+eligible|top\s+secret\s+eligible|eligible\s+for\s+(top\s+secret|ts)|ts-eligible)\b/i,
  any: /\b(clearance|secret|top\s+secret|ts\b|ts\s*\/?\s*sci|security\s+clearance)\b/i,
};

// Positive action verbs (doers)
const ACTION_VERB_PATTERNS: Record<string, RegExp> = {
  led: /\b(led|lead|leads?|heading|headed|spearheaded|directed|drove|oversaw|architected|designed\s+from\s+scratch|lead\s+designer)\b/i,
  built: /\b(built|build|builds?|created|developed|designed|architected|implemented|wrote|authored|programmed|deployed|constructed)\b/i,
  configured: /\b(configured|configure|manages?|managed|administered|setup|set\s+up|maintained|deployed)\b/i,
  optimized: /\b(optimized|optimize|improved|enhanced|streamlined|tuned|accelerated|upgraded|refactored)\b/i,
  managed: /\b(managed|manage|oversaw|supervised|maintained|coordinated|directed)\b/i,
  programmed: /\b(programmed|coded|developed|implemented|wrote|authored|built|deployed)\b/i,
  deployed: /\b(deployed|launched|shipped|released|published|pushed\s+to\s+production)\b/i,
  architected: /\b(architected|architect|designed|engineered|built\s+from\s+scratch|lead\s+designer|lead\s+architect)\b/i,
};

// Passive/negative verbs — used to exclude when user wants "doers only"
const PASSIVE_VERB_PATTERNS: RegExp[] = [
  /\b(maintaining|supporting|assisting|helping\s+with|contributing\s+to|legacy\s+system)\b/i,
];

// Visa sponsorship
const VISA_SPONSORSHIP_PATTERNS = [
  /\b(require[s]?\s+(visa|sponsorship)|visa\s+sponsorship\s+required|needs?\s+sponsorship|h1b|h-1b|opt|requires?\s+work\s+authorization|will\s+require\s+sponsorship)\b/i,
];

// Management role patterns
const MANAGEMENT_ROLE_PATTERNS = [
  /\b(project\s+manager|program\s+manager|management\s+role|manager|director|supervisor|team\s+lead|team\s+leader)\b/i,
];

// Career transition fields — unrelated backgrounds
const UNRELATED_FIELD_PATTERNS: Record<string, RegExp> = {
  'custodial': /\b(custodial|janitor|custodian|janitorial|showkeeping|housekeeping|groundskeeper|maintenance\s+worker)\b/i,
  'customer service': /\b(customer\s+service|customer\s+support|retail|cashier|barista|server|waiter|waitress|food\s+service|call\s+center)\b/i,
  'hospitality': /\b(hotel|hospitality|front\s+desk\s+agent|concierge|housekeeper)\b/i,
  'healthcare non-IT': /\b(nurse\s+aide|cna|caregiver|medical\s+assistant|phlebotomist)\b/i,
};

// Minimum readable chars to not be scanned
const MIN_READABLE_CHARS = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseOrGroups(query: string): string[][] {
  const orGroups: string[][] = [];
  const orPattern = /\b(?:either\s+)?(\w[\w\s\+\#\.]*?)\s+or\s+(\w[\w\s\+\#\.]*?)(?:\s+(?:experience|developer|developers|engineer|engineers|candidates?|skills?|knowing|with|and|but|$))/gi;
  let m: RegExpExecArray | null;
  while ((m = orPattern.exec(query)) !== null) {
    const left = m[1].trim();
    const right = m[2].trim();
    if (left && right && left.length > 1 && right.length > 1) {
      orGroups.push([left, right]);
    }
  }
  return orGroups;
}

function parseExclusionTerms(query: string): string[] {
  const excluded: string[] = [];
  const exclusionPatterns = [
    /\b(?:but\s+)?(?:not|exclude|without|no)\s+(?:anyone\s+who\s+(?:was|is|were|are)\s+a?\s*|anyone\s+with\s+|those\s+who\s+|candidates?\s+(?:who|with)\s+|a\s+)?([a-z][a-z\s\+\#\-]{2,40}?)(?:\s*[.,]|$|\s+(?:and|or|but|who|that|whose))/gi,
    /\bdo\s+not\s+include\s+(?:candidates?\s+)?(?:requiring?\s+)?([a-z][a-z\s\+\#\-]{2,40}?)(?:\s*[.,]|$|\s+(?:and|or|but))/gi,
    /\bexclude\s+(?:anyone\s+(?:who\s+)?(?:only\s+)?(?:has|have|holds?)?\s+)?([a-z][a-z\s\+\#\-]{2,40}?)(?:\s*[.,]|$|\s+(?:and|or|but|certifications?))/gi,
    /\bskip\s+(?:over\s+)?(?:the\s+)?candidates?\s+who\s+(?:only\s+)?(?:list|mention|have)\s+([a-z][a-z\s\+\#\-]{2,40}?)(?:\s*[.,]|$)/gi,
    /\bthrow\s+out\s+(?:anyone|candidates?)\s+(?:whose\s+)?([a-z][a-z\s\+\#\-]{2,40}?)(?:\s*[.,]|$)/gi,
    /\bdrop\s+(?:them|candidates?|anyone)\s+(?:from\s+the\s+(?:results|queue))?\s*(?:if\s+([a-z][a-z\s\+\#\-]{2,40}))?/gi,
  ];
  for (const pattern of exclusionPatterns) {
    let mx: RegExpExecArray | null;
    while ((mx = pattern.exec(query.toLowerCase())) !== null) {
      const term = mx[1]?.trim();
      if (term && term.length > 2) excluded.push(term);
    }
  }
  return excluded;
}

function detectClearance(query: string): 'secret' | 'top_secret' | 'ts_sci' | 'ts_eligible' | 'any' | undefined {
  if (CLEARANCE_PATTERNS.ts_sci.test(query)) return 'ts_sci';
  if (CLEARANCE_PATTERNS.ts_eligible.test(query)) return 'ts_eligible';
  if (/\bts\/sci\s+is\s+better|ts\/sci\s+preferred|either\s+works/i.test(query)) return 'ts_eligible'; // TS/SCI preferred but TS works
  if (CLEARANCE_PATTERNS.top_secret.test(query)) return 'top_secret';
  if (/\b(secret\s+clearance|active\s+secret|clearance|secret\b(?!\s+internet))\b/i.test(query)) return 'secret';
  if (/\bclearance\b/i.test(query)) return 'any';
  return undefined;
}

function detectActionVerbs(query: string): string[] {
  const found: string[] = [];
  for (const [verb, pattern] of Object.entries(ACTION_VERB_PATTERNS)) {
    if (pattern.test(query)) found.push(verb);
  }
  return found;
}

function detectExcludedActionVerbs(query: string): string[] {
  // Detect "skip if only mentions maintaining/supporting"
  const excluded: string[] = [];
  if (/\b(only\s+)?(?:list|mention|supporting|maintaining|assisting)\b/i.test(query)) {
    excluded.push('maintaining', 'supporting');
  }
  return excluded;
}

function detectTopN(query: string): { n: number; skill: string } | null {
  const topNMatch = query.match(/\btop\s+(\d+)\s+(?:candidates?|results?|people)\s*(?:(?:for\s+(?:a|the)\s+)?([a-z][a-z\s]+?)\s+role|ranked?\s+by\s+([a-z\s\+\#]+?))?(?:\s*[,.]|$|\s+who\b|\s+with\b)/i);
  if (topNMatch) {
    const n = parseInt(topNMatch[1]);
    const skill = (topNMatch[2] || topNMatch[3] || '').trim();
    return { n, skill };
  }
  return null;
}

function detectFileType(query: string): 'docx' | 'pdf' | 'any' | undefined {
  if (/\bdocx?\b/i.test(query)) return 'docx';
  if (/\bpdf\b/i.test(query)) return 'pdf';
  return undefined;
}

function detectExcludeFileType(query: string): 'docx' | 'pdf' | undefined {
  if (/\bexclude\s+.*\bdocx?\b|only\s+submitted\s+a\s+docx\b/i.test(query)) return 'docx';
  if (/\bexclude\s+.*\bpdf\b/i.test(query)) return 'pdf';
  return undefined;
}

function detectCareerTransition(query: string): string[] {
  const found: string[] = [];
  for (const [field, pattern] of Object.entries(UNRELATED_FIELD_PATTERNS)) {
    if (pattern.test(query)) found.push(field);
  }
  // Generic transition language
  if (/\btransitioned?\s+from\b|\bcareer\s+change\b|\bunrelated\s+field\b/i.test(query)) {
    found.push('unrelated');
  }
  return found;
}

// ─── Fuzzy / typo corrections ─────────────────────────────────────────────────

const FUZZY_CORRECTIONS: Record<string, string> = {
  'phyton': 'python',
  'kubernets': 'kubernetes',
  'kubernetees': 'kubernetes',
  'dockr': 'docker',
  'javascrpit': 'javascript',
  'javascipt': 'javascript',
  'typescrit': 'typescript',
  'typscript': 'typescript',
  'postgreql': 'postgresql',
  'postgress': 'postgresql',
  'bachelors of sience': 'bachelors of science',
  'bachelor of sience': 'bachelor of science',
  'bacherlors': 'bachelors',
  'baschelors': 'bachelors',
  'bachleors': 'bachelors',
  'masteres': 'masters',
  'certifaction': 'certification',
  'certifcation': 'certification',
  'valdosta st': 'valdosta state',
  'microsft': 'microsoft',
  'mircosoft': 'microsoft',
  'powershel': 'powershell',
  'develeper': 'developer',
  'developper': 'developer',
  'enigneer': 'engineer',
  'engineeer': 'engineer',
  'administartor': 'administrator',
  'administator': 'administrator',
  'analitcs': 'analytics',
  'analtics': 'analytics',
  'secuirty': 'security',
  'securty': 'security',
  'devops': 'devops',
  'jenkin': 'jenkins',
  'terrraform': 'terraform',
  'terrafrom': 'terraform',
  'ansibel': 'ansible',
  'pythn': 'python',
};

export function correctFuzzyTerms(rawQuery: string): string {
  let q = rawQuery;
  for (const [typo, fix] of Object.entries(FUZZY_CORRECTIONS)) {
    q = q.replace(new RegExp(`\\b${typo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), fix);
  }
  return q;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseNaturalLanguageQuery(rawQuery: string): ParsedQuery {
  const query = correctFuzzyTerms(rawQuery);
  const lowerQuery = query.toLowerCase();

  const result: ParsedQuery = {
    degrees: { any: false, highSchool: false, associate: false, bachelor: false, master: false, phd: false },
    certifications: { general: [], specific: [], inProgress: [] },
    institutions: {},
    experience: { minYears: 0 },
    skills: { required: [], fields: [], orGroups: [], excluded: [] },
    semantic: {},
    isCompound: false,
  };

  // "show all" / "list all" / "show me everyone" — return a special pass-through query
  if (/\b(show\s+(me\s+)?(all|every(one|body)?)|list\s+(all|every)|all\s+(candidates|resumes?|people)|everyone|everybody)\b/i.test(query)) {
    result.skills.fields.push('__all__');
    return result;
  }

  // Compound detection
  const hasAnd = /\band\b/i.test(query);
  const hasMultipleWith = (query.match(/\b(with|in)\b/gi) || []).length > 1;
  result.isCompound = hasAnd || hasMultipleWith;

  // OR groups
  result.skills.orGroups = parseOrGroups(query);

  // Exclusion terms
  result.skills.excluded = parseExclusionTerms(query);

  // Specific exclusions
  if (/\b(project\s+manager|management\s+role|manager|project\s+lead|5\s+years\s+in\s+management)\b/i.test(query) && /\b(not|exclude|without|no|drop|skip)\b/i.test(query)) {
    result.experience.excludeManagement = true;
  }
  if (/\b(visa\s+sponsorship|sponsorship|h1b|h-1b|visa)\b/i.test(query) && /\b(not|exclude|without|no|do\s+not)\b/i.test(query)) {
    result.experience.excludeVisaSponsorship = true;
  }
  if (/\bmaster'?s?\s+degree\b/i.test(query) && /\b(not|exclude|without|no|do\s+not|don.?t)\b/i.test(query)) {
    result.degrees.excludeMaster = true;
  }
  if (/\bassociate'?s?\b.*\b(exclude|skip|throw|drop|without)\b|\b(exclude|skip|throw|drop|without)\b.*\bassociate'?s?\b/i.test(query)) {
    result.degrees.excludeAssociate = true;
  }
  if (/\bexclude\s+.*foundational\b|\bonly\s+(?:the\s+)?foundational\b|\bfoundational\s+cloud\s+certs\b/i.test(query)) {
    result.certifications.excludeFoundational = true;
  }

  // GPA requirement
  if (/\b(gpa|grade\s+point\s+average|high\s+gpa)\b/i.test(query)) {
    result.degrees.requireGPA = true;
  }

  // GitHub requirement
  if (/\bgithub\b/i.test(query) && /\b(link|profile|active|have)\b/i.test(query)) {
    result.skills.requireGitHub = true;
  }

  // Clearance
  const clearance = detectClearance(query);
  if (clearance) {
    result.experience.clearance = clearance;
    // TS/SCI preferred but TS works → accept either
    if (/\bts\/sci\s+is\s+better|ts\/sci\s+preferred|either\s+works/i.test(query)) {
      result.experience.clearance = 'top_secret'; // accept TS+ (ts_sci also passes)
    }
  }
  // Require clearance snippet
  if (/\b(exact\s+(?:sentence|snippet|text)|pull\s+the\s+exact|lacks\s+an\s+exact\s+snippet)\b/i.test(query) && clearance) {
    result.experience.requireClearanceSnippet = true;
  }

  // Action verbs (positive doers)
  const actionVerbs = detectActionVerbs(query);
  if (actionVerbs.length > 0) result.experience.actionVerbs = actionVerbs;

  // Excluded action verbs
  const excludedVerbs = detectExcludedActionVerbs(query);
  if (excludedVerbs.length > 0) result.experience.excludeActionVerbs = excludedVerbs;

  // Currently employed as
  const currentlyMatch = query.match(/\bcurrently\s+(?:employed\s+(?:as|in)|working\s+as)\s+(?:an?\s+)?([a-z][a-z\s]{2,50}?)(?:\s*[.,]|$|\s+(?:not|rather|and|or|but))/i);
  if (currentlyMatch) result.experience.currentlyEmployedAs = currentlyMatch[1].trim();

  // "not just looking" — currently employed check
  if (/\bnot\s+just\s+looking|currently\s+employed|actively\s+working\b/i.test(query)) {
    if (!result.experience.currentlyEmployedAs) result.experience.currentlyEmployedAs = '__any__';
  }

  // Top N
  const topNResult = detectTopN(query);
  if (topNResult) {
    result.skills.topN = topNResult.n;
    result.skills.topNSkill = topNResult.skill;
  }

  // Title match preference
  if (/\b(prioritize|prefer|exact\s+title|title\s+match)\b/i.test(query)) {
    result.skills.preferTitleMatch = true;
  }

  // File type
  const fileType = detectFileType(query);
  if (fileType) result.skills.fileType = fileType;

  const excludeFileType = detectExcludeFileType(query);
  if (excludeFileType) result.skills.excludeFileType = excludeFileType;

  // Unreadable / scanned PDF
  if (/\b(unreadable|scanned|scanned\s+pdf|no\s+text|ocr|garbled|can.?t\s+read)\b/i.test(query)) {
    result.skills.showUnreadable = true;
  }
  if (/\bflag\s+((?:them|it|scanned|unreadable)[a-z\s]*(?:separately|for\s+me))\b/i.test(query)) {
    result.skills.flagUnreadable = true;
  }

  // Recently modified
  const recentMatch = query.match(/(?:last|past|within\s+the?\s+last|modified\s+in\s+the\s+last)\s+(\d+)\s+(day|days|week|weeks|month|months)/i);
  if (recentMatch) {
    let days = parseInt(recentMatch[1]);
    const unit = recentMatch[2].toLowerCase();
    if (unit.startsWith('week')) days *= 7;
    if (unit.startsWith('month')) days *= 30;
    result.experience.recentlyUpdatedDays = days;
  }
  // "last year" / "last 6 months"
  if (/\b(past|last)\s+year\b/i.test(query) && !result.experience.recentlyUpdatedDays) {
    result.experience.recentlyUpdatedDays = 365;
  }
  if (/\b(last|past)\s+6\s+months\b/i.test(query) && !result.experience.recentlyUpdatedDays) {
    result.experience.recentlyUpdatedDays = 180;
  }
  if (/\b(last|past)\s+60\s+days\b/i.test(query) && !result.experience.recentlyUpdatedDays) {
    result.experience.recentlyUpdatedDays = 60;
  }

  // Career transition detection
  const careerTransFields = detectCareerTransition(query);
  if (careerTransFields.length > 0) result.experience.careerTransitionFrom = careerTransFields;

  // ─── Degrees ───────────────────────────────────────────────────────────────
  result.degrees.highSchool = DEGREE_PATTERNS.highSchool.test(query);
  result.degrees.associate = DEGREE_PATTERNS.associate.test(query) && !result.degrees.excludeAssociate;
  result.degrees.bachelor = DEGREE_PATTERNS.bachelor.test(query);
  result.degrees.master = DEGREE_PATTERNS.master.test(query) && !result.degrees.excludeMaster;
  result.degrees.phd = DEGREE_PATTERNS.phd.test(query);

  const anyDegreePattern = /\b(any|a|an|some)\s+degree|degree[s]?\b|attended\s+(college|university)|college\s+degree/i;
  if (anyDegreePattern.test(query) && !result.degrees.bachelor && !result.degrees.master && !result.degrees.phd && !result.degrees.associate) {
    result.degrees.any = true;
  }

  // ─── Majors/fields ─────────────────────────────────────────────────────────
  const AMBIGUOUS_ABBREVS = new Set(['it', 'me', 'ce', 'pa', 'bi', 'ee', 'soc', 'comm', 'ms', 'ma']);
  const contextPrefix = `(?:(?:in|major|degree|background|field|study|studies|experience|concentration)\\s+)`;

  const wordBoundaryMatch = (text: string, keyword: string, originalQuery: string): boolean => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isShortAbbrev = keyword.length <= 4 && /^[a-zA-Z]+$/.test(keyword);
    if (isShortAbbrev && AMBIGUOUS_ABBREVS.has(keyword.toLowerCase())) {
      const upperEscaped = keyword.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?<![A-Z])${upperEscaped}(?![A-Z])`).test(originalQuery)) return true;
      return new RegExp(`${contextPrefix}${escaped}(?![a-zA-Z])`, 'i').test(text);
    }
    const pattern = isShortAbbrev
      ? `(?<![a-zA-Z])${escaped}(?![a-zA-Z])`
      : `\\b${escaped}\\b`;
    return new RegExp(pattern, 'i').test(text);
  };

  for (const [field, keywords] of Object.entries(MAJOR_FIELDS)) {
    for (const keyword of keywords) {
      if (wordBoundaryMatch(lowerQuery, keyword, query)) {
        result.degrees.specificField = field;
        result.skills.fields.push(field);
        break;
      }
    }
    if (result.degrees.specificField) break;
  }

  const majorPattern = /\b(?:degree[s]?|major|concentration|background|training|experience)\s+in\s+([a-z\s]+?)(?:\s+(?:and|with|or|\||$))/i;
  const majorMatch = query.match(majorPattern);
  if (majorMatch && !result.degrees.specificField) {
    const extractedMajor = majorMatch[1].trim();
    result.degrees.specificMajor = extractedMajor;
    result.skills.fields.push(extractedMajor);
  }

  // ─── Certifications ────────────────────────────────────────────────────────
  // In-progress detection
  const inProgressMatch = query.match(/(?:studying\s+for|in\s+progress|currently\s+pursuing|working\s+toward[s]?|preparing\s+for)\s+(?:(?:their|a|an|the)\s+)?([A-Z][A-Z0-9\+\-]+(?:\s+[A-Z][A-Z0-9\+\-]*)*)/gi);
  if (inProgressMatch) {
    for (const m of inProgressMatch) {
      const certNameMatch = m.match(/(?:studying\s+for|in\s+progress|pursuing|working\s+toward[s]?|preparing\s+for)\s+(?:(?:their|a|an|the)\s+)?(.+)/i);
      if (certNameMatch) result.certifications.inProgress!.push(certNameMatch[1].trim());
    }
  }

  for (const certGroup of CERTIFICATION_SYNONYMS) {
    const matched = (certGroup.pattern && certGroup.pattern.test(query)) ||
      certGroup.variants.some(v => lowerQuery.includes(v.toLowerCase()));
    if (matched) {
      if (!result.certifications.specific.includes(certGroup.primary)) {
        result.certifications.specific.push(certGroup.primary);
        result.certifications.general.push(certGroup.primary);
      }
    }
  }

  if (/\bcertification[s]?\b|\bcertified\b|\blicense[s]?\b/i.test(query) && result.certifications.specific.length === 0) {
    result.certifications.general.push('certification');
  }

  // ─── Vendor-level broad cert matching ──────────────────────────────────────
  // Fires when user says e.g. "cisco certifications", "aws certified", "any palo alto cert",
  // "holds a giac certification", "is cisco certified", "someone with juniper certs", etc.
  // We require BOTH a vendor keyword AND some linguistic cert signal in the query,
  // OR a phrase like "<vendor> certified" which is itself a cert signal.
  const hasCertSignal = CERT_LINGUISTIC_PATTERNS.test(query) ||
    /\b(certified|certification|cert\b|certs\b|credentialed|accredited)\b/i.test(query);
  if (hasCertSignal) {
    if (!result.certifications.vendors) result.certifications.vendors = [];
    for (const { vendors, pattern } of VENDOR_QUERY_PATTERNS) {
      if (pattern.test(query)) {
        for (const v of vendors) {
          if (!result.certifications.vendors.includes(v)) {
            result.certifications.vendors.push(v);
          }
        }
      }
    }
    // If vendor certs were found, expand specific list so resume matching also picks them up
    if (result.certifications.vendors.length > 0) {
      for (const vendor of result.certifications.vendors) {
        const vendorCerts = CERT_VENDOR_GROUPS[vendor] ?? [];
        for (const cert of vendorCerts) {
          if (!result.certifications.specific.includes(cert)) {
            result.certifications.specific.push(cert);
          }
        }
      }
    }
  }

  // ─── Institution ───────────────────────────────────────────────────────────
  if (IVY_LEAGUE.some(school => lowerQuery.includes(school))) {
    result.institutions.type = 'ivy_league';
  } else if (INSTITUTION_PATTERNS.state_university.test(query)) {
    result.institutions.type = 'state_university';
  } else if (INSTITUTION_PATTERNS.community_college.test(query)) {
    result.institutions.type = 'community_college';
  } else if (INSTITUTION_PATTERNS.trade_school.test(query)) {
    result.institutions.type = 'trade_school';
  } else if (INSTITUTION_PATTERNS.liberal_arts.test(query)) {
    result.institutions.type = 'liberal_arts';
  } else if (INSTITUTION_PATTERNS.technical_institute.test(query)) {
    result.institutions.type = 'technical_institute';
  } else if (INSTITUTION_PATTERNS.bootcamp.test(query)) {
    result.institutions.type = 'bootcamp';
  } else if (/\b(private\s+(?:university|college))\b/i.test(query)) {
    result.institutions.type = 'private';
  } else if (/\b(public\s+(?:university|college))\b/i.test(query)) {
    result.institutions.type = 'public';
  }

  const institutionPattern = /\b(?:from|at|attended|graduated)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:University|College|Institute|School)))/;
  const institutionMatch = query.match(institutionPattern);
  if (institutionMatch) result.institutions.specificName = institutionMatch[1];

  // ─── Years of experience ───────────────────────────────────────────────────
  const yearsMatch = lowerQuery.match(/(\d+)\+?\s*(?:year[s]?|yr[s]?)\s*(?:of\s*)?(?:experience|exp|work|employment)/i);
  if (yearsMatch) result.experience.minYears = parseInt(yearsMatch[1]);

  const moreThanMatch = lowerQuery.match(/(?:more\s+than|at\s+least|over)\s+(\d+)\s*(?:\+)?\s*(?:year[s]?|yr[s]?)/i);
  if (moreThanMatch && result.experience.minYears === 0) result.experience.minYears = parseInt(moreThanMatch[1]) + 1;

  const plusYearsMatch = lowerQuery.match(/(\d+)\s*\+\s*(?:year[s]?|yr[s]?)/i);
  if (plusYearsMatch && result.experience.minYears === 0) result.experience.minYears = parseInt(plusYearsMatch[1]);

  const writtenNumbers: { [key: string]: number } = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };
  for (const [word, num] of Object.entries(writtenNumbers)) {
    if (new RegExp(`\\b${word}\\s+year[s]?\\s+(?:of\\s+)?(?:experience|exp)`, 'i').test(lowerQuery)) {
      result.experience.minYears = num;
      break;
    }
  }

  // ─── Seniority ─────────────────────────────────────────────────────────────
  for (const [level, pattern] of Object.entries(SENIORITY_PATTERNS)) {
    if (pattern.test(query)) {
      result.experience.seniority = level as ExperienceRequirements['seniority'];
      break;
    }
  }

  // ─── Company ───────────────────────────────────────────────────────────────
  const companyPattern = /\b(?:at|with|from|worked at|employed by)\s+((?:[A-Z][a-z]+\s*){1,5}(?:Company|Corporation|Inc|LLC|Ltd|Co\.))/;
  const companyMatch = query.match(companyPattern);
  if (companyMatch) result.experience.specificCompany = companyMatch[1];

  if (/\bthe\s+walt\s+disney\s+company\b/i.test(query)) {
    result.experience.specificCompany = 'The Walt Disney Company';
  }

  // ─── Specific role ─────────────────────────────────────────────────────────
  const rolePattern = /\b(?:as|experience as|worked as|role as)\s+(?:a\s+)?([a-z\s]+?)(?:\s+(?:with|and|at|or|\||$))/i;
  const roleMatch = query.match(rolePattern);
  if (roleMatch) result.experience.specificRole = roleMatch[1].trim();

  // ─── Industry ──────────────────────────────────────────────────────────────
  const industries = ['finance', 'financial', 'customer service', 'cybersecurity', 'information technology', 'healthcare', 'education', 'retail', 'manufacturing', 'defense', 'federal', 'government'];
  for (const industry of industries) {
    if (lowerQuery.includes(industry)) {
      result.experience.industry = industry;
      break;
    }
  }

  // ─── Domain/tech skill matching ────────────────────────────────────────────
  // IMPORTANT: CERTIFICATION_SYNONYMS are excluded here — certs are handled by
  // the certification detection logic and must not bleed into skills.required.
  const certPrimaries = new Set(CERTIFICATION_SYNONYMS.map(g => g.primary));
  for (const group of [...DOMAIN_SYNONYMS, ...TECH_SYNONYMS, ...CERTIFICATION_SYNONYMS]) {
    const matched = (group.pattern && group.pattern.test(query)) ||
      group.variants.some(v => lowerQuery.includes(v.toLowerCase()));
    if (matched) {
      // If this is a certification primary, push it as a specific cert, not a skill
      if (certPrimaries.has(group.primary)) {
        if (!result.certifications.specific.includes(group.primary)) {
          result.certifications.specific.push(group.primary);
        }
      } else if (!result.skills.required.includes(group.primary)) {
        result.skills.required.push(group.primary);
      }
    }
  }

  // ─── General skills ────────────────────────────────────────────────────────
  // Very broad stop-word list: every common English verb, pronoun, preposition,
  // connector, question word, filler phrase, and query-framing word that is NOT
  // a meaningful skill or domain term.
  const stopWords = new Set([
    // articles / determiners
    'the', 'the', 'a', 'an', 'any', 'all', 'some', 'many', 'much', 'few', 'several', 'each', 'every', 'both',
    // pronouns
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'their', 'who', 'whom', 'whose',
    'this', 'that', 'these', 'those', 'which', 'what',
    // prepositions / conjunctions
    'in', 'on', 'at', 'by', 'for', 'of', 'to', 'up', 'as', 'or', 'and', 'but', 'nor', 'so', 'yet', 'if',
    'from', 'with', 'into', 'onto', 'upon', 'over', 'under', 'about', 'than', 'then', 'also', 'either',
    'neither', 'both', 'not', 'only', 'just', 'even', 'very', 'too', 'now', 'how', 'when', 'where', 'why',
    'because', 'since', 'until', 'while', 'after', 'before', 'through', 'between', 'among', 'without',
    'within', 'across', 'along', 'near', 'off', 'out', 'per', 'plus', 'like', 'via', 'yet',
    // auxiliary / modal verbs
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'done',
    'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'need', 'dare', 'ought',
    // common query-framing words (not skills)
    'find', 'show', 'give', 'list', 'get', 'look', 'search', 'run', 'pull', 'fetch', 'return', 'display',
    'tell', 'bring', 'send', 'check', 'want', 'make', 'sure', 'need', 'help', 'try', 'lets', 'please',
    // conversational filler
    'okay', 'alright', 'right', 'well', 'hmm', 'yeah', 'yep', 'nope', 'sure', 'great', 'good',
    // natural-language framing words that appear around real search terms
    'people', 'person', 'candidate', 'candidates', 'applicant', 'applicants', 'resume', 'resumes',
    'someone', 'anyone', 'everybody', 'nobody', 'those', 'ones', 'them', 'members',
    'experience', 'experiences', 'background', 'history', 'knowledge', 'skills', 'skill', 'ability',
    'abilities', 'work', 'works', 'worked', 'working', 'role', 'roles', 'position', 'positions', 'job',
    'jobs', 'career', 'careers', 'field', 'fields', 'area', 'areas', 'industry', 'sector', 'domain',
    // action-framing words that wrap real skills
    'using', 'uses', 'used', 'knows', 'know', 'knowing', 'familiar', 'proficient', 'expert', 'expertise',
    'specialist', 'specialize', 'focus', 'focused', 'knowledgeable', 'versed', 'trained', 'certified',
    // degree words — already handled by degree detection logic, must not leak into skills
    'degree', 'degrees', 'major', 'minor', 'concentration', 'graduate', 'graduated', 'university',
    'college', 'school', 'institution', 'program', 'course', 'courses', 'study', 'studied', 'studies',
    'bachelor', 'bachelors', 'undergraduate', 'master', 'masters', 'doctorate', 'doctoral',
    'associates', 'associate', 'diploma', 'phd', 'mba', 'postgraduate', 'postgrad',
    // cert words — already handled by certification detection logic
    'certification', 'certifications', 'certified', 'license', 'licenses', 'licensed', 'credentialed',
    // numeric / time
    'year', 'years', 'month', 'months', 'week', 'weeks', 'day', 'days', 'recent', 'recently', 'current',
    'currently', 'active', 'actively', 'previous', 'formerly', 'past', 'last', 'first', 'next', 'latest',
    // misc functional words
    'than', 'more', 'less', 'most', 'least', 'such', 'other', 'another', 'same', 'different', 'else',
    'include', 'included', 'including', 'exclude', 'excluded', 'excluding', 'rather', 'instead',
    'skip', 'drop', 'throw', 'remove', 'flag', 'explicitly', 'specifically', 'ideally', 'preferably',
    'currently', 'actually', 'really', 'truly', 'simply', 'only', 'exactly', 'either', 'neither',
    'sweep', 'recent', 'uploads', 'hired', 'hire', 'hiring', 'filter', 'filtered', 'results', 'result',
    'match', 'matches', 'matching', 'found', 'showing', 'ranked', 'rank', 'score', 'scored', 'top',
    'bottom', 'best', 'worst', 'highest', 'lowest', 'strong', 'stronger', 'strongest', 'weak',
  ]);

  // Only keep words that look like they could be genuine technical/domain terms:
  // - length > 3 (avoids noise like "the", "and", two-letter abbreviations already handled above)
  // - not in the stop list
  // - not already captured by synonym groups
  // - not purely alphabetic words that are common English (handled by stop list above)
  const skillKeywords = lowerQuery.match(/\b[a-z]{4,}(?:\+\+|\#)?\b/g) || [];
  const extraSkills = skillKeywords.filter(skill =>
    !stopWords.has(skill) &&
    !result.skills.required.some(s => s.toLowerCase() === skill) &&
    // Reject if it's just a field name already captured
    !result.skills.fields.includes(skill) &&
    // Reject if it matches any MAJOR_FIELDS key (already handled via specificField)
    !Object.keys(MAJOR_FIELDS).some(f => f === skill)
  );
  result.skills.required = [...result.skills.required, ...extraSkills];

  // ─── Semantic patterns ─────────────────────────────────────────────────────

  // Leadership without official title
  if (/\b(managing\s+a\s+team|led?\s+(?:a\s+)?team|even\s+if\s+(?:not|their)\s+(?:official\s+)?(?:manager|titled?)|without\s+(?:the\s+)?(?:official\s+)?(?:manager\s+)?title|informal\s+leader|de\s+facto\s+lead|who\s+(?:managed|led|supervised)\s+(?:a\s+)?team)\b/i.test(query)) {
    result.semantic.leadershipWithoutTitle = true;
  }

  // Built from scratch / greenfield
  if (/\b(from\s+scratch|built\s+(?:new\s+)?infrastructure|greenfield|ground\s+up|rather\s+than\s+(?:just\s+)?maintaining)\b/i.test(query)) {
    result.semantic.greenfield = true;
  }

  // Hands-on technical
  if (/\b(hands?.on|most\s+technical|most\s+(?:hands?.on\s+)?technical|technical\s+candidates?)\b/i.test(query)) {
    result.semantic.handsOnTech = true;
  }

  // Fast-paced / startup / high-stress
  if (/\b(fast.paced|fast\s+paced|high.stress|high\s+stress|startup|high.pressure|emergency\s+response|dynamic\s+environment)\b/i.test(query)) {
    result.semantic.fastPaced = true;
  }

  // Customer escalation / difficult clients
  if (/\b(angry\s+clients?|difficult\s+customer|escalation|de.escalation|customer\s+(?:conflict|complaint|service\s+escalation)|irate\s+(?:clients?|customers?))\b/i.test(query)) {
    result.semantic.customerEscalation = true;
  }

  // Promoted at same company
  if (/\b(promoted\s+(?:at\s+least\s+once|while\s+working|at\s+(?:the\s+)?same\s+company)|promotion\s+within|advance[sd]?\s+(?:within|at\s+(?:the\s+)?same))\b/i.test(query)) {
    result.semantic.promotedInPlace = true;
  }

  // Studied while working full-time
  if (/\b(balanced\s+(?:a\s+)?full.time|worked\s+(?:full.time\s+)?while\s+(?:completing|studying|in\s+school|earning)|while\s+completing\s+(?:their|a)\s+(?:college|degree|bachelor)|full.time\s+job\s+while\s+completing)\b/i.test(query)) {
    result.semantic.studiedWhileWorking = true;
  }

  // Exclude currently enrolled
  if (/\b(exclude\s+(?:those?\s+)?(?:who\s+are\s+)?still\s+(?:currently\s+)?enrolled|not\s+currently\s+enrolled|still\s+in\s+school|exclude\s+(?:those\s+)?(?:still\s+)?(?:currently\s+)?(?:enrolled|in\s+school))\b/i.test(query)) {
    result.semantic.excludeCurrentlyEnrolled = true;
  }

  // Exact job title requirement
  const exactTitleMatch = query.match(/\bexactly\s+['"]?([^'"]+?)['"]?(?:\s*[.,]|$)/i) ||
                           query.match(/\bwhose\s+(?:most\s+recent\s+)?(?:title|role)\s+was\s+(?:exactly\s+)?['"]?([^'"]+?)['"]?(?:\s*[.,]|$)/i);
  if (exactTitleMatch) {
    result.semantic.exactTitle = exactTitleMatch[1].trim();
  }

  // AI-generated content detection (pass-through all, flag in handler)
  if (/\b(flag|detect|identify)\s+(?:any\s+)?(?:resumes?\s+)?(?:that\s+)?(?:appear\s+to\s+be\s+)?(?:completely\s+)?(?:ai.generated|artificially\s+generated|stuffed\s+with\s+hidden|keyword.stuffed)\b/i.test(query)) {
    result.semantic.detectAIGenerated = true;
    if (!result.skills.fields.includes('__all__')) result.skills.fields.push('__all__');
  }

  // Rank by cert count
  if (/\brank(?:ed?|ing)?\s+(?:the\s+)?(?:top\s+\d+\s+)?(?:[\w\s]+?)?candidates?\s+based\s+on\s+(?:their\s+)?(?:total\s+(?:number\s+of\s+)?)?(?:active\s+|relevant\s+)?certifications?\b/i.test(query)) {
    result.semantic.rankByCertCount = true;
  }

  // Exclude purely front-end
  if (/\b(purely\s+front.end|front.end\s+only|only\s+front.end)\b/i.test(query) && /\b(exclude|filter\s+out|without|no)\b/i.test(query)) {
    result.semantic.excludeFrontendOnly = true;
  }

  return result;
}

// ─── Resume matching ───────────────────────────────────────────────────────────

function isUnreadableResume(content: string): boolean {
  if (!content || content.trim().length < MIN_READABLE_CHARS) return true;
  const readable = content.replace(/[^a-zA-Z\s]/g, '').trim();
  const totalWords = readable.split(/\s+/).filter(w => w.length > 1);
  return totalWords.length < 20;
}

function checkClearance(content: string, required: 'secret' | 'top_secret' | 'ts_sci' | 'ts_eligible' | 'any'): boolean {
  const patterns = {
    ts_sci: /\b(ts\s*\/?\s*sci|top\s+secret\s*\/?\s*sci)\b/i,
    // top_secret accepts TS/SCI or straight TS
    top_secret: /\b(top\s+secret|ts\s*\/?\s*sci|ts\b)\b/i,
    ts_eligible: /\b(ts\s+eligible|top\s+secret\s+eligible|ts-eligible)\b/i,
    secret: /\b(secret\s+clearance|active\s+secret|secret|top\s+secret|ts\b|ts\s*\/?\s*sci)\b/i,
    any: /\b(clearance|secret|top\s+secret|ts\b|ts\s*\/?\s*sci|security\s+clearance)\b/i,
  };
  return patterns[required].test(content);
}

function extractClearanceSnippet(content: string): string {
  const pattern = /\b(ts\s*\/?\s*sci|top\s+secret|secret\s+clearance|security\s+clearance|clearance)\b/i;
  const idx = content.search(pattern);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 120);
  const end = Math.min(content.length, idx + 200);
  let snippet = content.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

function checkActionVerbNearSkill(content: string, verbs: string[], skill: string): boolean {
  const lowerContent = content.toLowerCase();
  const lowerSkill = skill.toLowerCase();
  const skillIdx = lowerContent.indexOf(lowerSkill);
  if (skillIdx === -1) return false;
  const window = lowerContent.slice(Math.max(0, skillIdx - 200), skillIdx + skill.length + 200);
  return verbs.some(verb => {
    const vPattern = ACTION_VERB_PATTERNS[verb];
    return vPattern ? vPattern.test(window) : false;
  });
}

function checkOnlyPassiveVerbs(content: string, skill: string): boolean {
  const lowerContent = content.toLowerCase();
  const lowerSkill = skill.toLowerCase();
  const skillIdx = lowerContent.indexOf(lowerSkill);
  if (skillIdx === -1) return false;
  const window = content.slice(Math.max(0, skillIdx - 300), skillIdx + skill.length + 300);
  const hasPassive = PASSIVE_VERB_PATTERNS.some(p => p.test(window));
  const hasActive = Object.values(ACTION_VERB_PATTERNS).some(p => p.test(window));
  return hasPassive && !hasActive;
}

function checkCurrentlyEmployed(content: string, role: string): boolean {
  if (role === '__any__') {
    return /\b(current|present|currently\s+employed|currently\s+working)\b/i.test(content);
  }
  const roleLower = role.toLowerCase();
  const escaped = roleLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(current|present|currently)[^.]{0,150}${escaped}|${escaped}[^.]{0,150}(current|present|currently)`,
    'i'
  );
  return pattern.test(content);
}

function checkCareerTransition(content: string, fromFields: string[]): boolean {
  for (const field of fromFields) {
    if (field === 'unrelated') {
      const hasAnyUnrelated = Object.values(UNRELATED_FIELD_PATTERNS).some(p => p.test(content));
      if (hasAnyUnrelated) return true;
    } else {
      const pattern = UNRELATED_FIELD_PATTERNS[field];
      if (pattern && pattern.test(content)) return true;
    }
  }
  return false;
}

function scoreForSkill(content: string, skill: string): number {
  if (!skill) return 0;
  const lower = content.toLowerCase();
  const skillLower = skill.toLowerCase();
  let count = 0;
  let idx = lower.indexOf(skillLower);
  while (idx !== -1) { count++; idx = lower.indexOf(skillLower, idx + 1); }
  return count;
}

// ─── matchResumeToQuery ────────────────────────────────────────────────────────

export function matchResumeToQuery(
  resumeContent: string,
  parsedQuery: ParsedQuery,
  resumeMeta?: { file_name?: string; indexed_at?: string }
): {
  matches: boolean;
  score: number;
  reasons: string[];
  clearanceSnippet?: string;
  isUnreadable?: boolean;
} {
  const contentLower = resumeContent.toLowerCase();
  let score = 0;
  const reasons: string[] = [];
  let requiredMatches = 0;
  let totalRequired = 0;

  // ── Show-all pass-through ─────────────────────────────────────────────────
  if (parsedQuery.skills.fields.includes('__all__')) {
    return { matches: true, score: 1, reasons: ['other:All candidates'] };
  }

  // ── Unreadable / scanned PDF ─────────────────────────────────────────────
  const unreadable = isUnreadableResume(resumeContent);
  if (parsedQuery.skills.showUnreadable && !parsedQuery.skills.flagUnreadable) {
    return { matches: unreadable, score: unreadable ? 10 : 0, reasons: unreadable ? ['Unreadable/scanned resume'] : [], isUnreadable: unreadable };
  }

  // ── File type filter ──────────────────────────────────────────────────────
  const fileName = resumeMeta?.file_name || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (parsedQuery.skills.fileType && parsedQuery.skills.fileType !== 'any') {
    if (parsedQuery.skills.fileType === 'docx' && ext !== 'docx') return { matches: false, score: 0, reasons: [] };
    if (parsedQuery.skills.fileType === 'pdf' && ext !== 'pdf') return { matches: false, score: 0, reasons: [] };
  }
  if (parsedQuery.skills.excludeFileType) {
    if (parsedQuery.skills.excludeFileType === 'docx' && ext === 'docx') return { matches: false, score: 0, reasons: [] };
    if (parsedQuery.skills.excludeFileType === 'pdf' && ext === 'pdf') return { matches: false, score: 0, reasons: [] };
  }

  // ── Recently updated filter ───────────────────────────────────────────────
  if (parsedQuery.experience.recentlyUpdatedDays && resumeMeta?.indexed_at) {
    const indexedDate = new Date(resumeMeta.indexed_at);
    const cutoff = new Date(Date.now() - parsedQuery.experience.recentlyUpdatedDays * 24 * 60 * 60 * 1000);
    if (indexedDate < cutoff) return { matches: false, score: 0, reasons: [] };
  }

  // ── Visa sponsorship exclusion ────────────────────────────────────────────
  if (parsedQuery.experience.excludeVisaSponsorship) {
    if (VISA_SPONSORSHIP_PATTERNS.some(p => p.test(resumeContent))) return { matches: false, score: 0, reasons: [] };
  }

  // ── Management role exclusion ─────────────────────────────────────────────
  if (parsedQuery.experience.excludeManagement) {
    if (MANAGEMENT_ROLE_PATTERNS.some(p => p.test(resumeContent))) return { matches: false, score: 0, reasons: [] };
  }

  // ── Master's degree exclusion ─────────────────────────────────────────────
  if (parsedQuery.degrees.excludeMaster) {
    const masterGroups = DEGREE_SYNONYMS.filter(g => g.primary.includes('Master') || g.primary === 'MBA');
    if (masterGroups.some(g => g.pattern?.test(resumeContent) || g.variants.some(v => contentLower.includes(v)))) {
      return { matches: false, score: 0, reasons: [] };
    }
  }

  // ── Associate degree exclusion ────────────────────────────────────────────
  if (parsedQuery.degrees.excludeAssociate) {
    const assocGroup = DEGREE_SYNONYMS.find(g => g.primary === 'Associate Degree');
    const hasBachelor = DEGREE_SYNONYMS.filter(g => g.primary.includes('Bachelor')).some(g => g.pattern?.test(resumeContent));
    const hasMaster = DEGREE_SYNONYMS.filter(g => g.primary.includes('Master') || g.primary === 'MBA').some(g => g.pattern?.test(resumeContent));
    const hasPhD = DEGREE_SYNONYMS.find(g => g.primary === 'PhD')?.pattern?.test(resumeContent);
    // Exclude if highest degree is associate (no bachelor+)
    if (assocGroup && (assocGroup.pattern?.test(resumeContent) || assocGroup.variants.some(v => contentLower.includes(v))) &&
        !hasBachelor && !hasMaster && !hasPhD) {
      return { matches: false, score: 0, reasons: [] };
    }
  }

  // ── Foundational cert exclusion ───────────────────────────────────────────
  if (parsedQuery.certifications.excludeFoundational) {
    if (FOUNDATIONAL_CERT_PATTERNS.some(p => p.test(resumeContent))) return { matches: false, score: 0, reasons: [] };
  }

  // ── Generic excluded terms ────────────────────────────────────────────────
  if (parsedQuery.skills.excluded && parsedQuery.skills.excluded.length > 0) {
    for (const term of parsedQuery.skills.excluded) {
      if (matchesAnySynonym(resumeContent, term)) return { matches: false, score: 0, reasons: [] };
    }
  }

  // ── Clearance check ───────────────────────────────────────────────────────
  let clearanceSnippet: string | undefined;
  if (parsedQuery.experience.clearance) {
    const hasClearance = checkClearance(resumeContent, parsedQuery.experience.clearance);
    if (!hasClearance) return { matches: false, score: 0, reasons: [] };
    clearanceSnippet = extractClearanceSnippet(resumeContent);
    if (parsedQuery.experience.requireClearanceSnippet && !clearanceSnippet) {
      return { matches: false, score: 0, reasons: [] };
    }
    score += 30;
    const label = parsedQuery.experience.clearance.replace('_', '/').toUpperCase();
    reasons.push(`clearance:${label}`);
    totalRequired++;
    requiredMatches++;
  }

  // ── Currently employed ────────────────────────────────────────────────────
  if (parsedQuery.experience.currentlyEmployedAs) {
    const employed = checkCurrentlyEmployed(resumeContent, parsedQuery.experience.currentlyEmployedAs);
    if (employed) {
      score += 20;
      reasons.push(parsedQuery.experience.currentlyEmployedAs === '__any__'
        ? 'employment:current'
        : `employment:${parsedQuery.experience.currentlyEmployedAs}`);
    } else if (parsedQuery.isCompound) {
      // Don't hard-fail on this, but don't award points
    }
  }

  // ── Career transition check ───────────────────────────────────────────────
  if (parsedQuery.experience.careerTransitionFrom && parsedQuery.experience.careerTransitionFrom.length > 0) {
    const transitioned = checkCareerTransition(resumeContent, parsedQuery.experience.careerTransitionFrom);
    if (transitioned) {
      score += 20;
      reasons.push('other:Career transition from unrelated field');
      // Also reward soft skills mentions
      if (/\b(communication|teamwork|problem\s+solving|adaptable|customer\s+service|interpersonal)\b/i.test(resumeContent)) {
        score += 10;
        reasons.push('other:Soft skills highlighted');
      }
    }
  }

  // ── In-progress certifications ────────────────────────────────────────────
  if (parsedQuery.certifications.inProgress && parsedQuery.certifications.inProgress.length > 0) {
    for (const cert of parsedQuery.certifications.inProgress) {
      const certLower = cert.toLowerCase();
      const escaped = certLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const inProgPattern = new RegExp(
        `(studying\\s+for|in\\s+progress|pursuing|working\\s+toward|preparing)[^.]{0,100}${escaped}|${escaped}[^.]{0,100}(in\\s+progress|pursuing|studying)`,
        'i'
      );
      if (inProgPattern.test(resumeContent)) {
        score += 15;
        reasons.push(`cert_progress:${cert}`);
      }
    }
    // If user specifically wants in-progress (not holders), down-score those who already hold
    if (/\b(rather\s+than|not\s+already|not\s+currently\s+hold|instead\s+of)\b/i.test('')) {
      // Would need query context here — handled by exclusion terms
    }
  }

  // ── GPA requirement ───────────────────────────────────────────────────────
  if (parsedQuery.degrees.requireGPA) {
    const hasGPA = /\b(gpa|grade\s+point\s+average)[:\s]+[34]\.\d|\b[34]\.\d\s*(gpa|grade\s+point)\b/i.test(resumeContent);
    if (!hasGPA) return { matches: false, score: 0, reasons: [] };
    score += 15;
    reasons.push('other:GPA stated on resume');
  }

  // ── GitHub link ───────────────────────────────────────────────────────────
  if (parsedQuery.skills.requireGitHub) {
    const hasGitHub = /github\.com\/[a-zA-Z0-9\-]+/i.test(resumeContent) || /\bgithub\b/i.test(resumeContent);
    if (!hasGitHub) return { matches: false, score: 0, reasons: [] };
    score += 10;
    reasons.push('other:GitHub profile found');
  }

  // ── Compound query required-condition counting ────────────────────────────
  if (parsedQuery.isCompound) {
    if (parsedQuery.degrees.bachelor || parsedQuery.degrees.master || parsedQuery.degrees.phd || parsedQuery.degrees.associate || parsedQuery.degrees.highSchool) totalRequired++;
    if (parsedQuery.degrees.specificField || parsedQuery.degrees.specificMajor) totalRequired++;
    if (parsedQuery.certifications.specific.length > 0) totalRequired++;
    if (parsedQuery.experience.seniority) totalRequired++;
    if (parsedQuery.experience.minYears > 0) totalRequired++;
    if (parsedQuery.institutions.type || parsedQuery.institutions.specificName) totalRequired++;
    if (parsedQuery.skills.orGroups && parsedQuery.skills.orGroups.length > 0) totalRequired += parsedQuery.skills.orGroups.length;
  }

  // ── OR groups ─────────────────────────────────────────────────────────────
  if (parsedQuery.skills.orGroups && parsedQuery.skills.orGroups.length > 0) {
    for (const group of parsedQuery.skills.orGroups) {
      const matchedTerm = group.find(term => matchesAnySynonym(resumeContent, term));
      if (matchedTerm) {
        score += 15;
        reasons.push(`skill:${matchedTerm}`);
        requiredMatches++;
      }
    }
  }

  // ── Degree check ──────────────────────────────────────────────────────────
  if (parsedQuery.degrees.phd) {
    const phdGroup = DEGREE_SYNONYMS.find(g => g.primary === 'PhD');
    if (phdGroup && (phdGroup.pattern?.test(resumeContent) || phdGroup.variants.some(v => contentLower.includes(v.toLowerCase())))) {
      score += 20; reasons.push('degree:PhD/Doctorate'); requiredMatches++;
    }
  } else if (parsedQuery.degrees.master) {
    const masterGroups = DEGREE_SYNONYMS.filter(g => g.primary.includes('Master') || g.primary === 'MBA');
    if (masterGroups.some(g => g.pattern?.test(resumeContent) || g.variants.some(v => contentLower.includes(v.toLowerCase())))) {
      score += 18; reasons.push("degree:Master's"); requiredMatches++;
    }
  } else if (parsedQuery.degrees.bachelor) {
    const bachelorGroups = DEGREE_SYNONYMS.filter(g => g.primary.includes('Bachelor'));
    if (bachelorGroups.some(g => g.pattern?.test(resumeContent) || g.variants.some(v => contentLower.includes(v.toLowerCase())))) {
      score += 15; reasons.push("degree:Bachelor's"); requiredMatches++;
    }
  } else if (parsedQuery.degrees.associate) {
    const assocGroup = DEGREE_SYNONYMS.find(g => g.primary === 'Associate Degree');
    if (assocGroup && (assocGroup.pattern?.test(resumeContent) || assocGroup.variants.some(v => contentLower.includes(v.toLowerCase())))) {
      score += 12; reasons.push("degree:Associate's"); requiredMatches++;
    }
  } else if (parsedQuery.degrees.highSchool) {
    const gedGroup = DEGREE_SYNONYMS.find(g => g.primary === 'GED');
    if ((gedGroup && (gedGroup.pattern?.test(resumeContent) || gedGroup.variants.some(v => contentLower.includes(v.toLowerCase())))) ||
        /\b(high\s+school|hs\s+diploma)\b/i.test(resumeContent)) {
      score += 10; reasons.push('degree:High School Diploma/GED'); requiredMatches++;
    }
  } else if (parsedQuery.degrees.any && /\b(university|college|bachelor|master|phd|associate)\b/i.test(resumeContent)) {
    score += 10; reasons.push('degree:College education'); requiredMatches++;
  }

  // ── Field/major check ─────────────────────────────────────────────────────
  const AMBIGUOUS_RESUME_ABBREVS = new Set(['it', 'me', 'ce', 'pa', 'bi', 'ee', 'soc', 'comm', 'ms', 'ma']);
  const resumeContextPrefix = `(?:(?:in|major|degree|background|field|study|studies|experience|concentration|bs|b\\.s\\.|ms|m\\.s\\.)\\s+)`;
  const fieldWordBoundary = (keyword: string): boolean => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isShortAbbrev = keyword.length <= 4 && /^[a-zA-Z]+$/.test(keyword);
    if (isShortAbbrev && AMBIGUOUS_RESUME_ABBREVS.has(keyword.toLowerCase())) {
      const upperEscaped = keyword.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?<![A-Z])${upperEscaped}(?![A-Z])`).test(resumeContent)) return true;
      return new RegExp(`${resumeContextPrefix}${escaped}(?![a-zA-Z])`, 'i').test(resumeContent);
    }
    const pattern = isShortAbbrev ? `(?<![a-zA-Z])${escaped}(?![a-zA-Z])` : `\\b${escaped}\\b`;
    return new RegExp(pattern, 'i').test(resumeContent);
  };

  // Fields whose keywords are common single words that appear incidentally in many resumes.
  // For these, require either: a strong-signal keyword (multi-word / title-specific), OR
  // the weak keyword appearing alongside a career/title/education context phrase.
  const WEAK_SINGLE_WORD_FIELDS = new Set([
    'law', 'finance', 'marketing', 'education', 'management', 'accounting',
    'economics', 'psychology', 'sociology', 'humanities', 'arts', 'mathematics',
    'communications', 'biology', 'chemistry', 'physics',
  ]);
  // Keywords within these fields that are strong enough to match alone
  const STRONG_FIELD_KEYWORDS: Record<string, RegExp> = {
    'law': /\b(attorney|lawyer|paralegal|juris\s+doctor|j\.d\.|llb|llm|litigation|legal\s+counsel|contract\s+law|corporate\s+law|law\s+firm|law\s+school|legal\s+practice|barrister|solicitor|esquire|esq\.)\b/i,
    'finance': /\b(cfa|cpa|financial\s+analyst|investment\s+bank|portfolio\s+manag|equity\s+research|bloomberg|capital\s+markets|derivatives|hedge\s+fund|asset\s+manag|actuarial)\b/i,
    'marketing': /\b(marketing\s+manager|brand\s+manager|digital\s+marketing|marketing\s+director|chief\s+marketing|cmo|marketing\s+degree|b\.s\.\s+marketing|b\.a\.\s+marketing)\b/i,
    'education': /\b(teacher|professor|curriculum|classroom|pedagogy|k-12|elementary|middle\s+school|high\s+school\s+teacher|school\s+district|teaching\s+certificate|m\.ed\.|b\.ed\.)\b/i,
    'accounting': /\b(cpa|cma|cfe|accountant|controller|auditor|gaap|ifrs|tax\s+return|bookkeeping|accounts\s+payable|accounts\s+receivable)\b/i,
  };
  // Context phrases that make a weak single-word hit credible
  const FIELD_CONTEXT_RE = /\b(degree|major|background|experience\s+in|career\s+in|practice|practitioner|specialist|professional|work\s+in|studied|studies|certificate)\b/i;

  if (parsedQuery.degrees.specificField) {
    const field = parsedQuery.degrees.specificField;
    const fieldKeywords = MAJOR_FIELDS[field] || [field];
    const isWeak = WEAK_SINGLE_WORD_FIELDS.has(field);

    let matched = false;
    if (isWeak) {
      // Check strong-signal regex first
      const strongRe = STRONG_FIELD_KEYWORDS[field];
      if (strongRe && strongRe.test(resumeContent)) {
        matched = true;
      } else {
        // Weak keyword + context: find any keyword, then check a window around it for context
        for (const kw of fieldKeywords) {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const kwRe = new RegExp(`\\b${escaped}\\b`, 'gi');
          let m: RegExpExecArray | null;
          while ((m = kwRe.exec(contentLower)) !== null) {
            const window = resumeContent.slice(Math.max(0, m.index - 120), m.index + kw.length + 120);
            if (FIELD_CONTEXT_RE.test(window)) { matched = true; break; }
          }
          if (matched) break;
        }
        // Also accept if 3+ distinct field keywords appear (strong collective signal)
        if (!matched) {
          const hits = fieldKeywords.filter(k => fieldWordBoundary(k));
          if (hits.length >= 3) matched = true;
        }
      }
    } else {
      matched = fieldKeywords.some(k => fieldWordBoundary(k));
    }

    if (matched) {
      score += 25; reasons.push(`field:${field}`); requiredMatches++;
    }
  }
  if (parsedQuery.degrees.specificMajor && fieldWordBoundary(parsedQuery.degrees.specificMajor)) {
    score += 20; reasons.push(`major:${parsedQuery.degrees.specificMajor}`); requiredMatches++;
  }

  // ── Certification check ───────────────────────────────────────────────────
  if (parsedQuery.certifications.specific.length > 0) {
    const isVendorQuery = (parsedQuery.certifications.vendors?.length ?? 0) > 0;
    let certMatched = false;
    for (const cert of parsedQuery.certifications.specific) {
      if (matchesAnySynonym(resumeContent, cert)) {
        score += 25; reasons.push(`cert:${cert}`); certMatched = true;
        // For specific (non-vendor) queries stop at first match.
        // For vendor queries keep scanning so all held certs surface as reasons.
        if (!isVendorQuery) break;
      }
    }
    if (certMatched) requiredMatches++;
  }

  // ── Institution check ─────────────────────────────────────────────────────
  if (parsedQuery.institutions.type) {
    let instMatched = false;
    if (parsedQuery.institutions.type === 'ivy_league') {
      if (IVY_LEAGUE.some(school => contentLower.includes(school))) {
        score += 30; reasons.push('institution:Ivy League'); instMatched = true;
      }
    } else {
      const pattern = INSTITUTION_PATTERNS[parsedQuery.institutions.type];
      if (pattern) {
        const matched = typeof pattern === 'object' && !Array.isArray(pattern)
          ? (pattern as RegExp).test(resumeContent)
          : (pattern as string[]).some((s: string) => contentLower.includes(s));
        if (matched) { score += 15; reasons.push(`institution:${parsedQuery.institutions.type.replace('_', ' ')}`); instMatched = true; }
      }
    }
    if (instMatched) requiredMatches++;
  }

  if (parsedQuery.institutions.specificName && contentLower.includes(parsedQuery.institutions.specificName.toLowerCase())) {
    score += 30; reasons.push(`institution:${parsedQuery.institutions.specificName}`); requiredMatches++;
  }

  // ── Years of experience ───────────────────────────────────────────────────
  if (parsedQuery.experience.minYears > 0) {
    const expMatches = resumeContent.matchAll(/(\d+)\+?\s*(?:year[s]?|yr[s]?)\s*(?:of\s*)?(?:experience|exp|work|employment)/gi);
    let maxYears = 0;
    for (const expMatch of expMatches) {
      const years = parseInt(expMatch[1]);
      if (years > maxYears) maxYears = years;
    }
    if (maxYears >= parsedQuery.experience.minYears) {
      score += 15; reasons.push(`exp:${maxYears}`); requiredMatches++;
    }
  }

  // ── Seniority ─────────────────────────────────────────────────────────────
  if (parsedQuery.experience.seniority) {
    const pattern = SENIORITY_PATTERNS[parsedQuery.experience.seniority];
    if (pattern && pattern.test(resumeContent)) {
      score += 20; reasons.push(`seniority:${parsedQuery.experience.seniority}`); requiredMatches++;
    }
  }

  // ── Specific company ──────────────────────────────────────────────────────
  if (parsedQuery.experience.specificCompany && contentLower.includes(parsedQuery.experience.specificCompany.toLowerCase())) {
    score += 25; reasons.push(`company:${parsedQuery.experience.specificCompany}`);
  }

  // ── Specific role ─────────────────────────────────────────────────────────
  if (parsedQuery.experience.specificRole && contentLower.includes(parsedQuery.experience.specificRole)) {
    score += 15; reasons.push(`role:${parsedQuery.experience.specificRole}`);
  }

  // ── Industry ──────────────────────────────────────────────────────────────
  if (parsedQuery.experience.industry && contentLower.includes(parsedQuery.experience.industry)) {
    score += 10; reasons.push(`industry:${parsedQuery.experience.industry}`);
  }

  // ── Action verb matching (positive doers) ─────────────────────────────────
  if (parsedQuery.experience.actionVerbs && parsedQuery.experience.actionVerbs.length > 0) {
    const skillsToCheck = [...(parsedQuery.skills.orGroups?.flat() || []), ...parsedQuery.skills.required].slice(0, 6);
    for (const skill of skillsToCheck) {
      if (checkActionVerbNearSkill(resumeContent, parsedQuery.experience.actionVerbs, skill)) {
        score += 20;
        reasons.push(`skill:${skill}`);
        break;
      }
    }
    // Exclude if only passive verbs near the skill
    if (parsedQuery.experience.excludeActionVerbs && parsedQuery.experience.excludeActionVerbs.length > 0) {
      for (const skill of skillsToCheck) {
        if (checkOnlyPassiveVerbs(resumeContent, skill)) {
          return { matches: false, score: 0, reasons: [] };
        }
      }
    }
  }

  // ── Title match preference ─────────────────────────────────────────────────
  if (parsedQuery.skills.preferTitleMatch && parsedQuery.experience.currentlyEmployedAs && parsedQuery.experience.currentlyEmployedAs !== '__any__') {
    const titleRegex = new RegExp(`\\b${parsedQuery.experience.currentlyEmployedAs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (titleRegex.test(resumeContent)) {
      score += 25;
      reasons.push(`role:${parsedQuery.experience.currentlyEmployedAs}`);
    }
  }

  // ── Semantic flags ────────────────────────────────────────────────────────
  if (parsedQuery.semantic) {
    const sem = parsedQuery.semantic;

    if (sem.leadershipWithoutTitle) {
      const leadPat = /\b(led\s+(?:a\s+)?team|managed\s+(?:a\s+)?team\s+of|supervised\s+(?:a?\s+)?(?:team|staff|employees?|developers?|engineers?|analysts?)|oversaw\s+(?:a\s+)?(?:team|staff)|direct\s+reports?|team\s+of\s+\d+|people\s+manager|mentored\s+(?:junior|team|staff)|coached\s+(?:junior|team|staff)|staff\s+management|team\s+lead(?:er)?|leading\s+(?:a\s+)?team\s+of|managed\s+\d+\s+(?:engineers?|developers?|analysts?|staff|employees))\b/i;
      if (leadPat.test(resumeContent)) {
        score += 25; reasons.push('skill:Team Leadership'); requiredMatches++;
      } else {
        return { matches: false, score: 0, reasons: [] };
      }
      totalRequired++;
    }

    if (sem.greenfield) {
      const gfPat = /\b(built?\s+from\s+scratch|from\s+the\s+ground\s+up|greenfield|established\s+(?:new|from\s+scratch)|architected\s+new|standing\s+up\s+(?:new|a)\s+(?:infrastructure|platform|system|environment)|created\s+(?:new\s+)?(?:infrastructure|architecture|platform))\b/i;
      if (gfPat.test(resumeContent)) { score += 20; reasons.push('skill:Built From Scratch'); }
    }

    if (sem.handsOnTech) {
      const techVerbCount = (resumeContent.match(/\b(implemented|developed|built|coded|programmed|deployed|configured|architected|wrote|authored|engineered)\b/gi) || []).length;
      if (techVerbCount >= 3) {
        score += 20; reasons.push('skill:Hands-On Technical'); requiredMatches++;
      } else {
        return { matches: false, score: 0, reasons: [] };
      }
      totalRequired++;
    }

    if (sem.fastPaced) {
      const fpPat = /\b(startup|fast.paced|fast\s+paced|high.pressure|high\s+pressure|agile\s+environment|rapid\s+growth|high.stress|high\s+stress|emergency\s+response|rapidly\s+changing|dynamic\s+environment)\b/i;
      if (fpPat.test(resumeContent)) { score += 15; reasons.push('skill:Fast-Paced Environment'); }
    }

    if (sem.customerEscalation) {
      const cePat = /\b(escalation|de.escalation|escalated\s+(?:calls?|issues?|tickets?|complaints?)|difficult\s+(?:clients?|customers?)|angry\s+(?:clients?|customers?)|complaint\s+resolution|customer\s+(?:conflict|escalation|grievance)|irate\s+(?:clients?|customers?)|challenging\s+(?:clients?|customers?))\b/i;
      if (cePat.test(resumeContent)) {
        score += 20; reasons.push('skill:Customer Escalation'); requiredMatches++;
      } else {
        return { matches: false, score: 0, reasons: [] };
      }
      totalRequired++;
    }

    if (sem.promotedInPlace) {
      const promPat = /\b(promoted\s+to|promotion\s+to|advanced\s+(?:to|from)|moved\s+(?:up\s+to|from)\s+(?:a?\s+)?(?:junior|associate|senior|lead)|progressed\s+to|role\s+advancement|internal\s+(?:promotion|transfer))\b/i;
      if (promPat.test(resumeContent)) {
        score += 20; reasons.push('skill:Promoted In Place'); requiredMatches++;
      } else {
        return { matches: false, score: 0, reasons: [] };
      }
      totalRequired++;
    }

    if (sem.studiedWhileWorking) {
      const swwPat = /\b(while\s+(?:working|employed|maintaining\s+full.time)|(?:full.time|fulltime)\s+(?:while|during)\s+(?:studying|school|college|degree)|maintained\s+(?:full.time\s+)?(?:employment|work)\s+while|balanced\s+(?:work|employment)\s+(?:with|and)\s+(?:school|education|degree)|worked\s+full.time\s+while)\b/i;
      if (swwPat.test(resumeContent)) { score += 15; reasons.push('skill:Studied While Working'); }
    }

    if (sem.excludeCurrentlyEnrolled) {
      const enrolledPat = /\b(currently\s+enrolled|expected\s+graduation\s*:\s*20[2-9]\d|pursuing\s+(?:a\s+)?(?:degree|bachelor|master)|graduation\s+(?:date|year)\s*:\s*20[2-9]\d|in\s+progress\s+(?:degree|graduation)|expected\s+to\s+graduate)\b/i;
      if (enrolledPat.test(resumeContent)) return { matches: false, score: 0, reasons: [] };
    }

    if (sem.exactTitle) {
      const titleRe = new RegExp(`\\b${sem.exactTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!titleRe.test(resumeContent)) return { matches: false, score: 0, reasons: [] };
      score += 30; reasons.push(`role:${sem.exactTitle}`); requiredMatches++; totalRequired++;
    }

    if (sem.excludeFrontendOnly) {
      const backendPat = /\b(backend|back.end|server.side|api|node\.?js|python|java|ruby|golang|go\b|rust|php|django|flask|spring|express|fastapi|postgresql|mysql|mongodb|redis|kubernetes|docker|devops|infrastructure|cloud\s+(?:aws|azure|gcp))\b/i;
      if (!backendPat.test(resumeContent)) return { matches: false, score: 0, reasons: [] };
    }
  }

  // ── Skills using synonym-aware matching ───────────────────────────────────
  if (parsedQuery.skills.required.length > 0) {
    for (const skill of parsedQuery.skills.required) {
      if (matchesAnySynonym(resumeContent, skill)) {
        score += 10; reasons.push(`skill:${skill}`);
      }
    }
  }

  // ── Compound query gate ───────────────────────────────────────────────────
  if (parsedQuery.isCompound && totalRequired > 0 && requiredMatches < totalRequired) {
    return { matches: false, score: 0, reasons: [] };
  }

  return {
    matches: score > 0,
    score,
    reasons,
    clearanceSnippet,
    isUnreadable: unreadable,
  };
}

export { scoreForSkill, isUnreadableResume };
export type { SynonymGroup };
