import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

export async function uploadToGofile(filePath: string, token?: string, folderId?: string, logCallback?: (msg: string) => void): Promise<string> {
  // 1. Get best server
  if (logCallback) logCallback('Fetching Gofile server...');
  let server = 'store1';
  try {
    const res = await axios.get('https://api.gofile.io/servers');
    if (res.data.status === 'ok' && res.data.data.servers.length > 0) {
      server = res.data.data.servers[0].name;
    }
  } catch {
    if (logCallback) logCallback('Failed to fetch servers, using default.');
  }

  const uploadUrl = `https://${server}.gofile.io/uploadFile`;
  if (logCallback) logCallback(`Uploading to ${server}...`);

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  if (token) form.append('token', token);
  if (folderId) form.append('folderId', folderId);

  try {
    const res = await axios.post(uploadUrl, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (res.data.status === 'ok') {
      return res.data.data.downloadPage;
    } else {
      throw new Error(`Gofile error: ${JSON.stringify(res.data)}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Upload failed: ${message}`);
  }
}
