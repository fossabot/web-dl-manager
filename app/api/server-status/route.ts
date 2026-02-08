import { NextResponse } from 'next/server';
import si from 'systeminformation';
import { getActiveTaskCount } from '@/lib/tasks';
import { getNetSpeed } from '@/lib/utils';
import { execSync } from 'child_process';

function getVersion(cmd: string): string {
  try {
    // eslint-disable-next-line sonarjs/os-command
    return execSync(`${cmd} --version`, { timeout: 3000 }).toString().trim().split('\n')[0];
  } catch {
    return 'N/A';
  }
}

export async function GET() {
  try {
    const [cpu, mem, disk, time, netSpeed] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.time(),
      getNetSpeed()
    ]);

    const mainDisk = disk.length > 0 ? disk[0] : { size: 0, used: 0, use: 0 };

    const galleryDlVer = getVersion('gallery-dl');
    const rcloneVer = getVersion('rclone');

    return NextResponse.json({
      success: true,
      system: {
        uptime: `${Math.floor(time.uptime / 86400)}d ${Math.floor((time.uptime % 86400) / 3600)}h`,
        platform: `${process.platform} ${process.arch}`,
        cpu_usage: cpu.currentLoad,
      },
      network: {
        rx_speed: netSpeed.rx,
        tx_speed: netSpeed.tx,
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
  } catch (error) {
    console.error('Server status error:', error);
    return NextResponse.json(
      { error: '获取服务器状态失败', message: 'Failed to get server status' },
      { status: 500 }
    );
  }
}
