/**
 * Presentational Component: NoteCard
 * 
 * Displays a single note in card format.
 */

import { NoteOutputDTO } from '@/application/dtos/NoteDTO';

interface NoteCardProps {
  note: NoteOutputDTO;
  onEdit?: (note: NoteOutputDTO) => void;
  onDelete?: (id: string) => void;
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-semibold text-gray-900">{note.title}</h3>
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(note)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              aria-label="Edit note"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(note.id)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
              aria-label="Delete note"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      
      <p className="text-gray-700 mb-4 whitespace-pre-wrap line-clamp-3">
        {note.content || <span className="text-gray-400 italic">No content</span>}
      </p>
      
      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>{note.wordCount} words</span>
        <span>Updated {formatDate(note.updatedAt)}</span>
      </div>
    </div>
  );
}
