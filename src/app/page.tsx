/**
 * Next.js Page: Home
 * 
 * Main entry point for the application UI.
 */

'use client';

import { useState, useEffect } from 'react';
import { NoteOutputDTO } from '@/application/dtos/NoteDTO';
import { notesApi } from '@/interfaces/http/apiRoutes';
import { NoteCard } from '@/interfaces/components/NoteCard';
import { NoteForm } from '@/interfaces/components/NoteForm';
import { SearchBar } from '@/interfaces/components/SearchBar';

export default function HomePage() {
  const [notes, setNotes] = useState<NoteOutputDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteOutputDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = async (searchQuery?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const url = searchQuery
        ? notesApi.search(searchQuery)
        : notesApi.collection();
      const response = await fetch(url);
      const result = await response.json();

      if (response.ok) {
        setNotes(result.data.notes);
      } else {
        setError(result.error?.message || 'Failed to fetch notes');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleCreateNote = async (title: string, content: string) => {
    try {
      const response = await fetch(notesApi.collection(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      const result = await response.json();

      if (response.ok) {
        setIsCreating(false);
        fetchNotes();
      } else {
        setError(result.error?.message || 'Failed to create note');
      }
    } catch (err) {
      setError('Failed to create note');
    }
  };

  const handleUpdateNote = async (title: string, content: string) => {
    if (!editingNote) return;

    try {
      const response = await fetch(notesApi.resource(editingNote.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      const result = await response.json();

      if (response.ok) {
        setEditingNote(null);
        fetchNotes();
      } else {
        setError(result.error?.message || 'Failed to update note');
      }
    } catch (err) {
      setError('Failed to update note');
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const response = await fetch(notesApi.resource(id), {
        method: 'DELETE',
      });

      // A successful delete returns 204 No Content (empty body).
      if (response.ok) {
        fetchNotes();
      } else {
        const result = await response.json().catch(() => null);
        setError(result?.error?.message || 'Failed to delete note');
      }
    } catch (err) {
      setError('Failed to delete note');
    }
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      fetchNotes(query);
    } else {
      fetchNotes();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Notes Demo</h1>
          <p className="text-gray-600">
            A clean architecture note-taking application
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 text-sm mt-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Create/Edit Form */}
        {(isCreating || editingNote) && (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">
              {editingNote ? 'Edit Note' : 'Create New Note'}
            </h2>
            <NoteForm
              initialTitle={editingNote?.title}
              initialContent={editingNote?.content}
              onSubmit={editingNote ? handleUpdateNote : handleCreateNote}
              onCancel={() => {
                setIsCreating(false);
                setEditingNote(null);
              }}
              submitLabel={editingNote ? 'Update' : 'Create'}
            />
          </div>
        )}

        {/* Actions Bar */}
        {!isCreating && !editingNote && (
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchBar onSearch={handleSearch} />
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              + New Note
            </button>
          </div>
        )}

        {/* Notes Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading notes...</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-4 text-gray-600 text-lg">No notes yet</p>
            <p className="text-gray-500">
              Create your first note to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={setEditingNote}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>Built with Next.js, TypeScript, Tailwind CSS & Clean Architecture</p>
        </footer>
      </div>
    </main>
  );
}
