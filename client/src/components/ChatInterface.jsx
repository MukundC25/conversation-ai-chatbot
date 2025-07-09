import React, { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, Settings, Trash2, Upload, FileText, Search, Sparkles, Brain, Headphones } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast, { Toaster } from 'react-hot-toast'
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
  const [availableModes, setAvailableModes] = useState([
    { id: 'assistant', name: 'Assistant', description: 'General AI assistant', icon: Sparkles },
    { id: 'developer', name: 'Developer', description: 'Coding & technical help', icon: Brain },
    { id: 'support', name: 'Support', description: 'Customer service agent', icon: Headphones }
  ])
  const [showSettings, setShowSettings] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [useRAG, setUseRAG] = useState(false)
  const [error, setError] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  // Load available modes on component mount
  useEffect(() => {
    const loadModes = async () => {
      try {
        const modesData = await chatAPI.getModes()
        // Merge with default modes to get icons
        const mergedModes = modesData.modes.map(mode => {
          const defaultMode = availableModes.find(m => m.id === mode.id)
          return { ...mode, icon: defaultMode?.icon || Sparkles }
        })
        setAvailableModes(mergedModes)
      } catch (error) {
        console.error('Failed to load chat modes:', error)
        toast.error('Failed to load chat modes')
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
    setIsTyping(true)
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
        toast.success('New conversation started!')
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

      if (useRAG) {
        toast.success('Response generated using your documents!')
      }
    } catch (error) {
      console.error('Chat error:', error)
      toast.error('Failed to send message. Please try again.')

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
      setIsTyping(false)
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
    toast.success(`Switched to ${modeInfo?.name || newMode} mode`)

    const modeMessage = {
      id: Date.now(),
      text: `🔄 Switched to ${modeInfo?.name || newMode} mode. ${modeInfo?.description || ''}`,
      sender: 'bot',
      timestamp: new Date(),
      isSystemMessage: true
    }
    setMessages(prev => [...prev, modeMessage])
  }

  const handleUploadSuccess = (result) => {
    toast.success(`Document "${result.filename}" uploaded successfully!`)

    const uploadMessage = {
      id: Date.now(),
      text: `📄 Document "${result.filename}" uploaded successfully! ${result.processing_info?.chunks_created || 0} chunks created. You can now ask questions about this document.`,
      sender: 'bot',
      timestamp: new Date(),
      isSystemMessage: true
    }
    setMessages(prev => [...prev, uploadMessage])
    setShowUpload(false)

    // Auto-enable RAG when document is uploaded
    if (!useRAG) {
      setUseRAG(true)
      toast.info('Document search enabled automatically!')
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <Toaster position="top-right" />

      {/* Enhanced Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-lg shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.div
              animate={{ rotate: isTyping ? 360 : 0 }}
              transition={{ duration: 2, repeat: isTyping ? Infinity : 0 }}
            >
              <Bot size={24} className="text-white" />
            </motion.div>
            <div>
              <h2 className="text-lg font-semibold">
                Conversational AI
              </h2>
              <p className="text-sm text-blue-100">
                Powered by Google Gemini
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setUseRAG(!useRAG)}
              className={`p-2 rounded-lg transition-colors ${
                useRAG
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
              title={useRAG ? "Document search enabled" : "Enable document search"}
            >
              <Search size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUpload(true)}
              className="p-2 bg-white/10 text-white/70 hover:bg-white/20 rounded-lg transition-colors"
              title="Upload documents"
            >
              <Upload size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClearConversation}
              className="p-2 bg-white/10 text-white/70 hover:bg-red-400/20 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <Trash2 size={18} />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Mode Selector - Always Visible */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border-b border-gray-200 p-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Mode:</span>
            <div className="flex space-x-1">
              {availableModes.map((mode) => {
                const IconComponent = mode.icon
                return (
                  <motion.button
                    key={mode.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleModeChange(mode.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentMode === mode.id
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={mode.description}
                  >
                    <IconComponent size={16} />
                    <span>{mode.name}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* RAG Status */}
          {useRAG && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center space-x-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs"
            >
              <FileText size={14} />
              <span>Document Search Active</span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-container bg-gradient-to-b from-gray-50 to-white">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`flex items-start space-x-3 ${
                message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              } ${message.isSystemMessage ? 'justify-center' : ''}`}
            >
              {!message.isSystemMessage && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                      : message.isError
                      ? 'bg-red-200 text-red-600'
                      : 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600'
                  }`}
                >
                  {message.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
                </motion.div>
              )}

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className={`${
                  message.isSystemMessage
                    ? 'bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 px-4 py-2 rounded-full text-sm shadow-sm'
                    : `max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-md ${
                        message.sender === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white ml-auto'
                          : message.isError
                          ? 'border-red-200 bg-red-50 text-red-700 mr-auto'
                          : 'bg-white text-gray-900 mr-auto border border-gray-200'
                      }`
                }`}
              >
                <p className={message.isSystemMessage ? '' : 'text-sm leading-relaxed'}>{message.text}</p>
                {!message.isSystemMessage && (
                  <div className="flex items-center justify-between mt-2">
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
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex items-start space-x-3"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600 flex items-center justify-center shadow-md">
                <Bot size={18} />
              </div>
              <div className="bg-white text-gray-900 px-4 py-3 rounded-2xl shadow-md border border-gray-200">
                <div className="flex space-x-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-gray-400 rounded-full"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

      {/* Enhanced Input Form */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-t border-gray-200 bg-white p-4"
      >
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={useRAG ? "Ask about your documents..." : "Type your message..."}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
              disabled={isLoading}
            />
            {useRAG && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <FileText size={16} className="text-green-500" />
              </div>
            )}
          </div>
          <motion.button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg transition-all duration-200"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Bot size={18} />
              </motion.div>
            ) : (
              <Send size={18} />
            )}
            <span>{isLoading ? 'Sending...' : 'Send'}</span>
          </motion.button>
        </form>
      </motion.div>

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
