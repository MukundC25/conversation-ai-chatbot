import requests
import json
import time
from pathlib import Path

# Test configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api"

class TestHealthAPI:
    """Test health check endpoints"""
    
    def test_health_check(self):
        """Test basic health check"""
        response = requests.get(f"{API_BASE}/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
        assert "gemini_configured" in data
        assert "vector_db_type" in data

class TestChatAPI:
    """Test chat functionality"""
    
    def test_chat_modes_endpoint(self):
        """Test getting available chat modes"""
        response = requests.get(f"{API_BASE}/chat/modes")
        assert response.status_code == 200
        
        data = response.json()
        assert "modes" in data
        assert len(data["modes"]) >= 3
        
        # Check required mode fields
        for mode in data["modes"]:
            assert "id" in mode
            assert "name" in mode
            assert "description" in mode
    
    def test_basic_chat(self):
        """Test basic chat functionality"""
        payload = {
            "message": "Hello, how are you?",
            "mode": "assistant"
        }
        
        response = requests.post(f"{API_BASE}/chat", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert "mode" in data
        assert "timestamp" in data
        assert "memory_stats" in data
        
        assert data["mode"] == "assistant"
        assert len(data["session_id"]) > 0
        assert len(data["response"]) > 0
    
    def test_chat_with_session_continuity(self):
        """Test chat session continuity"""
        # First message
        payload1 = {
            "message": "My name is Alice",
            "mode": "assistant"
        }
        
        response1 = requests.post(f"{API_BASE}/chat", json=payload1)
        assert response1.status_code == 200
        
        data1 = response1.json()
        session_id = data1["session_id"]
        
        # Second message with same session
        payload2 = {
            "message": "What is my name?",
            "session_id": session_id,
            "mode": "assistant"
        }
        
        response2 = requests.post(f"{API_BASE}/chat", json=payload2)
        assert response2.status_code == 200
        
        data2 = response2.json()
        assert data2["session_id"] == session_id
        assert data2["memory_stats"]["total_messages"] > data1["memory_stats"]["total_messages"]
    
    def test_different_chat_modes(self):
        """Test different chat modes"""
        modes = ["assistant", "developer", "support"]
        
        for mode in modes:
            payload = {
                "message": f"Hello in {mode} mode",
                "mode": mode
            }
            
            response = requests.post(f"{API_BASE}/chat", json=payload)
            assert response.status_code == 200
            
            data = response.json()
            assert data["mode"] == mode
    
    def test_rag_enabled_chat(self):
        """Test RAG-enabled chat"""
        payload = {
            "message": "What is your refund policy?",
            "mode": "support",
            "use_rag": True
        }
        
        response = requests.post(f"{API_BASE}/chat", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "response" in data
        # In test mode, should mention RAG or documents
        assert "RAG" in data["response"] or "document" in data["response"].lower()

class TestSessionAPI:
    """Test session management"""
    
    def test_get_sessions(self):
        """Test getting active sessions"""
        response = requests.get(f"{API_BASE}/chat/sessions")
        assert response.status_code == 200
        
        data = response.json()
        assert "sessions" in data
        assert "stats" in data
    
    def test_session_info(self):
        """Test getting session information"""
        # Create a session first
        chat_payload = {
            "message": "Test message for session info",
            "mode": "assistant"
        }
        
        chat_response = requests.post(f"{API_BASE}/chat", json=chat_payload)
        session_id = chat_response.json()["session_id"]
        
        # Get session info
        response = requests.get(f"{API_BASE}/chat/sessions/{session_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "session_id" in data
        assert "stats" in data
        assert "context" in data
        assert data["session_id"] == session_id
    
    def test_clear_session_memory(self):
        """Test clearing session memory"""
        # Create a session first
        chat_payload = {
            "message": "Test message before clear",
            "mode": "assistant"
        }
        
        chat_response = requests.post(f"{API_BASE}/chat", json=chat_payload)
        session_id = chat_response.json()["session_id"]
        
        # Clear session memory
        response = requests.post(f"{API_BASE}/chat/sessions/{session_id}/clear")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data

class TestRAGAPI:
    """Test RAG functionality"""
    
    def test_rag_stats(self):
        """Test getting RAG statistics"""
        response = requests.get(f"{API_BASE}/chat/rag/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "vector_store_stats" in data
        assert "max_context_length" in data
        assert "similarity_threshold" in data
        assert "supported_file_types" in data
    
    def test_rag_search(self):
        """Test RAG document search"""
        params = {
            "query": "refund policy",
            "k": 3
        }
        
        response = requests.post(f"{API_BASE}/chat/rag/search", params=params)
        assert response.status_code == 200
        
        data = response.json()
        assert "query" in data
        assert "context" in data
        assert "sources" in data
        assert "total_found" in data

class TestUploadAPI:
    """Test document upload functionality"""
    
    def test_upload_text_file(self):
        """Test uploading a text file"""
        # Create a test file
        test_content = "This is a test document for upload testing. It contains sample content."
        test_file_path = Path("test_upload.txt")
        
        with open(test_file_path, "w") as f:
            f.write(test_content)
        
        try:
            # Upload the file
            with open(test_file_path, "rb") as f:
                files = {"file": ("test_upload.txt", f, "text/plain")}
                response = requests.post(f"{API_BASE}/upload", files=files)
            
            assert response.status_code == 200
            
            data = response.json()
            assert "message" in data
            assert "filename" in data
            assert "file_id" in data
            assert "status" in data
            assert data["filename"] == "test_upload.txt"
            
        finally:
            # Clean up
            if test_file_path.exists():
                test_file_path.unlink()
    
    def test_get_documents(self):
        """Test getting uploaded documents"""
        response = requests.get(f"{API_BASE}/documents")
        assert response.status_code == 200
        
        data = response.json()
        assert "documents" in data

class TestIntegration:
    """Integration tests for complete workflows"""
    
    def test_upload_and_rag_workflow(self):
        """Test complete upload and RAG workflow"""
        # 1. Create and upload a test document
        test_content = """
        Company Policy Document
        
        Refund Policy:
        We offer a 30-day money-back guarantee on all purchases.
        
        Shipping Policy:
        Free shipping on orders over $50.
        """
        
        test_file_path = Path("integration_test.txt")
        with open(test_file_path, "w") as f:
            f.write(test_content)
        
        try:
            # Upload document
            with open(test_file_path, "rb") as f:
                files = {"file": ("integration_test.txt", f, "text/plain")}
                upload_response = requests.post(f"{API_BASE}/upload", files=files)
            
            assert upload_response.status_code == 200
            upload_data = upload_response.json()
            assert upload_data["status"] == "processed"
            
            # Wait a moment for processing
            time.sleep(1)
            
            # 2. Search for content using RAG
            search_params = {"query": "refund policy", "k": 3}
            search_response = requests.post(f"{API_BASE}/chat/rag/search", params=search_params)
            assert search_response.status_code == 200
            
            search_data = search_response.json()
            assert search_data["total_found"] > 0
            assert "30-day" in search_data["context"] or "money-back" in search_data["context"]
            
            # 3. Ask a question using RAG
            chat_payload = {
                "message": "What is your refund policy?",
                "mode": "support",
                "use_rag": True
            }
            
            chat_response = requests.post(f"{API_BASE}/chat", json=chat_payload)
            assert chat_response.status_code == 200
            
            chat_data = chat_response.json()
            # Should find relevant documents in test mode
            assert "document" in chat_data["response"].lower() or "found" in chat_data["response"].lower()
            
        finally:
            # Clean up
            if test_file_path.exists():
                test_file_path.unlink()

def run_tests():
    """Run all tests manually"""
    print("🧪 Running API Tests...")
    
    test_classes = [
        TestHealthAPI,
        TestChatAPI,
        TestSessionAPI,
        TestRAGAPI,
        TestUploadAPI,
        TestIntegration
    ]
    
    total_tests = 0
    passed_tests = 0
    
    for test_class in test_classes:
        print(f"\n📋 Running {test_class.__name__}...")
        test_instance = test_class()
        
        for method_name in dir(test_instance):
            if method_name.startswith("test_"):
                total_tests += 1
                try:
                    print(f"  ✓ {method_name}")
                    getattr(test_instance, method_name)()
                    passed_tests += 1
                except Exception as e:
                    print(f"  ✗ {method_name}: {str(e)}")
    
    print(f"\n📊 Test Results: {passed_tests}/{total_tests} passed")
    return passed_tests == total_tests

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
