import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formsAPI } from '../api/forms';
import type { Answer } from '../types';
import toast from 'react-hot-toast';

export default function FillForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Answer[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['form', id],
    queryFn: () => formsAPI.getForm(Number(id)),
  });

  // Initialize answers when data loads
  useEffect(() => {
    if (data?.questions) {
      const initialAnswers: Answer[] = data.questions.map(q => ({
        questionId: q.id,
        type: q.type,
        value: '',
        selectedOptionIds: [],
        image: null
      }));
      setAnswers(initialAnswers);
    }
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: () => formsAPI.submitForm(Number(id), { answers }),
    onSuccess: () => {
      toast.success('Form submitted successfully!');
      navigate('/');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to submit form');
    }
  });

  const handleAnswerChange = (questionId: number, value: any, type?: string) => {
    setAnswers(prev => prev.map(a =>
      a.questionId === questionId
        ? { ...a, ...(type === 'option' ? { selectedOptionId: value } : type === 'options' ? { selectedOptionIds: value } : { value }) }
        : a
    ));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!data) return;

    // Validate required questions
    const requiredQuestions = data.questions.filter(q => q.is_required);
    for (const q of requiredQuestions) {
      const answer = answers.find(a => a.questionId === q.id);
      if (!answer) continue;

      if (q.type === 'single_choice' && !answer.selectedOptionId) {
        toast.error(`Question "${q.text}" is required`);
        return;
      }
      if (q.type === 'multiple_choice' && (!answer.selectedOptionIds || answer.selectedOptionIds.length === 0)) {
        toast.error(`Question "${q.text}" is required`);
        return;
      }
      if (['short_text', 'long_text', 'numeric', 'date', 'time'].includes(q.type) && !answer.value) {
        toast.error(`Question "${q.text}" is required`);
        return;
      }
    }

    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="mt-4 text-white">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.form) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
          <svg className="mx-auto h-16 w-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-center text-red-600 text-lg font-medium">Form not found</p>
        </div>
      </div>
    );
  }

  const { form, questions } = data;

  if (form.is_locked) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <svg className="mx-auto h-16 w-16 text-yellow-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-yellow-600 text-lg font-medium">This form is locked</p>
          <p className="text-gray-600 mt-2">This form is no longer accepting responses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Form Header */}
        <div className="bg-white rounded-t-2xl shadow-2xl p-8 border-b-4 border-purple-600">
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">{form.title}</h1>
          {form.description && (
            <p className="text-gray-600 text-center">{form.description}</p>
          )}
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-b-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {questions.map((question, qIndex) => {
              const answer = answers.find(a => a.questionId === question.id);

              return (
                <div key={question.id} className="bg-gray-50 rounded-lg p-6 border-l-4 border-purple-500">
                  <label className="block text-lg font-medium text-gray-900 mb-4">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-purple-600 text-white rounded-full text-sm font-bold mr-2">
                      {qIndex + 1}
                    </span>
                    {question.text}
                    {question.is_required && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  {question.imageBase64 && (
                    <img
                      src={question.imageBase64}
                      alt="Question"
                      className="mb-4 max-w-md rounded-lg border border-gray-200 shadow-sm"
                    />
                  )}

                  {/* Short Text */}
                  {question.type === 'short_text' && (
                    <input
                      type="text"
                      maxLength={512}
                      value={answer?.value as string || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className="input-focus w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                      placeholder="Your answer"
                      required={question.is_required}
                    />
                  )}

                  {/* Long Text */}
                  {question.type === 'long_text' && (
                    <textarea
                      maxLength={4096}
                      rows={5}
                      value={answer?.value as string || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className="input-focus w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                      placeholder="Your answer"
                      required={question.is_required}
                    />
                  )}

                  {/* Single Choice */}
                  {question.type === 'single_choice' && (
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <label key={option.id} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-purple-300 transition-colors">
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option.id}
                            checked={answer?.selectedOptionId === option.id}
                            onChange={() => handleAnswerChange(question.id, option.id, 'option')}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            required={question.is_required}
                          />
                          <span className="text-gray-700 flex-1">{option.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Multiple Choice */}
                  {question.type === 'multiple_choice' && (
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <label key={option.id} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-purple-300 transition-colors">
                          <input
                            type="checkbox"
                            checked={answer?.selectedOptionIds?.includes(option.id) || false}
                            onChange={(e) => {
                              const currentIds = answer?.selectedOptionIds || [];
                              const newIds = e.target.checked
                                ? [...currentIds, option.id]
                                : currentIds.filter(id => id !== option.id);
                              handleAnswerChange(question.id, newIds, 'options');
                            }}
                            className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                          />
                          <span className="text-gray-700 flex-1">{option.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Numeric */}
                  {question.type === 'numeric' && (
                    <input
                      type="number"
                      value={answer?.value as string || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className="input-focus w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                      placeholder="Enter a number"
                      required={question.is_required}
                    />
                  )}

                  {/* Date */}
                  {question.type === 'date' && (
                    <input
                      type="date"
                      value={answer?.value as string || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className="input-focus w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                      required={question.is_required}
                    />
                  )}

                  {/* Time */}
                  {question.type === 'time' && (
                    <input
                      type="time"
                      value={answer?.value as string || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className="input-focus w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                      required={question.is_required}
                    />
                  )}
                </div>
              );
            })}

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 mt-8">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="btn-primary px-8 py-3 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
              >
                {submitMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit Form
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
