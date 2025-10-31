/// <reference types="cypress" />

describe('[API] Adding Collaborators to Forms', () => {
  let ownerToken: string;
  let formId: string;

  const owner = {
    name: 'Form Owner',
    email: `collabowner${Date.now()}@example.com`,
    password: 'Owner123!'
  };

  const viewer1 = {
    name: 'Viewer One',
    email: `viewer1${Date.now()}@example.com`,
    password: 'Viewer123!'
  };

  const viewer2 = {
    name: 'Viewer Two',
    email: `viewer2${Date.now()}@example.com`,
    password: 'Viewer123!'
  };

  const editor1 = {
    name: 'Editor One',
    email: `editor1${Date.now()}@example.com`,
    password: 'Editor123!'
  };

  const editor2 = {
    name: 'Editor Two',
    email: `editor2${Date.now()}@example.com`,
    password: 'Editor123!'
  };

  before(() => {
    // Register owner
    cy.request({
      method: 'POST',
      url: `${Cypress.env('AUTH_API_URL')}/register`,
      body: owner
    }).then((response) => {
      expect(response.status).to.eq(200);

      // Login to get token
      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/login`,
        body: {
          email: owner.email,
          password: owner.password
        }
      }).then((loginResponse) => {
        ownerToken = loginResponse.body.token;

        // Create a form using multipart/form-data
        const formData = {
          title: 'Collaboration Test Form',
          description: 'Form to test collaborators',
          allowGuests: false,
          questions: [
            {
              text: 'Test question',
              type: 'short_text',
              required: true
            }
          ]
        };

        cy.request({
          method: 'POST',
          url: `${Cypress.env('FORMS_API_URL')}/create-form`,
          headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary'
          },
          body: `------WebKitFormBoundary\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(formData)}\r\n------WebKitFormBoundary--\r\n`
        }).then((formResponse) => {
          formId = formResponse.body.formId;
        });
      });
    });

    // Register other users
    [viewer1, viewer2, editor1, editor2].forEach((user) => {
      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/register`,
        body: user
      });
    });
  });

  describe('Adding Collaborators', () => {
    it('should allow owner to add viewer collaborator', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        body: {
          email: viewer1.email,
          role: 'viewer'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.collaborator.role).to.eq('viewer');
      });
    });

    it('should allow owner to add editor collaborator', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        body: {
          email: editor1.email,
          role: 'editor'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
        expect(response.body.collaborator.role).to.eq('editor');
      });
    });

    it('should fail to add collaborator with invalid email', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        body: {
          email: 'nonexistent@example.com',
          role: 'viewer'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 404]);
        expect(response.body.message).to.match(/not.*found|does.*not.*exist|invalid.*user|nije.*pronađen/i);
      });
    });

    it('should fail to add collaborator without authentication', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        body: {
          email: viewer2.email,
          role: 'viewer'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it('should fail to add same collaborator twice', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        body: {
          email: viewer1.email,
          role: 'viewer'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 409]);
        expect(response.body.message).to.match(/already.*collaborator|already.*exists|već.*kolaborator/i);
      });
    });

    it('should fail to add collaborator with invalid role', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        body: {
          email: viewer2.email,
          role: 'invalid_role'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.message).to.match(/invalid.*role|Uloga.*mora/i);
      });
    });
  });

  describe('Listing Collaborators', () => {
    it('should list all collaborators for owner', () => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.collaborators).to.be.an('array');
        expect(response.body.collaborators.length).to.be.at.least(2);
        expect(response.body.isOwner).to.be.true;

        // Check viewer1 is in the list
        const viewer1Collab = response.body.collaborators.find((c: any) => c.email === viewer1.email);
        expect(viewer1Collab).to.exist;
        expect(viewer1Collab.role).to.eq('viewer');

        // Check editor1 is in the list
        const editor1Collab = response.body.collaborators.find((c: any) => c.email === editor1.email);
        expect(editor1Collab).to.exist;
        expect(editor1Collab.role).to.eq('editor');
      });
    });

    it('should allow editors to view collaborators list', () => {
      // Login as editor
      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/login`,
        body: {
          email: editor1.email,
          password: editor1.password
        }
      }).then((loginResponse) => {
        const editorToken = loginResponse.body.token;

        cy.request({
          method: 'GET',
          url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
          headers: {
            Authorization: `Bearer ${editorToken}`
          }
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.collaborators).to.be.an('array');
        });
      });
    });

    it('should allow viewers to view collaborators list', () => {
      // Login as viewer
      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/login`,
        body: {
          email: viewer1.email,
          password: viewer1.password
        }
      }).then((loginResponse) => {
        const viewerToken = loginResponse.body.token;

        cy.request({
          method: 'GET',
          url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
          headers: {
            Authorization: `Bearer ${viewerToken}`
          }
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.collaborators).to.be.an('array');
        });
      });
    });
  });

  describe('Removing Collaborators', () => {
    it('should prevent non-owner from removing collaborators', () => {
      // Login as editor
      cy.request({
        method: 'POST',
        url: `${Cypress.env('AUTH_API_URL')}/login`,
        body: {
          email: editor1.email,
          password: editor1.password
        }
      }).then((loginResponse) => {
        const editorToken = loginResponse.body.token;

        // Get collaborators list to find viewer1's ID
        cy.request({
          method: 'GET',
          url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
          headers: {
            Authorization: `Bearer ${editorToken}`
          }
        }).then((listResponse) => {
          const viewer1Collab = listResponse.body.collaborators.find((c: any) => c.email === viewer1.email);
          const collabId = viewer1Collab.id;

          cy.request({
            method: 'DELETE',
            url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators/${collabId}`,
            headers: {
              Authorization: `Bearer ${editorToken}`
            },
            failOnStatusCode: false
          }).then((response) => {
            expect(response.status).to.eq(403);
            expect(response.body.message).to.match(/only.*owner|permission.*denied|forbidden|Samo.*vlasnik/i);
          });
        });
      });
    });

    it('should allow owner to remove collaborators', () => {
      // Get collaborators list to find viewer1's ID
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        }
      }).then((listResponse) => {
        const viewer1Collab = listResponse.body.collaborators.find((c: any) => c.email === viewer1.email);
        const collabId = viewer1Collab.id;

        cy.request({
          method: 'DELETE',
          url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators/${collabId}`,
          headers: {
            Authorization: `Bearer ${ownerToken}`
          }
        }).then((response) => {
          expect(response.status).to.be.oneOf([200, 204]);
        });

        // Verify collaborator is removed
        cy.request({
          method: 'GET',
          url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators`,
          headers: {
            Authorization: `Bearer ${ownerToken}`
          }
        }).then((response) => {
          const viewer1Collab = response.body.collaborators.find((c: any) => c.email === viewer1.email);
          expect(viewer1Collab).to.not.exist;
        });
      });
    });

    it('should fail to remove non-existent collaborator', () => {
      cy.request({
        method: 'DELETE',
        url: `${Cypress.env('FORMS_API_URL')}/forms/${formId}/collaborators/99999`,
        headers: {
          Authorization: `Bearer ${ownerToken}`
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });

});
