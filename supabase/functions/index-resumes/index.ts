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

// For old binary .doc files — extract runs of printable ASCII that look like real text
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const tenantId = Deno.env.get('AZURE_TENANT_ID');
    const clientId = Deno.env.get('AZURE_CLIENT_ID');
    const clientSecret = Deno.env.get('AZURE_API_KEY') || Deno.env.get('AZURE_CLIENT_SECRET');

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

    const shareUrl = 'https://humangosolutions.sharepoint.com/:f:/s/ITDepartment/IgCvfe9qjYO3SZzbme7572AmAX2R5SbWXUnsb7SiBUUiUBw?e=taFyST';
    const encodedUrl = 'u!' + btoa(shareUrl).replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');

    const listRes = await fetch(`https://graph.microsoft.com/v1.0/shares/${encodedUrl}/driveItem/children`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    const files = listData.value || [];

    const { data: existingResumes } = await supabase
      .from('resumes')
      .select('file_url, last_modified, file_name, drive_item_id');

    const existingMap = new Map(
      (existingResumes || []).map(r => [r.file_name, r])
    );

    const url = new URL(req.url);
    const forceReindex = url.searchParams.get('reindex') === 'true';
    const batchSize = parseInt(url.searchParams.get('batch') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const processableFiles = files.filter((f: any) => {
      if (f.folder) return false;
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'doc', 'txt'].includes(ext);
    });

    const batch = processableFiles.slice(offset, offset + batchSize);

    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of batch) {
      if (file.folder) continue;

      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'docx', 'doc', 'txt'].includes(ext)) continue;

        const existing = existingMap.get(file.name);

        if (existing && !forceReindex) {
          const existingModified = new Date(existing.last_modified).getTime();
          const fileModified = new Date(file.lastModifiedDateTime).getTime();
          if (existingModified >= fileModified && existing.drive_item_id) {
            skipped++;
            continue;
          }
        }

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

        content = content.slice(0, 50000);

        const candidateName = file.name.replace(/\.[^/.]+$/, '');

        const { data: resumeData } = await supabase.from('resumes').upsert({
          file_name: file.name,
          file_url: downloadUrl,
          drive_item_id: file.id,
          content_text: content,
          candidate_name: candidateName,
          last_modified: file.lastModifiedDateTime
        }, { onConflict: 'file_name' }).select().single();

        if (resumeData) {
          const skills = extractSkills(content);
          await supabase.from('skills').delete().eq('resume_id', resumeData.id);
          if (skills.length > 0) {
            await supabase.from('skills').insert(
              skills.map(skill => ({ resume_id: resumeData.id, skill_name: skill }))
            );
          }
        }

        indexed++;
        console.log(`Indexed: ${file.name} (${ext}, ${content.length} chars)`);
      } catch (err) {
        failed++;
        console.error(`Failed ${file.name}:`, err);
      }
    }

    return new Response(JSON.stringify({ success: true, indexed, skipped, failed, total: processableFiles.length, offset, batchSize, hasMore: offset + batchSize < processableFiles.length }), {
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
