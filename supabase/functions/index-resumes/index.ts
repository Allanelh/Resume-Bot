import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import JSZip from 'npm:jszip@3.10.1';
import { extractText } from 'npm:unpdf@1.6.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function extractSkills(text: string): string[] {
  const commonSkills = [
    'Java', 'Python', 'JavaScript', 'TypeScript', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'PHP', 'Scala', 'Perl', 'R',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'ASP.NET',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins', 'Git', 'GitHub', 'GitLab', 'Bitbucket',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra', 'Oracle', 'DynamoDB',
    'Linux', 'Unix', 'Windows', 'MacOS', 'Bash', 'PowerShell',
    'Agile', 'Scrum', 'DevOps', 'CI/CD', 'Microservices', 'REST', 'GraphQL', 'API',
    'Machine Learning', 'AI', 'Data Science', 'Big Data', 'Hadoop', 'Spark', 'TensorFlow', 'PyTorch',
    'Security', 'Penetration Testing', 'Vulnerability Assessment', 'SIEM', 'Firewall', 'Cybersecurity',
    'Networking', 'TCP/IP', 'DNS', 'Load Balancing', 'VPN', 'Routing', 'Switching',
    'HTML', 'CSS', 'SASS', 'Webpack', 'Vite', 'Next.js', 'Tailwind', 'Bootstrap',
    'Testing', 'Jest', 'JUnit', 'Selenium', 'Cypress', 'QA', 'Quality Assurance',
    'Excel', 'Word', 'PowerPoint', 'Outlook', 'Office 365', 'Microsoft Office', 'Google Workspace',
    'SAP', 'Salesforce', 'QuickBooks', 'Tableau', 'Power BI', 'Looker',
    'Financial Analysis', 'Financial Modeling', 'Budgeting', 'Forecasting', 'Accounting', 'Bookkeeping',
    'GAAP', 'IFRS', 'Tax Preparation', 'Auditing', 'Financial Reporting',
    'Investment Banking', 'Portfolio Management', 'Risk Management', 'Trading', 'Equity Research',
    'Bloomberg Terminal', 'Reuters', 'FactSet', 'Capital IQ',
    'Project Management', 'Leadership', 'Team Management', 'Communication', 'Presentation',
    'Problem Solving', 'Critical Thinking', 'Time Management', 'Organization',
    'Customer Service', 'Sales', 'Marketing', 'Business Development', 'Negotiation',
    'Data Analysis', 'Statistical Analysis', 'Data Visualization', 'Reporting',
    'Writing', 'Content Creation', 'Technical Writing', 'Documentation',
    'Research', 'Analytics', 'Strategy', 'Planning', 'Consulting',
    'Typing', 'Data Entry', 'Computer Literacy', 'Internet Research', 'Email Management',
    'Social Media', 'Digital Marketing', 'SEO', 'SEM', 'Content Marketing',
    'Adobe Photoshop', 'Illustrator', 'InDesign', 'Premiere Pro', 'After Effects',
    'Figma', 'Sketch', 'UI/UX Design', 'Graphic Design', 'Web Design',
    'CAD', 'AutoCAD', 'SolidWorks', 'Revit', 'SketchUp',
    'MATLAB', 'Simulink', 'LabVIEW', 'SPSS', 'SAS', 'Stata'
  ];
  const lowerText = text.toLowerCase();
  const foundSkills = new Set<string>();
  for (const skill of commonSkills) {
    if (lowerText.includes(skill.toLowerCase())) foundSkills.add(skill);
  }
  return Array.from(foundSkills);
}

// ── Certification extraction ──────────────────────────────────────────────────
const CERT_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'CompTIA A+', pattern: /\b(comptia\s+a\s*\+|a\s*\+\s+certif)/i },
  { name: 'CompTIA Network+', pattern: /\b(comptia\s+net(work)?\s*\+|net(work)?\s*\+)\b/i },
  { name: 'CompTIA Security+', pattern: /\b(comptia\s+sec(urity)?\s*\+|sec(urity)?\s*\+)\b/i },
  { name: 'CompTIA Linux+', pattern: /\b(comptia\s+linux\s*\+|linux\s*\+)\b/i },
  { name: 'CompTIA Cloud+', pattern: /\b(comptia\s+cloud\s*\+|cloud\s*\+)\b/i },
  { name: 'CompTIA PenTest+', pattern: /\b(comptia\s+pentest\s*\+|pentest\s*\+)\b/i },
  { name: 'CompTIA CySA+', pattern: /\b(comptia\s+cysa\s*\+?|cysa\s*\+)\b/i },
  { name: 'CompTIA CASP+', pattern: /\b(comptia\s+casp\s*\+?|casp\s*\+?)\b/i },
  { name: 'CISSP', pattern: /\b(cissp|certified\s+information\s+systems\s+security\s+professional)\b/i },
  { name: 'SSCP', pattern: /\b(sscp|systems\s+security\s+certified\s+practitioner)\b/i },
  { name: 'CCSP', pattern: /\b(ccsp|certified\s+cloud\s+security\s+professional)\b/i },
  { name: 'CISA', pattern: /\b(cisa|certified\s+information\s+systems\s+auditor)\b/i },
  { name: 'CISM', pattern: /\b(cism|certified\s+information\s+security\s+manager)\b/i },
  { name: 'CRISC', pattern: /\b(crisc|certified\s+in\s+risk\s+and\s+information\s+systems\s+control)\b/i },
  { name: 'CCNA', pattern: /\b(ccna|cisco\s+certified\s+network\s+associate)\b/i },
  { name: 'CCNP', pattern: /\b(ccnp|cisco\s+certified\s+network\s+professional)\b/i },
  { name: 'CCIE', pattern: /\b(ccie|cisco\s+certified\s+internetwork\s+expert)\b/i },
  { name: 'AWS Cloud Practitioner', pattern: /\b(aws\s+(certified\s+)?cloud\s+practitioner|aws\s+cp)\b/i },
  { name: 'AWS Solutions Architect Associate', pattern: /\b(aws\s+(certified\s+)?solutions\s+architect\s*[-\u2013]?\s*associate|aws\s+saa)\b/i },
  { name: 'AWS Developer Associate', pattern: /\b(aws\s+(certified\s+)?developer\s*[-\u2013]?\s*associate)\b/i },
  { name: 'AWS SysOps Administrator', pattern: /\b(aws\s+(certified\s+)?sysops\s+administrator)\b/i },
  { name: 'AWS Solutions Architect Professional', pattern: /\b(aws\s+(certified\s+)?solutions\s+architect\s*[-\u2013]?\s*professional)\b/i },
  { name: 'AWS DevOps Engineer Professional', pattern: /\b(aws\s+(certified\s+)?devops\s+engineer\s*[-\u2013]?\s*professional)\b/i },
  { name: 'AWS Security Specialty', pattern: /\b(aws\s+(certified\s+)?security\s*[-\u2013]?\s*specialty)\b/i },
  { name: 'AZ-900', pattern: /\b(az-?900|azure\s+fundamentals)\b/i },
  { name: 'AZ-104', pattern: /\b(az-?104|azure\s+administrator)\b/i },
  { name: 'AZ-204', pattern: /\b(az-?204|azure\s+developer)\b/i },
  { name: 'AZ-305', pattern: /\b(az-?305|azure\s+solutions\s+architect\s+expert)\b/i },
  { name: 'AZ-500', pattern: /\b(az-?500|azure\s+security\s+engineer)\b/i },
  { name: 'MS-900', pattern: /\b(ms-?900|microsoft\s+365\s+fundamentals)\b/i },
  { name: 'SC-300', pattern: /\b(sc-?300|identity\s+and\s+access\s+administrator)\b/i },
  { name: 'SC-100', pattern: /\b(sc-?100|cybersecurity\s+architect\s+expert)\b/i },
  { name: 'DP-203', pattern: /\b(dp-?203|azure\s+data\s+engineer)\b/i },
  { name: 'AI-102', pattern: /\b(ai-?102|azure\s+ai\s+engineer)\b/i },
  { name: 'PL-300', pattern: /\b(pl-?300|power\s+bi\s+data\s+analyst)\b/i },
  { name: 'Google Cloud Digital Leader', pattern: /\b(google\s+cloud\s+digital\s+leader|cloud\s+digital\s+leader)\b/i },
  { name: 'Google Cloud Associate Engineer', pattern: /\b(associate\s+cloud\s+engineer)\b/i },
  { name: 'Google Cloud Professional Architect', pattern: /\b(professional\s+cloud\s+architect)\b/i },
  { name: 'Google Data Analytics Certificate', pattern: /\b(google\s+data\s+analytics\s+(professional\s+)?certificate)\b/i },
  { name: 'OSCP', pattern: /\b(oscp|offensive\s+security\s+certified\s+professional)\b/i },
  { name: 'OSWE', pattern: /\b(oswe|offensive\s+security\s+web\s+expert)\b/i },
  { name: 'CEH', pattern: /\b(ceh|certified\s+ethical\s+hacker)\b/i },
  { name: 'CHFI', pattern: /\b(chfi|computer\s+hacking\s+forensic\s+investigator)\b/i },
  { name: 'GSEC', pattern: /\b(gsec|giac\s+security\s+essentials)\b/i },
  { name: 'GCIH', pattern: /\b(gcih|giac\s+certified\s+incident\s+handler)\b/i },
  { name: 'GCIA', pattern: /\b(gcia|giac\s+certified\s+intrusion\s+analyst)\b/i },
  { name: 'GCFA', pattern: /\b(gcfa|giac\s+certified\s+forensic\s+analyst)\b/i },
  { name: 'GPEN', pattern: /\b(gpen|giac\s+penetration\s+tester)\b/i },
  { name: 'RHCSA', pattern: /\b(rhcsa|red\s+hat\s+certified\s+system\s+administrator)\b/i },
  { name: 'RHCE', pattern: /\b(rhce|red\s+hat\s+certified\s+engineer)\b/i },
  { name: 'Terraform Associate', pattern: /\b(hashicorp\s+(certified:?\s+)?terraform\s+associate|terraform\s+associate)\b/i },
  { name: 'Vault Associate', pattern: /\b(hashicorp\s+(certified:?\s+)?vault\s+associate|vault\s+associate)\b/i },
  { name: 'CKA', pattern: /\b(cka|certified\s+kubernetes\s+administrator)\b/i },
  { name: 'CKAD', pattern: /\b(ckad|certified\s+kubernetes\s+application\s+developer)\b/i },
  { name: 'CKS', pattern: /\b(cks|certified\s+kubernetes\s+security\s+specialist)\b/i },
  { name: 'LFCS', pattern: /\b(lfcs|linux\s+foundation\s+certified\s+system\s+administrator)\b/i },
  { name: 'VCP-DCV', pattern: /\b(vcp-?dcv|vmware\s+certified\s+professional.*data\s+center\s+virtualization)\b/i },
  { name: 'PMP', pattern: /\b(pmp|project\s+management\s+professional)\b/i },
  { name: 'CAPM', pattern: /\b(capm|certified\s+associate\s+in\s+project\s+management)\b/i },
  { name: 'PMI-ACP', pattern: /\b(pmi-?acp|pmi\s+agile\s+certified\s+practitioner)\b/i },
  { name: 'CSM', pattern: /\b(csm|certified\s+scrum\s*master)\b/i },
  { name: 'CSPO', pattern: /\b(cspo|certified\s+scrum\s+product\s+owner)\b/i },
  { name: 'PSM I', pattern: /\b(psm\s*(i|1)|professional\s+scrum\s+master\s*(i|1))\b/i },
  { name: 'SAFe Agilist', pattern: /\b(safe\s+agilist|scaled\s+agile)\b/i },
  { name: 'ITIL 4 Foundation', pattern: /\b(itil\s*(v?4)?\s*foundation|itil\s*v?4\b|itil\b)\b/i },
  { name: 'Six Sigma Green Belt', pattern: /\b(six\s+sigma\s+green\s+belt|cssgb|green\s+belt|lean\s+six\s+sigma\s+green\s+belt)\b/i },
  { name: 'Six Sigma Black Belt', pattern: /\b(six\s+sigma\s+black\s+belt|cssbb|black\s+belt|lean\s+six\s+sigma\s+black\s+belt)\b/i },
  { name: 'CPA', pattern: /\b(cpa|certified\s+public\s+accountant)\b/i },
  { name: 'CMA', pattern: /\b(cma|certified\s+management\s+accountant)\b/i },
  { name: 'CIA', pattern: /\b(cia|certified\s+internal\s+auditor)\b/i },
  { name: 'CFA', pattern: /\b(cfa|chartered\s+financial\s+analyst)\b/i },
  { name: 'CFP', pattern: /\b(cfp|certified\s+financial\s+planner)\b/i },
  { name: 'FRM', pattern: /\b(frm|financial\s+risk\s+manager)\b/i },
  { name: 'Series 7', pattern: /\b(series\s*[-\u2013]?\s*7)\b/i },
  { name: 'SIE', pattern: /\b(sie|securities\s+industry\s+essentials)\b/i },
  { name: 'SHRM-CP', pattern: /\b(shrm-?cp|shrm\s+certified\s+professional)\b/i },
  { name: 'SHRM-SCP', pattern: /\b(shrm-?scp|shrm\s+senior\s+certified\s+professional)\b/i },
  { name: 'PHR', pattern: /\b(phr|professional\s+in\s+human\s+resources)\b/i },
  { name: 'SPHR', pattern: /\b(sphr|senior\s+professional\s+in\s+human\s+resources)\b/i },
  { name: 'Salesforce Administrator', pattern: /\b(salesforce\s+(certified\s+)?administrator)\b/i },
  { name: 'Salesforce Platform Developer I', pattern: /\b(salesforce\s+(certified\s+)?platform\s+developer\s+i)\b/i },
  { name: 'ServiceNow', pattern: /\b(servicenow|service\s+now)\b/i },
  { name: 'BLS', pattern: /\b(bls|basic\s+life\s+support)\b/i },
  { name: 'ACLS', pattern: /\b(acls|advanced\s+cardiovascular\s+life\s+support)\b/i },
  { name: 'CPR', pattern: /\b(cpr|cardiopulmonary\s+resuscitation)\b/i },
  { name: 'CNA', pattern: /\b(cna|certified\s+nursing\s+assistant)\b/i },
  { name: 'PE License', pattern: /\b(professional\s+engineer\s+licens|pe\s+licens|licensed\s+professional\s+engineer)\b/i },
  { name: 'FE Exam', pattern: /\b(fundamentals\s+of\s+engineering|fe\s+exam|eit\b|engineer\s+in\s+training)\b/i },
  { name: 'LEED', pattern: /\b(leed(\s+(ap|green\s+associate))?|leadership\s+in\s+energy\s+and\s+environmental\s+design)\b/i },
  { name: 'OSHA 10', pattern: /\b(osha\s+10(-?hour)?)\b/i },
  { name: 'OSHA 30', pattern: /\b(osha\s+30(-?hour)?)\b/i },
  { name: 'CSP', pattern: /\b(csp|certified\s+safety\s+professional)\b/i },
  { name: 'Part 107 (FAA)', pattern: /\b(part\s+107|faa\s+part\s+107|remote\s+pilot\s+certificate)\b/i },
  { name: 'CIPP/US', pattern: /\b(cipp\s*\/\s*us|cipp\s+us|certified\s+information\s+privacy\s+professional)\b/i },
  { name: 'CIPM', pattern: /\b(cipm|certified\s+information\s+privacy\s+manager)\b/i },
  { name: 'ISO 27001', pattern: /\b(iso\s*\/?\s*iec\s*27001|iso\s*27001|isms)\b/i },
  { name: 'ISO 9001', pattern: /\b(iso\s*9001)\b/i },
  { name: 'CPIM', pattern: /\b(cpim|certified\s+in\s+planning\s+and\s+inventory\s+management)\b/i },
  { name: 'CSCP', pattern: /\b(cscp|certified\s+supply\s+chain\s+professional)\b/i },
  { name: 'Snowflake SnowPro Core', pattern: /\b(snowflake\s+snowpro\s+core|snowpro\s+core)\b/i },
  { name: 'Databricks Data Engineer', pattern: /\b(databricks\s+(certified\s+)?data\s+engineer)\b/i },
  { name: 'Tableau Desktop Specialist', pattern: /\b(tableau\s+(desktop\s+)?specialist|tableau\s+certified)\b/i },
  { name: 'Splunk Core Certified', pattern: /\b(splunk\s+(core\s+)?certified)\b/i },
];

function extractCertifications(text: string): string[] {
  const found = new Set<string>();
  for (const { name, pattern } of CERT_PATTERNS) {
    if (pattern.test(text)) found.add(name);
  }
  return Array.from(found);
}

async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });
    return Array.isArray(text) ? text.join('\n') : (text || '');
  } catch (err) {
    console.error('PDF extraction error:', err);
    return '';
  }
}

async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXml = zip.file('word/document.xml');
    if (!docXml) return '';
    const xml = await docXml.async('string');
    const text = xml
      .replace(/<w:br[^/]*/gi, '\n')
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#\d+;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return text;
  } catch (err) {
    console.error('DOCX extraction error:', err);
    return '';
  }
}

function extractTextFromDocBinary(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let text = '';
  let run = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if ((c >= 32 && c <= 126) || c === 9 || c === 10 || c === 13) {
      run += String.fromCharCode(c);
    } else {
      if (run.length >= 4) text += run + ' ';
      run = '';
    }
  }
  if (run.length >= 4) text += run;
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(l => {
    if (l.length < 3) return false;
    const alphaCount = (l.match(/[a-zA-Z]/g) || []).length;
    return alphaCount / l.length > 0.5;
  });
  return lines.join('\n').replace(/\s{3,}/g, '  ').trim();
}

function sanitizeForPostgres(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u0000/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\uFFFD/g, ' ')
    .trim();
}

// PDF text extraction sometimes inserts a space between every single
// character of a word (e.g. "D o m i n i c   C o r s o"). This repairs
// that corruption so excerpts display normal words.
function repairSpacedCharacters(text: string): string {
  const normalized = text.normalize('NFKC').replace(/[\s\p{Z}\p{Cf}]+/gu, ' ').trim();
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return '';

  const SINGLE_CHAR = /^[A-Za-z0-9@._#+()\-]$/;
  const splitCaseBoundaries = (s: string): string =>
    s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  const output: string[] = [];
  let run: string[] = [];

  const flush = (): void => {
    if (run.length === 0) return;
    if (run.length >= 3) {
      output.push(splitCaseBoundaries(run.join('')));
    } else {
      output.push(...run);
    }
    run = [];
  };

  for (const token of tokens) {
    if (token.length === 1 && SINGLE_CHAR.test(token)) {
      run.push(token);
    } else {
      flush();
      output.push(token);
    }
  }
  flush();

  return output.join(' ').replace(/\s+([.,;:!?])/g, '$1').trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const tenantId = Deno.env.get('SHAREPOINT_TENANT_ID') || Deno.env.get('AZURE_TENANT_ID');
    const clientId = Deno.env.get('SHAREPOINT_CLIENT_ID') || Deno.env.get('AZURE_CLIENT_ID');
    const clientSecret = Deno.env.get('SHAREPOINT_CLIENT_SECRET') || Deno.env.get('AZURE_CLIENT_SECRET') || Deno.env.get('AZURE_API_KEY');

    if (!tenantId || !clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Azure credentials not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    });
    const { access_token: token } = await tokenRes.json();

    const body = await req.json().catch(() => ({}));
    const urlParam = new URL(req.url).searchParams.get('url');
    const shareUrl = body?.sharePointUrl || urlParam;

    if (!shareUrl) {
      return new Response(JSON.stringify({ error: 'No SharePoint folder URL provided.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const encodedUrl = 'u!' + btoa(shareUrl).replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');

    // Fetch ALL file metadata from SharePoint (fast — just listing, no downloads)
    let files: any[] = [];
    let listUrl: string | null = `https://graph.microsoft.com/v1.0/shares/${encodedUrl}/driveItem/children?$top=200`;
    while (listUrl) {
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const listData = await listRes.json();
      files = files.concat(listData.value || []);
      listUrl = listData['@odata.nextLink'] || null;
    }

    const processableFiles = files.filter((f: any) => {
      if (f.folder) return false;
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'doc', 'txt'].includes(ext);
    });

    console.log(`Found ${files.length} total items, ${processableFiles.length} processable resume files.`);

    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');

    // ── Check Root mode: just list files, no download/index ──
    if (mode === 'check') {
      return new Response(JSON.stringify({
        success: true,
        totalItems: files.length,
        processableFiles: processableFiles.length,
        sampleNames: processableFiles.slice(0, 10).map((f: any) => f.name),
        folderName: files[0]?.parentReference?.name || 'Unknown folder',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const batchSize = parseInt(url.searchParams.get('batch') || '15');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Wipe ALL existing data ONLY on the first batch (offset === 0)
    if (offset === 0) {
      await supabase.from('certifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('skills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('resumes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('Cleared all existing resumes, skills, and certifications for fresh index.');
    }

    // Process only this batch's slice of files
    const batch = processableFiles.slice(offset, offset + batchSize);

    let indexed = 0;
    let failed = 0;

    for (const file of batch) {
      if (file.folder) continue;

      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'docx', 'doc', 'txt'].includes(ext)) continue;

        const downloadUrl = file['@microsoft.graph.downloadUrl'];
        const fileRes = await fetch(downloadUrl);
        const arrayBuffer = await fileRes.arrayBuffer();

        let content = '';

        if (ext === 'pdf') {
          content = await extractTextFromPdf(arrayBuffer);
        } else if (ext === 'docx') {
          content = await extractTextFromDocx(arrayBuffer);
        } else if (ext === 'doc') {
          content = extractTextFromDocBinary(arrayBuffer);
        } else if (ext === 'txt') {
          content = new TextDecoder().decode(arrayBuffer);
        }

        content = sanitizeForPostgres(repairSpacedCharacters(content.slice(0, 50000)));
        const candidateName = sanitizeForPostgres(file.name.replace(/\.[^/.]+$/, ''));
        const safeFileName = sanitizeForPostgres(file.name);

        const { data: resumeData, error: upsertError } = await supabase.from('resumes').upsert({
          file_name: safeFileName,
          file_url: downloadUrl,
          drive_item_id: file.id,
          content_text: content,
          candidate_name: candidateName,
          last_modified: file.lastModifiedDateTime
        }, { onConflict: 'file_name' }).select().single();

        if (upsertError) {
          failed++;
          console.error(`DB insert failed for ${file.name}:`, upsertError.message);
          continue;
        }

        if (resumeData) {
          const skills = extractSkills(content);
          await supabase.from('skills').delete().eq('resume_id', resumeData.id);
          if (skills.length > 0) {
            await supabase.from('skills').insert(
              skills.map(skill => ({ resume_id: resumeData.id, skill_name: skill }))
            );
          }

          const certs = extractCertifications(content);
          await supabase.from('certifications').delete().eq('resume_id', resumeData.id);
          if (certs.length > 0) {
            await supabase.from('certifications').insert(
              certs.map(cert => ({ resume_id: resumeData.id, certification_name: cert }))
            );
          }
        }

        indexed++;
        console.log(`Indexed: ${file.name} (${ext}, ${content.length} chars) — ${offset + indexed}/${processableFiles.length}`);
      } catch (err) {
        failed++;
        console.error(`Failed ${file.name}:`, err);
      }
    }

    const hasMore = offset + batchSize < processableFiles.length;

    return new Response(JSON.stringify({
      success: true,
      indexed,
      failed,
      total: processableFiles.length,
      offset,
      batchSize,
      hasMore
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Fatal Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
