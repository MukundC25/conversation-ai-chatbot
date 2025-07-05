from typing import List, Dict, Any, Optional
from langchain.memory import ConversationBufferWindowMemory, ConversationSummaryBufferMemory
from langchain.schema import BaseMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
import json
import os
from datetime import datetime
from utils.logger import logger

class ConversationMemory:
    """
    Advanced conversation memory management using LangChain
    Supports multiple memory strategies and conversation persistence
    """
    
    def __init__(self, 
                 memory_type: str = "buffer_window",
                 max_token_limit: int = 2000,
                 k: int = 10,
                 openai_api_key: Optional[str] = None):
        """
        Initialize conversation memory
        
        Args:
            memory_type: Type of memory ("buffer_window", "summary_buffer")
            max_token_limit: Maximum tokens for summary buffer memory
            k: Number of messages to keep in buffer window memory
            openai_api_key: OpenAI API key for summary memory
        """
        self.memory_type = memory_type
        self.max_token_limit = max_token_limit
        self.k = k
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        
        # Initialize LangChain memory
        self.memory = self._create_memory()
        
        # Store conversation metadata
        self.conversation_id = None
        self.created_at = datetime.now()
        self.last_updated = datetime.now()
        
        logger.info(f"Initialized {memory_type} memory with k={k}, max_tokens={max_token_limit}")
    
    def _create_memory(self):
        """Create appropriate LangChain memory instance"""
        if self.memory_type == "buffer_window":
            return ConversationBufferWindowMemory(
                k=self.k,
                return_messages=True,
                memory_key="chat_history"
            )
        elif self.memory_type == "summary_buffer":
            if not self.openai_api_key:
                logger.warning("No OpenAI API key provided, falling back to buffer window memory")
                return ConversationBufferWindowMemory(
                    k=self.k,
                    return_messages=True,
                    memory_key="chat_history"
                )
            
            llm = ChatOpenAI(
                api_key=self.openai_api_key,
                model=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
                temperature=0
            )
            
            return ConversationSummaryBufferMemory(
                llm=llm,
                max_token_limit=self.max_token_limit,
                return_messages=True,
                memory_key="chat_history"
            )
        else:
            raise ValueError(f"Unsupported memory type: {self.memory_type}")
    
    def add_message(self, human_message: str, ai_message: str):
        """Add a conversation turn to memory"""
        try:
            # Add to LangChain memory
            self.memory.save_context(
                {"input": human_message},
                {"output": ai_message}
            )
            
            self.last_updated = datetime.now()
            logger.debug(f"Added message pair to memory. Total messages: {len(self.get_messages())}")
            
        except Exception as e:
            logger.error(f"Error adding message to memory: {str(e)}")
            raise
    
    def get_messages(self) -> List[BaseMessage]:
        """Get all messages from memory"""
        try:
            memory_variables = self.memory.load_memory_variables({})
            return memory_variables.get("chat_history", [])
        except Exception as e:
            logger.error(f"Error retrieving messages from memory: {str(e)}")
            return []
    
    def get_context_string(self) -> str:
        """Get conversation context as a formatted string"""
        messages = self.get_messages()
        if not messages:
            return ""
        
        context_parts = []
        for message in messages:
            if isinstance(message, HumanMessage):
                context_parts.append(f"Human: {message.content}")
            elif isinstance(message, AIMessage):
                context_parts.append(f"Assistant: {message.content}")
        
        return "\n".join(context_parts)
    
    def get_summary(self) -> Optional[str]:
        """Get conversation summary if using summary buffer memory"""
        if hasattr(self.memory, 'moving_summary_buffer') and self.memory.moving_summary_buffer:
            return self.memory.moving_summary_buffer
        return None
    
    def clear(self):
        """Clear all conversation memory"""
        try:
            self.memory.clear()
            self.last_updated = datetime.now()
            logger.info("Conversation memory cleared")
        except Exception as e:
            logger.error(f"Error clearing memory: {str(e)}")
            raise
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory statistics and metadata"""
        messages = self.get_messages()
        summary = self.get_summary()
        
        return {
            "memory_type": self.memory_type,
            "total_messages": len(messages),
            "conversation_id": self.conversation_id,
            "created_at": self.created_at.isoformat(),
            "last_updated": self.last_updated.isoformat(),
            "has_summary": summary is not None,
            "summary_length": len(summary) if summary else 0,
            "max_token_limit": self.max_token_limit,
            "k": self.k
        }
    
    def export_conversation(self) -> Dict[str, Any]:
        """Export conversation for persistence"""
        messages = self.get_messages()
        
        exported_messages = []
        for msg in messages:
            exported_messages.append({
                "type": "human" if isinstance(msg, HumanMessage) else "ai",
                "content": msg.content,
                "timestamp": getattr(msg, 'timestamp', None)
            })
        
        return {
            "conversation_id": self.conversation_id,
            "memory_type": self.memory_type,
            "messages": exported_messages,
            "summary": self.get_summary(),
            "stats": self.get_memory_stats(),
            "exported_at": datetime.now().isoformat()
        }
    
    def import_conversation(self, conversation_data: Dict[str, Any]):
        """Import conversation from exported data"""
        try:
            self.clear()
            
            messages = conversation_data.get("messages", [])
            
            # Rebuild conversation by adding message pairs
            human_msg = None
            for msg_data in messages:
                if msg_data["type"] == "human":
                    human_msg = msg_data["content"]
                elif msg_data["type"] == "ai" and human_msg:
                    self.add_message(human_msg, msg_data["content"])
                    human_msg = None
            
            self.conversation_id = conversation_data.get("conversation_id")
            logger.info(f"Imported conversation with {len(messages)} messages")
            
        except Exception as e:
            logger.error(f"Error importing conversation: {str(e)}")
            raise


class MemoryManager:
    """
    Manages multiple conversation memories for different sessions
    """
    
    def __init__(self):
        self.memories: Dict[str, ConversationMemory] = {}
        self.default_memory_config = {
            "memory_type": "buffer_window",
            "max_token_limit": 2000,
            "k": 10
        }
    
    def get_memory(self, session_id: str, **kwargs) -> ConversationMemory:
        """Get or create memory for a session"""
        if session_id not in self.memories:
            config = {**self.default_memory_config, **kwargs}
            memory = ConversationMemory(**config)
            memory.conversation_id = session_id
            self.memories[session_id] = memory
            logger.info(f"Created new memory for session: {session_id}")
        
        return self.memories[session_id]
    
    def remove_memory(self, session_id: str):
        """Remove memory for a session"""
        if session_id in self.memories:
            del self.memories[session_id]
            logger.info(f"Removed memory for session: {session_id}")
    
    def clear_all_memories(self):
        """Clear all session memories"""
        self.memories.clear()
        logger.info("Cleared all session memories")
    
    def get_active_sessions(self) -> List[str]:
        """Get list of active session IDs"""
        return list(self.memories.keys())
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get statistics for all memories"""
        return {
            "total_sessions": len(self.memories),
            "active_sessions": self.get_active_sessions(),
            "sessions": {
                session_id: memory.get_memory_stats()
                for session_id, memory in self.memories.items()
            }
        }


# Global memory manager instance
memory_manager = MemoryManager()
