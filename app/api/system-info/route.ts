import { NextResponse } from 'next/server';
import os from 'os';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // 计算 CPU 使用率
    let cpuUsage = 0;
    if (process.cpuUsage) {
      const usage = process.cpuUsage();
      cpuUsage = Math.round((usage.user + usage.system) / 1000000);
    }

    // 计算平均 CPU 负载
    const loadAverage = os.loadavg();

    return NextResponse.json({
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
        total: Math.round(totalMemory / 1024 / 1024), // MB
        used: Math.round(usedMemory / 1024 / 1024), // MB
        free: Math.round(freeMemory / 1024 / 1024), // MB
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get system info:', error);
    return NextResponse.json(
      { error: 'Failed to get system information' },
      { status: 500 }
    );
  }
}
