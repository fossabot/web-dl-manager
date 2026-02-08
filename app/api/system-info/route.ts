import { NextResponse } from 'next/server';
import os from 'os';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    let cpuUsage = 0;
    if (process.cpuUsage) {
      const usage = process.cpuUsage();
      cpuUsage = Math.round((usage.user + usage.system) / 1000000);
    }

    const loadAverage = os.loadavg();

    return NextResponse.json({
      success: true,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        uptime: Math.floor(os.uptime()),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        speed: cpus[0]?.speed || 0,
        usage: cpuUsage,
        loadAverage: {
          oneMinute: loadAverage[0],
          fiveMinutes: loadAverage[1],
          fifteenMinutes: loadAverage[2],
        },
      },
      memory: {
        total: Math.round(totalMemory / 1024 / 1024),
        used: Math.round(usedMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024),
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('System info error:', error);
    return NextResponse.json(
      { error: '获取系统信息失败', message: 'Failed to get system information' },
      { status: 500 }
    );
  }
}
