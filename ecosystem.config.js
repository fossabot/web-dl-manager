module.exports = {
  apps: [
    {
      name: "web-dl-manager",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 6275
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      log_file: "logs/pm2-main.log",
      time: true,
      instances: 1,
      exec_mode: "fork"
    },
    {
      name: "camouflage-server",
      script: "node",
      args: "camouflage-server.mjs",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 5492
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      log_file: "logs/pm2-camouflage.log",
      time: true,
      instances: 1,
      exec_mode: "fork"
    }
  ]
};
