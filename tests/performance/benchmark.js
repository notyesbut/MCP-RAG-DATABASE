const axios = require('axios');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const ITERATIONS = 100;
const CONCURRENT_REQUESTS = 10;

// Test endpoints
const ENDPOINTS = [
  { method: 'GET', path: '/health', name: 'Health Check' },
  { method: 'GET', path: '/health/detailed', name: 'Detailed Health' },
  { method: 'GET', path: '/health/metrics', name: 'System Metrics' },
  { method: 'GET', path: '/health/liveness', name: 'Liveness Probe' },
  { method: 'GET', path: '/health/readiness', name: 'Readiness Probe' },
  { method: 'GET', path: '/api/v1/chat/mcps', name: 'List Chat MCPs' },
  { method: 'GET', path: '/api/v1/user/mcps', name: 'List User MCPs' },
  { method: 'GET', path: '/api/admin/metrics', name: 'Admin Metrics' },
  { method: 'GET', path: '/api/admin/mcp/status', name: 'MCP Status' },
  { method: 'GET', path: '/api/admin/errors', name: 'Error Logs' }
];

// Performance metrics storage
const metrics = {
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  iterations: ITERATIONS,
  concurrency: CONCURRENT_REQUESTS,
  endpoints: {},
  summary: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    requestsPerSecond: 0
  }
};

// Helper to calculate percentiles
function calculatePercentile(arr, percentile) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Measure single request
async function measureRequest(endpoint) {
  const start = performance.now();
  let success = false;
  let statusCode = 0;
  let error = null;

  try {
    const response = await axios({
      method: endpoint.method,
      url: `${BASE_URL}${endpoint.path}`,
      timeout: 5000,
      validateStatus: () => true // Accept any status
    });
    
    statusCode = response.status;
    success = statusCode >= 200 && statusCode < 300;
  } catch (err) {
    error = err.message;
  }

  const duration = performance.now() - start;

  return {
    duration,
    success,
    statusCode,
    error
  };
}

// Benchmark single endpoint
async function benchmarkEndpoint(endpoint) {
  console.log(`\n📊 Benchmarking ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
  
  const results = [];
  const startTime = performance.now();
  
  // Run iterations in batches
  for (let i = 0; i < ITERATIONS; i += CONCURRENT_REQUESTS) {
    const batch = [];
    const batchSize = Math.min(CONCURRENT_REQUESTS, ITERATIONS - i);
    
    for (let j = 0; j < batchSize; j++) {
      batch.push(measureRequest(endpoint));
    }
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // Progress indicator
    process.stdout.write(`\r  Progress: ${Math.min(i + CONCURRENT_REQUESTS, ITERATIONS)}/${ITERATIONS}`);
  }
  
  const totalTime = performance.now() - startTime;
  
  // Calculate metrics
  const durations = results.map(r => r.duration);
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  const endpointMetrics = {
    totalRequests: results.length,
    successfulRequests: successCount,
    failedRequests: failureCount,
    successRate: (successCount / results.length) * 100,
    averageResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
    minResponseTime: Math.min(...durations),
    maxResponseTime: Math.max(...durations),
    p50ResponseTime: calculatePercentile(durations, 50),
    p95ResponseTime: calculatePercentile(durations, 95),
    p99ResponseTime: calculatePercentile(durations, 99),
    requestsPerSecond: (results.length / totalTime) * 1000,
    errors: results.filter(r => r.error).map(r => r.error)
  };
  
  console.log(`\n  ✅ Success Rate: ${endpointMetrics.successRate.toFixed(2)}%`);
  console.log(`  ⏱️  Average: ${endpointMetrics.averageResponseTime.toFixed(2)}ms`);
  console.log(`  📈 P95: ${endpointMetrics.p95ResponseTime.toFixed(2)}ms`);
  console.log(`  🚀 RPS: ${endpointMetrics.requestsPerSecond.toFixed(2)}`);
  
  return endpointMetrics;
}

// Memory usage monitoring
function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    rss: (used.rss / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (used.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    heapUsed: (used.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
    external: (used.external / 1024 / 1024).toFixed(2) + ' MB'
  };
}

// Main benchmark function
async function runBenchmark() {
  console.log('🚀 Starting Performance Benchmark');
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`🔄 Iterations: ${ITERATIONS} requests per endpoint`);
  console.log(`⚡ Concurrency: ${CONCURRENT_REQUESTS} concurrent requests`);
  
  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
  } catch (err) {
    console.error('\n❌ Error: Server is not responding at', BASE_URL);
    console.error('   Please ensure the server is running before benchmarking.');
    process.exit(1);
  }
  
  // Record initial memory
  metrics.memoryBefore = getMemoryUsage();
  
  // Benchmark each endpoint
  for (const endpoint of ENDPOINTS) {
    metrics.endpoints[endpoint.name] = await benchmarkEndpoint(endpoint);
  }
  
  // Record final memory
  metrics.memoryAfter = getMemoryUsage();
  
  // Calculate overall summary
  let totalRequests = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  let allDurations = [];
  
  for (const [name, endpointMetrics] of Object.entries(metrics.endpoints)) {
    totalRequests += endpointMetrics.totalRequests;
    totalSuccessful += endpointMetrics.successfulRequests;
    totalFailed += endpointMetrics.failedRequests;
    
    // Approximate individual durations for percentile calculation
    for (let i = 0; i < endpointMetrics.totalRequests; i++) {
      allDurations.push(endpointMetrics.averageResponseTime);
    }
  }
  
  metrics.summary = {
    totalRequests,
    successfulRequests: totalSuccessful,
    failedRequests: totalFailed,
    overallSuccessRate: (totalSuccessful / totalRequests) * 100,
    averageResponseTime: allDurations.reduce((a, b) => a + b, 0) / allDurations.length,
    p95ResponseTime: calculatePercentile(allDurations, 95),
    p99ResponseTime: calculatePercentile(allDurations, 99)
  };
  
  // Save results
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const filename = `benchmark-${Date.now()}.json`;
  const filepath = path.join(resultsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(metrics, null, 2));
  
  console.log('\n\n📊 Overall Summary:');
  console.log(`  ✅ Success Rate: ${metrics.summary.overallSuccessRate.toFixed(2)}%`);
  console.log(`  📈 Total Requests: ${metrics.summary.totalRequests}`);
  console.log(`  ⏱️  Average Response: ${metrics.summary.averageResponseTime.toFixed(2)}ms`);
  console.log(`  📈 P95 Response: ${metrics.summary.p95ResponseTime.toFixed(2)}ms`);
  console.log(`  📈 P99 Response: ${metrics.summary.p99ResponseTime.toFixed(2)}ms`);
  console.log(`\n💾 Results saved to: ${filepath}`);
  
  return metrics;
}

// Export for use in other scripts
module.exports = { runBenchmark, benchmarkEndpoint, measureRequest };

// Run if called directly
if (require.main === module) {
  runBenchmark().catch(console.error);
}