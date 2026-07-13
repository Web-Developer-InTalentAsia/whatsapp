module.exports = {
  apps: [
    {
      name: "intalent_whatsapp",
      script: "./dist/server.cjs",

      // ecosystem.config.cjs file එක තිබෙන project folder එක භාවිත කරයි
      cwd: __dirname,

      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      watch: false,

      restart_delay: 3000,
      max_restarts: 10,
      max_memory_restart: "500M",

      time: true,
      merge_logs: true,

      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};