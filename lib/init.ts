import prisma from './prisma';
import { hashPassword } from './auth';
import { restoreGalleryDlConfig } from './tasks';

export async function initApp() {
  // 1. Restore gallery-dl config at startup
  await restoreGalleryDlConfig();

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const username = process.env.APP_USERNAME || 'Jyf0214';
    const password = process.env.APP_PASSWORD;
    if (password) {
      console.log(`Creating admin user: ${username}`);
      await prisma.user.create({
        data: {
          username,
          hashedPassword: hashPassword(password),
          isAdmin: true,
        },
      });
    } else {
      console.warn('APP_PASSWORD not set. No admin user created.');
    }
  }
}
