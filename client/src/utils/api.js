const API_BASE_URL = '/api'

export const chatAPI = {
  // Send a chat message
  sendMessage: async (message, sessionId = null, mode = 'assistant', useRAG = false) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          session_id: sessionId,
          mode,
          use_rag: useRAG
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  },

  // Get chat history
  getHistory: async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/history/${sessionId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting chat history:', error)
      throw error
    }
  },

  // Clear chat history
  clearHistory: async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/clear/${sessionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error clearing chat history:', error)
      throw error
    }
  },

  // Upload document
  uploadDocument: async (file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error uploading document:', error)
      throw error
    }
  },

  // Get uploaded documents
  getDocuments: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting documents:', error)
      throw error
    }
  },

  // Delete document
  deleteDocument: async (documentId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  },

  // Health check
  healthCheck: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error checking health:', error)
      throw error
    }
  }
}

export default chatAPI
