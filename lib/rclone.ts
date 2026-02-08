import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { dbConfig } from './config';

export async function createRcloneConfig(taskId: string, service: string, params: Record<string, unknown>): Promise<string | null> {
  const p = params as Record<string, string | undefined>;
  // Gofile and Openlist usually don't need rclone config in this context if handled by custom uploaders,
  // but if we support rclone for them later, we can add here.
  if (service === 'gofile' || service === 'openlist') {
    return null;
  }

  // eslint-disable-next-line sonarjs/publicly-writable-directories
  const configDir = '/tmp/rclone_configs';
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  const configPath = path.join(configDir, `${taskId}.conf`);
  
  let configContent = `[remote]
type = ${service}
`;

  if (service === 'webdav') {
    const url = p.webdav_url || await dbConfig.getConfig('WDM_WEBDAV_URL');
    const user = p.webdav_user || await dbConfig.getConfig('WDM_WEBDAV_USER');
    const pass = p.webdav_pass || await dbConfig.getConfig('WDM_WEBDAV_PASS');

    if (!url || !user || !pass) return null;

    configContent += `url = ${url}
`;
    configContent += `vendor = other
`;
    configContent += `user = ${user}
`;
    
    // Obscure password
    const obscuredPass = await runRcloneObscure(pass as string);
    configContent += `pass = ${obscuredPass}
`;

  } else if (service === 's3') {
    const provider = p.s3_provider || await dbConfig.getConfig('WDM_S3_PROVIDER') || 'AWS';
    const accessKey = p.s3_access_key_id || await dbConfig.getConfig('WDM_S3_ACCESS_KEY_ID');
    const secretKey = p.s3_secret_access_key || await dbConfig.getConfig('WDM_S3_SECRET_ACCESS_KEY');
    const region = p.s3_region || await dbConfig.getConfig('WDM_S3_REGION');
    const endpoint = p.s3_endpoint || await dbConfig.getConfig('WDM_S3_ENDPOINT') || '';

    if (!accessKey || !secretKey || !region) return null;

    configContent += `provider = ${provider}
`;
    configContent += `access_key_id = ${accessKey}
`;
    configContent += `secret_access_key = ${secretKey}
`;
    configContent += `region = ${region}
`;
    if (endpoint) configContent += `endpoint = ${endpoint}
`;

  } else if (service === 'b2') {
    const account = p.b2_account_id || await dbConfig.getConfig('WDM_B2_ACCOUNT_ID');
    const key = p.b2_application_key || await dbConfig.getConfig('WDM_B2_APPLICATION_KEY');

    if (!account || !key) return null;

    configContent += `account = ${account}
`;
    configContent += `key = ${key}
`;
  }

  fs.writeFileSync(configPath, configContent);
  return configPath;
}

export async function runRcloneObscure(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const child = spawn('rclone', ['obscure', password]);
    let stdout = '';
    child.stdout.on('data', (data) => stdout += data.toString());
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error('Failed to obscure password'));
    });
  });
}

export async function runRcloneCommand(command: string, logFile?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const logStream = logFile ? fs.createWriteStream(logFile, { flags: 'a' }) : null;
    if (logStream) logStream.write(`
[Rclone] Executing: ${command}
`);

    // eslint-disable-next-line sonarjs/os-command
    const child = spawn(command, { shell: true });

    if (logStream) {
      child.stdout.pipe(logStream);
      child.stderr.pipe(logStream);
    }

    child.on('close', (code) => {
      if (logStream) logStream.write(`
[Rclone] Exited with code ${code}
`);
      resolve(code === 0);
    });
  });
}
