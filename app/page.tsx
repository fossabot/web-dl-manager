'use client';

import { useState, useEffect } from 'react';

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const [downloader, setDownloader] = useState('gallery-dl');
  const [uploadService, setUploadService] = useState('');
  const [uploadPath, setUploadPath] = useState('');
  const [enableCompression, setEnableCompression] = useState(true);
  const [splitCompression, setSplitCompression] = useState(false);
  const [splitSize, setSplitSize] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('url', url);
    formData.append('downloader', downloader);
    formData.append('upload_service', uploadService);
    formData.append('upload_path', uploadPath);
    formData.append('enable_compression', enableCompression ? 'true' : 'false');
    formData.append('split_compression', splitCompression ? 'true' : 'false');
    formData.append('split_size', splitSize.toString());

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Successfully started ${data.taskIds.length} task(s).` });
        setUrl('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start task' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Downloader</h1>
        <p className="text-slate-400 text-sm">Download images and videos from various sites and upload to cloud storage.</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-green-900/50 border border-green-500/50 text-green-200' : 'bg-red-900/50 border border-red-500/50 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1 */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
          <div className="flex items-center mb-6">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">1</span>
            <h2 className="text-lg font-semibold text-white">Select Downloader & Enter URLs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-400 mb-2">Downloader Engine</label>
              <select
                value={downloader}
                onChange={(e) => setDownloader(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gallery-dl">Gallery-DL</option>
                <option value="kemono-dl">Kemono-DL (Pro)</option>
                <option value="megadl">Mega-DL</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-400 mb-2">URL(s) - One per line</label>
              <textarea
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                rows={5}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="https://example.com/user/123"
              />
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
          <div className="flex items-center mb-6">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">2</span>
            <h2 className="text-lg font-semibold text-white">Upload Configuration</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Target Service</label>
              <select
                value={uploadService}
                onChange={(e) => setUploadService(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a service</option>
                <option value="webdav">WebDAV</option>
                <option value="s3">S3</option>
                <option value="b2">Backblaze B2</option>
                <option value="gofile">Gofile.io</option>
                <option value="openlist">Openlist</option>
              </select>
            </div>
            {uploadService !== 'gofile' && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Remote Path</label>
                <input
                  type="text"
                  value={uploadPath}
                  onChange={(e) => setUploadPath(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="/downloads/images"
                />
              </div>
            )}
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
          <div className="flex items-center mb-6">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">3</span>
            <h2 className="text-lg font-semibold text-white">Options</h2>
          </div>
          <div className="space-y-6">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={enableCompression}
                  onChange={(e) => setEnableCompression(e.target.checked)}
                  className="w-5 h-5 bg-slate-900 border-slate-700 rounded text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                />
                <span className="ml-3 text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Enable Compression</span>
              </label>
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={splitCompression}
                  onChange={(e) => setSplitCompression(e.target.checked)}
                  className="w-5 h-5 bg-slate-900 border-slate-700 rounded text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                />
                <span className="ml-3 text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Split Archive</span>
              </label>
            </div>
            {splitCompression && (
              <div className="w-full md:w-1/3">
                <label className="block text-sm font-medium text-slate-400 mb-2">Split Size (MB)</label>
                <input
                  type="number"
                  value={splitSize}
                  onChange={(e) => setSplitSize(parseInt(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center pb-12">
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-bold rounded-full shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-3 transform hover:-translate-y-1 active:translate-y-0"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <span>Start Download</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}