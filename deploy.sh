#!/bin/bash

# Deployment script for Conversational AI Chatbot
# This script handles both development and production deployments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
ENVIRONMENT="development"
BUILD_ONLY=false
SKIP_TESTS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -b|--build-only)
            BUILD_ONLY=true
            shift
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment ENV    Set environment (development|production) [default: development]"
            echo "  -b, --build-only        Only build, don't start services"
            echo "  -s, --skip-tests        Skip running tests"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_status "Starting deployment for environment: $ENVIRONMENT"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install it and try again."
    exit 1
fi

# Validate environment
if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "production" ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be 'development' or 'production'"
    exit 1
fi

# Check for required environment files
if [[ "$ENVIRONMENT" == "production" ]]; then
    if [[ ! -f "server/.env.production" ]]; then
        print_error "Production environment file not found: server/.env.production"
        print_status "Please copy server/.env.production.example and configure it with your production settings"
        exit 1
    fi
    ENV_FILE="server/.env.production"
else
    if [[ ! -f "server/.env" ]]; then
        print_warning "Development environment file not found: server/.env"
        print_status "Copying from example file..."
        cp server/.env.example server/.env
    fi
    ENV_FILE="server/.env"
fi

# Run tests unless skipped
if [[ "$SKIP_TESTS" == false ]]; then
    print_status "Running tests..."
    
    # Check if backend is running for tests
    if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
        print_status "Backend is running, running API tests..."
        cd server && python test_api.py
        cd ..
        
        print_status "Running end-to-end tests..."
        python test_e2e.py
    else
        print_warning "Backend not running, skipping API tests"
        print_status "You can run tests manually after deployment with:"
        print_status "  cd server && python test_api.py"
        print_status "  python test_e2e.py"
    fi
fi

# Build and start services
print_status "Building Docker images..."

if [[ "$ENVIRONMENT" == "production" ]]; then
    # Production build
    docker-compose -f docker-compose.yml build --no-cache
    
    if [[ "$BUILD_ONLY" == false ]]; then
        print_status "Starting production services..."
        docker-compose -f docker-compose.yml up -d
        
        # Wait for services to be healthy
        print_status "Waiting for services to be healthy..."
        sleep 10
        
        # Check service health
        if docker-compose -f docker-compose.yml ps | grep -q "Up (healthy)"; then
            print_success "Services are healthy!"
        else
            print_warning "Some services may not be healthy. Check with: docker-compose ps"
        fi
    fi
else
    # Development build
    docker-compose build
    
    if [[ "$BUILD_ONLY" == false ]]; then
        print_status "Starting development services..."
        docker-compose up -d
        
        # Wait for services to start
        sleep 5
    fi
fi

if [[ "$BUILD_ONLY" == false ]]; then
    # Display service status
    print_status "Service status:"
    docker-compose ps
    
    # Display access URLs
    print_success "Deployment completed successfully!"
    echo ""
    print_status "Access URLs:"
    print_status "  Frontend: http://localhost:3000"
    print_status "  Backend API: http://localhost:8000"
    print_status "  API Documentation: http://localhost:8000/docs"
    print_status "  Health Check: http://localhost:8000/api/health"
    echo ""
    print_status "Useful commands:"
    print_status "  View logs: docker-compose logs -f"
    print_status "  Stop services: docker-compose down"
    print_status "  Restart services: docker-compose restart"
    print_status "  View service status: docker-compose ps"
else
    print_success "Build completed successfully!"
    print_status "To start services, run: docker-compose up -d"
fi
