import React, { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, Settings, Trash2, Upload, FileText, Search } from 'lucide-react'
import { chatAPI } from '../utils/api'
import DocumentUpload from './DocumentUpload'

const ChatInterface = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date()
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [currentMode, setCurrentMode] = useState('assistant')
  const [availableModes, setAvailableModes] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [useRAG, setUseRAG] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)

  // Load available modes on component mount
  useEffect(() => {
    const loadModes = async () => {
      try {
        const modesData = await chatAPI.getModes()
        setAvailableModes(modesData.modes)
      } catch (error) {
        console.error('Failed to load chat modes:', error)
      }
    }
    loadModes()
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputText.trim() || isLoading) return

    const userMessage = {
      id: Date.now(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const messageText = inputText
    setInputText('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await chatAPI.sendMessage(
        messageText,
        sessionId,
        currentMode,
        useRAG
      )

      // Update session ID if this is the first message
      if (!sessionId) {
        setSessionId(response.session_id)
      }

      const botMessage = {
        id: Date.now() + 1,
        text: response.response,
        sender: 'bot',
        timestamp: new Date(response.timestamp),
        tokensUsed: response.tokens_used,
        memoryStats: response.memory_stats
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error) {
      console.error('Chat error:', error)
      setError('Failed to send message. Please try again.')

      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I encountered an error. Please try again.",
        sender: 'bot',
        timestamp: new Date(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearConversation = async () => {
    if (!sessionId) {
      // Just clear local messages if no session
      setMessages([{
        id: 1,
        text: "Hello! I'm your AI assistant. How can I help you today?",
        sender: 'bot',
        timestamp: new Date()
      }])
      return
    }

    try {
      await chatAPI.clearSessionMemory(sessionId)
      setMessages([{
        id: 1,
        text: "Conversation cleared! How can I help you today?",
        sender: 'bot',
        timestamp: new Date()
      }])
    } catch (error) {
      console.error('Failed to clear conversation:', error)
      setError('Failed to clear conversation')
    }
  }

  const handleModeChange = (newMode) => {
    setCurrentMode(newMode)
    setShowSettings(false)

    const modeInfo = availableModes.find(mode => mode.id === newMode)
    const modeMessage = {
      id: Date.now(),
      text: `Switched to ${modeInfo?.name || newMode} mode. ${modeInfo?.description || ''}`,
      sender: 'bot',
      timestamp: new Date(),
      isSystemMessage: true
    }
    setMessages(prev => [...prev, modeMessage])
  }

  const handleUploadSuccess = (result) => {
    const uploadMessage = {
      id: Date.now(),
      text: `📄 Document "${result.filename}" uploaded successfully! ${result.processing_info?.chunks_created || 0} chunks created. You can now ask questions about this document.`,
      sender: 'bot',
      timestamp: new Date(),
      isSystemMessage: true
    }
    setMessages(prev => [...prev, uploadMessage])
    setShowUpload(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-lg shadow-lg">
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {availableModes.find(mode => mode.id === currentMode)?.name || 'Chat'}
          </h2>
          {sessionId && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Session: {sessionId.slice(0, 8)}...
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setUseRAG(!useRAG)}
            className={`p-2 rounded-lg transition-colors ${
              useRAG
                ? 'text-primary-600 bg-primary-100 hover:bg-primary-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title={useRAG ? "RAG enabled - AI will search documents" : "RAG disabled - Normal chat"}
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Upload documents"
          >
            <Upload size={18} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={handleClearConversation}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Clear conversation"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* RAG Status Indicator */}
      {useRAG && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center space-x-2">
            <FileText size={16} className="text-blue-600" />
            <span className="text-sm text-blue-700 font-medium">
              Document Search Enabled
            </span>
            <span className="text-xs text-blue-600">
              AI will search uploaded documents to answer your questions
            </span>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700 mr-2">Mode:</span>
              {availableModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => handleModeChange(mode.id)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    currentMode === mode.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {mode.name}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Document Search (RAG)</span>
              <button
                onClick={() => setUseRAG(!useRAG)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useRAG ? 'bg-primary-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useRAG ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${
              message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            } ${message.isSystemMessage ? 'justify-center' : ''}`}
          >
            {!message.isSystemMessage && (
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.sender === 'user'
                  ? 'bg-primary-500 text-white'
                  : message.isError
                  ? 'bg-red-200 text-red-600'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {message.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
            )}

            <div className={`${
              message.isSystemMessage
                ? 'bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs'
                : `chat-bubble ${
                    message.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'
                  } ${message.isError ? 'border-red-200 bg-red-50' : ''}`
            }`}>
              <p className={message.isSystemMessage ? '' : 'text-sm'}>{message.text}</p>
              {!message.isSystemMessage && (
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-xs ${
                    message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                  {message.tokensUsed && (
                    <span className="text-xs text-gray-400 ml-2">
                      {message.tokensUsed} tokens
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        
        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div className="chat-bubble chat-bubble-bot">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </form>
      </div>

      {/* Document Upload Modal */}
      {showUpload && (
        <DocumentUpload
          onUploadSuccess={handleUploadSuccess}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}

export default ChatInterface
