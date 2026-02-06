import axios from 'axios';
import fs from 'fs';
import path from 'path';

export class OpenlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenlistError';
  }
}

export async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/auth/login`;
  try {
    const resp = await axios.post(url, { username, password }, { timeout: 10000 });
    if (resp.data.code === 200) {
      const token = resp.data.data?.token;
      if (!token) throw new OpenlistError('Login successful, but token not found');
      return token;
    } else {
      throw new OpenlistError(resp.data.message || 'Unknown error');
    }
  } catch (err: any) {
    throw new OpenlistError(`Login failed: ${err.message}`);
  }
}

export async function createDirectory(baseUrl: string, token: string, remoteDir: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/fs/mkdir`;
  try {
    const resp = await axios.post(url, { path: remoteDir.replace(/\/$/, '') }, {
      headers: { Authorization: token },
      timeout: 10000
    });
    if (resp.data.code === 200) {
      return true;
    } else if (resp.data.code === 400 && resp.data.message?.includes('exist')) {
      return true;
    } else {
      throw new OpenlistError(resp.data.message || 'Failed to create directory');
    }
  } catch (err: any) {
    throw new OpenlistError(`Directory creation failed: ${err.message}`);
  }
}

export async function uploadFile(
  baseUrl: string,
  token: string,
  localFile: string,
  remoteDir: string,
  progressCallback?: (current: number, total: number) => void
) {
  const filename = path.basename(localFile);
  const fullPath = `${remoteDir.replace(/\/$/, '')}/${filename}`;
  const url = `${baseUrl.replace(/\/$/, '')}/api/fs/put`;

  const stats = fs.statSync(localFile);
  const totalSize = stats.size;

  const fileStream = fs.createReadStream(localFile);
  let uploadedSize = 0;

  fileStream.on('data', (chunk) => {
    uploadedSize += chunk.length;
    if (progressCallback) progressCallback(uploadedSize, totalSize);
  });

  try {
    const resp = await axios.put(url, fileStream, {
      headers: {
        Authorization: token,
        'File-Path': encodeURIComponent(fullPath),
        'Content-Type': 'application/octet-stream',
        'As-Task': 'false',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000,
    });

    if (resp.data.code === 200) {
      return fullPath;
    } else {
      throw new OpenlistError(resp.data.message || 'Upload failed');
    }
  } catch (err: any) {
    throw new OpenlistError(`Upload failed: ${err.message}`);
  }
}
