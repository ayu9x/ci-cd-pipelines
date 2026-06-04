const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_VERSION = process.env.BUILD_VERSION || 'local-dev';
const START_TIME = new Date().toISOString();

// ─── Serve frontend dashboard ────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Root endpoint ───────────────────────────────────────────
app.get('/', (req, res) => {
  // If the request wants JSON (e.g. curl), return JSON; otherwise serve the dashboard
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  res.json({
    status: 'running',
    app: 'cicd-pipeline-demo',
    version: BUILD_VERSION,
    deployed_at: START_TIME,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// ─── API endpoints (used by the dashboard frontend) ──────────
app.get('/api', (req, res) => {
  res.json({
    status: 'running',
    app: 'cicd-pipeline-demo',
    version: BUILD_VERSION,
    deployed_at: START_TIME,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    healthy: true,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    node_version: process.version,
    platform: process.platform,
    memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    environment: process.env.NODE_ENV || 'development',
    build_version: BUILD_VERSION,
  });
});

// ─── Original API endpoints (backward compatible) ────────────
app.get('/health', (req, res) => {
  res.json({
    healthy: true,
    timestamp: new Date().toISOString(),
  });
});

// ─── Info endpoint (useful for debugging deployments) ────────
app.get('/info', (req, res) => {
  res.json({
    node_version: process.version,
    platform: process.platform,
    memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    environment: process.env.NODE_ENV || 'development',
    build_version: BUILD_VERSION,
  });
});

// ─── Start server ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   Version: ${BUILD_VERSION}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   Health:    http://localhost:${PORT}/health`);
});
