import { useState, useEffect } from 'react';
import { X, Save, FolderOpen, RefreshCw, Zap, Search, CheckCircle2, AlertCircle, Loader2, Users, Archive } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConfigModalProps {
  onClose: () => void;
  currentUrl: string;
  onSave: (url: string) => void;
}

type SourceKey = 'new' | 'older';

interface CheckResult {
  loading: boolean;
  result: { totalItems: number; processableFiles: number; sampleNames: string[]; folderName: string } | null;
  error: string | null;
}

export default function ConfigModal({ onClose, currentUrl, onSave }: ConfigModalProps) {
  const [newUrl, setNewUrl] = useState(currentUrl);
  const [olderUrl, setOlderUrl] = useState('');
  const [activeSource, setActiveSource] = useState<SourceKey>('new');
  const [isSaving, setIsSaving] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAzureConnected, setIsAzureConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [indexProgress, setIndexProgress] = useState({ current: 0, total: 0 });
  const [checkResults, setCheckResults] = useState<Record<SourceKey, CheckResult>>({
    new: { loading: false, result: null, error: null },
    older: { loading: false, result: null, error: null },
  });

  // Load both URLs and active source from config on mount
  useEffect(() => {
    (async () => {
      const { data: newUrlData } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'sharepoint_folder_url')
        .maybeSingle();
      if (newUrlData) setNewUrl(newUrlData.config_value);

      const { data: olderUrlData } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'sharepoint_folder_url_older')
        .maybeSingle();
      if (olderUrlData?.config_value) setOlderUrl(olderUrlData.config_value);

      const { data: activeData } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'active_resume_source')
        .maybeSingle();
      if (activeData?.config_value === 'older') setActiveSource('older');
    })();
  }, []);

  const saveConfigKey = async (key: string, value: string) => {
    const { data: existing } = await supabase
      .from('app_config')
      .select('id')
      .eq('config_key', key)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('app_config')
        .update({ config_value: value, updated_at: new Date().toISOString() })
        .eq('config_key', key);
    } else {
      await supabase.from('app_config').insert({ config_key: key, config_value: value });
    }
  };

  const handleCheckRoot = async (source: SourceKey) => {
    const url = source === 'new' ? newUrl : olderUrl;
    if (!url.trim()) {
      setCheckResults(prev => ({ ...prev, [source]: { loading: false, result: null, error: 'Please enter a URL first' } }));
      return;
    }

    setCheckResults(prev => ({ ...prev, [source]: { loading: true, result: null, error: null } }));

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/index-resumes?mode=check`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sharePointUrl: url }),
      });
      const result = await response.json();

      if (!response.ok) {
        setCheckResults(prev => ({ ...prev, [source]: { loading: false, result: null, error: result.error || 'Failed to check folder' } }));
        return;
      }

      setCheckResults(prev => ({ ...prev, [source]: { loading: false, result, error: null } }));
    } catch (error) {
      setCheckResults(prev => ({ ...prev, [source]: { loading: false, result: null, error: 'Failed to connect to check service' } }));
    }
  };

  const handleAzureAuthenticate = async () => {
    setIsAuthenticating(true);
    setMessage('');

    try {
      const tokenUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-sharepoint-token`;
      const response = await fetch(tokenUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });

      if (response.ok) {
        setIsAzureConnected(true);
        setMessage('Successfully authenticated with Azure!');
        setTimeout(() => setMessage(''), 2000);
      } else {
        const error = await response.json();
        setMessage(`Authentication failed: ${error.error || 'Unknown error'}`);
      }
    } catch {
      setMessage('Failed to connect to authentication service. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const runIndex = async (url: string): Promise<{ indexed: number; failed: number; total: number }> => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/index-resumes`;
    let offset = 0;
    const batchSize = 15;
    let totalIndexed = 0;
    let totalFailed = 0;
    let totalFiles = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(`${apiUrl}?offset=${offset}&batch=${batchSize}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sharePointUrl: url }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Indexing failed');

      totalIndexed += result.indexed || 0;
      totalFailed += result.failed || 0;
      totalFiles = result.total || totalFiles;
      hasMore = result.hasMore;
      offset += batchSize;
      setIndexProgress({ current: Math.min(offset, totalFiles), total: totalFiles });

      if (hasMore) await new Promise(resolve => setTimeout(resolve, 300));
    }

    return { indexed: totalIndexed, failed: totalFailed, total: totalFiles };
  };

  const handleSwitchSource = async (source: SourceKey) => {
    if (source === activeSource) return;
    const url = source === 'new' ? newUrl : olderUrl;
    if (!url.trim()) {
      setMessage(`Please enter a SharePoint URL for the ${source === 'new' ? 'New' : 'Older'} Candidates folder first.`);
      return;
    }

    setIsIndexing(true);
    setMessage(`Switching to ${source === 'new' ? 'New' : 'Older'} Candidates — wiping old resumes and re-indexing...`);
    setIndexProgress({ current: 0, total: 0 });

    try {
      await saveConfigKey('active_resume_source', source);
      await saveConfigKey(source === 'new' ? 'sharepoint_folder_url' : 'sharepoint_folder_url_older', url);
      if (source === 'new') await saveConfigKey('sharepoint_folder_url', url);

      const result = await runIndex(url);
      const parts: string[] = [];
      if (result.indexed > 0) parts.push(`${result.indexed} indexed`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      setMessage(`Switch complete: ${parts.join(', ') || 'No changes'}. Total files: ${result.total}`);
      setActiveSource(source);

      await new Promise(resolve => setTimeout(resolve, 2000));
      onSave(url);
    } catch (error) {
      setMessage(`Error switching sources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSave = async () => {
    const activeUrl = activeSource === 'new' ? newUrl : olderUrl;
    if (!activeUrl.trim()) {
      setMessage(`Please enter a SharePoint URL for the active source (${activeSource === 'new' ? 'New' : 'Older'} Candidates).`);
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      await saveConfigKey('sharepoint_folder_url', newUrl);
      await saveConfigKey('sharepoint_folder_url_older', olderUrl);
      await saveConfigKey('active_resume_source', activeSource);

      setMessage('Configuration saved successfully!');
      setTimeout(() => onSave(activeUrl), 1000);
    } catch {
      setMessage('Error saving configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIndexResumes = async () => {
    const url = activeSource === 'new' ? newUrl : olderUrl;
    if (!url.trim()) {
      setMessage(`Please enter a SharePoint URL for ${activeSource === 'new' ? 'New' : 'Older'} Candidates.`);
      return;
    }

    setIsIndexing(true);
    setMessage('Indexing in progress — this will wipe all old resumes and load files from the selected folder.');
    setIndexProgress({ current: 0, total: 0 });

    try {
      await saveConfigKey('active_resume_source', activeSource);
      await saveConfigKey(activeSource === 'new' ? 'sharepoint_folder_url' : 'sharepoint_folder_url_older', url);
      if (activeSource === 'new') await saveConfigKey('sharepoint_folder_url', url);

      const result = await runIndex(url);
      const parts: string[] = [];
      if (result.indexed > 0) parts.push(`${result.indexed} indexed`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      setMessage(`Indexing complete: ${parts.join(', ') || 'No changes'}. Total files: ${result.total}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      onSave(url);
    } catch (error) {
      setMessage(`Error indexing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 p-6 pb-4 sticky top-0 bg-white z-10 rounded-t-xl">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-6 h-6" style={{ color: '#FE9900' }} />
            <h2 className="text-2xl font-bold text-slate-800">Configuration</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6 px-6 pb-6">
          {/* Binary Toggle Switch */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Resume Source</label>
            <div className="relative flex bg-white rounded-lg border border-slate-300 p-1">
              {/* Sliding indicator */}
              <div
                className="absolute top-1 bottom-1 rounded-md transition-all duration-300 ease-in-out"
                style={{
                  backgroundColor: '#FE9900',
                  width: 'calc(50% - 4px)',
                  left: activeSource === 'new' ? '4px' : 'calc(50% + 0px)',
                }}
              />
              <button
                onClick={() => !isIndexing && handleSwitchSource('new')}
                disabled={isIndexing}
                className="relative flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-medium text-sm transition-colors duration-200 z-10 disabled:cursor-not-allowed"
                style={{ color: activeSource === 'new' ? '#ffffff' : '#64748b' }}
              >
                <Users className="w-4 h-4" />
                <span>New Candidates</span>
              </button>
              <button
                onClick={() => !isIndexing && handleSwitchSource('older')}
                disabled={isIndexing}
                className="relative flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-medium text-sm transition-colors duration-200 z-10 disabled:cursor-not-allowed"
                style={{ color: activeSource === 'older' ? '#ffffff' : '#64748b' }}
              >
                <Archive className="w-4 h-4" />
                <span>Older Candidates</span>
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Switching sources will erase all current resumes and re-index from the selected folder. The active source is {activeSource === 'new' ? 'New' : 'Older'} Candidates.
            </p>
          </div>

          {/* New Candidates URL */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-slate-600" />
              <label className="text-sm font-semibold text-slate-700">New Candidates — SharePoint URL</label>
              {activeSource === 'new' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FFF5E6', color: '#E68A00' }}>
                  Active
                </span>
              )}
            </div>
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://humangosolutions.sharepoint.com/:f:/s/HR-Personnel/..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': '#FE9900' } as React.CSSProperties}
              onFocus={(e) => e.currentTarget.style.borderColor = '#FE9900'}
              disabled={isIndexing}
            />
            <button
              onClick={() => handleCheckRoot('new')}
              disabled={checkResults.new.loading || !newUrl.trim() || isIndexing}
              className="mt-2 flex items-center gap-2 px-3 py-2 text-sm rounded-lg border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: checkResults.new.loading || !newUrl.trim() ? '#cbd5e1' : '#027B7B',
                color: checkResults.new.loading || !newUrl.trim() ? '#94a3b8' : '#027B7B',
              }}
            >
              {checkResults.new.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Check Root</span>
            </button>
            {checkResults.new.result && (
              <div className="mt-3 p-3 rounded-lg bg-teal-50 border border-teal-200">
                <div className="flex items-center gap-2 text-teal-800 font-medium text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{checkResults.new.result.processableFiles} resume files found</span>
                  <span className="text-slate-400 font-normal">({checkResults.new.result.totalItems} total items)</span>
                </div>
                {checkResults.new.result.sampleNames.length > 0 && (
                  <div className="mt-2 text-xs text-slate-600">
                    <span className="font-medium">Sample files:</span>
                    <ul className="mt-1 space-y-0.5">
                      {checkResults.new.result.sampleNames.map((name, i) => (
                        <li key={i} className="truncate">• {name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {checkResults.new.error && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{checkResults.new.error}</span>
              </div>
            )}
          </div>

          {/* Older Candidates URL */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Archive className="w-4 h-4 text-slate-600" />
              <label className="text-sm font-semibold text-slate-700">Older Candidates — SharePoint URL</label>
              {activeSource === 'older' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FFF5E6', color: '#E68A00' }}>
                  Active
                </span>
              )}
            </div>
            <input
              type="text"
              value={olderUrl}
              onChange={(e) => setOlderUrl(e.target.value)}
              placeholder="https://humangosolutions.sharepoint.com/:f:/s/HR-Personnel/..."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
              style={{ '--tw-ring-color': '#FE9900' } as React.CSSProperties}
              onFocus={(e) => e.currentTarget.style.borderColor = '#FE9900'}
              disabled={isIndexing}
            />
            <button
              onClick={() => handleCheckRoot('older')}
              disabled={checkResults.older.loading || !olderUrl.trim() || isIndexing}
              className="mt-2 flex items-center gap-2 px-3 py-2 text-sm rounded-lg border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: checkResults.older.loading || !olderUrl.trim() ? '#cbd5e1' : '#027B7B',
                color: checkResults.older.loading || !olderUrl.trim() ? '#94a3b8' : '#027B7B',
              }}
            >
              {checkResults.older.loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Check Root</span>
            </button>
            {checkResults.older.result && (
              <div className="mt-3 p-3 rounded-lg bg-teal-50 border border-teal-200">
                <div className="flex items-center gap-2 text-teal-800 font-medium text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{checkResults.older.result.processableFiles} resume files found</span>
                  <span className="text-slate-400 font-normal">({checkResults.older.result.totalItems} total items)</span>
                </div>
                {checkResults.older.result.sampleNames.length > 0 && (
                  <div className="mt-2 text-xs text-slate-600">
                    <span className="font-medium">Sample files:</span>
                    <ul className="mt-1 space-y-0.5">
                      {checkResults.older.result.sampleNames.map((name, i) => (
                        <li key={i} className="truncate">• {name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {checkResults.older.error && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{checkResults.older.error}</span>
              </div>
            )}
          </div>

          {/* Authentication */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Authentication</h3>
            <button
              onClick={handleAzureAuthenticate}
              disabled={isAuthenticating || isAzureConnected}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg disabled:border-slate-300 disabled:text-slate-400 disabled:bg-slate-50 transition-colors"
              style={
                isAuthenticating || isAzureConnected
                  ? { borderColor: '#cbd5e1', color: '#94a3b8', backgroundColor: '#f8fafc' }
                  : { borderColor: '#FE9900', color: '#FE9900' }
              }
            >
              <Zap className="w-4 h-4" />
              <span>{isAzureConnected ? 'Azure Connected' : isAuthenticating ? 'Authenticating...' : 'Authenticate with Azure'}</span>
            </button>
          </div>

          {/* Indexing progress */}
          {isIndexing && indexProgress.total > 0 && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 text-blue-700 text-sm font-medium mb-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Indexing: {indexProgress.current}/{indexProgress.total} files processed</span>
              </div>
              <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${indexProgress.total > 0 ? (indexProgress.current / indexProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('Error') || message.includes('Please') || message.includes('Failed')
                ? 'bg-red-100 text-red-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {message}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || isIndexing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: isSaving ? '#cbd5e1' : '#FE9900' }}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
            <button
              onClick={handleIndexResumes}
              disabled={isIndexing || (activeSource === 'new' ? !newUrl.trim() : !olderUrl.trim())}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isIndexing ? 'animate-spin' : ''}`} />
              <span>{isIndexing ? 'Indexing...' : 'Index Resumes'}</span>
            </button>
          </div>

          {/* Help text */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Quick Start:</h3>
            <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
              <li>Paste SharePoint URLs for both New and Older Candidates folders</li>
              <li>Click "Check Root" to verify a folder is reachable and see file counts</li>
              <li>Click "Authenticate with Azure" to connect</li>
              <li>Use the toggle switch to switch between sources — switching automatically wipes and re-indexes</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
