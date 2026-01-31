import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import prisma from './db';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = promisify(exec);
const app = new Hono();

app.use('*', logger());
app.use('*', cors());

// Auth endpoints
app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json();
  
  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (user && user.hashedPassword === password) { // TODO: Use bcrypt/argon2
    return c.json({ 
      success: true, 
      user: { id: user.id, username: user.username, isAdmin: user.isAdmin },
      token: 'mock-jwt-token' 
    });
  }
  
  return c.json({ success: false, message: 'Invalid credentials' }, 401);
});

// Tasks endpoints
app.get('/api/tasks', async (c) => {
  const tasks = await prisma.task.findMany({
    include: { logs: { take: 10, orderBy: { createdAt: 'desc' } } },
    orderBy: { createdAt: 'desc' }
  });
  return c.json({ tasks });
});

app.post('/api/tasks', async (c) => {
  const { name, url } = await c.req.json();
  const task = await prisma.task.create({
    data: {
      name,
      url,
      status: 'PENDING',
    }
  });
  
  // Trigger download asynchronously
  startDownload(task.id);
  
  return c.json(task);
});

// Stats endpoint
app.get('/api/stats', async (c) => {
  const activeCount = await prisma.task.count({ where: { status: 'DOWNLOADING' } });
  const completedTodayCount = await prisma.task.count({ 
    where: { 
      status: 'COMPLETED',
      updatedAt: { gte: new Date(new Date().setHours(0,0,0,0)) }
    } 
  });
  
  return c.json({
    activeTasks: activeCount,
    completedToday: completedTodayCount,
    storageUsed: '0 GB' // TODO: Implement disk usage check
  });
});

// Serve static files from frontend build
app.use('/*', serveStatic({ root: './dist/frontend' }));

// Fallback to index.html for SPA
app.get('*', serveStatic({ path: './dist/frontend/index.html' }));

async function startDownload(taskId: number) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status: 'DOWNLOADING' }
  });

  await prisma.log.create({
    data: {
      message: `Started download for ${task.url}`,
      level: 'INFO',
      taskId: task.id
    }
  });

  try {
    // Mock download command
    // In real app: exec(`gallery-dl ${task.url}`)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED', progress: 100 }
    });

    await prisma.log.create({
      data: {
        message: `Successfully completed download for ${task.url}`,
        level: 'INFO',
        taskId: task.id
      }
    });
  } catch (error: any) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'FAILED' }
    });
    
    await prisma.log.create({
      data: {
        message: `Failed download: ${error.message}`,
        level: 'ERROR',
        taskId: taskId
      }
    });
  }
}

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port
});