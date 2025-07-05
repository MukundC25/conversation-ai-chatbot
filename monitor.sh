#!/bin/bash

# Monitoring script for Conversational AI Chatbot
# Checks service health and provides system status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Conversational AI Monitor${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_service_health() {
    local service_name=$1
    local url=$2
    local timeout=${3:-5}
    
    if curl -f -s --max-time $timeout "$url" > /dev/null 2>&1; then
        print_success "$service_name is healthy"
        return 0
    else
        print_error "$service_name is not responding"
        return 1
    fi
}

check_docker_services() {
    print_status "Checking Docker services..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        return 1
    fi
    
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running"
        return 1
    fi
    
    if command -v docker-compose &> /dev/null; then
        echo ""
        print_status "Docker Compose services:"
        docker-compose ps
    else
        print_warning "Docker Compose not available"
    fi
}

check_api_endpoints() {
    print_status "Checking API endpoints..."
    
    # Health check
    if check_service_health "Backend Health" "http://localhost:8000/api/health"; then
        # Get health details
        health_data=$(curl -s http://localhost:8000/api/health 2>/dev/null || echo "{}")
        echo "  OpenAI configured: $(echo $health_data | grep -o '"openai_configured":[^,]*' | cut -d: -f2)"
        echo "  Vector DB type: $(echo $health_data | grep -o '"vector_db_type":[^,}]*' | cut -d: -f2 | tr -d '"')"
    fi
    
    # Chat modes
    check_service_health "Chat Modes API" "http://localhost:8000/api/chat/modes"
    
    # RAG stats
    check_service_health "RAG System" "http://localhost:8000/api/chat/rag/stats"
}

check_frontend() {
    print_status "Checking frontend..."
    check_service_health "Frontend" "http://localhost:3000"
}

check_system_resources() {
    print_status "System resources:"
    
    # Disk usage
    echo "  Disk usage:"
    df -h . | tail -1 | awk '{print "    Available: " $4 " (" $5 " used)"}'
    
    # Memory usage (if available)
    if command -v free &> /dev/null; then
        echo "  Memory usage:"
        free -h | grep "Mem:" | awk '{print "    Available: " $7 " (" $3 " used)"}'
    fi
    
    # Docker resource usage (if available)
    if docker info > /dev/null 2>&1; then
        echo "  Docker containers:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -v "NAMES" | while read line; do
            echo "    $line"
        done
    fi
}

check_logs() {
    print_status "Recent error logs (last 10 lines):"
    
    if command -v docker-compose &> /dev/null && docker-compose ps > /dev/null 2>&1; then
        echo "  Backend errors:"
        docker-compose logs --tail=10 backend 2>/dev/null | grep -i error | tail -5 || echo "    No recent errors"
        
        echo "  Frontend errors:"
        docker-compose logs --tail=10 frontend 2>/dev/null | grep -i error | tail -5 || echo "    No recent errors"
    else
        echo "    Docker Compose not available or services not running"
    fi
}

run_quick_test() {
    print_status "Running quick functionality test..."
    
    # Test basic chat
    test_response=$(curl -s -X POST "http://localhost:8000/api/chat" \
        -H "Content-Type: application/json" \
        -d '{"message": "Health check test", "mode": "assistant"}' 2>/dev/null)
    
    if echo "$test_response" | grep -q "response"; then
        print_success "Chat API is working"
    else
        print_error "Chat API test failed"
    fi
    
    # Test RAG search
    search_response=$(curl -s -X POST "http://localhost:8000/api/chat/rag/search?query=test&k=1" 2>/dev/null)
    
    if echo "$search_response" | grep -q "query"; then
        print_success "RAG search is working"
    else
        print_error "RAG search test failed"
    fi
}

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --quick, -q     Quick health check only"
    echo "  --test, -t      Run functionality tests"
    echo "  --logs, -l      Show recent logs"
    echo "  --help, -h      Show this help message"
}

# Parse command line arguments
QUICK_MODE=false
SHOW_LOGS=false
RUN_TESTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -q|--quick)
            QUICK_MODE=true
            shift
            ;;
        -l|--logs)
            SHOW_LOGS=true
            shift
            ;;
        -t|--test)
            RUN_TESTS=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main monitoring routine
main() {
    print_header
    echo "Timestamp: $(date)"
    echo ""
    
    if [[ "$QUICK_MODE" == true ]]; then
        check_service_health "Backend" "http://localhost:8000/api/health"
        check_service_health "Frontend" "http://localhost:3000"
        exit 0
    fi
    
    check_docker_services
    echo ""
    
    check_api_endpoints
    echo ""
    
    check_frontend
    echo ""
    
    check_system_resources
    echo ""
    
    if [[ "$RUN_TESTS" == true ]]; then
        run_quick_test
        echo ""
    fi
    
    if [[ "$SHOW_LOGS" == true ]]; then
        check_logs
        echo ""
    fi
    
    print_success "Monitoring complete!"
    echo ""
    print_status "For continuous monitoring, run: watch -n 30 './monitor.sh --quick'"
    print_status "For detailed logs, run: docker-compose logs -f"
}

main "$@"
