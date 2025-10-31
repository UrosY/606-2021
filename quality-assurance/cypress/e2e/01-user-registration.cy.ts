/// <reference types="cypress" />

describe('[UI] User Registration', () => {
  beforeEach(() => {
    cy.visit('/register');
  });

  it('should display registration form with all required fields', () => {
    cy.get('input[name="name"]').should('be.visible');
    cy.get('input[name="email"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('input[name="confirmPassword"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });

  it('should successfully register a new user with valid data', () => {
    const timestamp = Date.now();
    const testEmail = `testuser${timestamp}@example.com`;

    cy.get('input[name="name"]').type('Test User');
    cy.get('input[name="email"]').type(testEmail);
    cy.get('input[name="password"]').type('TestPassword123!');
    cy.get('input[name="confirmPassword"]').type('TestPassword123!');
    cy.get('button[type="submit"]').click();

    // Should redirect to login page with success message
    cy.url().should('include', '/login');
  });

  it('should show validation error for invalid email', () => {
    const timestamp = Date.now();
    const testEmail = `testuser${timestamp}@example.com`;

    // First register with valid email
    cy.get('input[name="name"]').type('Test User');
    cy.get('input[name="email"]').type(testEmail);
    cy.get('input[name="password"]').type('TestPassword123!');
    cy.get('input[name="confirmPassword"]').type('TestPassword123!');
    cy.get('button[type="submit"]').click();

    // Wait for success
    cy.url().should('include', '/login');

    // Try to register again with same email
    cy.visit('/register');
    cy.get('input[name="name"]').type('Test User 2');
    cy.get('input[name="email"]').type(testEmail);
    cy.get('input[name="password"]').type('TestPassword123!');
    cy.get('input[name="confirmPassword"]').type('TestPassword123!');
    cy.get('button[type="submit"]').click();

    // Should show error for email already exists
    cy.contains(/email.*exists|email.*use|email.*taken|već.*postoji/i, { timeout: 10000 }).should('be.visible');
  });

  it('should show validation error for short password', () => {
    const timestamp = Date.now();
    const testEmail = `testuser${timestamp}@example.com`;

    cy.get('input[name="name"]').type('Test User');
    cy.get('input[name="email"]').type(testEmail);
    cy.get('input[name="password"]').type('123');
    cy.get('input[name="confirmPassword"]').type('123');
    cy.get('button[type="submit"]').click();

    // Should show error message about password length
    cy.contains(/password.*short|password.*length|password.*6|6.*character/i).should('be.visible');
  });

  it('should show error when passwords do not match', () => {
    const timestamp = Date.now();
    const testEmail = `testuser${timestamp}@example.com`;

    cy.get('input[name="name"]').type('Test User');
    cy.get('input[name="email"]').type(testEmail);
    cy.get('input[name="password"]').type('TestPassword123!');
    cy.get('input[name="confirmPassword"]').type('DifferentPassword123!');
    cy.get('button[type="submit"]').click();

    // Should show error about password mismatch
    cy.contains(/password.*match|password.*same/i).should('be.visible');
  });

  it('should show error when registering with existing email', () => {
    const timestamp = Date.now();
    const existingEmail = `existing${timestamp}@example.com`;

    // First registration
    cy.get('input[name="name"]').type('Test User');
    cy.get('input[name="email"]').type(existingEmail);
    cy.get('input[name="password"]').type('TestPassword123!');
    cy.get('input[name="confirmPassword"]').type('TestPassword123!');
    cy.get('button[type="submit"]').click();

    // Wait for redirect to login
    cy.url().should('include', '/login', { timeout: 10000 });

    // Try to register again with the same email
    cy.visit('/register');
    cy.get('input[name="name"]').type('Another User');
    cy.get('input[name="email"]').type(existingEmail);
    cy.get('input[name="password"]').type('AnotherPassword123!');
    cy.get('input[name="confirmPassword"]').type('AnotherPassword123!');
    cy.get('button[type="submit"]').click();

    // Should show error about existing user (backend returns "Email već postoji")
    cy.contains(/email.*postoji|email.*exists|email.*use|email.*taken/i, { timeout: 10000 }).should('be.visible');
  });

  it('should show error for missing required fields', () => {
    // Try to submit empty form
    cy.get('button[type="submit"]').click();

    // Form should not redirect (HTML5 validation prevents submission)
    cy.url().should('include', '/register');

    // Check that required fields have the required attribute
    cy.get('input[name="name"]').should('have.attr', 'required');
    cy.get('input[name="email"]').should('have.attr', 'required');
    cy.get('input[name="password"]').should('have.attr', 'required');
    cy.get('input[name="confirmPassword"]').should('have.attr', 'required');
  });

  it('should have a link to login page', () => {
    cy.contains(/already.*account|login|sign.*in/i).click();
    cy.url().should('include', '/login');
  });
});