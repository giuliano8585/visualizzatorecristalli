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
    },
    {
      name: 'crystal-preview',
      script: 'npx',
      args: 'vite preview --port 3001 --host 0.0.0.0',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'production',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
