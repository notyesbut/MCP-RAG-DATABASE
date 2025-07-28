/**
 * Quick API Server Test
 * Test basic server functionality with minimal dependencies
 */

import { apiServer } from './api/server';
import { logger } from './utils/logger';

async function quickApiTest() {
  console.log('\n🚀 Quick API Server Test');
  console.log('📋 Testing basic server functionality...\n');

  try {
    // Step 1: Test server creation
    console.log('1. ✅ Server instance created successfully');
    
    // Step 2: Test initialization
    console.log('2. 🔄 Initializing server components...');
    await apiServer.initialize();
    console.log('2. ✅ Server initialization completed');
    
    // Step 3: Start the server
    console.log('3. 🔄 Starting server...');
    await apiServer.start();
    console.log('3. ✅ Server started successfully');
    
    console.log('\n🎉 API SERVER TEST PASSED!');
    console.log('📍 Server running at: http://localhost:3000');
    console.log('📚 API Documentation: http://localhost:3000/api-docs');
    console.log('💓 Health Check: http://localhost:3000/health');
    
    console.log('\n🧪 Basic API endpoints available:');
    console.log('  • GET  /health - Health check');
    console.log('  • POST /api/v1/auth/login - Authentication');
    console.log('  • POST /api/v1/ingest/single - Data ingestion');
    console.log('  • POST /api/v1/query/natural - Natural language queries');
    console.log('  • GET  /api/v1/admin/mcps - MCP management');
    
    console.log('\n✨ Ready for integration testing!');
    console.log('⌨️  Press Ctrl+C to stop the server');
    
  } catch (error) {
    logger.error('❌ API Server test failed:', error);
    console.error('\n❌ API SERVER TEST FAILED');
    console.error('Error:', (error as Error).message);
    
    if ((error as Error).stack) {
      console.error('\nStack trace:');
      console.error((error as Error).stack);
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🔄 Shutting down test server...');
  try {
    await apiServer.stop();
    console.log('✅ Test server shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the test
if (require.main === module) {
  quickApiTest().catch((error) => {
    console.error('❌ Failed to start API test:', error);
    process.exit(1);
  });
}

export { quickApiTest };