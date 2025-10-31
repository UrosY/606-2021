/// <reference types="cypress" />

// Custom commands for authentication and common operations

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login via API
       * @example cy.loginViaAPI('user@example.com', 'password')
       */
      loginViaAPI(email: string, password: string): Chainable<void>;

      /**
       * Custom command to register user via API
       * @example cy.registerViaAPI('user@example.com', 'password', 'John Doe')
       */
      registerViaAPI(email: string, password: string, name: string): Chainable<void>;

      /**
       * Custom command to get auth token from localStorage
       * @example cy.getAuthToken()
       */
      getAuthToken(): Chainable<string>;

      /**
       * Custom command to set auth token in localStorage
       * @example cy.setAuthToken('token-value')
       */
      setAuthToken(token: string): Chainable<void>;

      /**
       * Custom command to create a form via API
       * @example cy.createForm(formData)
       */
      createForm(formData: any): Chainable<any>;
    }
  }
}

// Login via API and store the token
Cypress.Commands.add('loginViaAPI', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('AUTH_API_URL')}/login`,
    body: {
      email,
      password
    },
    failOnStatusCode: false
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body).to.have.property('token');

    // Store token in localStorage with the correct key 'auth_token'
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', response.body.token);

      // Also store user data if returned
      if (response.body.user) {
        win.localStorage.setItem('user', JSON.stringify(response.body.user));
      }
    });
  });
});

// Register via API
Cypress.Commands.add('registerViaAPI', (email: string, password: string, name: string) => {
  cy.request({
    method: 'POST',
    url: `${Cypress.env('AUTH_API_URL')}/register`,
    body: {
      email,
      password,
      name
    },
    failOnStatusCode: false
  }).then((response) => {
    // Accept both 200 (success) and 400 (user already exists)
    // This allows tests to be re-run without clearing the database
    expect(response.status).to.be.oneOf([200, 400]);

    if (response.status === 200) {
      expect(response.body).to.have.property('message');
    }
  });
});

// Get auth token from localStorage
Cypress.Commands.add('getAuthToken', () => {
  return cy.window().then((win) => {
    return win.localStorage.getItem('auth_token') || '';
  });
});

// Set auth token in localStorage
Cypress.Commands.add('setAuthToken', (token: string) => {
  cy.window().then((win) => {
    win.localStorage.setItem('auth_token', token);
  });
});

// Create form via API
Cypress.Commands.add('createForm', (formData: any) => {
  return cy.getAuthToken().then((token) => {
    // Convert to proper format for backend
    const formPayload = {
      title: formData.title,
      description: formData.description,
      allowGuests: formData.allowAnonymous || false,
      questions: formData.questions || []
    };

    return cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/create-form`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary'
      },
      body: `------WebKitFormBoundary\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(formPayload)}\r\n------WebKitFormBoundary--\r\n`
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('formId');
      return response.body;
    });
  });
});

export {};
