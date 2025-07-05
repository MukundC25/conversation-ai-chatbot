from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
import os
import shutil
from pathlib import Path
import uuid
from datetime import datetime

# Import RAG system
from ai.qa_rag import get_rag_system
from utils.logger import logger

router = APIRouter()

# Allowed file types
ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.md', '.docx'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def validate_file(file: UploadFile) -> bool:
    """Validate uploaded file"""
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        return False
    
    # Check file size (this is approximate, actual size check happens during upload)
    return True

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a document for RAG processing
    """
    try:
        # Validate file
        if not validate_file(file):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads")
        upload_dir.mkdir(exist_ok=True)

        # Generate unique filename
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = upload_dir / unique_filename

        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()

            # Check file size
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
                )

            buffer.write(content)

        logger.info(f"Uploaded file {file.filename} as {unique_filename}")

        # Process file for RAG
        rag_system = get_rag_system()

        try:
            rag_result = rag_system.add_document(
                str(file_path),
                metadata={
                    "original_filename": file.filename,
                    "file_id": unique_filename,
                    "upload_time": datetime.now().isoformat()
                }
            )

            status = "processed"
            processing_info = {
                "chunks_created": rag_result["chunks_created"],
                "total_characters": rag_result["total_characters"],
                "document_ids": rag_result["document_ids"]
            }

            logger.info(f"Successfully processed {file.filename} for RAG with {rag_result['chunks_created']} chunks")

        except Exception as rag_error:
            logger.error(f"RAG processing failed for {file.filename}: {str(rag_error)}")
            status = "uploaded_not_processed"
            processing_info = {"error": str(rag_error)}

        return {
            "message": "File uploaded and processed successfully",
            "filename": file.filename,
            "file_id": unique_filename,
            "size": len(content),
            "upload_time": datetime.now().isoformat(),
            "status": status,
            "processing_info": processing_info
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error for {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")

@router.get("/documents")
async def list_documents():
    """
    List all uploaded documents
    """
    try:
        upload_dir = Path("uploads")
        if not upload_dir.exists():
            return {"documents": []}
        
        documents = []
        for file_path in upload_dir.iterdir():
            if file_path.is_file():
                stat = file_path.stat()
                documents.append({
                    "file_id": file_path.name,
                    "original_name": file_path.name,  # TODO: Store original names in metadata
                    "size": stat.st_size,
                    "upload_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "status": "uploaded"
                })
        
        return {"documents": documents}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")

@router.delete("/documents/{file_id}")
async def delete_document(file_id: str):
    """
    Delete an uploaded document
    """
    try:
        file_path = Path("uploads") / file_id
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Document not found")
        
        # TODO: Remove from vector database as well
        
        file_path.unlink()
        
        return {
            "message": "Document deleted successfully",
            "file_id": file_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete error: {str(e)}")

@router.get("/documents/{file_id}/info")
async def get_document_info(file_id: str):
    """
    Get information about a specific document
    """
    try:
        file_path = Path("uploads") / file_id
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Document not found")
        
        stat = file_path.stat()
        
        return {
            "file_id": file_id,
            "original_name": file_id,  # TODO: Get from metadata
            "size": stat.st_size,
            "upload_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "status": "uploaded",
            "type": file_path.suffix.lower()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting document info: {str(e)}")
