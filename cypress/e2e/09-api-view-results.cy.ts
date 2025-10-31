/// <reference types="cypress" />

describe('[API] Viewing Form Results', () => {
  let ownerToken: string;
  let viewerToken: string;
  let formId: string;
  let responseId: string;
  let questionId: string;

  const owner = {
    name: 'Results Owner',
    email: `resultsowner${Date.now()}@example.com`,
    password: 'Owner123!'
  };

  const viewer = {
    name: 'Results Viewer',
    email: `resultsviewer${Date.now()}@example.com`,
    password: 'Viewer123!'
  };

  const respondent = {
    name: 'Respondent',
    email: `respondent${Date.now()}@example.com`,
    password: 'Respondent123!'
  };

  before(() => {
    // Register and login owner
    cy.request({
      method: 'POST',
      url: `${Cypress.env('AUTH_API_URL')}/register`,
      body: owner
    }).then(() => {
      return cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/login`,
        body: {
          email: owner.email,
          password: owner.password
        }
      });
    }).then((loginResponse) => {
      ownerToken = loginResponse.body.token;

      // Create form
      const formData = {
        title: 'Results Test Form',
        description: 'Form for testing results',
        allowGuests: false,
        questions: [
          {
            text: 'What is your name?',
            type: 'short_text',
            required: true
          }
        ]
      };

      return cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/create-form`,
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary'
        },
        body: `------WebKitFormBoundary\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(formData)}\r\n------WebKitFormBoundary--\r\n`
      });
    }).then((formResponse) => {
      formId = formResponse.body.formId;

      // Get question ID
      return cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      });
    }).then((formResponse) => {
      questionId = formResponse.body.questions[0].id;
    });

    // Register viewer and add as collaborator
    cy.request({
      method: 'POST',
      url: `${Cypress.env('AUTH_API_URL')}/register`,
      body: viewer
    }).then(() => {
      return cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/login`,
        body: {
          email: viewer.email,
          password: viewer.password
        }
      });
    }).then((loginResponse) => {
      viewerToken = loginResponse.body.token;

      return cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        body: {
          email: viewer.email,
          role: 'viewer'
        }
      });
    });

    // Register respondent and submit a response
    cy.request({
      method: 'POST',
      url: `${Cypress.env('AUTH_API_URL')}/register`,
      body: respondent
    }).then(() => {
      return cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/login`,
        body: {
          email: respondent.email,
          password: respondent.password
        }
      });
    }).then((loginResponse) => {
      const respondentToken = loginResponse.body.token;

      return cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
        headers: {
          Authorization: `Bearer ${respondentToken}`
        },
        body: {
          responses: [
            {
              questionId: questionId,
              answer: 'John Doe'
            }
          ]
        }
      });
    }).then((submitResponse) => {
      responseId = submitResponse.body.id;
    });
  });

  describe('View Results List', () => {
    it('should allow owner to view results list', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/my-results`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.be.an('array');

        // Find our form in the results
        const formResult = response.body.find((f: any) => f.form_id === formId);
        expect(formResult).to.exist;
        expect(formResult.responses).to.be.an('array');
        expect(formResult.responses.length).to.be.greaterThan(0);
      });
    });

    it('should allow viewer collaborator to view results list', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/my-results`,
        headers: {
          Authorization: `Bearer ${viewerToken}`
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.be.an('array');

        // Viewer should see the form they collaborate on
        const formResult = response.body.find((f: any) => f.form_id === formId);
        expect(formResult).to.exist;
      });
    });

    it('should fail to view results without authentication', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/my-results`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });

  describe('View Individual Response', () => {
    it('should allow owner to view individual response details', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/response/${responseId}`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.response).to.exist;
        expect(response.body.questions).to.be.an('array');
        expect(response.body.questions.length).to.be.greaterThan(0);
      });
    });

    it('should fail to view response without authentication', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/response/${responseId}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });

  describe('View Grouped Answers', () => {
    it('should allow owner to view grouped answers by question', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/grouped-answers`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(Number(response.body.form_id)).to.eq(Number(formId));
        expect(response.body.questions).to.be.an('array');
        expect(response.body.questions.length).to.be.greaterThan(0);

        // Each question should have answers
        response.body.questions.forEach((q: any) => {
          expect(q).to.have.property('id');
          expect(q).to.have.property('text');
          expect(q).to.have.property('type');
          expect(q).to.have.property('answers');
          expect(q.answers).to.be.an('array');
        });
      });
    });

    it('should allow viewer collaborator to view grouped answers', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/grouped-answers`,
        headers: {
          Authorization: `Bearer ${viewerToken}`
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.questions).to.be.an('array');
      });
    });

    it('should prevent non-collaborators from viewing grouped answers', () => {
      const outsider = {
        name: 'Outsider',
        email: `outsider${Date.now()}@example.com`,
        password: 'Outsider123!'
      };

      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/register`,
        body: outsider
      }).then(() => {
        return cy.request({
          method: 'POST',
          url: `${Cypress.env('AUTH_API_URL')}/login`,
          body: {
            email: outsider.email,
            password: outsider.password
          }
        });
      }).then((loginResponse) => {
        const outsiderToken = loginResponse.body.token;

        cy.request({
          method: 'GET',
          url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/grouped-answers`,
          headers: {
            Authorization: `Bearer ${outsiderToken}`
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(403);
        });
      });
    });

    it('should fail to view grouped answers without authentication', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/grouped-answers`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });

  describe('Export Response to XLSX', () => {
    it('should allow owner to export individual response to XLSX', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${responseId}/export`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        encoding: 'binary'
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers['content-type']).to.match(/spreadsheet|xlsx|excel/i);
        expect(response.headers['content-disposition']).to.include('attachment');
        expect(response.body).to.exist;
      });
    });

    it('should fail to export without authentication', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${responseId}/export`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it('should prevent non-owner from exporting', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${responseId}/export`,
        headers: {
          Authorization: `Bearer ${viewerToken}`
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403);
      });
    });
  });
});
