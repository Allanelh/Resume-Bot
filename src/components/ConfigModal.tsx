import { useState } from 'react';
import { X, Save, FolderOpen, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConfigModalProps {
  onClose: () => void;
  currentUrl: string;
  onSave: (url: string) => void;
}

export default function ConfigModal({ onClose, currentUrl, onSave }: ConfigModalProps) {
  const [sharePointUrl, setSharePointUrl] = useState(currentUrl);
  const [accessToken, setAccessToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [message, setMessage] = useState('');
  const [useAzure, setUseAzure] = useState(false);

  const handleSave = async () => {
    if (!sharePointUrl.trim()) {
      setMessage('Please enter a SharePoint folder URL');
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const { data: existing } = await supabase
        .from('app_config')
        .select('*')
        .eq('config_key', 'sharepoint_folder_url')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_config')
          .update({
            config_value: sharePointUrl,
            sharepoint_access_token: accessToken || null,
            updated_at: new Date().toISOString(),
          })
          .eq('config_key', 'sharepoint_folder_url');
      } else {
        await supabase.from('app_config').insert({
          config_key: 'sharepoint_folder_url',
          config_value: sharePointUrl,
          sharepoint_access_token: accessToken || null,
        });
      }

      setMessage('Configuration saved successfully!');
      setTimeout(() => {
        onSave(sharePointUrl);
      }, 1000);
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage('Error saving configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAzureAuthenticate = async () => {
    if (!sharePointUrl.trim()) {
      setMessage('Please enter a SharePoint folder URL first');
      return;
    }

    setIsAuthenticating(true);
    setMessage('');

    try {
      const tokenUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-sharepoint-token`;

      const response = await fetch(tokenUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.access_token);
        setMessage('Successfully authenticated with Azure!');
        setUseAzure(true);

        setTimeout(() => {
          setMessage('');
        }, 2000);
      } else {
        const error = await response.json();
        setMessage(`Authentication failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error authenticating with Azure:', error);
      setMessage('Failed to connect to authentication service. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleIndexResumes = async () => {
    if (!sharePointUrl.trim()) {
      setMessage('Please save the SharePoint URL first');
      return;
    }

    setIsIndexing(true);
    setMessage('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/index-resumes`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sharePointUrl }),
      });

      const result = await response.json();

      if (response.ok) {
        const parts = [];
        if (result.indexed > 0) parts.push(`${result.indexed} new`);
        if (result.updated > 0) parts.push(`${result.updated} updated`);
        if (result.skipped > 0) parts.push(`${result.skipped} skipped (unchanged)`);

        const summary = parts.length > 0 ? parts.join(', ') : 'No changes';
        setMessage(`Indexing complete: ${summary}. Total files: ${result.total || 0}`);
      } else {
        setMessage(result.error || 'Error indexing resumes. Please try again.');
      }
    } catch (error) {
      console.error('Error indexing resumes:', error);
      setMessage('Error connecting to indexing service. Please try again.');
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-6 h-6" style={{ color: '#FE9900' }} />
            <h2 className="text-2xl font-bold text-slate-800">Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              SharePoint Folder URL
            </label>
            <input
              type="text"
              value={sharePointUrl}
              onChange={(e) => setSharePointUrl(e.target.value)}
              placeholder="https://humangosolutions.sharepoint.com/:f:/s/ITDepartment/IgCvfe9qjYO3..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': '#FE9900' } as React.CSSProperties}
              onFocus={(e) => e.currentTarget.style.borderColor = '#FE9900'}
            />
            <p className="mt-2 text-sm text-slate-500">
              Paste your SharePoint folder URL.
            </p>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Authentication Method</h3>

            <div className="space-y-3">
              <button
                onClick={handleAzureAuthenticate}
                disabled={isAuthenticating || useAzure}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg disabled:border-slate-300 disabled:text-slate-400 disabled:bg-slate-50 transition-colors"
                style={
                  isAuthenticating || useAzure
                    ? { borderColor: '#cbd5e1', color: '#94a3b8', backgroundColor: '#f8fafc' }
                    : { borderColor: '#FE9900', color: '#FE9900' }
                }
                onMouseEnter={(e) => {
                  if (!isAuthenticating && !useAzure) {
                    e.currentTarget.style.backgroundColor = '#FFF5E6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isAuthenticating && !useAzure) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Zap className="w-4 h-4" />
                <span>{useAzure ? 'Azure Connected' : isAuthenticating ? 'Authenticating...' : 'Authenticate with Azure'}</span>
              </button>

              <div className="text-xs text-slate-500">
                {useAzure ? (
                  <p className="text-green-600">Azure OAuth credentials configured. Your access token will be automatically used.</p>
                ) : (
                  <p>Click to authenticate with your Azure account. Your IT department has already configured Human Go Solutions in Azure.</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Manual Access Token (Optional)
            </label>
            <textarea
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Or paste a Microsoft Graph access token manually..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent font-mono text-xs"
              style={{ '--tw-ring-color': '#FE9900' } as React.CSSProperties}
              onFocus={(e) => e.currentTarget.style.borderColor = '#FE9900'}
              rows={2}
              disabled={useAzure}
            />
            <p className="mt-2 text-sm text-slate-500">
              {useAzure ? 'Using Azure authentication. Manual token disabled.' : 'Or manually paste an access token if needed.'}
            </p>
          </div>

          {message && (
            <div className={`p-3 rounded-lg ${
              message.includes('Error') || message.includes('Please')
                ? 'bg-red-100 text-red-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: isSaving ? '#cbd5e1' : '#FE9900' }}
              onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#E68A00')}
              onMouseLeave={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#FE9900')}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>

            <button
              onClick={handleIndexResumes}
              disabled={isIndexing || !sharePointUrl.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isIndexing ? 'animate-spin' : ''}`} />
              <span>{isIndexing ? 'Indexing...' : 'Index Resumes'}</span>
            </button>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Start:</h3>
            <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
              <li>Paste your SharePoint folder URL</li>
              <li>Click "Authenticate with Azure" (configured automatically)</li>
              <li>Click "Save Configuration"</li>
              <li>Click "Index Resumes" to scan and load all resume files</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
