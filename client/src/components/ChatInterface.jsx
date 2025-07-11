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
    <div className="flex flex-col h-[calc(100vh-140px)] glass-effect rounded-2xl shadow-2xl overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
          },
        }}
      />

      {/* Enhanced Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <motion.div
              animate={{ rotate: isTyping ? 360 : 0 }}
              transition={{ duration: 2, repeat: isTyping ? Infinity : 0 }}
              className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center"
            >
              <Bot size={20} className="text-white" />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Conversational AI
              </h2>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <p className="text-sm text-slate-400">
                  Powered by Gemini
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setUseRAG(!useRAG)}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                useRAG
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white'
              }`}
              title={useRAG ? "Document search enabled" : "Enable document search"}
            >
              <Search size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUpload(true)}
              className="p-2.5 bg-slate-700/50 text-slate-400 hover:bg-slate-600/50 hover:text-white rounded-xl transition-all duration-200"
              title="Upload documents"
            >
              <Upload size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClearConversation}
              className="p-2.5 bg-slate-700/50 text-slate-400 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all duration-200"
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
        transition={{ delay: 0.2 }}
        className="bg-slate-800/30 border-b border-slate-700/50 p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-slate-300">Mode:</span>
            <div className="flex space-x-2">
              {availableModes.map((mode, index) => {
                const IconComponent = mode.icon
                return (
                  <motion.button
                    key={mode.id}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleModeChange(mode.id)}
                    className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      currentMode === mode.id
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white border border-slate-600/50'
                    }`}
                    title={mode.description}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    <IconComponent size={16} />
                    <span>{mode.name}</span>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* RAG Status */}
          <AnimatePresence>
            {useRAG && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 px-3 py-2 rounded-xl text-xs border border-green-500/30"
              >
                <FileText size={14} />
                <span>Document Search Active</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 chat-container bg-gradient-to-b from-slate-900/50 to-slate-800/30">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className={`flex items-start space-x-4 ${
                message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              } ${message.isSystemMessage ? 'justify-center' : ''}`}
            >
              {!message.isSystemMessage && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 500, damping: 30 }}
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : message.isError
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                      : 'bg-gradient-to-r from-slate-600 to-slate-700 text-slate-200'
                  }`}
                >
                  {message.sender === 'user' ? <User size={18} /> : <Bot size={18} />}
                </motion.div>
              )}

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 25 }}
                className={`${
                  message.isSystemMessage
                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 px-4 py-2 rounded-xl text-sm shadow-lg border border-blue-500/30'
                    : `max-w-xs lg:max-w-md px-5 py-4 rounded-2xl shadow-lg backdrop-blur-sm ${
                        message.sender === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white ml-auto'
                          : message.isError
                          ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30 text-red-300 mr-auto'
                          : 'bg-slate-800/80 text-slate-100 mr-auto border border-slate-700/50'
                      }`
                }`}
              >
                <p className={message.isSystemMessage ? '' : 'text-sm leading-relaxed'}>{message.text}</p>
                {!message.isSystemMessage && (
                  <div className="flex items-center justify-between mt-3">
                    <p className={`text-xs ${
                      message.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                    {message.tokensUsed && (
                      <span className="text-xs text-slate-500 ml-2">
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
              className="flex items-start space-x-4"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 text-slate-200 flex items-center justify-center shadow-lg">
                <Bot size={18} />
              </div>
              <div className="bg-slate-800/80 text-slate-100 px-5 py-4 rounded-2xl shadow-lg border border-slate-700/50 backdrop-blur-sm">
                <div className="flex space-x-1">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                    className="w-2 h-2 bg-slate-400 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-slate-400 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-slate-400 rounded-full"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Input Form */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="border-t border-slate-700/50 bg-slate-800/50 backdrop-blur-xl p-6"
      >
        <form onSubmit={handleSendMessage} className="flex space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={useRAG ? "Ask about your documents..." : "Type your message..."}
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-5 py-4 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 backdrop-blur-sm"
              disabled={isLoading}
            />
            {useRAG && (
              <motion.div
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <FileText size={18} className="text-green-400" />
              </motion.div>
            )}
          </div>
          <motion.button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3 shadow-lg shadow-blue-500/25 transition-all duration-200"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Bot size={20} />
              </motion.div>
            ) : (
              <Send size={20} />
            )}
            <span className="font-medium">{isLoading ? 'Sending...' : 'Send'}</span>
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
