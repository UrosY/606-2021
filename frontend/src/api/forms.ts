import { formsClient, formsMultipartClient } from './client';
import type {
  Form,
  FormListItem,
  SubmitFormData,
  Response,
  ResponseDetail,
  GroupedResponses,
  Collaborator
} from '../types';

export const formsAPI = {
  // Create form with images
  createForm: async (form: Form): Promise<{ success: boolean; message: string; formId: number }> => {
    const formData = new FormData();

    // Track which questions have images
    const imageIndices: number[] = [];

    const questionsData = form.questions.map((q, index) => {
      if (q.image) {
        imageIndices.push(index);
      }
      return {
        text: q.text,
        type: q.type,
        required: q.required,
        options: q.options || [],
        numericConfig: q.numericConfig,
        minSelections: q.minSelections,
        maxSelections: q.maxSelections
      };
    });

    formData.append('data', JSON.stringify({
      title: form.title,
      description: form.description || '',
      allowGuests: form.allowGuests,
      questions: questionsData,
      imageIndices // Send mapping of which questions have images
    }));

    // Append only actual images (not empty blobs)
    form.questions.forEach((q) => {
      if (q.image) {
        formData.append('images', q.image);
      }
    });

    const response = await formsMultipartClient.post('/create-form', formData);
    return response.data;
  },

  // Get user's forms
  getMyForms: async (): Promise<FormListItem[]> => {
    const response = await formsClient.get('/my-forms');
    return response.data;
  },

  // Get single form with questions
  getForm: async (id: number): Promise<{ form: any; questions: any[] }> => {
    const response = await formsClient.get(`/form/${id}`);
    return response.data;
  },

  // Edit form
  editForm: async (id: number, form: Form): Promise<{ message: string }> => {
    const formData = new FormData();

    // Track which questions have NEW images
    const imageIndices: number[] = [];

    const questionsData = form.questions.map((q, index) => {
      if (q.image) {
        imageIndices.push(index);
      }
      return {
        id: q.id, // Include question ID for proper matching
        text: q.text,
        type: q.type,
        required: q.required,
        options: q.options || [],
        numericConfig: q.numericConfig,
        minSelections: q.minSelections,
        maxSelections: q.maxSelections,
        hasExistingImage: !!q.imageBase64 // Track if question has an existing image to preserve
      };
    });

    formData.append('data', JSON.stringify({
      title: form.title,
      description: form.description || '',
      allowGuests: form.allowGuests,
      questions: questionsData,
      imageIndices // Send mapping of which questions have NEW images
    }));

    // Append only actual new images (not empty blobs)
    form.questions.forEach(q => {
      if (q.image) {
        formData.append('images', q.image);
      }
    });

    const response = await formsMultipartClient.put(`/edit-form/${id}`, formData);
    return response.data;
  },

  // Delete form
  deleteForm: async (id: number): Promise<{ message: string }> => {
    const response = await formsClient.delete(`/forms/${id}`);
    return response.data;
  },

  // Reorder questions
  reorderQuestions: async (formId: number, questionOrder: number[]): Promise<{ success: boolean; message: string }> => {
    const response = await formsClient.post(`/form/${formId}/reorder`, { questionOrder });
    return response.data;
  },

  // Submit form response
  submitForm: async (formId: number, data: SubmitFormData): Promise<{ success: boolean; message: string }> => {
    const formData = new FormData();

    formData.append('data', JSON.stringify(data));

    // Append answer images
    data.answers.forEach(a => {
      if (a.image) {
        formData.append('answerImages', a.image);
      }
    });

    const response = await formsMultipartClient.post(`/form/${formId}/submit`, formData);
    return response.data;
  },

  // Get form responses
  getMyResults: async (): Promise<Response[]> => {
    const response = await formsClient.get('/my-results');
    return response.data;
  },

  // Get single response detail
  getResponseDetail: async (responseId: number): Promise<ResponseDetail> => {
    const response = await formsClient.get(`/response/${responseId}`);
    return response.data;
  },

  // Get grouped answers
  getGroupedAnswers: async (formId: number): Promise<GroupedResponses> => {
    const response = await formsClient.get(`/form/${formId}/grouped-answers`);
    return response.data;
  },

  // Export response to xlsx
  exportResponse: async (responseId: number): Promise<Blob> => {
    const response = await formsClient.get(`/form/${responseId}/export`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Collaborators
  addCollaborator: async (formId: number, email: string, role: string): Promise<{ success: boolean; message: string; collaborator: Collaborator }> => {
    const response = await formsClient.post(`/forms/${formId}/collaborators`, { email, role });
    return response.data;
  },

  getCollaborators: async (formId: number): Promise<{ collaborators: Collaborator[]; isOwner: boolean; userRole: 'owner' | 'editor' | 'viewer' }> => {
    const response = await formsClient.get(`/forms/${formId}/collaborators`);
    return response.data;
  },

  removeCollaborator: async (formId: number, collabId: number): Promise<{ success: boolean; message: string }> => {
    const response = await formsClient.delete(`/forms/${formId}/collaborators/${collabId}`);
    return response.data;
  },

  // Lock/unlock form
  lockForm: async (formId: number, isLocked: boolean): Promise<{ success: boolean; message: string }> => {
    const response = await formsClient.patch(`/forms/${formId}/lock`, { isLocked });
    return response.data;
  },

  // Get public forms
  getPublicForms: async (): Promise<FormListItem[]> => {
    const response = await formsClient.get('/public-forms');
    return response.data;
  }
};
