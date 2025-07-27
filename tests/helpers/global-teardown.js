/**
 * Global Test Teardown - Runs once after all tests
 * Cleans up test environment and generates reports
 */

const path = require('path');
const fs = require('fs').promises;

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Calculate total test time
  const totalTime = Date.now() - global.__TEST_CONFIG__.startTime;
  console.log(`⏱️  Total test execution time: ${totalTime}ms`);
  
  // Clean up temporary files
  try {
    const tempDir = global.__TEST_CONFIG__.tempDir;
    await fs.rmdir(tempDir, { recursive: true });
  } catch (error) {
    // Ignore cleanup errors
  }
  
  // Generate test summary
  console.log('📊 Test execution complete');
  console.log('✅ Test environment cleaned up');
};