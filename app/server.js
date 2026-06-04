const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_VERSION = process.env.BUILD_VERSION || 'local-dev';
const START_TIME = new Date().toISOString();

// ─── Root endpoint ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    app: 'cicd-pipeline-demo',
    version: BUILD_VERSION,
    deployed_at: START_TIME,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// ─── Health check endpoint ───────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    healthy: true,
    timestamp: new Date().toISOString(),
  });
});

// ─── Info endpoint (useful for debugging deployments) ────────────
app.get('/info', (req, res) => {
  res.json({
    node_version: process.version,
    platform: process.platform,
    memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    environment: process.env.NODE_ENV || 'development',
    build_version: BUILD_VERSION,
  });
});

// ─── Start server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   Version: ${BUILD_VERSION}`);
  console.log(`   Health:  http://localhost:${PORT}/health`);
});
