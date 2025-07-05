import os
import pickle
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import uuid
from datetime import datetime

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    faiss = None

from utils.logger import logger

class Document:
    """Represents a document chunk with metadata"""
    
    def __init__(self, content: str, metadata: Dict[str, Any] = None):
        self.id = str(uuid.uuid4())
        self.content = content
        self.metadata = metadata or {}
        self.created_at = datetime.now()
        self.embedding = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "has_embedding": self.embedding is not None
        }

class MockEmbeddings:
    """Mock embeddings for testing without OpenAI API"""
    
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate mock embeddings for documents"""
        embeddings = []
        for text in texts:
            # Simple hash-based mock embedding
            hash_val = hash(text)
            embedding = [
                (hash_val + i) % 1000 / 1000.0 
                for i in range(self.dimension)
            ]
            embeddings.append(embedding)
        return embeddings
    
    def embed_query(self, text: str) -> List[float]:
        """Generate mock embedding for a query"""
        return self.embed_documents([text])[0]

class FAISSVectorStore:
    """FAISS-based vector store for document embeddings"""
    
    def __init__(self, 
                 dimension: int = 1536,
                 index_type: str = "flat",
                 persist_directory: str = "./vector_store"):
        """
        Initialize FAISS vector store
        
        Args:
            dimension: Embedding dimension
            index_type: FAISS index type ("flat", "ivf")
            persist_directory: Directory to save the index
        """
        if not FAISS_AVAILABLE:
            raise ImportError("FAISS is not installed. Install with: pip install faiss-cpu")
        
        self.dimension = dimension
        self.index_type = index_type
        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(exist_ok=True)
        
        # Initialize FAISS index
        if index_type == "flat":
            self.index = faiss.IndexFlatL2(dimension)
        elif index_type == "ivf":
            quantizer = faiss.IndexFlatL2(dimension)
            self.index = faiss.IndexIVFFlat(quantizer, dimension, 100)
        else:
            raise ValueError(f"Unsupported index type: {index_type}")
        
        # Document storage
        self.documents: Dict[str, Document] = {}
        self.id_to_index: Dict[str, int] = {}
        self.index_to_id: Dict[int, str] = {}
        self.next_index = 0
        
        # Try to load existing index
        self.load_index()
        
        logger.info(f"Initialized FAISS vector store with {self.index.ntotal} documents")
    
    def add_documents(self, documents: List[Document], embeddings: List[List[float]]):
        """Add documents with their embeddings to the vector store"""
        if len(documents) != len(embeddings):
            raise ValueError("Number of documents must match number of embeddings")
        
        # Convert embeddings to numpy array
        embeddings_array = np.array(embeddings, dtype=np.float32)
        
        # Train index if needed (for IVF)
        if self.index_type == "ivf" and not self.index.is_trained:
            if embeddings_array.shape[0] >= 100:  # Need at least 100 vectors to train
                self.index.train(embeddings_array)
            else:
                logger.warning("Not enough documents to train IVF index, using flat index")
                self.index = faiss.IndexFlatL2(self.dimension)
        
        # Add to FAISS index
        start_index = self.next_index
        self.index.add(embeddings_array)
        
        # Store documents and mappings
        for i, doc in enumerate(documents):
            doc.embedding = embeddings[i]
            self.documents[doc.id] = doc
            
            index_pos = start_index + i
            self.id_to_index[doc.id] = index_pos
            self.index_to_id[index_pos] = doc.id
        
        self.next_index += len(documents)
        
        logger.info(f"Added {len(documents)} documents to vector store")
    
    def similarity_search(self, 
                         query_embedding: List[float], 
                         k: int = 5,
                         filter_metadata: Dict[str, Any] = None) -> List[Tuple[Document, float]]:
        """Search for similar documents"""
        if self.index.ntotal == 0:
            return []
        
        # Convert query to numpy array
        query_array = np.array([query_embedding], dtype=np.float32)
        
        # Search in FAISS
        distances, indices = self.index.search(query_array, min(k, self.index.ntotal))
        
        results = []
        for distance, index in zip(distances[0], indices[0]):
            if index == -1:  # FAISS returns -1 for invalid indices
                continue
                
            doc_id = self.index_to_id.get(index)
            if doc_id and doc_id in self.documents:
                doc = self.documents[doc_id]
                
                # Apply metadata filtering if specified
                if filter_metadata:
                    if not all(doc.metadata.get(k) == v for k, v in filter_metadata.items()):
                        continue
                
                results.append((doc, float(distance)))
        
        return results
    
    def get_document(self, doc_id: str) -> Optional[Document]:
        """Get a document by ID"""
        return self.documents.get(doc_id)
    
    def delete_document(self, doc_id: str) -> bool:
        """Delete a document (marks as deleted, doesn't remove from index)"""
        if doc_id in self.documents:
            del self.documents[doc_id]
            if doc_id in self.id_to_index:
                index_pos = self.id_to_index[doc_id]
                del self.id_to_index[doc_id]
                del self.index_to_id[index_pos]
            logger.info(f"Deleted document {doc_id}")
            return True
        return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get vector store statistics"""
        return {
            "total_documents": len(self.documents),
            "index_size": self.index.ntotal,
            "dimension": self.dimension,
            "index_type": self.index_type,
            "is_trained": getattr(self.index, 'is_trained', True)
        }
    
    def save_index(self):
        """Save the FAISS index and metadata to disk"""
        try:
            # Save FAISS index
            index_path = self.persist_directory / "faiss.index"
            faiss.write_index(self.index, str(index_path))
            
            # Save metadata
            metadata = {
                "documents": {doc_id: doc.to_dict() for doc_id, doc in self.documents.items()},
                "id_to_index": self.id_to_index,
                "index_to_id": self.index_to_id,
                "next_index": self.next_index,
                "dimension": self.dimension,
                "index_type": self.index_type
            }
            
            metadata_path = self.persist_directory / "metadata.pkl"
            with open(metadata_path, "wb") as f:
                pickle.dump(metadata, f)
            
            logger.info(f"Saved vector store to {self.persist_directory}")
            
        except Exception as e:
            logger.error(f"Failed to save vector store: {str(e)}")
    
    def load_index(self):
        """Load the FAISS index and metadata from disk"""
        try:
            index_path = self.persist_directory / "faiss.index"
            metadata_path = self.persist_directory / "metadata.pkl"
            
            if index_path.exists() and metadata_path.exists():
                # Load FAISS index
                self.index = faiss.read_index(str(index_path))
                
                # Load metadata
                with open(metadata_path, "rb") as f:
                    metadata = pickle.load(f)
                
                # Restore documents
                self.documents = {}
                for doc_id, doc_data in metadata["documents"].items():
                    doc = Document(doc_data["content"], doc_data["metadata"])
                    doc.id = doc_id
                    doc.created_at = datetime.fromisoformat(doc_data["created_at"])
                    self.documents[doc_id] = doc
                
                self.id_to_index = metadata["id_to_index"]
                self.index_to_id = metadata["index_to_id"]
                self.next_index = metadata["next_index"]
                
                logger.info(f"Loaded vector store with {len(self.documents)} documents")
                
        except Exception as e:
            logger.warning(f"Could not load existing vector store: {str(e)}")

class VectorStoreManager:
    """Manages vector store operations with different backends"""
    
    def __init__(self, 
                 store_type: str = "faiss",
                 dimension: int = 1536,
                 persist_directory: str = "./vector_store"):
        """
        Initialize vector store manager
        
        Args:
            store_type: Type of vector store ("faiss", "chromadb")
            dimension: Embedding dimension
            persist_directory: Directory to persist the store
        """
        self.store_type = store_type
        self.dimension = dimension
        self.persist_directory = persist_directory
        
        # Initialize embeddings (mock for now)
        self.embeddings = MockEmbeddings(dimension)
        
        # Initialize vector store
        if store_type == "faiss":
            self.store = FAISSVectorStore(dimension, persist_directory=persist_directory)
        else:
            raise ValueError(f"Unsupported store type: {store_type}")
        
        logger.info(f"Initialized vector store manager with {store_type}")
    
    def add_texts(self, 
                  texts: List[str], 
                  metadatas: List[Dict[str, Any]] = None) -> List[str]:
        """Add texts to the vector store"""
        if metadatas is None:
            metadatas = [{}] * len(texts)
        
        # Create documents
        documents = [
            Document(text, metadata) 
            for text, metadata in zip(texts, metadatas)
        ]
        
        # Generate embeddings
        embeddings = self.embeddings.embed_documents(texts)
        
        # Add to store
        self.store.add_documents(documents, embeddings)
        
        # Save the store
        self.store.save_index()
        
        return [doc.id for doc in documents]
    
    def similarity_search(self, 
                         query: str, 
                         k: int = 5,
                         filter_metadata: Dict[str, Any] = None) -> List[Tuple[str, float]]:
        """Search for similar documents"""
        query_embedding = self.embeddings.embed_query(query)
        results = self.store.similarity_search(query_embedding, k, filter_metadata)
        
        return [(doc.content, score) for doc, score in results]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get vector store statistics"""
        return self.store.get_stats()

# Global vector store manager
vector_store_manager = None

def get_vector_store() -> VectorStoreManager:
    """Get or create global vector store manager"""
    global vector_store_manager
    if vector_store_manager is None:
        store_type = os.getenv("VECTOR_DB_TYPE", "faiss")
        persist_dir = os.getenv("VECTOR_DB_PATH", "./vector_store")
        vector_store_manager = VectorStoreManager(store_type, persist_directory=persist_dir)
    return vector_store_manager
