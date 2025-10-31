# Cypress E2E Tests

This directory contains end-to-end (e2e) tests for the Forms Application using Cypress.

## Test Coverage

The tests are organized according to the integration test requirements from the project specification:

### UI Tests
1. **01-user-registration.cy.ts** - [UI] User registration
2. **02-user-login.cy.ts** - [UI] User login
3. **05-ui-search-forms.cy.ts** - [UI] Search forms by name

### API Tests
4. **03-api-users-crud.cy.ts** - [API] CRUD operations on users
5. **04-api-forms-crud.cy.ts** - [API] CRUD operations on forms
6. **06-api-form-filling.cy.ts** - [API] Form filling with all question types
7. **07-api-form-locking.cy.ts** - [API] Closing/locking forms
8. **08-api-collaborators.cy.ts** - [API] Adding collaborators to forms
9. **09-api-view-results.cy.ts** - [API] Viewing filled forms (individual and aggregated results)

## Prerequisites

Before running the tests, ensure:
1. All backend services are running (auth-service and forms-service)
2. Frontend development server is running
3. Database is properly set up and accessible

## Running Tests

### Open Cypress Test Runner (Interactive Mode)
```bash
cd frontend
npm run cypress:open
```

This will open the Cypress Test Runner GUI where you can:
- Select and run individual tests
- See tests execute in real-time
- Debug tests interactively

### Run Tests in Headless Mode
```bash
cd frontend
npm run cypress:run
```

This will:
- Run all tests in headless mode
- Generate videos of test runs
- Create screenshots of failures
- Display results in the terminal

### Run Specific Test File
```bash
cd frontend
npx cypress run --spec "cypress/e2e/01-user-registration.cy.ts"
```

## Configuration

### Environment Variables
The tests use the following environment variables (configured in `cypress.config.ts`):
- `AUTH_API_URL` - Authentication service URL (default: http://localhost:3001)
- `FORMS_API_URL` - Forms service URL (default: http://localhost:3002)
- `baseUrl` - Frontend application URL (default: http://localhost:5173)

### Timeouts
- Default command timeout: 10 seconds
- Request timeout: 10 seconds
- Response timeout: 10 seconds

## Test Structure

### Support Files
- `cypress/support/e2e.ts` - Main support file loaded before tests
- `cypress/support/commands.ts` - Custom Cypress commands

### Custom Commands
The following custom commands are available:
- `cy.loginViaAPI(email, password)` - Login via API and store token
- `cy.registerViaAPI(email, password, name)` - Register user via API
- `cy.getAuthToken()` - Get authentication token from localStorage
- `cy.setAuthToken(token)` - Set authentication token in localStorage
- `cy.createForm(formData)` - Create a form via API

## Test Data

Tests use dynamic test data with timestamps to avoid conflicts:
- User emails: `testuser{timestamp}@example.com`
- Form titles: Unique titles per test suite

## Generated Artifacts

### Videos
Test run videos are saved to `cypress/videos/` (gitignored)

### Screenshots
Failure screenshots are saved to `cypress/screenshots/` (gitignored)

### Downloads
Downloaded files are saved to `cypress/downloads/` (gitignored)

## Debugging

### Using cy.debug()
Add `cy.debug()` to pause test execution:
```typescript
cy.get('input').type('text')
cy.debug() // Pauses here
cy.get('button').click()
```

### Using cy.pause()
Add `cy.pause()` to manually step through commands:
```typescript
cy.pause() // Opens debugger
cy.get('input').type('text')
```

### Browser DevTools
When running in interactive mode, you can open browser DevTools to inspect:
- DOM elements
- Network requests
- Console logs
- Application state

## Common Issues

### Backend Services Not Running
If tests fail with connection errors, ensure:
```bash
# From project root
npm run dev
```

### Port Conflicts
If services are running on different ports, update `cypress.config.ts`:
```typescript
env: {
  AUTH_API_URL: 'http://localhost:YOUR_AUTH_PORT',
  FORMS_API_URL: 'http://localhost:YOUR_FORMS_PORT',
}
```

### Database State
Some tests may fail if the database has stale data. Consider:
- Resetting the database between test runs
- Using database migrations/seeds
- Implementing cleanup hooks in tests

## Best Practices

1. **Independent Tests** - Each test should be able to run independently
2. **Clean State** - Tests create their own test data
3. **Assertions** - Use meaningful assertions with clear error messages
4. **Waits** - Avoid hard-coded waits, use Cypress retry-ability
5. **Selectors** - Prefer data attributes over classes/IDs for stability

## Integration with CI/CD

To run tests in CI/CD pipelines:

```bash
# Run all tests in headless mode
npm run cypress:run

# Run with specific browser
npx cypress run --browser chrome

# Run with parallel execution
npx cypress run --record --parallel
```

## Manual Testing Requirements

According to the project specification, the following should be tested manually:
- [Manual] Form filling on UI
- [Manual] Generate XLSX report

These tests ensure proper user experience and file generation that may be difficult to automate.

## Resources

- [Cypress Documentation](https://docs.cypress.io/)
- [Cypress Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Cypress API Reference](https://docs.cypress.io/api/table-of-contents)
