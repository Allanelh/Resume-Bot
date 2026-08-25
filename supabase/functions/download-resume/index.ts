const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const AZURE_TENANT_ID = Deno.env.get('SHAREPOINT_TENANT_ID') || Deno.env.get('AZURE_TENANT_ID');
const AZURE_CLIENT_ID = Deno.env.get('SHAREPOINT_CLIENT_ID') || Deno.env.get('AZURE_CLIENT_ID');
const AZURE_API_KEY = Deno.env.get('SHAREPOINT_CLIENT_SECRET') || Deno.env.get('AZURE_CLIENT_SECRET') || Deno.env.get('AZURE_API_KEY');

async function getAccessToken(): Promise<string> {
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_API_KEY) {
    throw new Error('Azure credentials not configured. Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET (or AZURE_* equivalents) in the edge function secrets.');
  }
  try {
    const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: AZURE_CLIENT_ID!,
      client_secret: AZURE_API_KEY!,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Azure token error: ${response.status}`, error);
      throw new Error(`Failed to get Azure token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { driveItemId, fileName } = await req.json();

    if (!driveItemId) {
      return new Response(
        JSON.stringify({ error: 'driveItemId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get fresh access token
    const accessToken = await getAccessToken();

    // Read the SharePoint folder URL from the database config table
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: configData } = await supabase
      .from('app_config')
      .select('config_value')
      .eq('config_key', 'sharepoint_folder_url')
      .maybeSingle();

    const shareUrl = configData?.config_value;
    if (!shareUrl) {
      throw new Error('No SharePoint folder URL configured. Please set one in Settings.');
    }

    // Use TextEncoder and base64 encoding for Deno
    const encoder = new TextEncoder();
    const data = encoder.encode(shareUrl);
    const base64 = btoa(String.fromCharCode(...data));
    const encodedUrl = 'u!' + base64.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');

    // Try to get all files in the folder and find the one with matching driveItemId
    const folderResponse = await fetch(
      `https://graph.microsoft.com/v1.0/shares/${encodedUrl}/driveItem/children`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!folderResponse.ok) {
      const errorText = await folderResponse.text();
      console.error('Failed to access SharePoint folder:', folderResponse.status, errorText);
      throw new Error('Failed to access SharePoint folder');
    }

    const folderData = await folderResponse.json();
    const file = folderData.value?.find((item: any) => item.id === driveItemId);

    if (!file) {
      throw new Error('File not found in SharePoint');
    }

    const downloadUrl = file['@microsoft.graph.downloadUrl'];

    if (!downloadUrl) {
      throw new Error('Download URL not available');
    }

    // Download the file using the fresh URL
    const downloadResponse = await fetch(downloadUrl);

    if (!downloadResponse.ok) {
      console.error('Download failed:', downloadResponse.status, await downloadResponse.text());
      throw new Error(`Failed to download file: ${downloadResponse.statusText}`);
    }

    const blob = await downloadResponse.blob();
    const contentType = downloadResponse.headers.get('Content-Type') || 'application/octet-stream';

    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName || 'resume.pdf'}"`,
      },
    });
  } catch (error) {
    console.error('Error in download-resume:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
