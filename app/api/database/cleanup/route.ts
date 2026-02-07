import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { dbConfig } from '@/lib/config';

const KNOWN_CONFIG_KEYS = new Set([
  "REDIS_URL",  // Legacy support only, use DATABASE_URL for redis:// URLs instead
  "WDM_CONFIG_BACKUP_RCLONE_BASE64",
  "WDM_CONFIG_BACKUP_REMOTE_PATH",
  "WDM_CUSTOM_SYNC_ENABLED",
  "WDM_CUSTOM_SYNC_LOCAL_PATH",
  "WDM_CUSTOM_SYNC_REMOTE_PATH",
  "WDM_CUSTOM_SYNC_INTERVAL",
  "WDM_SYNC_TASKS_JSON",
  "WDM_GALLERY_DL_ARGS",
  "WDM_VERIFICATION_TYPE",
  "WDM_VERIFICATION_SITE_KEY",
  "WDM_VERIFICATION_SECRET_KEY",
  "WDM_VERIFICATION_ID",
  "WDM_VERIFICATION_GEETEST_DEMO_TYPE",
  "TUNNEL_TOKEN",
  "AVATAR_URL",
  "login_domain",
  "WDM_OPENLIST_URL",
  "WDM_OPENLIST_USER",
  "WDM_OPENLIST_PASS",
  "WDM_GOFILE_TOKEN",
  "WDM_GOFILE_FOLDER_ID",
  "WDM_WEBDAV_URL",
  "WDM_WEBDAV_USER",
  "WDM_WEBDAV_PASS",
  "WDM_S3_PROVIDER",
  "WDM_S3_ACCESS_KEY_ID",
  "WDM_S3_SECRET_ACCESS_KEY",
  "WDM_S3_REGION",
  "WDM_S3_ENDPOINT",
  "WDM_B2_ACCOUNT_ID",
  "WDM_B2_APPLICATION_KEY",
  "WDM_KEMONO_USERNAME",
  "WDM_KEMONO_PASSWORD",
  "WDM_BG_CONFIG", // Background configuration (stored as JSON)
]);

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allConfigs = await prisma.config.findMany();
    let deletedCount = 0;

    for (const config of allConfigs) {
      if (config.keyName === null || !KNOWN_CONFIG_KEYS.has(config.keyName)) {
        await prisma.config.delete({ where: { id: config.id } });
        deletedCount++;
      }
    }
    
    // Clear cache
    dbConfig.clearCache();

    return NextResponse.json({ 
      status: 'success', 
      message: `Cleanup complete. Removed ${deletedCount} unused config keys.` 
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: 'error', message }, { status: 500 });
  }
}
