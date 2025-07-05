import axios from 'axios'

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// Chat API functions
export const chatAPI = {
  // Send a chat message
  sendMessage: async (message, sessionId = null, mode = 'assistant', useRag = false) => {
    const response = await api.post('/chat', {
      message,
      session_id: sessionId,
      mode,
      use_rag: useRag,
      memory_type: 'buffer_window'
    })
    return response.data
  },

  // Get available chat modes
  getModes: async () => {
    const response = await api.get('/chat/modes')
    return response.data
  },

  // Get active sessions
  getSessions: async () => {
    const response = await api.get('/chat/sessions')
    return response.data
  },

  // Get session info
  getSessionInfo: async (sessionId) => {
    const response = await api.get(`/chat/sessions/${sessionId}`)
    return response.data
  },

  // Clear session
  clearSession: async (sessionId) => {
    const response = await api.delete(`/chat/sessions/${sessionId}`)
    return response.data
  },

  // Clear session memory
  clearSessionMemory: async (sessionId) => {
    const response = await api.post(`/chat/sessions/${sessionId}/clear`)
    return response.data
  }
}

// Upload API functions
export const uploadAPI = {
  // Upload a document
  uploadDocument: async (file, onProgress = null) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          onProgress(percentCompleted)
        }
      },
    })
    return response.data
  },

  // Get uploaded documents
  getDocuments: async () => {
    const response = await api.get('/documents')
    return response.data
  },

  // Delete a document
  deleteDocument: async (fileId) => {
    const response = await api.delete(`/documents/${fileId}`)
    return response.data
  },

  // Get document info
  getDocumentInfo: async (fileId) => {
    const response = await api.get(`/documents/${fileId}/info`)
    return response.data
  }
}

// Health check
export const healthAPI = {
  check: async () => {
    const response = await api.get('/health')
    return response.data
  }
}

export default api
