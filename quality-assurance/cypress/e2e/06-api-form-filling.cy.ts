/// <reference types="cypress" />

describe('[API] Form Filling with All Question Types', () => {
  let authToken: string;
  let formId: string;
  let questionIds: any = {};

  const testUser = {
    name: 'Form Filling Test User',
    email: `formfilling${Date.now()}@example.com`,
    password: 'FormFilling123!'
  };

  before(() => {
    // Register user
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

        // Create a comprehensive form with all question types
        const comprehensiveForm = {
          title: 'Comprehensive Survey Form',
          description: 'Form with all question types for testing',
          allowGuests: false,
          questions: [
            {
              text: 'What is your name?',
              type: 'short_text',
              required: true
            },
            {
              text: 'Tell us about your experience',
              type: 'long_text',
              required: false
            },
            {
              text: 'Select your favorite color',
              type: 'single_choice',
              required: true,
              options: ['Red', 'Blue', 'Green', 'Yellow']
            },
            {
              text: 'Select your hobbies (choose 2)',
              type: 'multiple_choice',
              required: true,
              options: ['Reading', 'Sports', 'Music', 'Gaming', 'Cooking']
            },
            {
              text: 'Rate on a scale',
              type: 'numeric',
              required: true
            },
            {
              text: 'Select your birth date',
              type: 'date',
              required: true
            },
            {
              text: 'What time do you usually wake up?',
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
          formId = response.body.formId;

          // Get form to retrieve question IDs
          cy.request({
            method: 'GET',
            url: `${Cypress.env('FORMS_API_URL')}/form/${formId}`
          }).then((formResponse) => {
            // Store question IDs for reference
            formResponse.body.questions.forEach((q: any) => {
              questionIds[q.type] = q.id;
            });
          });
        });
      });
    });
  });

  it('should successfully submit form with all question types filled', () => {
    const formSubmission = {
      responses: [
        {
          questionId: questionIds.short_text,
          answer: 'John Doe'
        },
        {
          questionId: questionIds.long_text,
          answer: 'This is a long text answer that describes my experience in detail. It contains multiple sentences and provides comprehensive information about the topic at hand.'
        },
        {
          questionId: questionIds.single_choice,
          answer: 'Blue'
        },
        {
          questionId: questionIds.multiple_choice,
          answer: ['Reading', 'Music']
        },
        {
          questionId: questionIds.numeric,
          answer: 8
        },
        {
          questionId: questionIds.date,
          answer: '1990-05-15'
        },
        {
          questionId: questionIds.time,
          answer: '07:30'
        }
      ]
    };

    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: formSubmission
    }).then((response) => {
      expect(response.status).to.be.oneOf([200, 201]);
      expect(response.body).to.have.property('id');
      expect(response.body.responses).to.have.length(7);
    });
  });

  it('should validate short text character limit (max 512)', () => {
    const longText = 'a'.repeat(600);

    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        responses: [
          {
            questionId: questionIds.short_text,
            answer: longText
          }
        ]
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.match(/512|character.*limit|too.*long/i);
    });
  });

  it('should validate long text character limit (max 4096)', () => {
    const veryLongText = 'a'.repeat(5000);

    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        responses: [
          {
            questionId: questionIds.long_text,
            answer: veryLongText
          }
        ]
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.match(/4096|character.*limit|too.*long/i);
    });
  });

  it('should validate single choice - only one option selected', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        responses: [
          {
            questionId: questionIds.single_choice,
            answer: ['Red', 'Blue'] // Multiple answers for single choice
          }
        ]
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('should validate multiple choice - minimum required selections', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        responses: [
          {
            questionId: questionIds.multiple_choice,
            answer: ['Reading'] // Only 1 when 2 required
          }
        ]
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.match(/minimum|at least.*2|required.*2/i);
    });
  });


  it('should accept valid number from generated sequence', () => {
    // Valid number: 8 is in the sequence [-4, -1, 2, 5, 8, 11, 14, 17, 20]
    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        responses: [
          {
            questionId: questionIds.numeric,
            answer: 8
          },
          {
            questionId: questionIds.short_text,
            answer: 'Test'
          },
          {
            questionId: questionIds.single_choice,
            answer: 'Red'
          },
          {
            questionId: questionIds.multiple_choice,
            answer: ['Reading', 'Sports']
          },
          {
            questionId: questionIds.date,
            answer: '2024-01-01'
          }
        ]
      }
    }).then((response) => {
      expect(response.status).to.be.oneOf([200, 201]);
    });
  });

  it('should validate date format', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        responses: [
          {
            questionId: questionIds.date,
            answer: 'invalid-date'
          }
        ]
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.match(/invalid.*date|date.*format/i);
    });
  });

  it('should validate time format', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        responses: [
          {
            questionId: questionIds.time,
            answer: 'invalid-time'
          }
        ]
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.match(/invalid.*time|time.*format/i);
    });
  });

  it('should fail when required questions are not answered', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        responses: [
          {
            questionId: questionIds.long_text,
            answer: 'Only optional question answered'
          }
        ]
      },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.message).to.match(/required|must.*answer/i);
    });
  });

  it('should allow submission with only required fields', () => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('FORMS_API_URL')}/form/${formId}/submit`,
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        responses: [
          {
            questionId: questionIds.short_text,
            answer: 'Required only'
          },
          {
            questionId: questionIds.single_choice,
            answer: 'Green'
          },
          {
            questionId: questionIds.multiple_choice,
            answer: ['Gaming', 'Cooking']
          },
          {
            questionId: questionIds.numeric,
            answer: 11
          },
          {
            questionId: questionIds.date,
            answer: '2024-10-26'
          }
        ]
      }
    }).then((response) => {
      expect(response.status).to.be.oneOf([200, 201]);
    });
  });

  it('should test form submission for anonymous users (allowGuests)', () => {
    // Create a form that allows anonymous submissions
    const anonymousForm = {
      title: 'Anonymous Survey',
      description: 'Can be filled without login',
      allowGuests: true,
      questions: [
        {
          text: 'Your feedback',
          type: 'short_text',
          required: true
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
      body: `------WebKitFormBoundary\r\nContent-Disposition: form-data; name="data"\r\n\r\n${JSON.stringify(anonymousForm)}\r\n------WebKitFormBoundary--\r\n`
    }).then((formResponse) => {
      const anonymousFormId = formResponse.body.formId;

      // Get form to get question IDs
      cy.request({
        method: 'GET',
        url: `${Cypress.env('FORMS_API_URL')}/form/${anonymousFormId}`
      }).then((getFormResponse) => {
        const questionId = getFormResponse.body.questions[0].id;

        // Submit without authentication
        cy.request({
          method: 'POST',
          url: `${Cypress.env('FORMS_API_URL')}/form/${anonymousFormId}/submit`,
          body: {
            responses: [
              {
                questionId: questionId,
                answer: 'Anonymous feedback'
              }
            ]
          }
        }).then((submitResponse) => {
          expect(submitResponse.status).to.be.oneOf([200, 201]);
        });
      });
    });
  });
});
