import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PROJECT_ROOT } from '@/lib/constants';

let changelogCache: { content: string | null; lastFetch: number } = {
  content: null,
  lastFetch: 0,
};
const CACHE_TTL = 3600 * 1000; // 1 hour

export async function GET() {
  const now = Date.now();

  if (changelogCache.content && now - changelogCache.lastFetch < CACHE_TTL) {
    return new NextResponse(changelogCache.content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Try GitHub
  try {
    const remoteUrl = "https://raw.githubusercontent.com/Jyf0214/web-dl-manager/main/CHANGELOG.md";
    const res = await axios.get(remoteUrl, { timeout: 3000 });
    if (res.status === 200) {
      changelogCache = { content: res.data, lastFetch: now };
      return new NextResponse(res.data, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  } catch {
    // Ignore and fallback to local
  }

  // Fallback to local
  const localPath = path.join(PROJECT_ROOT, 'CHANGELOG.md');
  if (fs.existsSync(localPath)) {
    const content = fs.readFileSync(localPath, 'utf8');
    changelogCache = { content, lastFetch: now };
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new NextResponse('Changelog not found.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
