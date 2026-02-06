import { NextResponse } from 'next/server';
import si from 'systeminformation';
import { getActiveTaskCount } from '@/lib/tasks';
import { execSync } from 'child_process';

function getVersion(cmd: string): string {
  try {
    return execSync(`${cmd} --version`).toString().trim().split('\n')[0];
  } catch (e) {
    return 'N/A';
  }
}

export async function GET() {
  const [cpu, mem, disk, time] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.time()
  ]);

  // Use the first disk usually mounted on /
  const mainDisk = disk.length > 0 ? disk[0] : { size: 0, used: 0, use: 0 };

  const galleryDlVer = getVersion('gallery-dl');
  const rcloneVer = getVersion('rclone');

  return NextResponse.json({
    system: {
      uptime: `${Math.floor(time.uptime / 86400)}d ${Math.floor((time.uptime % 86400) / 3600)}h`,
      platform: `${process.platform} ${process.arch}`,
      cpu_usage: cpu.currentLoad,
    },
    memory: {
      total: mem.total,
      used: mem.used,
      percent: (mem.used / mem.total) * 100,
    },
    disk: {
      total: mainDisk.size,
      used: mainDisk.used,
      percent: mainDisk.use,
    },
    application: {
      active_tasks: getActiveTaskCount(),
      versions: {
        'gallery-dl': galleryDlVer,
        'rclone': rcloneVer
      }
    }
  });
}