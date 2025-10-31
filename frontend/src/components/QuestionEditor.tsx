import { useState } from 'react';
import type { Question, QuestionType } from '../types';

interface Props {
  question: Question;
  index: number;
  onUpdate: (index: number, question: Question) => void;
  onDelete: (index: number) => void;
  onClone: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'short_text', label: 'Short Text (512 chars)' },
  { value: 'long_text', label: 'Long Text (4096 chars)' },
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'numeric', label: 'Numeric' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' }
];

export default function QuestionEditor({
  question,
  index,
  onUpdate,
  onDelete,
  onClone,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: Props) {
  const [showImageUpload, setShowImageUpload] = useState(false);

  const handleChange = (field: keyof Question, value: any) => {
    onUpdate(index, { ...question, [field]: value });
  };

  const handleTypeChange = (newType: QuestionType) => {
    const updated: Question = {
      ...question,
      type: newType,
      options: (newType === 'single_choice' || newType === 'multiple_choice') ? (question.options || ['']) : undefined,
      numericConfig: newType === 'numeric' ? { mode: 'list', values: [] } : undefined
    };
    onUpdate(index, updated);
  };

  const addOption = () => {
    const options = question.options || [];
    handleChange('options', [...options, '']);
  };

  const updateOption = (optIndex: number, value: string) => {
    const options = [...(question.options || [])];
    options[optIndex] = value;
    handleChange('options', options);
  };

  const removeOption = (optIndex: number) => {
    const options = (question.options || []).filter((_, i) => i !== optIndex);
    handleChange('options', options);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        // Update both image and imageBase64 together to avoid race condition
        onUpdate(index, {
          ...question,
          image: file,
          imageBase64: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    // Update both fields together to avoid race condition
    onUpdate(index, {
      ...question,
      image: null,
      imageBase64: null
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 hover:border-purple-300 transition-colors">
      {/* Header with controls */}
      <div className="flex justify-between items-start pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg">
            <span className="text-sm font-bold text-purple-600">{index + 1}</span>
          </div>
          <span className="text-sm font-medium text-gray-700">Question {index + 1}</span>
        </div>
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={!canMoveUp}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md disabled:text-gray-200 disabled:cursor-not-allowed transition-colors"
            title="Move up"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={!canMoveDown}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md disabled:text-gray-200 disabled:cursor-not-allowed transition-colors"
            title="Move down"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onClone(index)}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
            title="Clone question"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Delete question"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Question Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question Text *
        </label>
        <input
          type="text"
          value={question.text}
          onChange={(e) => handleChange('text', e.target.value)}
          className="input-focus w-full px-4 py-2.5 border border-gray-300 rounded-lg"
          placeholder="Enter your question"
          required
        />
      </div>

      {/* Question Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question Type
        </label>
        <select
          value={question.type}
          onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
          className="input-focus w-full px-4 py-2.5 border border-gray-300 rounded-lg"
        >
          {QUESTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Type-specific options */}
      {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Options
          </label>
          <div className="space-y-2">
            {(question.options || []).map((option, optIndex) => (
              <div key={optIndex} className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white border border-gray-300 rounded-full text-xs text-gray-600">
                  {optIndex + 1}
                </span>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(optIndex, e.target.value)}
                  className="input-focus flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white"
                  placeholder={`Option ${optIndex + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeOption(optIndex)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addOption}
            className="mt-3 px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            + Add Option
          </button>
        </div>
      )}

      {question.type === 'numeric' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Numeric questions will accept number inputs. You can optionally define a range (e.g., -4 to 20 step 3 generates: -4, -1, 2, 5, 8, 11, 14, 17, 20).
          </p>
        </div>
      )}

      {/* Image Upload */}
      <div className="pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setShowImageUpload(!showImageUpload)}
          className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {question.imageBase64 || question.image ? 'Change Image' : 'Add Image'}
        </button>

        {showImageUpload && (
          <div className="mt-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
            />
          </div>
        )}

        {question.imageBase64 && (
          <div className="mt-3 relative inline-block">
            <img
              src={question.imageBase64}
              alt="Question"
              className="max-w-xs max-h-48 rounded-lg border border-gray-200 shadow-sm"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 shadow-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Required Checkbox */}
      <div className="flex items-center pt-2">
        <input
          type="checkbox"
          id={`required-${index}`}
          checked={question.required}
          onChange={(e) => handleChange('required', e.target.checked)}
          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
        />
        <label htmlFor={`required-${index}`} className="ml-2 block text-sm text-gray-700 cursor-pointer">
          Required question
        </label>
      </div>
    </div>
  );
}
