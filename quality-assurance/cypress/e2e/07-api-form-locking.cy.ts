/// <reference types="cypress" />

describe('[API] Closing/Locking Forms', () => {
  let ownerToken: string;
  let editorToken: string;
  let viewerToken: string;
  let formId: string;

  const owner = {
    name: 'Form Owner',
    email: `owner${Date.now()}@example.com`,
    password: 'Owner123!'
  };

  const editor = {
    name: 'Form Editor',
    email: `editor${Date.now()}@example.com`,
    password: 'Editor123!'
  };

  const viewer = {
    name: 'Form Viewer',
    email: `viewer${Date.now()}@example.com`,
    password: 'Viewer123!'
  };

  before(() => {
    // Register all users first
    cy.request({
      method: 'POST',
      url: `${Cypress.env('AUTH_API_URL')}/register`,
      body: owner
    }).then(() => {
      // Login to get token
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

      // Create a form using multipart/form-data
      const formData = {
        title: 'Test Form for Locking',
        description: 'This form will be locked',
        allowGuests: false,
        questions: [
          {
            text: 'Sample question',
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
    });

    // Register editor
    cy.request({
      method: 'POST',
      url: `${Cypress.env('AUTH_API_URL')}/register`,
      body: editor
    }).then(() => {
      return cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/login`,
        body: {
          email: editor.email,
          password: editor.password
        }
      });
    }).then((response) => {
      editorToken = response.body.token;
    });

    // Register viewer
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
    }).then((response) => {
      viewerToken = response.body.token;
    });
  });

  describe('Locking Forms', () => {
    it('should allow owner to lock the form', () => {
      cy.request({
        method: 'PATCH',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/lock`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        body: {
          isLocked: true
        }
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 204]);
      });

      // Verify form is locked
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }).then((response) => {
        expect(response.body.form.is_locked).to.eq(1);
      });
    });

    it('should prevent submissions to locked form', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }).then((formResponse) => {
        const questionId = formResponse.body.questions[0].id;

        cy.request({
          method: 'POST',
          url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
          headers: {
            Authorization: `Bearer ${ownerToken}`
          },
          body: {
            responses: [
              {
                questionId: questionId,
                answer: 'Test answer'
              }
            ]
          },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([400, 403]);
          expect(response.body.error).to.match(/locked|closed|zaključana/i);
        });
      });
    });

    it('should allow owner to unlock the form', () => {
      cy.request({
        method: 'PATCH',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/lock`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        body: {
          isLocked: false
        }
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 204]);
      });

      // Verify form is unlocked
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }).then((response) => {
        expect(response.body.form.is_locked).to.eq(0);
      });
    });

    it('should allow submissions after unlocking', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }).then((formResponse) => {
        const questionId = formResponse.body.questions[0].id;

        cy.request({
          method: 'POST',
          url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
          headers: {
            Authorization: `Bearer ${ownerToken}`
          },
          body: {
            responses: [
              {
                questionId: questionId,
                answer: 'Test answer after unlock'
              }
            ]
          }
        }).then((response) => {
          expect(response.status).to.be.oneOf([200, 201]);
        });
      });
    });
  });

  describe('Collaborator Permissions for Locking', () => {
    before(() => {
      // Add editor as collaborator with editor role
      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        body: {
          email: editor.email,
          role: 'editor'
        }
      });

      // Add viewer as collaborator with viewer role
      cy.request({
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

    it('should allow editor to lock/unlock the form', () => {
      // Editor locks the form
      cy.request({
        method: 'PATCH',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/lock`,
        headers: {
          Authorization: `Bearer ${editorToken}`
        },
        body: {
          isLocked: true
        }
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 204]);
      });

      // Verify it's locked
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${formId}`,
        headers: {
          Authorization: `Bearer ${editorToken}`
        }
      }).then((response) => {
        expect(response.body.form.is_locked).to.eq(1);
      });

      // Editor unlocks the form
      cy.request({
        method: 'PATCH',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/lock`,
        headers: {
          Authorization: `Bearer ${editorToken}`
        },
        body: {
          isLocked: false
        }
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 204]);
      });
    });

    it('should prevent viewer from locking/unlocking the form', () => {
      cy.request({
        method: 'PATCH',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/lock`,
        headers: {
          Authorization: `Bearer ${viewerToken}`
        },
        body: {
          isLocked: true
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403);
        expect(response.body.message).to.match(/permission|forbidden|not.*allowed|dozvolu|zaključavanje/i);
      });
    });

    it('should prevent non-collaborators from locking form', () => {
      // Create another user who is not a collaborator
      const outsider = {
        name: 'Outsider',
        email: `outsider${Date.now()}@example.com`,
        password: 'Outsider123!'
      };

      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/register`,
        body: outsider
      }).then((response) => {
        const outsiderToken = response.body.token;

        cy.request({
          method: 'PATCH',
          url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/lock`,
          headers: {
            Authorization: `Bearer ${outsiderToken}`
          },
          body: {
            isLocked: true
          },
          failOnStatusCode: false
        }).then((lockResponse) => {
          expect(lockResponse.status).to.be.oneOf([403, 404]);
        });
      });
    });

    it('should fail to lock form without authentication', () => {
      cy.request({
        method: 'PATCH',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/lock`,
        body: {
          isLocked: true
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });

});
