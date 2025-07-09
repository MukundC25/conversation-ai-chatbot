# Conversational AI Chatbot

An intelligent, memory-aware AI chatbot that engages in contextual multi-turn conversations, trained for domain-specific or customer support interactions using OpenAI APIs and a vector database.

## Features

- 🤖 Contextual multi-turn conversation with memory
- 📁 Document upload and RAG (Retrieval-Augmented Generation)
- 🎯 Multiple chat modes (Assistant, Developer, Support)
- 🧠 AI capabilities with summarization and context-based answers
- 📊 Real-time response streaming
- 🎨 Modern React UI with Tailwind CSS

## Tech Stack

### Frontend
- React.js with Vite
- Tailwind CSS
- Axios for API calls

### Backend
- FastAPI
- LangChain for AI memory
- OpenAI SDK
- FAISS/ChromaDB for vector storage
- PyPDF2 for document processing

## Project Structure

```
conversational-ai/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── server/                  # Python backend
│   ├── main.py              # FastAPI entry point
│   ├── routes/
│   ├── ai/
│   │   ├── memory.py        # LangChain memory
│   │   └── qa_rag.py        # RAG integration
│   ├── utils/
│   │   └── vectorstore.py   # Vector DB logic
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Google Gemini API key (free tier available, optional for testing)

### One-Command Deployment

```bash
# Clone the repository
git clone <repository-url>
cd conversational-ai

# Deploy with Docker Compose
./deploy.sh
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### Manual Setup (Alternative)

#### Backend Setup
```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create environment file
cp .env.example .env
# Edit .env with your OpenAI API key

# Start the server
uvicorn main:app --reload
```

#### Frontend Setup
```bash
cd client
npm install
npm run dev
```

## Configuration

### Environment Variables

Create `server/.env` with your configuration:
```env
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-pro
VECTOR_DB_TYPE=faiss
ALLOWED_ORIGINS=http://localhost:3000
```

### Getting Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key to your `.env` file

### Testing Without Gemini API

The application works in test mode without a Gemini API key, using mock responses for development and testing.

## API Endpoints

- `POST /api/chat` - Main chat endpoint with memory and RAG support
- `POST /api/upload` - Document upload for RAG processing
- `GET /api/chat/modes` - Available chat modes
- `GET /api/chat/sessions` - Active chat sessions
- `POST /api/chat/rag/search` - Search documents
- `GET /api/health` - Health check

## Deployment

### Development
```bash
./deploy.sh
```

### Production
```bash
# Configure production environment
cp server/.env.production server/.env.prod
# Edit with your production settings

# Deploy
./deploy.sh --environment production
```

### Cloud Platforms
- **Vercel + Render**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Railway**: Auto-deploy from GitHub
- **DigitalOcean**: App Platform deployment

## Monitoring

```bash
# Quick health check
./monitor.sh --quick

# Full system status
./monitor.sh

# Run functionality tests
./monitor.sh --test

# View recent logs
./monitor.sh --logs
```

## Testing

### Automated Tests
```bash
# API tests
cd server && python test_api.py

# End-to-end tests
python test_e2e.py

# Frontend integration tests
# Open http://localhost:3000/test_frontend.html
```

### Manual Testing
1. Upload a document via the UI
2. Enable RAG mode (search icon)
3. Ask questions about the uploaded document
4. Test different chat modes (Assistant, Developer, Support)

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │────│   FastAPI       │────│   Vector Store  │
│   (Frontend)    │    │   (Backend)     │    │   (FAISS)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │  Google Gemini  │
                       │     (Free)      │
                       └─────────────────┘
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `./deploy.sh --skip-tests && python test_e2e.py`
5. Submit a pull request

## License

MIT License
