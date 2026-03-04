module.exports = {
  apps: [
    {
      name: 'crystal-studio',
      script: 'npx',
      args: 'vite --port 3000 --host 0.0.0.0',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
