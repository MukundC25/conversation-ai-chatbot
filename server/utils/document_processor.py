import os
from typing import List, Dict, Any, Optional
from pathlib import Path
import uuid
from datetime import datetime

# Document processing imports
try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

from utils.logger import logger

class DocumentChunk:
    """Represents a chunk of processed document"""
    
    def __init__(self, 
                 content: str, 
                 source: str,
                 chunk_index: int = 0,
                 metadata: Dict[str, Any] = None):
        self.id = str(uuid.uuid4())
        self.content = content
        self.source = source
        self.chunk_index = chunk_index
        self.metadata = metadata or {}
        self.created_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "source": self.source,
            "chunk_index": self.chunk_index,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "content_length": len(self.content)
        }

class TextSplitter:
    """Splits text into chunks for processing"""
    
    def __init__(self, 
                 chunk_size: int = 1000,
                 chunk_overlap: int = 200,
                 separator: str = "\n\n"):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separator = separator
    
    def split_text(self, text: str) -> List[str]:
        """Split text into chunks"""
        if len(text) <= self.chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.chunk_size
            
            # Try to find a good break point
            if end < len(text):
                # Look for separator within the overlap region
                break_point = text.rfind(self.separator, start, end)
                if break_point == -1:
                    # Look for sentence endings
                    break_point = text.rfind('.', start, end)
                    if break_point == -1:
                        # Look for any whitespace
                        break_point = text.rfind(' ', start, end)
                        if break_point == -1:
                            break_point = end
                end = break_point + 1
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Move start position with overlap
            start = max(start + 1, end - self.chunk_overlap)
        
        return chunks

class DocumentProcessor:
    """Processes various document types into text chunks"""
    
    def __init__(self, 
                 chunk_size: int = 1000,
                 chunk_overlap: int = 200):
        self.text_splitter = TextSplitter(chunk_size, chunk_overlap)
        self.supported_extensions = {'.txt', '.md', '.pdf'}
        
        if not PDF_AVAILABLE and not PDFPLUMBER_AVAILABLE:
            logger.warning("No PDF processing libraries available. PDF support disabled.")
            self.supported_extensions.discard('.pdf')
    
    def is_supported(self, file_path: str) -> bool:
        """Check if file type is supported"""
        return Path(file_path).suffix.lower() in self.supported_extensions
    
    def process_text_file(self, file_path: str) -> List[DocumentChunk]:
        """Process a text file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            chunks = self.text_splitter.split_text(content)
            
            document_chunks = []
            for i, chunk in enumerate(chunks):
                doc_chunk = DocumentChunk(
                    content=chunk,
                    source=file_path,
                    chunk_index=i,
                    metadata={
                        "file_type": "text",
                        "file_size": os.path.getsize(file_path),
                        "total_chunks": len(chunks)
                    }
                )
                document_chunks.append(doc_chunk)
            
            logger.info(f"Processed text file {file_path} into {len(chunks)} chunks")
            return document_chunks
            
        except Exception as e:
            logger.error(f"Error processing text file {file_path}: {str(e)}")
            raise
    
    def process_pdf_file(self, file_path: str) -> List[DocumentChunk]:
        """Process a PDF file"""
        if not PDF_AVAILABLE and not PDFPLUMBER_AVAILABLE:
            raise ValueError("PDF processing not available. Install PyPDF2 or pdfplumber.")
        
        try:
            text_content = ""
            
            if PDFPLUMBER_AVAILABLE:
                # Use pdfplumber (better text extraction)
                import pdfplumber
                with pdfplumber.open(file_path) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text_content += page_text + "\n\n"
            
            elif PDF_AVAILABLE:
                # Fallback to PyPDF2
                with open(file_path, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    for page in pdf_reader.pages:
                        text_content += page.extract_text() + "\n\n"
            
            if not text_content.strip():
                raise ValueError("No text content extracted from PDF")
            
            chunks = self.text_splitter.split_text(text_content)
            
            document_chunks = []
            for i, chunk in enumerate(chunks):
                doc_chunk = DocumentChunk(
                    content=chunk,
                    source=file_path,
                    chunk_index=i,
                    metadata={
                        "file_type": "pdf",
                        "file_size": os.path.getsize(file_path),
                        "total_chunks": len(chunks),
                        "extraction_method": "pdfplumber" if PDFPLUMBER_AVAILABLE else "PyPDF2"
                    }
                )
                document_chunks.append(doc_chunk)
            
            logger.info(f"Processed PDF file {file_path} into {len(chunks)} chunks")
            return document_chunks
            
        except Exception as e:
            logger.error(f"Error processing PDF file {file_path}: {str(e)}")
            raise
    
    def process_file(self, file_path: str) -> List[DocumentChunk]:
        """Process a file based on its extension"""
        if not self.is_supported(file_path):
            raise ValueError(f"Unsupported file type: {Path(file_path).suffix}")
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext == '.pdf':
            return self.process_pdf_file(file_path)
        elif file_ext in {'.txt', '.md'}:
            return self.process_text_file(file_path)
        else:
            raise ValueError(f"Unsupported file extension: {file_ext}")
    
    def process_text_content(self, 
                           content: str, 
                           source_name: str = "text_input",
                           metadata: Dict[str, Any] = None) -> List[DocumentChunk]:
        """Process raw text content"""
        chunks = self.text_splitter.split_text(content)
        
        document_chunks = []
        for i, chunk in enumerate(chunks):
            doc_chunk = DocumentChunk(
                content=chunk,
                source=source_name,
                chunk_index=i,
                metadata={
                    **(metadata or {}),
                    "file_type": "text",
                    "total_chunks": len(chunks),
                    "content_length": len(content)
                }
            )
            document_chunks.append(doc_chunk)
        
        logger.info(f"Processed text content into {len(chunks)} chunks")
        return document_chunks
    
    def get_supported_extensions(self) -> List[str]:
        """Get list of supported file extensions"""
        return list(self.supported_extensions)

# Global document processor instance
document_processor = DocumentProcessor()
