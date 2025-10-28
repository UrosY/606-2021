import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formsAPI } from '../api/forms';
import type { Form, Question, QuestionType } from '../types';
import toast from 'react-hot-toast';
import QuestionEditor from '../components/QuestionEditor';
import CollaboratorManager from '../components/CollaboratorManager';

export default function FormBuilder() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [allowGuests, setAllowGuests] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'editor' | 'viewer' | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastFetchedVersion = useRef<string>('');

  // Load form if editing
  const { data, refetch } = useQuery({
    queryKey: ['form', id],
    queryFn: () => formsAPI.getForm(Number(id)),
    enabled: isEditMode,
    refetchInterval: isEditMode && !hasUnsavedChanges ? 5000 : false, // Poll every 5 seconds if no unsaved changes
  });

  // Load user role and collaborators
  const { data: collabData } = useQuery({
    queryKey: ['collaborators', id],
    queryFn: () => formsAPI.getCollaborators(Number(id)),
    enabled: isEditMode,
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Populate form fields when data loads
  useEffect(() => {
    if (data) {
      const currentVersion = JSON.stringify(data);

      // Check if form was updated by someone else
      if (lastFetchedVersion.current && lastFetchedVersion.current !== currentVersion && !hasUnsavedChanges) {
        toast.success('Form updated by collaborator. Refreshing...', { duration: 2000 });
      }

      lastFetchedVersion.current = currentVersion;
      setTitle(data.form.title);
      setDescription(data.form.description || '');
      setAllowGuests(Boolean(data.form.allow_anonymous));
      setIsLocked(Boolean(data.form.is_locked));
      setQuestions(data.questions.map(q => ({
        id: q.id,
        text: q.text,
        type: q.type,
        required: q.is_required,
        options: q.options?.map((o: any) => o.text) || [],
        imageBase64: q.imageBase64,
        image: null
      })));
      setHasUnsavedChanges(false);
    }
  }, [data]);

  // Set user role from collaborator data
  useEffect(() => {
    if (collabData) {
      setUserRole(collabData.userRole);
    }
  }, [collabData]);

  // Track changes for unsaved changes warning
  useEffect(() => {
    const handleChange = () => {
      if (isEditMode) {
        setHasUnsavedChanges(true);
      }
    };
    // Add event listeners if needed
    return () => {
      // Cleanup
    };
  }, [isEditMode]);

  const lockMutation = useMutation({
    mutationFn: (locked: boolean) => formsAPI.lockForm(Number(id), locked),
    onSuccess: (_, locked) => {
      setIsLocked(locked);
      toast.success(locked ? 'Form locked successfully!' : 'Form unlocked successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to lock/unlock form');
    },
  });

  const createMutation = useMutation({
    mutationFn: formsAPI.createForm,
    onSuccess: (data) => {
      toast.success('Form created successfully!');
      navigate('/dashboard');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create form');
    }
  });

  const editMutation = useMutation({
    mutationFn: (form: Form) => formsAPI.editForm(Number(id), form),
    onSuccess: () => {
      toast.success('Form updated successfully!');
      navigate('/dashboard');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update form');
    }
  });

  const canEdit = !isEditMode || userRole === 'owner' || userRole === 'editor';
  const isOwner = userRole === 'owner';

  const handleToggleLock = () => {
    if (!canEdit) {
      toast.error('Only owners and editors can lock/unlock forms');
      return;
    }
    lockMutation.mutate(!isLocked);
  };

  const addQuestion = () => {
    if (!canEdit) {
      toast.error('You don\'t have permission to edit this form');
      return;
    }
    const newQuestion: Question = {
      text: '',
      type: 'short_text',
      required: false,
      options: [],
      image: null
    };
    setQuestions([...questions, newQuestion]);
    setHasUnsavedChanges(true);
  };

  const updateQuestion = (index: number, updatedQuestion: Question) => {
    if (!canEdit) {
      toast.error('You don\'t have permission to edit this form');
      return;
    }
    const newQuestions = [...questions];
    newQuestions[index] = updatedQuestion;
    setQuestions(newQuestions);
    setHasUnsavedChanges(true);
  };

  const deleteQuestion = (index: number) => {
    if (!canEdit) {
      toast.error('You don\'t have permission to edit this form');
      return;
    }
    if (window.confirm('Are you sure you want to delete this question?')) {
      setQuestions(questions.filter((_, i) => i !== index));
      setHasUnsavedChanges(true);
    }
  };

  const cloneQuestion = (index: number) => {
    if (!canEdit) {
      toast.error('You don\'t have permission to edit this form');
      return;
    }
    const questionToClone = { ...questions[index] };
    delete questionToClone.id; // Remove ID for new question
    const newQuestions = [...questions];
    newQuestions.splice(index + 1, 0, questionToClone);
    setQuestions(newQuestions);
    setHasUnsavedChanges(true);
  };

  const moveQuestionUp = (index: number) => {
    if (!canEdit) {
      toast.error('You don\'t have permission to edit this form');
      return;
    }
    if (index === 0) return;
    const newQuestions = [...questions];
    [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
    setQuestions(newQuestions);
    setHasUnsavedChanges(true);
  };

  const moveQuestionDown = (index: number) => {
    if (!canEdit) {
      toast.error('You don\'t have permission to edit this form');
      return;
    }
    if (index === questions.length - 1) return;
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
    setQuestions(newQuestions);
    setHasUnsavedChanges(true);
  };

  const handleShare = () => {
    if (isEditMode && id) {
      setShareModalOpen(true);
    } else {
      toast.error('Please save the form first before sharing');
    }
  };

  const copyShareLink = () => {
    if (id) {
      const link = `${window.location.origin}/fill/${id}`;
      navigator.clipboard.writeText(link);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isEditMode && !canEdit) {
      toast.error('You don\'t have permission to edit this form');
      return;
    }

    if (!title.trim()) {
      toast.error('Form title is required');
      return;
    }

    if (questions.length === 0) {
      toast.error('Add at least one question');
      return;
    }

    const emptyQuestions = questions.filter(q => !q.text.trim());
    if (emptyQuestions.length > 0) {
      toast.error('All questions must have text');
      return;
    }

    const form: Form = {
      title,
      description,
      allowGuests,
      questions
    };

    if (isEditMode) {
      editMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {isEditMode ? 'Edit Form' : 'Create New Form'}
              </h1>
              {/* User Role Badge */}
              {isEditMode && userRole && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  userRole === 'owner' ? 'bg-purple-100 text-purple-700' :
                  userRole === 'editor' ? 'bg-green-100 text-green-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {userRole === 'owner' ? 'Owner' : userRole === 'editor' ? 'Editor' : 'Viewer'}
                </span>
              )}
              {/* Lock Status Badge */}
              {isEditMode && isLocked && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 inline-flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Locked
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {isEditMode && (
                <>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleToggleLock}
                      disabled={lockMutation.isPending}
                      className={`px-4 py-2 border rounded-lg transition-colors inline-flex items-center ${
                        isLocked
                          ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                          : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isLocked ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        )}
                      </svg>
                      {isLocked ? 'Unlock Form' : 'Lock Form'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleShare}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors inline-flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                  </button>
                </>
              )}
              {(!isEditMode || canEdit) && (
                <button
                  type="submit"
                  disabled={createMutation.isPending || editMutation.isPending || (isEditMode && !canEdit)}
                  onClick={handleSubmit}
                  className="btn-primary px-6 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending || editMutation.isPending
                    ? 'Saving...'
                    : isEditMode
                    ? 'Update Form'
                    : 'Create Form'}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Form Details</h2>
            {userRole === 'viewer' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                You have view-only access to this form. Contact the owner to request edit permissions.
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Form Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setHasUnsavedChanges(true); }}
                  className="input-focus w-full px-4 py-2.5 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter form title"
                  required
                  disabled={!canEdit}
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setHasUnsavedChanges(true); }}
                  rows={3}
                  className="input-focus w-full px-4 py-2.5 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Enter form description"
                  disabled={!canEdit}
                />
              </div>

              <div className="flex items-center pt-2">
                <input
                  type="checkbox"
                  id="allowGuests"
                  checked={allowGuests}
                  onChange={(e) => { setAllowGuests(e.target.checked); setHasUnsavedChanges(true); }}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canEdit}
                />
                <label htmlFor="allowGuests" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                  Allow anonymous users to fill this form
                </label>
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
              {canEdit && (
                <button
                  type="button"
                  onClick={addQuestion}
                  className="btn-primary px-4 py-2 text-white rounded-lg font-medium inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canEdit}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Question
                </button>
              )}
            </div>

            {questions.map((question, index) => (
              <QuestionEditor
                key={index}
                question={question}
                index={index}
                onUpdate={updateQuestion}
                onDelete={deleteQuestion}
                onClone={cloneQuestion}
                onMoveUp={moveQuestionUp}
                onMoveDown={moveQuestionDown}
                canMoveUp={index > 0}
                canMoveDown={index < questions.length - 1}
              />
            ))}

            {questions.length === 0 && (
              <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-600 mb-4">
                  {canEdit
                    ? 'No questions yet. Click "Add Question" to get started.'
                    : 'No questions in this form yet.'}
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="btn-primary inline-flex items-center px-4 py-2 text-white rounded-lg font-medium"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Your First Question
                  </button>
                )}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Share Modal */}
      {shareModalOpen && id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Share & Collaborate</h3>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Public Share Link Section */}
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-900 mb-2">Public Link</h4>
              <p className="text-sm text-gray-600 mb-3">
                Share this link with anyone to allow them to fill out the form:
              </p>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/fill/${id}`}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={copyShareLink}
                  className="btn-primary px-4 py-2 text-white rounded-lg font-medium whitespace-nowrap inline-flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </button>
              </div>
            </div>

            {/* Collaborators Section */}
            <div className="border-t border-gray-200 pt-6">
              <CollaboratorManager formId={Number(id)} />
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShareModalOpen(false)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
