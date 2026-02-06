module.exports = {
  apps: [
    {
      name: "web-dl-manager",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      log_file: "logs/pm2.log",
      time: true,
      instances: 1,
      exec_mode: "fork"
    }
  ]
};
