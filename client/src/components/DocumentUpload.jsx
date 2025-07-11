import React, { useState, useCallback } from 'react'
import { Upload, X, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { chatAPI } from '../utils/api'
import toast from 'react-hot-toast'

const DocumentUpload = ({ onClose, onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }, [])

  const handleChange = useCallback((e) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }, [])

  const handleFiles = async (files) => {
    const fileArray = Array.from(files)
    
    for (const file of fileArray) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type ${file.type} is not supported. Please upload PDF, TXT, or DOC files.`)
        continue
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`)
        continue
      }

      await uploadFile(file)
    }
  }

  const uploadFile = async (file) => {
    setUploading(true)
    try {
      const result = await chatAPI.uploadDocument(file)
      
      setUploadedFiles(prev => [...prev, {
        id: result.document_id,
        name: file.name,
        size: file.size,
        status: 'success'
      }])
      
      toast.success(`${file.name} uploaded successfully!`)
      
      if (onUploadSuccess) {
        onUploadSuccess(result)
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(`Failed to upload ${file.name}: ${error.message}`)
      
      setUploadedFiles(prev => [...prev, {
        id: Date.now(),
        name: file.name,
        size: file.size,
        status: 'error',
        error: error.message
      }])
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="glass-effect rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Upload Documents
          </h3>
          <motion.button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X size={20} />
          </motion.button>
        </div>

        <motion.div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
            dragActive
              ? 'border-blue-400 bg-blue-500/10 scale-105'
              : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/20'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          whileHover={{ scale: 1.02 }}
        >
          <motion.div
            animate={{ y: dragActive ? -5 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Upload className="mx-auto h-16 w-16 text-slate-400 mb-4" />
          </motion.div>
          <p className="text-sm text-slate-300 mb-2">
            Drag and drop files here, or{' '}
            <label className="text-blue-400 hover:text-blue-300 cursor-pointer font-medium">
              browse
              <input
                type="file"
                multiple
                onChange={handleChange}
                accept=".pdf,.txt,.doc,.docx"
                className="hidden"
              />
            </label>
          </p>
          <p className="text-xs text-slate-500">
            Supports PDF, TXT, DOC files up to 10MB
          </p>
        </motion.div>

        {uploadedFiles.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-medium text-slate-200">Uploaded Files</h4>
            <AnimatePresence>
              {uploadedFiles.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl border border-slate-600/50"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-slate-600/50 rounded-lg">
                      <FileText size={16} className="text-slate-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{file.name}</p>
                      <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {file.status === 'success' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <CheckCircle size={18} className="text-green-400" />
                      </motion.div>
                    )}
                    {file.status === 'error' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <AlertCircle size={18} className="text-red-400" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {uploading && (
          <motion.div
            className="mt-6 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <span className="ml-3 text-sm text-slate-300">Uploading...</span>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}

export default DocumentUpload
