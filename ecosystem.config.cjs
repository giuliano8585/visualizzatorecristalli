module.exports = {
  apps: [
    {
      name: 'crystal-studio',
      script: 'node_modules/.bin/serve',
      args: 'dist -l 3000 -s',
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
