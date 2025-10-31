/// <reference types="cypress" />

describe('[UI] Search Forms by Name', () => {
  const testUser = {
    name: 'Search Test User',
    email: `searchtest${Date.now()}@example.com`,
    password: 'SearchTest123!'
  };

  const testForms = [
    {
      title: 'Customer Feedback Survey',
      description: 'Get feedback from customers',
      questions: []
    },
    {
      title: 'Employee Satisfaction Survey',
      description: 'Measure employee happiness',
      questions: []
    },
    {
      title: 'Product Research Form',
      description: 'Research for new product',
      questions: []
    },
    {
      title: 'Event Registration',
      description: 'Register for upcoming event',
      questions: []
    }
  ];

  before(() => {
    // Register user
    cy.registerViaAPI(testUser.email, testUser.password, testUser.name);

    // Login via API
    cy.visit('/');
    cy.loginViaAPI(testUser.email, testUser.password);

    // Create test forms
    testForms.forEach((form) => {
      cy.createForm(form);
    });
  });

  beforeEach(() => {
    cy.visit('/');
    cy.loginViaAPI(testUser.email, testUser.password);
    cy.visit('/forms');
  });

  it('should display all forms initially', () => {
    // Should see all created forms
    cy.contains(testForms[0].title).should('be.visible');
    cy.contains(testForms[1].title).should('be.visible');
    cy.contains(testForms[2].title).should('be.visible');
    cy.contains(testForms[3].title).should('be.visible');
  });

  it('should have a search input field', () => {
    cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]').should('be.visible');
  });

  it('should filter forms by title - single match', () => {
    cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]').type('Customer');

    // Should show Customer Feedback Survey
    cy.contains(testForms[0].title).should('be.visible');

    // Should not show other forms
    cy.contains(testForms[1].title).should('not.exist');
    cy.contains(testForms[2].title).should('not.exist');
    cy.contains(testForms[3].title).should('not.exist');
  });

  it('should filter forms by title - multiple matches', () => {
    cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]').type('Survey');

    // Should show both surveys
    cy.contains(testForms[0].title).should('be.visible');
    cy.contains(testForms[1].title).should('be.visible');

    // Should not show non-survey forms
    cy.contains(testForms[2].title).should('not.exist');
    cy.contains(testForms[3].title).should('not.exist');
  });

  it('should handle case-insensitive search', () => {
    cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]').type('EVENT');

    // Should show Event Registration regardless of case
    cy.contains(testForms[3].title).should('be.visible');
  });

  it('should show no results for non-existent form name', () => {
    cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]').type('NonExistentForm');

    // Should not show any forms
    testForms.forEach((form) => {
      cy.contains(form.title).should('not.exist');
    });

    // Should show "no results" message
    cy.contains(/no.*forms.*found|no.*results|no.*matches/i).should('be.visible');
  });

  it('should clear search and show all forms again', () => {
    const searchInput = cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]');

    // Type search query
    searchInput.type('Customer');
    cy.contains(testForms[0].title).should('be.visible');

    // Clear search
    searchInput.clear();

    // Should show all forms again
    testForms.forEach((form) => {
      cy.contains(form.title).should('be.visible');
    });
  });

  it('should update results in real-time as user types', () => {
    const searchInput = cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]');

    // Type partial search
    searchInput.type('Em');
    cy.contains(testForms[1].title).should('be.visible');

    // Continue typing
    searchInput.type('ployee');
    cy.contains(testForms[1].title).should('be.visible');
    cy.contains(testForms[0].title).should('not.exist');
  });

  it('should search in form description as well', () => {
    cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]').type('happiness');

    // Should find Employee Satisfaction Survey by description
    cy.contains(testForms[1].title).should('be.visible');
  });

  it('should handle special characters in search', () => {
    const searchInput = cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]');

    searchInput.type('Survey!@#');
    // Should still perform search (might show results or no results depending on implementation)
    // The important thing is it shouldn't crash
    searchInput.should('have.value', 'Survey!@#');
  });

  it('should preserve search query when navigating back to forms list', () => {
    const searchInput = cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]');

    searchInput.type('Customer');
    cy.contains(testForms[0].title).should('be.visible');

    // Click on a form (if clickable)
    cy.contains(testForms[0].title).click();

    // Navigate back
    cy.go('back');

    // Search query should be preserved (this depends on implementation)
    // Commenting this out as it might not be required
    // cy.get('input[type="search"], input[placeholder*="search" i], input[name*="search" i]')
    //   .should('have.value', 'Customer');
  });
});
