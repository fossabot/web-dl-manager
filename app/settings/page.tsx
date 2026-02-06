'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
      }
    } catch (err) {
      console.error('Failed to fetch configs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleChange = (key: string, value: string) => {
    setConfigs(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 text-blue-500 border-4 border-slate-700 border-t-blue-500 rounded-full"></div>
      </div>
    );
  }

  const sections = [
    {
      title: 'General Settings',
      keys: [
        { key: 'TUNNEL_TOKEN', label: 'Cloudflared Tunnel Token', placeholder: 'your-token-here' },
        { key: 'AVATAR_URL', label: 'Avatar URL', placeholder: 'https://example.com/avatar.png' },
        { key: 'WDM_GALLERY_DL_ARGS', label: 'Gallery-dl Extra Args', placeholder: '--cookies-from-browser chrome' },
        { key: 'REDIS_URL', label: 'Redis URL', placeholder: 'redis://default:password@host:port' },
      ]
    },
    {
      title: 'WebDAV Storage',
      keys: [
        { key: 'WDM_WEBDAV_URL', label: 'WebDAV URL', placeholder: 'https://dav.example.com' },
        { key: 'WDM_WEBDAV_USER', label: 'WebDAV Username', placeholder: 'user' },
        { key: 'WDM_WEBDAV_PASS', label: 'WebDAV Password', placeholder: 'password', type: 'password' },
      ]
    },
    {
      title: 'S3 Compatible Storage',
      keys: [
        { key: 'WDM_S3_PROVIDER', label: 'S3 Provider', placeholder: 'AWS / Cloudflare / Backblaze' },
        { key: 'WDM_S3_REGION', label: 'S3 Region', placeholder: 'us-east-1' },
        { key: 'WDM_S3_ENDPOINT', label: 'S3 Endpoint', placeholder: 'https://...' },
        { key: 'WDM_S3_ACCESS_KEY_ID', label: 'Access Key ID', placeholder: '...' },
        { key: 'WDM_S3_SECRET_ACCESS_KEY', label: 'Secret Access Key', placeholder: '...', type: 'password' },
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center">
          <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          System Settings
        </h1>
        <p className="text-slate-400 text-sm">Configure storage services and system parameters.</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-green-900/50 border border-green-500/50 text-green-200' : 'bg-red-900/50 border border-red-500/50 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{section.title}</h2>
            </div>
            <div className="p-6 space-y-4">
              {section.keys.map((item) => (
                <div key={item.key}>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 px-1">{item.label}</label>
                  <input
                    type={item.type || 'text'}
                    value={configs[item.key] || ''}
                    onChange={(e) => handleChange(item.key, e.target.value)}
                    placeholder={item.placeholder}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-4 pb-12">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-bold rounded-full shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
