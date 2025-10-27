import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formsAPI } from '../api/forms';

export default function ResponseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['response', id],
    queryFn: () => formsAPI.getResponseDetail(Number(id))
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading response...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-600">Response not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Response Detail</h1>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Back
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">{data.response.form_title}</h2>
          <p className="text-sm text-gray-600">
            Submitted by: {data.response.user_name || 'Anonymous'}
          </p>
          <p className="text-sm text-gray-600">
            Submitted at: {new Date(data.response.submitted_at).toLocaleString()}
          </p>
        </div>

        <div className="space-y-6">
          {data.questions.map((question: any, index: number) => (
            <div key={question.id} className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                {index + 1}. {question.text}
              </h3>

              {question.questionImageBase64 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Question Image:</p>
                  <img
                    src={question.questionImageBase64}
                    alt="Question"
                    className="max-w-md rounded border border-gray-200 shadow-sm"
                  />
                </div>
              )}

              <div className="mt-2">
                <p className="text-sm font-medium text-gray-700 mb-1">Answer:</p>
                {question.type === 'single_choice' || question.type === 'multiple_choice' ? (
                  <p className="text-gray-900">{question.answer || 'No answer'}</p>
                ) : (
                  <p className="text-gray-900">{question.answer || 'No answer'}</p>
                )}
              </div>

              {question.answerImageBase64 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Answer Image:</p>
                  <img
                    src={question.answerImageBase64}
                    alt="Answer"
                    className="max-w-md rounded border border-gray-200 shadow-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
