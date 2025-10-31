/// <reference types="cypress" />

describe('[API] CRUD Operations on Forms', () => {
  let authToken: string;
  let formId: string;

  const testUser = {
    name: 'Forms Test User',
    email: `formstest${Date.now()}@example.com`,
    password: 'FormsTest123!'
  };

  before(() => {
    // Register and login to get auth token
    cy.request({
      method: 'POST',
      url: `${Cypress.env('AUTH_API_URL')}/register`,
      body: testUser
    }).then((response) => {
      expect(response.status).to.eq(200);

      // Login to get token
      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/login`,
        body: {
          email: testUser.email,
          password: testUser.password
        }
      }).then((loginResponse) => {
        authToken = loginResponse.body.token;
      });
    });
  });

  describe('CREATE - Create Form', () => {
    it('should create a new form with basic information', () => {
      const newForm = {
        title: 'Test Survey Form',
        description: 'This is a test survey form',
        allowGuests: false,
        questions: [
          {
            text: 'What is your name?',
            type: 'short_text',
            required: true
          },
          {
            text: 'Tell us about yourself',
            type: 'long_text',
            required: false
          }
        ]
      };

      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/create-form`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary'
        },
        body: `------WebKitFormBoundary\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(newForm)}\r\n------WebKitFormBoundary--\r\n`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('formId');
        expect(response.body.success).to.be.true;

        formId = response.body.formId;
      });
    });

    it('should create a form with all question types', () => {
      const comprehensiveForm = {
        title: 'Comprehensive Form',
        description: 'Form with all question types',
        allowGuests: true,
        questions: [
          {
            text: 'Short text question',
            type: 'short_text',
            required: true
          },
          {
            text: 'Long text question',
            type: 'long_text',
            required: false
          },
          {
            text: 'Single choice question',
            type: 'single_choice',
            required: true,
            options: ['Option 1', 'Option 2', 'Option 3']
          },
          {
            text: 'Multiple choice question',
            type: 'multiple_choice',
            required: false,
            options: ['Choice A', 'Choice B', 'Choice C', 'Choice D']
          },
          {
            text: 'Number question',
            type: 'numeric',
            required: true
          },
          {
            text: 'Date question',
            type: 'date',
            required: true
          },
          {
            text: 'Time question',
            type: 'time',
            required: false
          }
        ]
      };

      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/create-form`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary'
        },
        body: `------WebKitFormBoundary\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(comprehensiveForm)}\r\n------WebKitFormBoundary--\r\n`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });

    it('should fail to create form without authentication', () => {
      const testForm = {
        title: 'Unauthorized Form',
        description: 'Should fail',
        allowGuests: false,
        questions: []
      };

      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/create-form`,
        headers: {
          'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary'
        },
        body: `------WebKitFormBoundary\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(testForm)}\r\n------WebKitFormBoundary--\r\n`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it('should fail to create form with invalid data', () => {
      const invalidForm = {
        // Missing required title field
        description: 'Invalid form',
        allowGuests: false,
        questions: []
      };

      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/create-form`,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary'
        },
        body: `------WebKitFormBoundary\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(invalidForm)}\r\n------WebKitFormBoundary--\r\n`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });
  });

  describe('READ - Get Forms', () => {
    it('should get all forms for authenticated user', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/my-forms`,
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.be.an('array');
        expect(response.body.length).to.be.greaterThan(0);
      });
    });

    it('should get form by ID', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}`
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('form');
        expect(response.body).to.have.property('questions');
        expect(response.body.form.id).to.eq(formId);
        expect(response.body.questions).to.be.an('array');
      });
    });

    it('should fail to get non-existent form', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/99999`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });

  describe('DELETE - Delete Form', () => {
    it('should delete a form', () => {
      cy.request({
        method: 'DELETE',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}`,
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }).then((deleteResponse) => {
        expect(deleteResponse.status).to.be.oneOf([200, 204]);
      });

      // Verify form is deleted
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}`,
        failOnStatusCode: false
      }).then((getResponse) => {
        expect(getResponse.status).to.eq(404);
      });
    });

    it('should fail to delete form without authentication', () => {
      cy.request({
        method: 'DELETE',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });
});
