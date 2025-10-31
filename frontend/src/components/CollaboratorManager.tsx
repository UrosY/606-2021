import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formsAPI } from '../api/forms';
import type { Collaborator } from '../types';
import toast from 'react-hot-toast';

interface CollaboratorManagerProps {
  formId: number;
}

export default function CollaboratorManager({ formId }: CollaboratorManagerProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [showAddForm, setShowAddForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['collaborators', formId],
    queryFn: () => formsAPI.getCollaborators(formId),
  });

  const addMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      formsAPI.addCollaborator(formId, email, role),
    onSuccess: () => {
      toast.success('Collaborator added successfully!');
      setEmail('');
      setRole('viewer');
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ['collaborators', formId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add collaborator');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (collabId: number) => formsAPI.removeCollaborator(formId, collabId),
    onSuccess: () => {
      toast.success('Collaborator removed successfully!');
      queryClient.invalidateQueries({ queryKey: ['collaborators', formId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to remove collaborator');
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    addMutation.mutate({ email: email.trim(), role });
  };

  const handleRemove = (collabId: number, name: string) => {
    if (window.confirm(`Remove ${name} as collaborator?`)) {
      removeMutation.mutate(collabId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const isOwner = data?.isOwner ?? false;
  const collaborators = data?.collaborators ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-gray-900">Collaborators</h3>
        {isOwner && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Collaborator
          </button>
        )}
      </div>

      {/* Add Collaborator Form */}
      {showAddForm && isOwner && (
        <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="user@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="viewer">Viewer (can view responses only)</option>
                <option value="editor">Editor (can edit form and view responses)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {addMutation.isPending ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEmail('');
                  setRole('viewer');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Collaborators List */}
      {collaborators.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center bg-gray-50 rounded-lg border border-gray-200">
          No collaborators yet. {isOwner && 'Add someone to collaborate on this form.'}
        </p>
      ) : (
        <div className="space-y-2">
          {collaborators.map((collab) => (
            <div
              key={collab.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{collab.name || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{collab.email}</p>
              </div>
              <div className="flex items-center space-x-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    collab.role === 'editor'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {collab.role === 'editor' ? 'Editor' : 'Viewer'}
                </span>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemove(collab.id, collab.name || collab.email || 'this user')}
                    disabled={removeMutation.isPending}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                    title="Remove collaborator"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
