# Deployment Guide - Conversational AI Chatbot

This guide covers deployment options for the Conversational AI Chatbot application.

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- OpenAI API key (for production use)
- At least 2GB RAM and 10GB disk space

### Development Deployment

1. Clone the repository and navigate to the project directory
2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Production Deployment

1. Configure production environment:
   ```bash
   cp server/.env.production server/.env.prod
   # Edit server/.env.prod with your production settings
   ```

2. Deploy to production:
   ```bash
   ./deploy.sh --environment production
   ```

## Deployment Options

### 1. Docker Compose (Recommended)

**Advantages:**
- Easy setup and management
- Isolated services
- Automatic service discovery
- Built-in health checks

**Commands:**
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 2. Cloud Platforms

#### Vercel (Frontend) + Render (Backend)

**Frontend (Vercel):**
1. Connect your GitHub repository to Vercel
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variable: `VITE_API_URL=https://your-backend-url.com`

**Backend (Render):**
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables from `.env.production`

#### Railway

1. Connect your GitHub repository to Railway
2. Railway will auto-detect and deploy both services
3. Configure environment variables in the Railway dashboard

#### DigitalOcean App Platform

1. Create a new app from your GitHub repository
2. Configure the backend service:
   - Source: `/server`
   - Build command: `pip install -r requirements.txt`
   - Run command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Configure the frontend service:
   - Source: `/client`
   - Build command: `npm run build`
   - Output directory: `dist`

### 3. VPS/Dedicated Server

#### Using Docker Compose

1. Install Docker and Docker Compose on your server
2. Clone the repository
3. Configure production environment variables
4. Run deployment script:
   ```bash
   ./deploy.sh --environment production
   ```

#### Manual Installation

**Backend:**
```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd client
npm install
npm run build
# Serve the dist folder with nginx or any static file server
```

## Environment Configuration

### Required Environment Variables

**Backend (.env):**
```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo
HOST=0.0.0.0
PORT=8000
VECTOR_DB_TYPE=faiss
VECTOR_DB_PATH=./vector_store
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

**Frontend:**
```env
VITE_API_URL=http://localhost:8000  # or your production API URL
```

### Optional Configuration

- **MongoDB**: For persistent chat history
- **Redis**: For session management
- **Sentry**: For error monitoring
- **Analytics**: For usage tracking

## SSL/HTTPS Setup

### Using Nginx Reverse Proxy

1. Install Nginx on your server
2. Configure SSL certificates (Let's Encrypt recommended)
3. Set up reverse proxy configuration:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Using Cloudflare

1. Add your domain to Cloudflare
2. Enable SSL/TLS encryption
3. Configure DNS records to point to your server
4. Enable security features (DDoS protection, WAF)

## Monitoring and Maintenance

### Health Checks

- Backend: `GET /api/health`
- Frontend: `GET /health` (nginx)

### Logging

**Docker Compose:**
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Manual Installation:**
- Backend logs: Check uvicorn output or configure logging to files
- Frontend logs: Check nginx access/error logs

### Backup

**Important data to backup:**
- Vector store data (`vector_store/` directory)
- Uploaded documents (`uploads/` directory)
- Environment configuration files
- Database data (if using MongoDB)

### Updates

1. Pull latest code from repository
2. Rebuild Docker images:
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000 and 8000 are available
2. **OpenAI API errors**: Verify API key and quota
3. **CORS errors**: Check ALLOWED_ORIGINS configuration
4. **File upload issues**: Verify upload directory permissions

### Debug Commands

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs backend
docker-compose logs frontend

# Access backend container
docker-compose exec backend bash

# Test API endpoints
curl http://localhost:8000/api/health
curl http://localhost:8000/api/chat/modes
```

## Performance Optimization

### Backend

- Use production ASGI server (Gunicorn + Uvicorn)
- Configure proper logging levels
- Implement caching for frequent queries
- Monitor memory usage for vector store

### Frontend

- Enable gzip compression
- Configure proper caching headers
- Use CDN for static assets
- Implement lazy loading for components

### Database

- Regular vector store optimization
- Implement document cleanup policies
- Monitor storage usage

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **CORS**: Configure restrictive CORS policies for production
3. **File Uploads**: Validate file types and sizes
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **HTTPS**: Always use HTTPS in production
6. **Updates**: Keep dependencies updated

## Support

For deployment issues:
1. Check the troubleshooting section above
2. Review application logs
3. Verify environment configuration
4. Test with the provided test suites
