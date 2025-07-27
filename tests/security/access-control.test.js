/**
 * Security and Access Control Tests
 * Tests authentication, authorization, input validation, and security measures
 */

const { Database } = require('../../src/core/database');
const { MCPServer } = require('../../src/mcp/server');
const { SecurityManager } = require('../../src/security/manager');
const { AuthenticationService } = require('../../src/security/authentication');
const crypto = require('crypto');

describe('Security and Access Control', () => {
  let db;
  let server;
  let securityManager;
  let authService;

  beforeAll(async () => {
    db = await global.testHelpers.createTestDatabase();
    securityManager = new SecurityManager({ database: db });
    authService = new AuthenticationService({ securityManager });
    
    server = await global.testHelpers.createTestMCPServer({
      security: securityManager,
      authentication: authService
    });
    
    await server.start();
  });

  afterAll(async () => {
    await db.close();
    await server.stop();
  });

  describe('Authentication Security', () => {
    test('should enforce secure password requirements', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc123',
        'qwerty',
        '1234567890',
        'password123'
      ];

      for (const weakPassword of weakPasswords) {
        await expect(authService.createUser({
          username: 'testuser',
          password: weakPassword,
          email: 'test@example.com'
        })).rejects.toThrow('Password does not meet security requirements');
      }
    });

    test('should accept strong passwords', async () => {
      const strongPasswords = [
        'MySecureP@ssw0rd123!',
        'Complex#Pass1234$',
        'Str0ng!P@ssw0rd#2024'
      ];

      for (let i = 0; i < strongPasswords.length; i++) {
        const result = await authService.createUser({
          username: `testuser${i}`,
          password: strongPasswords[i],
          email: `test${i}@example.com`
        });

        expect(result.success).toBe(true);
        expect(result.userId).toBeDefined();
      }
    });

    test('should hash passwords securely', async () => {
      const password = 'SecureTestP@ss123!';
      const user = await authService.createUser({
        username: 'hashtest',
        password,
        email: 'hashtest@example.com'
      });

      // Retrieve stored password hash
      const storedUser = await db.findById('users', user.userId);
      
      expect(storedUser.password).not.toBe(password);
      expect(storedUser.password).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt format
      expect(storedUser.salt).toBeDefined();
    });

    test('should implement secure session management', async () => {
      const user = await authService.createUser({
        username: 'sessiontest',
        password: 'SecureP@ss123!',
        email: 'sessiontest@example.com'
      });

      // Login and get session
      const loginResult = await authService.login('sessiontest', 'SecureP@ss123!');
      expect(loginResult.success).toBe(true);
      expect(loginResult.sessionToken).toBeDefined();
      expect(loginResult.sessionToken).toMatch(/^[a-f0-9]{64}$/); // 32-byte hex

      // Validate session
      const sessionValid = await authService.validateSession(loginResult.sessionToken);
      expect(sessionValid.valid).toBe(true);
      expect(sessionValid.userId).toBe(user.userId);

      // Logout should invalidate session
      await authService.logout(loginResult.sessionToken);
      const sessionInvalid = await authService.validateSession(loginResult.sessionToken);
      expect(sessionInvalid.valid).toBe(false);
    });

    test('should implement account lockout after failed attempts', async () => {
      const user = await authService.createUser({
        username: 'lockouttest',
        password: 'SecureP@ss123!',
        email: 'lockouttest@example.com'
      });

      // Attempt multiple failed logins
      for (let i = 0; i < 5; i++) {
        const result = await authService.login('lockouttest', 'wrongpassword');
        expect(result.success).toBe(false);
      }

      // Account should be locked
      const lockedResult = await authService.login('lockouttest', 'SecureP@ss123!');
      expect(lockedResult.success).toBe(false);
      expect(lockedResult.error).toContain('account locked');

      // Should be able to unlock after timeout or manual unlock
      await authService.unlockAccount(user.userId);
      const unlockedResult = await authService.login('lockouttest', 'SecureP@ss123!');
      expect(unlockedResult.success).toBe(true);
    });

    test('should implement two-factor authentication', async () => {
      const user = await authService.createUser({
        username: '2fatest',
        password: 'SecureP@ss123!',
        email: '2fatest@example.com'
      });

      // Enable 2FA
      const twoFASetup = await authService.enable2FA(user.userId);
      expect(twoFASetup.secret).toBeDefined();
      expect(twoFASetup.qrCode).toBeDefined();

      // Simulate TOTP token generation
      const mockTOTP = '123456';
      jest.spyOn(authService, 'generateTOTP').mockReturnValue(mockTOTP);

      // Login with 2FA
      const loginResult = await authService.login('2fatest', 'SecureP@ss123!');
      expect(loginResult.requires2FA).toBe(true);
      expect(loginResult.tempToken).toBeDefined();

      // Complete 2FA
      const complete2FA = await authService.complete2FA(loginResult.tempToken, mockTOTP);
      expect(complete2FA.success).toBe(true);
      expect(complete2FA.sessionToken).toBeDefined();
    });
  });

  describe('Authorization and Access Control', () => {
    let adminUser, regularUser, guestUser;

    beforeAll(async () => {
      // Create test users with different roles
      adminUser = await authService.createUser({
        username: 'admin',
        password: 'AdminP@ss123!',
        email: 'admin@example.com',
        role: 'admin'
      });

      regularUser = await authService.createUser({
        username: 'user',
        password: 'UserP@ss123!',
        email: 'user@example.com',
        role: 'user'
      });

      guestUser = await authService.createUser({
        username: 'guest',
        password: 'GuestP@ss123!',
        email: 'guest@example.com',
        role: 'guest'
      });
    });

    test('should enforce role-based access control', async () => {
      // Admin should have full access
      const adminSession = await authService.login('admin', 'AdminP@ss123!');
      const adminAccess = await securityManager.checkPermission(
        adminSession.sessionToken, 
        'database:admin'
      );
      expect(adminAccess.allowed).toBe(true);

      // Regular user should have limited access
      const userSession = await authService.login('user', 'UserP@ss123!');
      const userAccess = await securityManager.checkPermission(
        userSession.sessionToken, 
        'database:admin'
      );
      expect(userAccess.allowed).toBe(false);

      const userReadAccess = await securityManager.checkPermission(
        userSession.sessionToken, 
        'database:read'
      );
      expect(userReadAccess.allowed).toBe(true);

      // Guest should have minimal access
      const guestSession = await authService.login('guest', 'GuestP@ss123!');
      const guestWriteAccess = await securityManager.checkPermission(
        guestSession.sessionToken, 
        'database:write'
      );
      expect(guestWriteAccess.allowed).toBe(false);
    });

    test('should implement resource-level permissions', async () => {
      // Create protected collections
      await securityManager.setCollectionPermissions('sensitive_data', {
        read: ['admin'],
        write: ['admin'],
        delete: ['admin']
      });

      await securityManager.setCollectionPermissions('public_data', {
        read: ['admin', 'user', 'guest'],
        write: ['admin', 'user'],
        delete: ['admin']
      });

      const userSession = await authService.login('user', 'UserP@ss123!');
      
      // Should not access sensitive data
      const sensitiveAccess = await securityManager.checkCollectionAccess(
        userSession.sessionToken,
        'sensitive_data',
        'read'
      );
      expect(sensitiveAccess.allowed).toBe(false);

      // Should access public data
      const publicAccess = await securityManager.checkCollectionAccess(
        userSession.sessionToken,
        'public_data',
        'read'
      );
      expect(publicAccess.allowed).toBe(true);
    });

    test('should implement row-level security', async () => {
      // Insert test data with ownership
      const userSession = await authService.login('user', 'UserP@ss123!');
      
      await db.insert('user_data', {
        content: 'User private data',
        owner_id: regularUser.userId,
        private: true
      });

      await db.insert('user_data', {
        content: 'Other user data',
        owner_id: adminUser.userId,
        private: true
      });

      // User should only see their own data
      const userDataAccess = await securityManager.filterUserData(
        userSession.sessionToken,
        'user_data',
        {}
      );

      expect(userDataAccess.query.owner_id).toBe(regularUser.userId);
    });

    test('should implement field-level security', async () => {
      // Define field-level permissions
      await securityManager.setFieldPermissions('users', {
        'password': { read: [], write: ['admin'] },
        'email': { read: ['admin', 'self'], write: ['admin', 'self'] },
        'salary': { read: ['admin', 'hr'], write: ['admin', 'hr'] }
      });

      const userSession = await authService.login('user', 'UserP@ss123!');
      
      // Should filter sensitive fields
      const filteredFields = await securityManager.filterFields(
        userSession.sessionToken,
        'users',
        ['username', 'email', 'password', 'salary']
      );

      expect(filteredFields).toContain('username');
      expect(filteredFields).toContain('email'); // Self access
      expect(filteredFields).not.toContain('password');
      expect(filteredFields).not.toContain('salary');
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should prevent SQL injection attacks', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET role='admin' WHERE username='user'; --",
        "' UNION SELECT * FROM sensitive_data --"
      ];

      for (const maliciousInput of maliciousInputs) {
        const sanitized = securityManager.sanitizeInput(maliciousInput);
        expect(sanitized).not.toContain('DROP TABLE');
        expect(sanitized).not.toContain('UPDATE');
        expect(sanitized).not.toContain('UNION SELECT');
        expect(sanitized).not.toContain('--');
      }
    });

    test('should prevent NoSQL injection attacks', async () => {
      const maliciousQueries = [
        { $where: 'function() { while(1); }' },
        { $where: 'function() { return true; }' },
        { username: { $ne: null } },
        { $or: [{ password: { $regex: '.*' } }] }
      ];

      for (const maliciousQuery of maliciousQueries) {
        const sanitized = securityManager.sanitizeQuery(maliciousQuery);
        expect(sanitized).not.toHaveProperty('$where');
        expect(JSON.stringify(sanitized)).not.toContain('while(1)');
      }
    });

    test('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("XSS")',
        '<svg onload="alert(1)">',
        '"><script>alert("XSS")</script>'
      ];

      for (const xssPayload of xssPayloads) {
        const sanitized = securityManager.sanitizeHTML(xssPayload);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
      }
    });

    test('should validate and sanitize file uploads', async () => {
      const testFiles = [
        {
          name: 'document.pdf',
          type: 'application/pdf',
          size: 1024 * 1024, // 1MB
          content: Buffer.from('PDF content')
        },
        {
          name: 'malicious.exe',
          type: 'application/octet-stream',
          size: 1024,
          content: Buffer.from('Executable content')
        },
        {
          name: 'large.pdf',
          type: 'application/pdf',
          size: 100 * 1024 * 1024, // 100MB
          content: Buffer.from('Large PDF')
        }
      ];

      for (const file of testFiles) {
        const validation = await securityManager.validateFile(file);
        
        if (file.name.endsWith('.exe')) {
          expect(validation.allowed).toBe(false);
          expect(validation.reason).toContain('file type not allowed');
        } else if (file.size > 50 * 1024 * 1024) {
          expect(validation.allowed).toBe(false);
          expect(validation.reason).toContain('file too large');
        } else {
          expect(validation.allowed).toBe(true);
        }
      }
    });

    test('should implement rate limiting for API endpoints', async () => {
      const client = new (require('../../src/mcp/client'))({
        serverUrl: `http://localhost:${server.port}`
      });
      
      await client.connect();

      // Configure aggressive rate limiting for testing
      server.setRateLimit(5, 1000); // 5 requests per second

      const requests = [];
      const startTime = Date.now();

      // Send 10 rapid requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          client.request('tools/call', {
            name: 'database_query',
            arguments: { collection: 'test', query: {} }
          }).catch(error => ({ error: error.message }))
        );
      }

      const results = await Promise.all(requests);
      const errors = results.filter(r => r.error);
      
      // Some requests should be rate limited
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.error.includes('rate limit'))).toBe(true);

      await client.disconnect();
    });
  });

  describe('Data Protection and Privacy', () => {
    test('should encrypt sensitive data at rest', async () => {
      const sensitiveData = {
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
        personalInfo: 'Sensitive personal information'
      };

      // Insert with encryption
      const result = await db.insert('encrypted_data', sensitiveData, {
        encrypt: ['ssn', 'creditCard', 'personalInfo']
      });

      // Verify data is encrypted in storage
      const rawData = await db.findById('encrypted_data', result.id, { raw: true });
      expect(rawData.ssn).not.toBe(sensitiveData.ssn);
      expect(rawData.creditCard).not.toBe(sensitiveData.creditCard);
      expect(rawData.personalInfo).not.toBe(sensitiveData.personalInfo);

      // Verify data can be decrypted when retrieved normally
      const decryptedData = await db.findById('encrypted_data', result.id);
      expect(decryptedData.ssn).toBe(sensitiveData.ssn);
      expect(decryptedData.creditCard).toBe(sensitiveData.creditCard);
      expect(decryptedData.personalInfo).toBe(sensitiveData.personalInfo);
    });

    test('should implement data masking for non-privileged users', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-123-4567',
        ssn: '123-45-6789'
      };

      await db.insert('user_pii', userData);

      const guestSession = await authService.login('guest', 'GuestP@ss123!');
      
      // Guest should see masked data
      const maskedData = await securityManager.getMaskedData(
        guestSession.sessionToken,
        'user_pii',
        userData.id
      );

      expect(maskedData.name).toBe('J*** D**');
      expect(maskedData.email).toBe('j***.***@example.com');
      expect(maskedData.phone).toBe('+1-555-***-****');
      expect(maskedData.ssn).toBe('***-**-****');
    });

    test('should implement secure data deletion', async () => {
      const testData = {
        sensitive: 'This is sensitive information that must be securely deleted',
        timestamp: new Date()
      };

      const result = await db.insert('secure_deletion_test', testData);

      // Perform secure deletion
      const deletionResult = await securityManager.secureDelete(
        'secure_deletion_test',
        result.id
      );

      expect(deletionResult.success).toBe(true);
      expect(deletionResult.overwritePasses).toBeGreaterThan(0);

      // Verify data is completely removed
      const deletedData = await db.findById('secure_deletion_test', result.id);
      expect(deletedData).toBeNull();
    });

    test('should implement audit logging for sensitive operations', async () => {
      const adminSession = await authService.login('admin', 'AdminP@ss123!');

      // Perform sensitive operation
      await securityManager.performSensitiveOperation(
        adminSession.sessionToken,
        'delete_user',
        { userId: regularUser.userId }
      );

      // Check audit log
      const auditLogs = await securityManager.getAuditLogs({
        operation: 'delete_user',
        userId: adminUser.userId,
        startTime: new Date(Date.now() - 60000) // Last minute
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0]).toHaveProperty('timestamp');
      expect(auditLogs[0]).toHaveProperty('operation', 'delete_user');
      expect(auditLogs[0]).toHaveProperty('userId', adminUser.userId);
      expect(auditLogs[0]).toHaveProperty('details');
    });
  });

  describe('Security Monitoring and Incident Response', () => {
    test('should detect suspicious activity patterns', async () => {
      const suspiciousActivities = [
        // Multiple failed login attempts from same IP
        { type: 'failed_login', ip: '192.168.1.100', count: 10 },
        // Unusual data access patterns
        { type: 'mass_data_access', userId: regularUser.userId, recordsAccessed: 10000 },
        // Off-hours access
        { type: 'off_hours_access', userId: regularUser.userId, hour: 3 },
        // Privilege escalation attempts
        { type: 'privilege_escalation', userId: regularUser.userId, attemptedRole: 'admin' }
      ];

      for (const activity of suspiciousActivities) {
        const threat = await securityManager.analyzeThreat(activity);
        
        expect(threat.riskLevel).toBeGreaterThan(0);
        expect(threat.shouldAlert).toBe(true);
        
        if (threat.riskLevel >= 8) {
          expect(threat.immediateAction).toBeDefined();
        }
      }
    });

    test('should implement automatic incident response', async () => {
      // Simulate high-risk security incident
      const incident = {
        type: 'potential_breach',
        severity: 'high',
        indicators: [
          'multiple_failed_logins',
          'privilege_escalation_attempt',
          'unusual_data_access'
        ],
        affectedSystems: ['database', 'mcp_server']
      };

      const response = await securityManager.handleSecurityIncident(incident);

      expect(response.actions).toContain('lock_affected_accounts');
      expect(response.actions).toContain('increase_monitoring');
      expect(response.actions).toContain('notify_administrators');
      expect(response.alertsSent).toBeGreaterThan(0);
      expect(response.quarantineApplied).toBe(true);
    });

    test('should generate security reports', async () => {
      const report = await securityManager.generateSecurityReport({
        timeframe: '24h',
        includeMetrics: true,
        includeThreatAnalysis: true
      });

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('threats');
      expect(report).toHaveProperty('recommendations');
      
      expect(report.metrics).toHaveProperty('totalLogins');
      expect(report.metrics).toHaveProperty('failedLogins');
      expect(report.metrics).toHaveProperty('dataAccess');
      expect(report.metrics).toHaveProperty('securityEvents');
      
      expect(Array.isArray(report.threats)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Compliance and Regulatory Requirements', () => {
    test('should support GDPR compliance features', async () => {
      const userData = {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        consent: {
          marketing: true,
          analytics: false,
          necessary: true
        },
        dataProcessingPurpose: 'user_account'
      };

      await db.insert('gdpr_users', userData);

      // Right to access
      const userDataExport = await securityManager.exportUserData(userData.email);
      expect(userDataExport).toHaveProperty('personalData');
      expect(userDataExport).toHaveProperty('processingHistory');

      // Right to rectification
      const updateResult = await securityManager.updateUserData(
        userData.email,
        { name: 'Jane Smith' }
      );
      expect(updateResult.success).toBe(true);

      // Right to erasure (right to be forgotten)
      const erasureResult = await securityManager.eraseUserData(userData.email);
      expect(erasureResult.success).toBe(true);
      expect(erasureResult.anonymized).toBe(true);

      // Data should be anonymized, not deleted
      const anonymizedUser = await db.find('gdpr_users', { email: userData.email });
      expect(anonymizedUser.length).toBe(0);
      
      const anonymizedRecord = await db.find('gdpr_users', { 
        originalEmail: userData.email 
      });
      expect(anonymizedRecord.length).toBe(1);
      expect(anonymizedRecord[0].email).toMatch(/^anonymous_/);
    });

    test('should support HIPAA compliance features', async () => {
      const patientData = {
        patientId: 'P12345',
        name: 'John Patient',
        medicalRecord: 'Confidential medical information',
        treatment: 'Treatment details'
      };

      // Insert with HIPAA compliance
      await db.insert('patient_records', patientData, {
        hipaaCompliant: true,
        encryptionLevel: 'AES-256',
        accessLogging: true
      });

      // All access should be logged
      const accessLog = await securityManager.getHIPAAAccessLog({
        recordId: patientData.patientId,
        timeframe: '1h'
      });

      expect(accessLog.length).toBeGreaterThan(0);
      expect(accessLog[0]).toHaveProperty('accessor');
      expect(accessLog[0]).toHaveProperty('accessTime');
      expect(accessLog[0]).toHaveProperty('accessReason');
    });

    test('should implement data retention policies', async () => {
      const retentionPolicies = [
        { collection: 'logs', retentionDays: 90 },
        { collection: 'temp_data', retentionDays: 7 },
        { collection: 'archived_data', retentionDays: 2555 } // 7 years
      ];

      for (const policy of retentionPolicies) {
        await securityManager.setRetentionPolicy(policy.collection, policy.retentionDays);
      }

      // Insert old data
      const oldData = {
        content: 'Old data to be purged',
        created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // 100 days ago
      };

      await db.insert('logs', oldData);

      // Run retention policy enforcement
      const purgeResult = await securityManager.enforceRetentionPolicies();
      
      expect(purgeResult.collectionsProcessed).toContain('logs');
      expect(purgeResult.recordsPurged).toBeGreaterThan(0);
    });
  });
});