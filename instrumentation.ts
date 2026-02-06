export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initApp } = await import('./lib/init');
    const { startBackgroundTasks } = await import('./lib/background');
    
    await initApp();
    startBackgroundTasks();
  }
}
