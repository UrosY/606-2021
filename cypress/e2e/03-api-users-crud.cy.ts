/// <reference types="cypress" />

describe('[API] CRUD Operations on Users', () => {
  describe('CREATE - User Registration', () => {
    it('should successfully create a new user', () => {
      const newUser = {
        name: 'New Test User',
        email: `newuser${Date.now()}@example.com`,
        password: 'NewUser123!'
      };

      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/register`,
        body: newUser
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('message');
      });
    });

    it('should reject duplicate email registration', () => {
      const duplicateUser = {
        name: 'Duplicate User',
        email: `duplicate${Date.now()}@example.com`,
        password: 'Duplicate123!'
      };

      // First registration should succeed
      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/register`,
        body: duplicateUser
      }).then((response) => {
        expect(response.status).to.eq(200);

        // Second registration with same email should fail
        cy.request({
          method: 'POST',
          url: `${Cypress.env('AUTH_API_URL')}/register`,
          body: duplicateUser,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(400);
          expect(response.body).to.have.property('error');
        });
      });
    });

    it('should reject registration with invalid email', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/register`,
        body: {
          name: 'Invalid Email User',
          email: 'invalid-email',
          password: 'Password123!'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body).to.have.property('error');
      });
    });
  });

});
