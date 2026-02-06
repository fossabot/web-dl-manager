export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initApp } = await import('./lib/init');
    const { startBackgroundTasks } = await import('./lib/background');
    const { startTunnel } = await import('./lib/tunnel');
    
    await initApp();
    startBackgroundTasks();
    await startTunnel();
  }
}
