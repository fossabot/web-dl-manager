import prisma from './prisma';
import { hashPassword } from './auth';
import { restoreGalleryDlConfig } from './tasks';
import { CAMOUFLAGE_DIR } from './constants';
import { execSync } from 'child_process';
import fs from 'fs';

export async function initApp() {
  // 1. Restore gallery-dl config at startup
  await restoreGalleryDlConfig();

  // 2. Clone Static Site for Camouflage
  const gitUrl = process.env.STATIC_SITE_GIT_URL || "https://github.com/Jyf0214/upgraded-doodle.git";
  const gitBranch = process.env.STATIC_SITE_GIT_BRANCH || "gh-pages";

  if (!fs.existsSync(CAMOUFLAGE_DIR)) {
      console.log(`Cloning static site to ${CAMOUFLAGE_DIR}...`);
      try {
          execSync(`git clone --quiet --depth 1 --branch ${gitBranch} ${gitUrl} ${CAMOUFLAGE_DIR}`);
          console.log("Static site cloning successful.");
      } catch (e) {
          console.error("Static site cloning failed:", e);
      }
  }

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
