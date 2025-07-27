#!/usr/bin/env node

/**
 * Test Runner Script
 * Comprehensive test execution with reporting and CI/CD integration
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class TestRunner {
  constructor(options = {}) {
    this.options = {
      parallel: options.parallel !== false,
      coverage: options.coverage !== false,
      watch: options.watch || false,
      verbose: options.verbose || false,
      testPattern: options.testPattern || '**/*.test.js',
      outputDir: options.outputDir || './tests/coverage',
      maxWorkers: options.maxWorkers || Math.min(os.cpus().length, 4),
      timeout: options.timeout || 300000, // 5 minutes
      ...options
    };
    
    this.stats = {
      startTime: Date.now(),
      suites: {},
      overall: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };
  }

  async run() {
    console.log('🧪 Starting Enterprise Multi-MCP Smart Database Test Suite');
    console.log('=' .repeat(70));
    
    try {
      await this.setupTestEnvironment();
      await this.runTestSuites();
      await this.generateReports();
      await this.cleanup();
      
      this.printSummary();
      process.exit(this.stats.overall.failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    }
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    // Create output directories
    await fs.mkdir(this.options.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.options.outputDir, 'reports'), { recursive: true });
    
    // Set environment variables
    process.env.NODE_ENV = 'test';
    process.env.JEST_QUIET = this.options.verbose ? 'false' : 'true';
    
    console.log('✅ Test environment ready');
  }

  async runTestSuites() {
    const testSuites = [
      {
        name: 'Unit Tests',
        pattern: 'tests/unit/**/*.test.js',
        priority: 1,
        parallel: true
      },
      {
        name: 'Integration Tests',
        pattern: 'tests/integration/**/*.test.js',
        priority: 2,
        parallel: true
      },
      {
        name: 'Security Tests',
        pattern: 'tests/security/**/*.test.js',
        priority: 3,
        parallel: false // Security tests may need sequential execution
      },
      {
        name: 'Performance Tests',
        pattern: 'tests/performance/**/*.test.js',
        priority: 4,
        parallel: false // Performance tests need isolation
      },
      {
        name: 'Benchmark Tests',
        pattern: 'tests/benchmarks/**/*.test.js',
        priority: 5,
        parallel: false
      },
      {
        name: 'E2E Tests',
        pattern: 'tests/e2e/**/*.test.js',
        priority: 6,
        parallel: false // E2E tests need full system
      }
    ];

    if (this.options.parallel) {
      await this.runSuitesInParallel(testSuites);
    } else {
      await this.runSuitesSequentially(testSuites);
    }
  }

  async runSuitesInParallel(testSuites) {
    console.log('🏃‍♂️ Running test suites in parallel...');
    
    // Group suites by priority and run each priority group sequentially
    const priorityGroups = testSuites.reduce((groups, suite) => {
      if (!groups[suite.priority]) groups[suite.priority] = [];
      groups[suite.priority].push(suite);
      return groups;
    }, {});

    for (const priority of Object.keys(priorityGroups).sort()) {
      const suites = priorityGroups[priority];
      
      if (suites.length === 1 || !suites[0].parallel) {
        // Run sequentially if only one suite or if parallel is disabled
        for (const suite of suites) {
          await this.runSuite(suite);
        }
      } else {
        // Run in parallel
        const suitePromises = suites.map(suite => this.runSuite(suite));
        await Promise.all(suitePromises);
      }
    }
  }

  async runSuitesSequentially(testSuites) {
    console.log('🚶‍♂️ Running test suites sequentially...');
    
    for (const suite of testSuites) {
      await this.runSuite(suite);
    }
  }

  async runSuite(suite) {
    console.log(`\n🔬 Running ${suite.name}...`);
    const startTime = Date.now();

    try {
      const result = await this.executeJest(suite);
      const endTime = Date.now();
      
      this.stats.suites[suite.name] = {
        ...result,
        duration: endTime - startTime,
        status: 'completed'
      };

      console.log(`✅ ${suite.name} completed in ${endTime - startTime}ms`);
      console.log(`   📊 ${result.passed}/${result.total} tests passed`);

    } catch (error) {
      const endTime = Date.now();
      
      this.stats.suites[suite.name] = {
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: endTime - startTime,
        status: 'failed',
        error: error.message
      };

      console.log(`❌ ${suite.name} failed: ${error.message}`);
    }
  }

  async executeJest(suite) {
    return new Promise((resolve, reject) => {
      const args = [
        '--testPathPattern', suite.pattern,
        '--testTimeout', this.options.timeout.toString(),
        '--maxWorkers', this.options.maxWorkers.toString(),
        '--json',
        '--outputFile', path.join(this.options.outputDir, `${suite.name.replace(/\s+/g, '_').toLowerCase()}_results.json`)
      ];

      if (this.options.coverage) {
        args.push('--coverage');
        args.push('--coverageDirectory', path.join(this.options.outputDir, 'coverage'));
      }

      if (this.options.verbose) {
        args.push('--verbose');
      }

      if (this.options.watch) {
        args.push('--watch');
      }

      const jestProcess = spawn('npx', ['jest', ...args], {
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      if (!this.options.verbose) {
        jest.stdout.on('data', (data) => {
          output += data.toString();
        });

        jest.stderr.on('data', (data) => {
          output += data.toString();
        });
      }

      jest.on('close', (code) => {
        if (code === 0) {
          // Parse Jest JSON output
          try {
            const resultsFile = path.join(this.options.outputDir, `${suite.name.replace(/\s+/g, '_').toLowerCase()}_results.json`);
            const results = require(resultsFile);
            
            const stats = {
              total: results.numTotalTests,
              passed: results.numPassedTests,
              failed: results.numFailedTests,
              skipped: results.numPendingTests + results.numTodoTests
            };

            // Update overall stats
            this.stats.overall.total += stats.total;
            this.stats.overall.passed += stats.passed;
            this.stats.overall.failed += stats.failed;
            this.stats.overall.skipped += stats.skipped;

            resolve(stats);
          } catch (parseError) {
            reject(new Error(`Failed to parse test results: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Jest exited with code ${code}\n${output}`));
        }
      });

      jest.on('error', (error) => {
        reject(new Error(`Failed to start Jest: ${error.message}`));
      });
    });
  }

  async generateReports() {
    console.log('\n📊 Generating test reports...');

    await Promise.all([
      this.generateHTMLReport(),
      this.generateJUnitReport(),
      this.generateCoverageReport(),
      this.generatePerformanceReport()
    ]);

    console.log('✅ Reports generated successfully');
  }

  async generateHTMLReport() {
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
    <title>Enterprise Multi-MCP Smart Database - Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { background: #d4edda; border-color: #c3e6cb; }
        .failed { background: #f8d7da; border-color: #f5c6cb; }
        .stats { display: flex; gap: 20px; margin: 10px 0; }
        .stat { padding: 10px; background: #e9ecef; border-radius: 3px; }
        .progress { width: 100%; background: #e9ecef; border-radius: 3px; overflow: hidden; }
        .progress-bar { height: 20px; background: #28a745; text-align: center; line-height: 20px; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Enterprise Multi-MCP Smart Database Test Results</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        <p>Duration: ${Date.now() - this.stats.startTime}ms</p>
    </div>

    <div class="stats">
        <div class="stat">
            <strong>Total Tests:</strong> ${this.stats.overall.total}
        </div>
        <div class="stat">
            <strong>Passed:</strong> ${this.stats.overall.passed}
        </div>
        <div class="stat">
            <strong>Failed:</strong> ${this.stats.overall.failed}
        </div>
        <div class="stat">
            <strong>Skipped:</strong> ${this.stats.overall.skipped}
        </div>
        <div class="stat">
            <strong>Success Rate:</strong> ${Math.round((this.stats.overall.passed / this.stats.overall.total) * 100)}%
        </div>
    </div>

    <div class="progress">
        <div class="progress-bar" style="width: ${(this.stats.overall.passed / this.stats.overall.total) * 100}%">
            ${Math.round((this.stats.overall.passed / this.stats.overall.total) * 100)}%
        </div>
    </div>

    <h2>Test Suites</h2>
    ${Object.entries(this.stats.suites).map(([name, stats]) => `
        <div class="suite ${stats.failed > 0 ? 'failed' : 'passed'}">
            <h3>${name}</h3>
            <p>Status: ${stats.status}</p>
            <p>Duration: ${stats.duration}ms</p>
            <p>Tests: ${stats.passed}/${stats.total} passed</p>
            ${stats.error ? `<p>Error: ${stats.error}</p>` : ''}
        </div>
    `).join('')}
</body>
</html>
    `;

    await fs.writeFile(path.join(this.options.outputDir, 'reports', 'test-results.html'), htmlReport);
  }

  async generateJUnitReport() {
    const junitXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite 
    name="Enterprise Multi-MCP Smart Database"
    tests="${this.stats.overall.total}"
    failures="${this.stats.overall.failed}"
    skipped="${this.stats.overall.skipped}"
    time="${(Date.now() - this.stats.startTime) / 1000}">
    ${Object.entries(this.stats.suites).map(([name, stats]) => `
        <testcase 
            classname="${name.replace(/\s+/g, '.')}"
            name="${name}"
            time="${stats.duration / 1000}">
            ${stats.failed > 0 ? `<failure message="${stats.error || 'Test suite failed'}" />` : ''}
        </testcase>
    `).join('')}
</testsuite>`;

    await fs.writeFile(path.join(this.options.outputDir, 'reports', 'junit.xml'), junitXml);
  }

  async generateCoverageReport() {
    if (!this.options.coverage) return;

    // Coverage report is generated by Jest, just create a summary
    const coverageSummary = {
      timestamp: new Date().toISOString(),
      overall: this.stats.overall,
      suites: this.stats.suites,
      coverageEnabled: true
    };

    await fs.writeFile(
      path.join(this.options.outputDir, 'reports', 'coverage-summary.json'),
      JSON.stringify(coverageSummary, null, 2)
    );
  }

  async generatePerformanceReport() {
    const performanceData = {
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.stats.startTime,
      suites: Object.entries(this.stats.suites).map(([name, stats]) => ({
        name,
        duration: stats.duration,
        testsPerSecond: stats.total / (stats.duration / 1000),
        status: stats.status
      })),
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
        node: process.version
      }
    };

    await fs.writeFile(
      path.join(this.options.outputDir, 'reports', 'performance.json'),
      JSON.stringify(performanceData, null, 2)
    );
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test environment...');
    
    // Clean up temporary test files
    try {
      const tempFiles = [
        'tests/temp',
        '.test-cache'
      ];

      for (const file of tempFiles) {
        try {
          await fs.rmdir(file, { recursive: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.warn('Warning: Some cleanup operations failed');
    }

    console.log('✅ Cleanup completed');
  }

  printSummary() {
    const duration = Date.now() - this.stats.startTime;
    const successRate = Math.round((this.stats.overall.passed / this.stats.overall.total) * 100);

    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(70));
    console.log(`⏱️  Total Duration: ${duration}ms`);
    console.log(`📈 Total Tests: ${this.stats.overall.total}`);
    console.log(`✅ Passed: ${this.stats.overall.passed}`);
    console.log(`❌ Failed: ${this.stats.overall.failed}`);
    console.log(`⏭️  Skipped: ${this.stats.overall.skipped}`);
    console.log(`🎯 Success Rate: ${successRate}%`);
    console.log('');

    // Suite breakdown
    console.log('📋 SUITE BREAKDOWN:');
    Object.entries(this.stats.suites).forEach(([name, stats]) => {
      const status = stats.failed > 0 ? '❌' : '✅';
      const rate = Math.round((stats.passed / stats.total) * 100);
      console.log(`   ${status} ${name}: ${stats.passed}/${stats.total} (${rate}%) - ${stats.duration}ms`);
    });

    console.log('');
    if (this.stats.overall.failed === 0) {
      console.log('🎉 ALL TESTS PASSED! System is ready for deployment.');
    } else {
      console.log('⚠️  SOME TESTS FAILED. Review the results before deployment.');
    }
    
    console.log('📁 Reports available in:', this.options.outputDir);
    console.log('='.repeat(70));
  }
}

// CLI Support
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--no-parallel':
        options.parallel = false;
        break;
      case '--no-coverage':
        options.coverage = false;
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--pattern':
        options.testPattern = args[++i];
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--workers':
        options.maxWorkers = parseInt(args[++i]);
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]);
        break;
      case '--help':
        console.log(`
Enterprise Multi-MCP Smart Database Test Runner

Usage: node run-tests.js [options]

Options:
  --no-parallel     Run test suites sequentially
  --no-coverage     Disable code coverage
  --watch           Watch for file changes
  --verbose         Show verbose output
  --pattern <glob>  Test file pattern (default: **/*.test.js)
  --output <dir>    Output directory (default: ./tests/coverage)
  --workers <num>   Number of worker processes
  --timeout <ms>    Test timeout in milliseconds
  --help            Show this help message

Examples:
  node run-tests.js                           # Run all tests
  node run-tests.js --verbose                 # Run with verbose output
  node run-tests.js --pattern "unit/**"       # Run only unit tests
  node run-tests.js --no-parallel --no-coverage # Sequential run without coverage
        `);
        process.exit(0);
        break;
    }
  }

  const runner = new TestRunner(options);
  runner.run();
}

module.exports = TestRunner;