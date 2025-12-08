module.exports = {
  apps: [{
    name: 'ltg-assistant',
    script: 'server.js',
    instances: process.env.PM2_INSTANCES || 4,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '500M',
    env_file: '.env.production',
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
