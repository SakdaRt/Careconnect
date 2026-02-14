# Backend Integration Tests

This directory contains comprehensive integration tests for the Careconnect backend API, focusing on Tier-0 critical paths.

## 📁 Test Structure

```
tests/
├── setup.js                 # Test database setup and utilities
├── integration/
│   ├── auth.test.js         # Authentication flow tests
│   ├── jobs.test.js         # Job lifecycle tests
│   ├── wallet.test.js       # Wallet and transaction tests
│   └── disputes.test.js     # Dispute management tests
├── mocks/
│   └── providers.js         # Mock external service endpoints
└── README.md               # This file
```

## 🚀 Running Tests

### Local Development

```bash
# Run all tests with coverage
npm test

# Run only integration tests
npm run test:integration

# Run smoke tests (Tier-0 critical paths only)
npm run test:smoke

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/integration/auth.test.js
```

### Docker Environment

```bash
# Run tests in Docker container
docker-compose -f docker-compose.test.yml up --build

# Run tests and remove containers
docker-compose -f docker-compose.test.yml up --build --rm

# Run tests in background
docker-compose -f docker-compose.test.yml up -d --build
docker-compose -f docker-compose.test.yml logs -f backend-test
docker-compose -f docker-compose.test.yml down
```

## 🧪 Test Categories

### Tier-0 Critical Paths

These are the essential user flows that must work for the application to function:

1. **Authentication Flow**
   - User registration → Login → Token refresh → Protected route access
   - Token validation and error handling
   - Rate limiting on auth endpoints

2. **Job Lifecycle**
   - Create job (hirer) → List jobs → Assign caregiver → Status transitions
   - Job posting, assignment, completion flow
   - Authorization by user role

3. **Wallet Operations**
   - Wallet creation → Ledger transactions → Withdrawal requests
   - Balance management and transaction history
   - Hold/release mechanisms

4. **Dispute Management**
   - Create dispute → Admin review → Resolution
   - Multi-party dispute handling
   - Admin resolution workflows

### Test Coverage Areas

- ✅ **Happy Path**: Normal user flows
- ✅ **Error Cases**: Invalid inputs, authorization failures
- ✅ **Edge Cases**: Boundary conditions, malformed data
- ✅ **Security**: Authentication, authorization, rate limiting
- ✅ **Data Validation**: Input sanitization, type checking

## 🛠️ Test Utilities

### Database Setup

The test suite uses a separate test database (`careconnect_test`) that is:

- Created automatically before tests run
- Cleaned between each test
- Populated with minimal test data
- Dropped after test completion

### Test Helpers

```javascript
import {
  createTestUser,           // Create test user with hashed password
  createTestWallet,         // Create wallet with test balance
  createTestPatientProfile, // Create patient profile
  createTestJob,           // Create test job
  generateTestToken,       // Generate JWT token for user
  generateRefreshToken     // Generate refresh token
} from '../setup.js';
```

### Mock Services

External services are mocked to ensure deterministic tests:

- **Twilio**: SMS sending
- **Payment Provider**: Charges and refunds
- **Email Service**: Transactional emails
- **KYC Provider**: Identity verification
- **File Upload**: Document storage
- **Geocoding**: Address validation

## 📊 Test Data

### Test Users

- **Hirer**: `hirer-{test}@example.com`
- **Caregiver**: `caregiver-{test}@example.com`
- **Admin**: `admin-{test}@example.com`

### Default Values

- **Test Password**: `TestPassword123!`
- **Initial Wallet Balance**: `1000.00`
- **Test Job Rate**: `25.00/hour`
- **Test Location**: `123 Test St, City, State`

## 🔧 Configuration

### Environment Variables

Tests use these environment variables (with fallbacks):

```bash
DATABASE_NAME=careconnect_test
DATABASE_USER=careconnect
DATABASE_PASSWORD=careconnect_test_password
JWT_SECRET=test-jwt-secret-for-testing
JWT_REFRESH_SECRET=test-refresh-secret-for-testing
NODE_ENV=test
```

### Jest Configuration

```javascript
{
  testEnvironment: 'node',
  testTimeout: 30000,           // 30s for integration tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js']
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Ensure PostgreSQL is running
   docker-compose up postgres-test
   
   # Check database exists
   psql -h localhost -p 5433 -U careconnect -d careconnect_test -c "\\l"
   ```

2. **Port Conflicts**
   ```bash
   # Kill processes using test ports
   lsof -ti:3001 | xargs kill -9
   lsof -ti:5433 | xargs kill -9
   ```

3. **Test Timeouts**
   ```bash
   # Increase timeout in jest.config.cjs
   testTimeout: 60000  # 60 seconds
   ```

4. **Mock Provider Issues**
   ```bash
   # Check mock providers are running
   curl http://localhost:3001/health
   ```

### Debug Mode

Run tests with additional debugging:

```bash
# Verbose output
npm run test:integration -- --verbose

# Debug specific test
npm test -- --testNamePattern="should create a new job" --verbose

# Run with Node inspector
node --inspect-brk node_modules/.bin/jest tests/integration/auth.test.js
```

## 📈 Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV Data**: `coverage/lcov.info`
- **Text Summary**: Console output

### Coverage Targets

- **Statements**: >80%
- **Branches**: >70%
- **Functions**: >80%
- **Lines**: >80%

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Backend Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## 🎯 Best Practices

### Writing Tests

1. **Use descriptive test names**
   ```javascript
   it('should create job and assign caregiver successfully')
   ```

2. **Test one thing per test**
   ```javascript
   // Good: Single assertion focus
   expect(response.body.job.status).toBe('posted');
   
   // Bad: Multiple unrelated assertions
   expect(response.body.job.title).toBe('Test');
   expect(response.body.user.email).toBe('test@example.com');
   ```

3. **Use test helpers for setup**
   ```javascript
   const user = await createTestUser({ role: 'hirer' });
   const token = await generateTestToken(user.id);
   ```

4. **Clean up between tests**
   - Database is automatically cleaned in `beforeEach`
   - Mock providers reset between tests
   - No shared state between tests

### Test Data Management

1. **Use random data to avoid conflicts**
   ```javascript
   email: `test-${Date.now()}@example.com`
   ```

2. **Create minimal required data**
   ```javascript
   // Only create what's needed for the test
   const job = await createTestJob(hirer.id, patient.id);
   ```

3. **Use consistent patterns**
   ```javascript
   // Standard user creation pattern
   const user = await createTestUser({ role: 'caregiver' });
   const token = await generateTestToken(user.id);
   ```

## 🚨 Important Notes

- Tests use a separate database to avoid affecting development data
- All external services are mocked for deterministic results
- Tests are designed to be run in parallel (no shared state)
- Database transactions are rolled back after each test
- Mock providers automatically start/stop with test suite

## 📞 Support

For test-related issues:

1. Check the troubleshooting section above
2. Review test logs for specific error messages
3. Ensure all dependencies are installed (`npm ci`)
4. Verify database is running and accessible
5. Check that mock providers are functioning correctly
