from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import os
import uuid
from datetime import datetime

# Import AI modules
from ai.memory import memory_manager, ConversationMemory
from ai.qa_rag import get_rag_system
from utils.logger import logger

router = APIRouter()

# Pydantic models
class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: Optional[datetime] = None

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None  # If not provided, will create new session
    mode: Optional[str] = "assistant"  # assistant, developer, support
    use_rag: Optional[bool] = False
    memory_type: Optional[str] = "buffer_window"  # buffer_window, summary_buffer

class ChatResponse(BaseModel):
    response: str
    session_id: str
    mode: str
    timestamp: datetime
    tokens_used: Optional[int] = None
    memory_stats: Optional[Dict] = None

# Gemini client setup with fallback for testing
def get_gemini_client():
    """Get Gemini client with fallback for testing"""
    api_key = os.getenv("GOOGLE_API_KEY")

    # Allow testing without API key
    if not api_key or api_key == "your_google_api_key_here":
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-pro"))
        return model
    except (ImportError, Exception) as e:
        logger.warning(f"Failed to initialize Gemini client: {e}")
        return None

def generate_mock_response(message: str, mode: str) -> str:
    """Generate a mock response for testing without OpenAI API"""
    responses = {
        "assistant": f"I'm a helpful AI assistant in test mode. You said: '{message}'. How can I help you further?",
        "developer": f"As a developer assistant in test mode, I see you mentioned: '{message}'. I'd be happy to help with coding questions!",
        "support": f"Thank you for contacting support! In test mode, I received your message: '{message}'. How can I assist you today?"
    }
    return responses.get(mode, f"Test response for '{message}' in {mode} mode.")

def get_system_prompt(mode: str) -> str:
    """Get system prompt based on chat mode"""
    prompts = {
        "assistant": """You are a helpful AI assistant. You provide clear, accurate, and helpful responses to user questions. 
        You maintain context throughout the conversation and can engage in multi-turn dialogue effectively.""",
        
        "developer": """You are an expert software developer and coding assistant. You help with programming questions, 
        code review, debugging, and technical explanations. You provide code examples and best practices.""",
        
        "support": """You are a customer support agent. You are friendly, professional, and focused on solving 
        customer problems efficiently. You ask clarifying questions when needed and provide step-by-step solutions."""
    }
    return prompts.get(mode, prompts["assistant"])

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint that handles conversation with AI using memory
    """
    try:
        # Get or create session ID
        session_id = request.session_id or str(uuid.uuid4())

        # Get conversation memory for this session
        memory = memory_manager.get_memory(
            session_id,
            memory_type=request.memory_type
        )

        logger.info(f"Processing chat for session {session_id}")

        # Get Gemini client
        client = get_gemini_client()

        if client is None:
            # Use mock response for testing
            if request.use_rag:
                # Test RAG functionality with mock
                rag_system = get_rag_system()
                context, sources = rag_system.retrieve_context(request.message, k=3)
                if context:
                    ai_response = f"[RAG Test Mode] Based on the documents, here's what I found:\n\n{context[:200]}...\n\nThis is a mock response showing RAG integration."
                else:
                    ai_response = f"[RAG Test Mode] No relevant documents found for '{request.message}'. This is a mock response."
            else:
                ai_response = generate_mock_response(request.message, request.mode)
            tokens_used = None
            logger.info(f"Using mock response for session {session_id} (RAG: {request.use_rag})")
        else:
            # Handle RAG if requested
            if request.use_rag:
                rag_system = get_rag_system()
                context, sources = rag_system.retrieve_context(request.message, k=5)

                if context:
                    # Use RAG prompt
                    rag_prompt = rag_system.generate_rag_prompt(
                        request.message,
                        context,
                        get_system_prompt(request.mode)
                    )

                    prompt_text = rag_prompt
                    logger.info(f"Using RAG for session {session_id} with {len(sources)} source documents")
                else:
                    # No relevant documents found, use regular chat
                    prompt_text = f"{get_system_prompt(request.mode)}\n\nUser: {request.message}"
                    logger.info(f"No relevant documents found for RAG query in session {session_id}")
            else:
                # Regular chat without RAG - build conversation context
                conversation_parts = [get_system_prompt(request.mode)]

                # Add conversation history from memory
                memory_messages = memory.get_messages()
                for msg in memory_messages[-10:]:  # Keep last 10 messages for context
                    if hasattr(msg, 'content'):
                        role = "User" if msg.__class__.__name__ == "HumanMessage" else "Assistant"
                        conversation_parts.append(f"{role}: {msg.content}")

                # Add current user message
                conversation_parts.append(f"User: {request.message}")
                conversation_parts.append("Assistant:")

                prompt_text = "\n\n".join(conversation_parts)

            logger.info(f"Calling Gemini API for session {session_id} (RAG: {request.use_rag})")

            # Call Gemini API
            response = client.generate_content(prompt_text)

            ai_response = response.text
            tokens_used = None  # Gemini doesn't provide token usage in the same way

        # Save conversation turn to memory
        memory.add_message(request.message, ai_response)

        return ChatResponse(
            response=ai_response,
            session_id=session_id,
            mode=request.mode,
            timestamp=datetime.now(),
            tokens_used=tokens_used,
            memory_stats=memory.get_memory_stats()
        )

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, client = Depends(get_gemini_client)):
    """
    Streaming chat endpoint for real-time responses
    """
    try:
        # Prepare messages (same as above)
        messages = [
            {"role": "system", "content": get_system_prompt(request.mode)}
        ]
        
        for msg in request.history[-10:]:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        messages.append({
            "role": "user",
            "content": request.message
        })
        
        # Create streaming response
        def generate():
            try:
                stream = client.chat.completions.create(
                    model=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
                    messages=messages,
                    max_tokens=1000,
                    temperature=0.7,
                    stream=True
                )
                
                for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        content = chunk.choices[0].delta.content
                        yield f"data: {json.dumps({'content': content})}\n\n"
                
                yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Streaming error: {str(e)}")

@router.get("/chat/modes")
async def get_chat_modes():
    """Get available chat modes"""
    return {
        "modes": [
            {
                "id": "assistant",
                "name": "General Assistant",
                "description": "Helpful AI assistant for general questions"
            },
            {
                "id": "developer",
                "name": "Developer Assistant",
                "description": "Expert coding and technical support"
            },
            {
                "id": "support",
                "name": "Customer Support",
                "description": "Professional customer service agent"
            }
        ]
    }

@router.get("/chat/sessions")
async def get_active_sessions():
    """Get all active chat sessions"""
    return {
        "sessions": memory_manager.get_active_sessions(),
        "stats": memory_manager.get_memory_stats()
    }

@router.get("/chat/sessions/{session_id}")
async def get_session_info(session_id: str):
    """Get information about a specific session"""
    if session_id not in memory_manager.memories:
        raise HTTPException(status_code=404, detail="Session not found")

    memory = memory_manager.get_memory(session_id)
    return {
        "session_id": session_id,
        "stats": memory.get_memory_stats(),
        "context": memory.get_context_string(),
        "summary": memory.get_summary()
    }

@router.delete("/chat/sessions/{session_id}")
async def clear_session(session_id: str):
    """Clear a specific chat session"""
    if session_id not in memory_manager.memories:
        raise HTTPException(status_code=404, detail="Session not found")

    memory_manager.remove_memory(session_id)
    return {"message": f"Session {session_id} cleared successfully"}

@router.post("/chat/sessions/{session_id}/clear")
async def clear_session_memory(session_id: str):
    """Clear memory for a specific session but keep the session"""
    if session_id not in memory_manager.memories:
        raise HTTPException(status_code=404, detail="Session not found")

    memory = memory_manager.get_memory(session_id)
    memory.clear()
    return {"message": f"Memory cleared for session {session_id}"}

@router.get("/chat/rag/stats")
async def get_rag_stats():
    """Get RAG system statistics"""
    try:
        rag_system = get_rag_system()
        return rag_system.get_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting RAG stats: {str(e)}")

@router.post("/chat/rag/search")
async def search_documents(query: str, k: int = 5):
    """Search for relevant documents"""
    try:
        rag_system = get_rag_system()
        context, sources = rag_system.retrieve_context(query, k=k)

        return {
            "query": query,
            "context": context,
            "sources": sources,
            "total_found": len(sources)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching documents: {str(e)}")

@router.post("/chat/rag/add-text")
async def add_text_to_rag(content: str, source_name: str = "manual_input"):
    """Add text content directly to RAG system"""
    try:
        rag_system = get_rag_system()
        result = rag_system.add_text_content(content, source_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding text to RAG: {str(e)}")
