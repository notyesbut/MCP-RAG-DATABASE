/**
 * Global Test Teardown - Runs once after all tests
 * Cleans up test environment and generates reports
 */

const path = require('path');
const fs = require('fs').promises;

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Calculate total test time
    if (global.__TEST_CONFIG__) {
      const totalTime = Date.now() - global.__TEST_CONFIG__.startTime;
      console.log(`⏱️  Total test execution time: ${totalTime}ms`);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Close any remaining database connections
    if (global.testDbConnections) {
      for (const connection of global.testDbConnections) {
        try {
          await connection.close();
        } catch (error) {
          console.warn('Error closing test database connection:', error.message);
        }
      }
    }
    
    // Clean up any remaining file descriptors or handles
    if (global.testFileHandles) {
      for (const handle of global.testFileHandles) {
        try {
          await handle.close();
        } catch (error) {
          console.warn('Error closing test file handle:', error.message);
        }
      }
    }
    
    // Clean up temporary files
    try {
      if (global.__TEST_CONFIG__ && global.__TEST_CONFIG__.tempDir) {
        const tempDir = global.__TEST_CONFIG__.tempDir;
        await fs.rmdir(tempDir, { recursive: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Allow time for cleanup operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate test summary
    console.log('📊 Test execution complete');
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    console.error('❌ Global teardown error:', error);
  }
};