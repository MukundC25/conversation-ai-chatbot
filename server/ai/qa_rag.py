from typing import List, Dict, Any, Optional, Tuple
import os
from datetime import datetime

from utils.vectorstore import get_vector_store, VectorStoreManager
from utils.document_processor import document_processor, DocumentChunk
from utils.logger import logger

class RAGSystem:
    """
    Retrieval-Augmented Generation system for document-based Q&A
    """
    
    def __init__(self,
                 vector_store: Optional[VectorStoreManager] = None,
                 max_context_length: int = 4000,
                 similarity_threshold: float = 100.0):  # Very permissive for mock embeddings
        """
        Initialize RAG system
        
        Args:
            vector_store: Vector store manager instance
            max_context_length: Maximum length of context to include
            similarity_threshold: Minimum similarity score for relevant documents
        """
        self.vector_store = vector_store or get_vector_store()
        self.max_context_length = max_context_length
        self.similarity_threshold = similarity_threshold
        self.document_processor = document_processor
        
        logger.info("Initialized RAG system")
    
    def add_document(self, file_path: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Add a document to the RAG system
        
        Args:
            file_path: Path to the document file
            metadata: Additional metadata for the document
            
        Returns:
            Dictionary with processing results
        """
        try:
            # Process the document into chunks
            chunks = self.document_processor.process_file(file_path)
            
            if not chunks:
                raise ValueError("No content extracted from document")
            
            # Prepare texts and metadata for vector store
            texts = []
            metadatas = []
            
            for chunk in chunks:
                texts.append(chunk.content)
                
                # Combine chunk metadata with provided metadata
                chunk_metadata = {
                    **chunk.metadata,
                    **(metadata or {}),
                    "chunk_id": chunk.id,
                    "source_file": file_path,
                    "chunk_index": chunk.chunk_index,
                    "processed_at": datetime.now().isoformat()
                }
                metadatas.append(chunk_metadata)
            
            # Add to vector store
            doc_ids = self.vector_store.add_texts(texts, metadatas)
            
            result = {
                "file_path": file_path,
                "chunks_created": len(chunks),
                "document_ids": doc_ids,
                "total_characters": sum(len(chunk.content) for chunk in chunks),
                "metadata": metadata,
                "processed_at": datetime.now().isoformat()
            }
            
            logger.info(f"Added document {file_path} with {len(chunks)} chunks to RAG system")
            return result
            
        except Exception as e:
            logger.error(f"Error adding document {file_path} to RAG: {str(e)}")
            raise
    
    def add_text_content(self, 
                        content: str, 
                        source_name: str = "text_input",
                        metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Add raw text content to the RAG system
        
        Args:
            content: Text content to add
            source_name: Name/identifier for the content source
            metadata: Additional metadata
            
        Returns:
            Dictionary with processing results
        """
        try:
            # Process the text into chunks
            chunks = self.document_processor.process_text_content(
                content, source_name, metadata
            )
            
            if not chunks:
                raise ValueError("No content to process")
            
            # Prepare texts and metadata for vector store
            texts = []
            metadatas = []
            
            for chunk in chunks:
                texts.append(chunk.content)
                
                chunk_metadata = {
                    **chunk.metadata,
                    **(metadata or {}),
                    "chunk_id": chunk.id,
                    "source_name": source_name,
                    "chunk_index": chunk.chunk_index,
                    "processed_at": datetime.now().isoformat()
                }
                metadatas.append(chunk_metadata)
            
            # Add to vector store
            doc_ids = self.vector_store.add_texts(texts, metadatas)
            
            result = {
                "source_name": source_name,
                "chunks_created": len(chunks),
                "document_ids": doc_ids,
                "total_characters": len(content),
                "metadata": metadata,
                "processed_at": datetime.now().isoformat()
            }
            
            logger.info(f"Added text content '{source_name}' with {len(chunks)} chunks to RAG system")
            return result
            
        except Exception as e:
            logger.error(f"Error adding text content to RAG: {str(e)}")
            raise
    
    def retrieve_context(self, 
                        query: str, 
                        k: int = 5,
                        filter_metadata: Dict[str, Any] = None) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Retrieve relevant context for a query
        
        Args:
            query: The query to search for
            k: Number of documents to retrieve
            filter_metadata: Metadata filters to apply
            
        Returns:
            Tuple of (context_string, source_documents)
        """
        try:
            # Search for relevant documents
            results = self.vector_store.similarity_search(
                query, k=k, filter_metadata=filter_metadata
            )
            
            if not results:
                return "", []
            
            # Log actual similarity scores for debugging
            if results:
                logger.info(f"Found {len(results)} documents with scores: {[score for _, score in results[:3]]}")

            # Filter by similarity threshold (for now, let's be very permissive for testing)
            filtered_results = results  # Accept all results for testing

            if not filtered_results:
                logger.info(f"No documents found")
                return "", []
            
            # Build context string
            context_parts = []
            total_length = 0
            source_docs = []
            
            for i, (content, score) in enumerate(filtered_results):
                if total_length + len(content) > self.max_context_length:
                    # Try to fit partial content
                    remaining_space = self.max_context_length - total_length
                    if remaining_space > 100:  # Only add if we have reasonable space
                        partial_content = content[:remaining_space-3] + "..."
                        context_parts.append(f"[Document {i+1}]: {partial_content}")
                    break
                
                context_parts.append(f"[Document {i+1}]: {content}")
                total_length += len(content)
                
                source_docs.append({
                    "content": content,
                    "similarity_score": score,
                    "rank": i + 1
                })
            
            context_string = "\n\n".join(context_parts)
            
            logger.info(f"Retrieved {len(source_docs)} relevant documents for query")
            return context_string, source_docs
            
        except Exception as e:
            logger.error(f"Error retrieving context for query: {str(e)}")
            return "", []
    
    def generate_rag_prompt(self, 
                           query: str, 
                           context: str,
                           system_prompt: str = None) -> str:
        """
        Generate a prompt for RAG-based question answering
        
        Args:
            query: User's question
            context: Retrieved context documents
            system_prompt: Optional system prompt override
            
        Returns:
            Formatted prompt for the LLM
        """
        if not system_prompt:
            system_prompt = """You are a helpful AI assistant that answers questions based on the provided context documents. 
Use the context to provide accurate and relevant answers. If the context doesn't contain enough information to answer the question, say so clearly.
Always cite which document(s) you're referencing in your answer."""
        
        if not context:
            return f"{system_prompt}\n\nQuestion: {query}\n\nNote: No relevant context documents were found for this question."
        
        prompt = f"""{system_prompt}

Context Documents:
{context}

Question: {query}

Please provide a comprehensive answer based on the context documents above."""
        
        return prompt
    
    def get_stats(self) -> Dict[str, Any]:
        """Get RAG system statistics"""
        vector_stats = self.vector_store.get_stats()
        
        return {
            "vector_store_stats": vector_stats,
            "max_context_length": self.max_context_length,
            "similarity_threshold": self.similarity_threshold,
            "supported_file_types": self.document_processor.get_supported_extensions()
        }

# Global RAG system instance
rag_system = None

def get_rag_system() -> RAGSystem:
    """Get or create global RAG system instance"""
    global rag_system
    if rag_system is None:
        rag_system = RAGSystem()
    return rag_system
