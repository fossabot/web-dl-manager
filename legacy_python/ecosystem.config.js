module.exports = {
  apps: [
    {
      name: "web-dl-manager",
      script: "python",
      args: "-m app.main",
      cwd: __dirname,
      env: {
        DEBUG_MODE: "false",
        TUNNEL_TOKEN: process.env.TUNNEL_TOKEN || ""
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      log_file: "logs/pm2.log",
      time: true,
      instances: 1,
      exec_mode: "fork"
    }
  ]
};