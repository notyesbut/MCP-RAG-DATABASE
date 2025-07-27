/**
 * Global Test Setup - Runs once before all tests
 * Initializes test environment and shared resources
 */

const path = require('path');
const fs = require('fs').promises;

module.exports = async () => {
  console.log('🧪 Setting up Enterprise Multi-MCP Smart Database Test Environment...');
  
  // Create test directories
  const testDirs = [
    'tests/temp',
    'tests/fixtures/data',
    'tests/coverage',
    'tests/logs'
  ];
  
  for (const dir of testDirs) {
    await fs.mkdir(path.join(__dirname, '../..', dir), { recursive: true });
  }
  
  // Set global test configuration
  global.__TEST_CONFIG__ = {
    startTime: Date.now(),
    tempDir: path.join(__dirname, '../temp'),
    fixturesDir: path.join(__dirname, '../fixtures'),
    testDbPath: ':memory:',
    mcpTestPort: 9000 + Math.floor(Math.random() * 1000)
  };
  
  console.log('✅ Test environment setup complete');
};