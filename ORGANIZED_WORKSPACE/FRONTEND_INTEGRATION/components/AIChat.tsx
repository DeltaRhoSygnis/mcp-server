/**
 * 💬 **AI CHAT COMPONENT**
 * Ready-to-use React component for AI chat functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import { useMCPChat } from '../hooks/useMCPClient';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface AIChatProps {
  userId?: string;
  userRole?: 'owner' | 'worker' | 'customer';
  placeholder?: string;
  maxMessages?: number;
  className?: string;
  onMessage?: (message: ChatMessage) => void;
}

export function AIChat({
  userId = 'current_user',
  userRole = 'owner',
  placeholder = 'Ask your AI assistant...',
  maxMessages = 50,
  className = '',
  onMessage
}: AIChatProps) {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { 
    messages, 
    sendMessage, 
    isConnected, 
    isTyping,
    messageCount 
  } = useMCPChat({ 
    userId, 
    maxMessages,
    autoConnect: true 
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Notify parent component of new messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      onMessage?.(lastMessage);
    }
  }, [messages, onMessage]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isConnected) return;

    const messageToSend = inputMessage.trim();
    setInputMessage('');

    try {
      await sendMessage(messageToSend, userRole);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Re-add message to input if sending failed
      setInputMessage(messageToSend);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isConnected) {
    return (
      <div className={`ai-chat disconnected ${className}`}>
        <div className="connection-status error">
          🔴 Disconnected from AI Chat
          <p>Please check your connection and refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ai-chat ${className}`}>
      <div className="chat-header">
        <h3>💬 AI Assistant</h3>
        <div className="connection-status connected">
          🟢 Connected ({messageCount} messages)
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <p>👋 Hello! I'm your AI assistant for chicken business management.</p>
            <p>Ask me about:</p>
            <ul>
              <li>🐔 Chicken care and feeding</li>
              <li>🥚 Egg production optimization</li>
              <li>📊 Business insights and forecasting</li>
              <li>💰 Sales and inventory management</li>
            </ul>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-content">
                {msg.content}
              </div>
              <div className="message-time">
                {formatTime(msg.timestamp)}
              </div>
            </div>
          ))
        )}

        {isTyping && (
          <div className="message assistant typing">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="input-container">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={!isConnected}
            rows={1}
            className="message-input"
          />
          <button 
            onClick={handleSendMessage}
            disabled={!isConnected || !inputMessage.trim() || isTyping}
            className="send-button"
          >
            {isTyping ? '⏳' : '📤'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .ai-chat {
          display: flex;
          flex-direction: column;
          height: 500px;
          max-width: 600px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: white;
          overflow: hidden;
        }

        .ai-chat.disconnected {
          height: auto;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #ddd;
        }

        .chat-header h3 {
          margin: 0;
          color: #333;
        }

        .connection-status {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .connection-status.connected {
          background: #e6f7e6;
          color: #2e7d32;
        }

        .connection-status.error {
          background: #fee;
          color: #c00;
          text-align: center;
          padding: 20px;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .welcome-message {
          text-align: center;
          color: #666;
          padding: 20px;
        }

        .welcome-message ul {
          text-align: left;
          display: inline-block;
          margin: 10px 0;
        }

        .welcome-message li {
          margin: 5px 0;
        }

        .message {
          display: flex;
          flex-direction: column;
          max-width: 80%;
        }

        .message.user {
          align-self: flex-end;
          align-items: flex-end;
        }

        .message.assistant {
          align-self: flex-start;
          align-items: flex-start;
        }

        .message-content {
          padding: 12px 16px;
          border-radius: 18px;
          word-wrap: break-word;
          white-space: pre-wrap;
        }

        .message.user .message-content {
          background: #0070f3;
          color: white;
        }

        .message.assistant .message-content {
          background: #f1f3f4;
          color: #333;
        }

        .message-time {
          font-size: 11px;
          color: #999;
          margin: 4px 8px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #999;
          animation: typing 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }

        .input-area {
          padding: 15px 20px;
          border-top: 1px solid #ddd;
          background: #f8f9fa;
        }

        .input-container {
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }

        .message-input {
          flex: 1;
          padding: 10px 15px;
          border: 1px solid #ddd;
          border-radius: 20px;
          resize: none;
          min-height: 20px;
          max-height: 100px;
          font-family: inherit;
          outline: none;
        }

        .message-input:focus {
          border-color: #0070f3;
          box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.1);
        }

        .send-button {
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 50%;
          background: #0070f3;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: background 0.2s;
        }

        .send-button:hover:not(:disabled) {
          background: #0051a2;
        }

        .send-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default AIChat;