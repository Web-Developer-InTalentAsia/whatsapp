module.exports = {
  apps: [
    {
      name: "intalent-whatsapp",
      script: "dist/server.cjs",
      cwd: "C:\\apps\\intalent-whatsapp-inbox",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};