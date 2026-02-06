import { NextResponse } from 'next/server';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const OWNER = "Jyf0214";
const REPO = "web-dl-manager";
const BRANCH = "next";

export async function GET() {
  try {
    // Get remote latest SHA
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`;
    const res = await axios.get(url);
    const remoteSha = res.data.sha;

    // Get local SHA (if available via git or file)
    let localSha = 'N/A';
    try {
        // Try reading from revision file if generated during build
        // or execute git rev-parse
        // In this environment, we might not have git inside the container pointing to the right repo
        // For now, return N/A if not found.
    } catch (e) {}

    return NextResponse.json({
      current_version: localSha,
      latest_version: remoteSha.substring(0, 7),
      update_available: localSha !== remoteSha && localSha !== 'N/A'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
