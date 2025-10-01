/**
 * 📝 **CHICKEN NOTE PROCESSOR COMPONENT**
 * Ready-to-use React component for processing chicken business notes
 */

import React, { useState } from 'react';
import { useMCPClient } from '../hooks/useMCPClient';
import { ChickenNote } from '../services/mcpClient';

interface ChickenNoteProcessorProps {
  branchId?: string;
  userId?: string;
  onNoteProcessed?: (note: ChickenNote, result: any) => void;
  className?: string;
}

export function ChickenNoteProcessor({ 
  branchId = 'default_branch',
  userId = 'current_user',
  onNoteProcessed,
  className = ''
}: ChickenNoteProcessorProps) {
  const [noteContent, setNoteContent] = useState('');
  const [result, setResult] = useState<any>(null);
  const { processNote, isLoading, isConnected } = useMCPClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!noteContent.trim()) return;

    const note: ChickenNote = {
      id: `note_${Date.now()}`,
      local_uuid: `local_${Date.now()}`,
      branch_id: branchId,
      author_id: userId,
      content: noteContent,
      user_role: 'owner',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    try {
      const response = await processNote(note);
      setResult(response);
      onNoteProcessed?.(note, response);
      
      if (response.success) {
        setNoteContent(''); // Clear form on success
      }
    } catch (error) {
      console.error('Note processing failed:', error);
      setResult({ success: false, error: 'Processing failed' });
    }
  };

  if (!isConnected) {
    return (
      <div className={`mcp-note-processor error ${className}`}>
        <h2>🐔 Chicken Note Processor</h2>
        <div className="connection-error">
          ❌ Not connected to MCP Server
          <p>Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`mcp-note-processor ${className}`}>
      <h2>🐔 Chicken Note Processor</h2>
      
      <form onSubmit={handleSubmit} className="note-form">
        <div className="form-group">
          <label htmlFor="note-content">Business Note:</label>
          <textarea
            id="note-content"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Enter your chicken business note...&#10;&#10;Examples:&#10;• Fed 20 chickens, collected 15 eggs&#10;• Sold 3 roosters to customer John&#10;• Need to order more feed next week"
            rows={6}
            disabled={isLoading}
            className="note-textarea"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading || !noteContent.trim()}
          className={`submit-button ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? '🔄 Processing...' : '🚀 Process Note'}
        </button>
      </form>

      {result && (
        <div className={`result ${result.success ? 'success' : 'error'}`}>
          <h3>📊 Processing Result:</h3>
          
          {result.success ? (
            <div className="success-content">
              <div className="parsed-data">
                {typeof result.result === 'string' ? (
                  <p>{result.result}</p>
                ) : (
                  <pre>{JSON.stringify(result.result, null, 2)}</pre>
                )}
              </div>
              
              {result.metadata && (
                <div className="metadata">
                  <small>
                    ⏱️ Processing time: {result.metadata.processingTime}ms
                    {result.metadata.model && ` | 🧠 Model: ${result.metadata.model}`}
                    {result.metadata.confidence && ` | 🎯 Confidence: ${Math.round((result.metadata.confidence || 0) * 100)}%`}
                  </small>
                </div>
              )}
            </div>
          ) : (
            <div className="error-content">
              ❌ Error: {result.error || 'Unknown error occurred'}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .mcp-note-processor {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f9f9f9;
        }

        .connection-error {
          text-align: center;
          padding: 20px;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 4px;
          color: #c00;
        }

        .note-form {
          margin: 20px 0;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }

        .note-textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-family: inherit;
          resize: vertical;
        }

        .note-textarea:focus {
          outline: none;
          border-color: #0070f3;
          box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.1);
        }

        .submit-button {
          background: #0070f3;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          transition: background 0.2s;
        }

        .submit-button:hover:not(:disabled) {
          background: #0051a2;
        }

        .submit-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .submit-button.loading {
          background: #ff6b35;
        }

        .result {
          margin-top: 20px;
          padding: 15px;
          border-radius: 4px;
        }

        .result.success {
          background: #e6f7e6;
          border: 1px solid #4caf50;
        }

        .result.error {
          background: #fee;
          border: 1px solid #f44336;
        }

        .result h3 {
          margin-top: 0;
          margin-bottom: 10px;
        }

        .parsed-data pre {
          background: white;
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 14px;
        }

        .metadata {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
        }

        .metadata small {
          color: #666;
        }

        .error-content {
          color: #c00;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}

export default ChickenNoteProcessor;