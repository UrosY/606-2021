// User types
export interface User {
  id: number;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// Question types
export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multiple_choice'
  | 'numeric'
  | 'date'
  | 'time';

export interface Question {
  id?: number;
  text: string;
  type: QuestionType;
  required: boolean;
  position?: number;
  options?: string[];
  imageBase64?: string | null;
  image?: File | null;
  // For numeric type
  numericConfig?: {
    mode: 'list' | 'range';
    values?: number[]; // for list mode
    start?: number; // for range mode
    end?: number;
    step?: number;
  };
  // For multiple choice
  minSelections?: number;
  maxSelections?: number;
}

// Form types
export interface Form {
  id?: number;
  title: string;
  description?: string;
  allowGuests: boolean;
  allow_anonymous?: boolean; // Backend uses this name
  owner_id?: number;
  is_locked?: boolean;
  questions: Question[];
}

export interface FormListItem {
  id: number;
  title: string;
  description?: string;
}

// Collaborator types
export type CollaboratorRole = 'viewer' | 'editor';

export interface Collaborator {
  id: number;
  user_id: number;
  form_id: number;
  role: CollaboratorRole;
  email?: string;
  name?: string;
}

// Answer/Response types
export interface Answer {
  questionId: number;
  type: QuestionType;
  value?: string | number;
  selectedOptionId?: number;
  selectedOptionIds?: number[];
  image?: File | null;
}

export interface SubmitFormData {
  answers: Answer[];
}

export interface Response {
  id: number;
  form_id: number;
  user_id?: number;
  submitted_at: string;
  user_name?: string;
  user_email?: string;
  form_title?: string;
}

export interface ResponseDetail extends Response {
  questions: {
    id: number;
    text: string;
    type: QuestionType;
    answer: string | null;
    options: { id: number; text: string }[];
    imageBase64?: string | null;
  }[];
}

export interface GroupedAnswer {
  id: number;
  answer_text: string | null;
  imageBase64?: string | null;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  type: QuestionType;
  selectedOptionTexts?: string[];
}

export interface QuestionWithAnswers {
  id: number;
  text: string;
  type: QuestionType;
  imageBase64?: string | null;
  answers: GroupedAnswer[];
}

export interface GroupedResponses {
  form_id: number;
  questions: QuestionWithAnswers[];
}
