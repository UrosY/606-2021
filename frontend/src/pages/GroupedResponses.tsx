import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formsAPI } from '../api/forms';

export default function GroupedResponses() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['formGroupedAnswers', id],
    queryFn: () => formsAPI.getGroupedAnswers(Number(id))
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading grouped responses...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-600">Data not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Grouped Responses</h1>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Back
          </button>
        </div>

        <div className="space-y-8">
          {data.questions.map((question: any, index: number) => (
            <div key={question.id} className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {index + 1}. {question.text}
              </h3>

              {question.imageBase64 && (
                <img
                  src={question.imageBase64}
                  alt="Question"
                  className="mb-4 max-w-md rounded border"
                />
              )}

              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Responses: {question.answers.length}
                </p>

                {question.type === 'single_choice' || question.type === 'multiple_choice' ? (
                  <div className="space-y-2">
                    {/* Calculate option frequency */}
                    {(() => {
                      const optionCounts: Record<string, number> = {};
                      question.answers.forEach((a: any) => {
                        a.selectedOptionTexts?.forEach((text: string) => {
                          optionCounts[text] = (optionCounts[text] || 0) + 1;
                        });
                      });
                      return Object.entries(optionCounts).map(([option, count]) => (
                        <div key={option} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-900">{option}</span>
                          <span className="text-gray-600">
                            {count} ({((count / question.answers.length) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {question.answers.map((answer: any, aIndex: number) => (
                      <div key={aIndex} className="p-3 bg-gray-50 rounded">
                        <p className="text-gray-900">{answer.answer_text || 'No answer'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          By: {answer.user_name || 'Anonymous'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
