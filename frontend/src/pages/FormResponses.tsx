import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formsAPI } from '../api/forms';
import { format } from 'date-fns';

export default function FormResponses() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['formGroupedAnswers', id],
    queryFn: () => formsAPI.getGroupedAnswers(Number(id))
  });

  const { data: results } = useQuery({
    queryKey: ['myResults'],
    queryFn: formsAPI.getMyResults
  });

  const formResults = results?.find((r: any) => r.form_id === Number(id));
  const responses = formResults?.responses || [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading responses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Form Responses</h1>
          <div className="space-x-4">
            <Link
              to={`/forms/${id}/responses/grouped`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              View Grouped
            </Link>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {responses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No responses yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {responses.map((response: any) => (
                <li key={response.response_id}>
                  <Link
                    to={`/responses/${response.response_id}`}
                    className="block hover:bg-gray-50 px-6 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {response.user_name || 'Anonymous'}
                        </p>
                        {response.user_email && (
                          <p className="text-sm text-gray-500">{response.user_email}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {format(new Date(response.submitted_at), 'PPpp')}
                        </p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            formsAPI.exportResponse(response.response_id).then((blob) => {
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `response-${response.response_id}.xlsx`;
                              a.click();
                            });
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Export XLSX
                        </button>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
