/// <reference types="cypress" />

describe('[UI] User Login', () => {
  const testUser = {
    name: 'Login Test User',
    email: 'logintest@example.com',
    password: 'LoginTest123!'
  };

  before(() => {
    // Register a test user for login tests
    cy.registerViaAPI(testUser.email, testUser.password, testUser.name);
  });

  beforeEach(() => {
    cy.visit('/login');
  });

  it('should display login form with all required fields', () => {
    cy.get('input[name="email"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });

  it('should successfully login with valid credentials', () => {
    cy.get('input[name="email"]').type(testUser.email);
    cy.get('input[name="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();

    // Should redirect to dashboard
    cy.url().should('not.include', '/login');
    cy.url().should('match', /\/(dashboard|forms|home)/);

    // Check if token is stored in localStorage (key is 'auth_token')
    cy.window().its('localStorage').invoke('getItem', 'auth_token').should('exist');
  });

  it('should show error for invalid email', () => {
    cy.get('input[name="email"]').type('nonexistent@example.com');
    cy.get('input[name="password"]').type('WrongPassword123!');
    cy.get('button[type="submit"]').click();

    // Should show error message
    cy.contains(/invalid.*credentials|incorrect.*email|user.*not.*found/i).should('be.visible');
  });

  it('should show error for incorrect password', () => {
    cy.get('input[name="email"]').type(testUser.email);
    cy.get('input[name="password"]').type('WrongPassword123!');
    cy.get('button[type="submit"]').click();

    // Should show error message
    cy.contains(/invalid.*credentials|incorrect.*password|wrong.*password/i).should('be.visible');
  });

  it('should show validation error for empty fields', () => {
    cy.get('button[type="submit"]').click();

    // Form should not redirect (HTML5 validation prevents submission)
    cy.url().should('include', '/login');

    // Check that required fields have the required attribute
    cy.get('input[name="email"]').should('have.attr', 'required');
    cy.get('input[name="password"]').should('have.attr', 'required');
  });

  it('should have a link to registration page', () => {
    cy.contains(/create.*account|register|sign.*up/i).click();
    cy.url().should('include', '/register');
  });

  it('should persist login session after page reload', () => {
    cy.get('input[name="email"]').type(testUser.email);
    cy.get('input[name="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();

    // Wait for redirect
    cy.url().should('not.include', '/login');

    // Reload the page
    cy.reload();

    // Should still be logged in (not redirected to login)
    cy.url().should('not.include', '/login');
  });

  it('should allow logout after successful login', () => {
    cy.get('input[name="email"]').type(testUser.email);
    cy.get('input[name="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();

    // Wait for redirect
    cy.url().should('not.include', '/login');

    // Find and click logout button
    cy.contains(/logout|sign.*out/i).click();

    // Token should be removed from localStorage (key is 'auth_token')
    cy.window().its('localStorage').invoke('getItem', 'auth_token').should('not.exist');

    // Should redirect to login page
    cy.url().should('include', '/login');
  });
});
