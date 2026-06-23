/**
 * Presentational Component: NoteForm
 * 
 * Form for creating or editing a note.
 */

'use client';

import { useState, FormEvent } from 'react';

interface NoteFormProps {
  initialTitle?: string;
  initialContent?: string;
  onSubmit: (title: string, content: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function NoteForm({
  initialTitle = '',
  initialContent = '',
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}: NoteFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit(title.trim(), content.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Title *
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Enter note title"
          required
          maxLength={200}
        />
      </div>

      <div>
        <label
          htmlFor="content"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Content
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[200px]"
          placeholder="Enter note content"
        />
      </div>

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
