# Frontend Logic Tests

This directory contains minimal frontend logic tests focusing on critical authentication and routing components.

## 📁 Test Files

### **Core Logic Tests**
- `routerGuards.test.tsx` - Route protection and role-based access
- `AuthContext.test.tsx` - Authentication state management
- `api.interceptor.test.ts` - Axios request/response interceptors

### **Setup**
- `setup.ts` - Global test configuration and mocks

## 🚀 Running Tests

### **All Logic Tests**
```bash
npm run test:logic
```

### **All Tests**
```bash
npm test
```

### **Watch Mode**
```bash
npm run test:ui
```

### **Coverage Report**
```bash
npm run test:coverage
```

## 🧪 Test Coverage

### **Route Guards**
- ✅ `RequireAuth` - Authentication requirement
- ✅ `RequireRole` - Role-based access control
- ✅ `RequireAdmin` - Admin-only access
- ✅ Loading states and redirects

### **AuthContext**
- ✅ User authentication flow
- ✅ Token management (set/clear)
- ✅ Active role management
- ✅ Token refresh mechanism
- ✅ Logout functionality

### **API Interceptors**
- ✅ Request interceptor (token attachment)
- ✅ Response interceptor (401 handling)
- ✅ Token refresh flow
- ✅ Error handling and retry logic

## 🛠️ Test Configuration

### **Vitest Setup**
```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
  },
})
```

### **Global Mocks**
- `localStorage` - Mocked storage API
- `matchMedia` - Mocked media queries
- `ResizeObserver` - Mocked observer API
- `IntersectionObserver` - Mocked observer API

## 🎯 Test Strategy

### **Focus Areas**
1. **Authentication Logic** - Token handling, user state
2. **Authorization Logic** - Route guards, role checks
3. **API Communication** - Request/response interceptors

### **What's Not Tested**
- UI rendering (covered by existing tests)
- Component styling
- Visual layout
- User interactions beyond logic

### **Mocking Strategy**
- **API Calls** - Mocked with vi.fn()
- **LocalStorage** - Mocked implementation
- **React Router** - MemoryRouter for navigation
- **External Dependencies** - Minimal mocking

## 📊 Test Examples

### **Route Guard Test**
```typescript
it('redirects to login when user is not authenticated', () => {
  mockUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
    isAuthenticated: false,
  } as any)

  render(
    <MemoryRouter initialEntries={['/protected']}>
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>
    </MemoryRouter>
  )

  expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
})
```

### **AuthContext Test**
```typescript
it('logs in user successfully', async () => {
  vi.mocked(api.login).mockResolvedValue({
    success: true,
    data: { user: mockUser, tokens: { accessToken: 'token' } },
  })

  // Test login flow
  await act(async () => {
    loginBtn.click()
  })

  expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
})
```

### **API Interceptor Test**
```typescript
it('attaches auth token to requests', async () => {
  vi.mocked(localStorage.getItem).mockReturnValue('test-token')
  
  const config = { headers: {} }
  const result = requestInterceptor(config)
  
  expect(result.headers.Authorization).toBe('Bearer test-token')
})
```

## 🔧 Development Guidelines

### **Adding New Tests**
1. Focus on logic, not UI
2. Mock external dependencies
3. Use TypeScript for type safety
4. Test happy path and error cases
5. Keep tests isolated and deterministic

### **Test Naming**
- Use descriptive test names
- Group related tests in describe blocks
- Test one behavior per test
- Use "should" phrasing

### **Mock Management**
- Clear mocks before each test
- Use consistent mock data
- Mock at the module level when possible
- Avoid over-mocking

## 🐛 Troubleshooting

### **Common Issues**
1. **Import Errors**: Check mock paths and exports
2. **Async Tests**: Use `waitFor` and `act` properly
3. **Mock Persistence**: Clear mocks in beforeEach
4. **Type Errors**: Ensure proper TypeScript types

### **Debug Mode**
```bash
# Run with verbose output
npm run test:logic -- --reporter=verbose

# Run specific test file
npm test routerGuards.test.tsx

# Update snapshots
npm test -- --update
```

## 📈 Coverage Goals

### **Target Coverage**
- **Statements**: >80%
- **Branches**: >70%
- **Functions**: >80%
- **Lines**: >80%

### **Critical Path Coverage**
- Authentication flow: 100%
- Route protection: 100%
- Token management: 100%
- API interceptors: 100%

## 🚀 CI/CD Integration

### **GitHub Actions Example**
```yaml
- name: Run Frontend Tests
  run: |
    cd frontend
    npm ci
    npm run test:logic
    npm run test:coverage
```

### **Docker Integration**
```dockerfile
# In frontend Dockerfile
RUN npm ci && npm run test:logic
```

## 📞 Best Practices

### **Test Organization**
- Group tests by feature
- Use consistent file naming
- Keep test files focused
- Document complex scenarios

### **Mock Strategy**
- Mock external services
- Use realistic test data
- Avoid mocking implementation details
- Keep mocks simple and predictable

### **Error Handling**
- Test error scenarios
- Verify error boundaries
- Test network failures
- Validate error messages

## 🎉 Benefits

### **Why These Tests Matter**
- **Reliability**: Catch regressions in critical logic
- **Documentation**: Tests serve as living documentation
- **Refactoring**: Safe code improvements
- **Onboarding**: New developers understand behavior

### **Maintenance**
- **Low Overhead**: Focused on logic, not UI
- **Fast Execution**: No browser automation needed
- **Easy Debugging**: Clear error messages
- **Stable**: Minimal external dependencies
