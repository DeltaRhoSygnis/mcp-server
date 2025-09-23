#!/bin/bash

# Production Deployment Script for Charnoks MCP Server
# This script handles the complete deployment process

set -e  # Exit on any error

echo "🚀 Starting Charnoks MCP Server Deployment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="charnoks-mcp-server"
IMAGE_NAME="charnoks/mcp-server"
HEALTH_CHECK_URL="http://localhost:3002/health"
MAX_WAIT_TIME=120

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    log_info "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    log_success "Docker is running"
}

# Check if required files exist
check_requirements() {
    log_info "Checking required files..."
    
    required_files=("Dockerfile" "docker-compose.yml" "package.json" ".env")
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file '$file' not found"
            if [[ "$file" == ".env" ]]; then
                log_warning "Copy .env.example to .env and fill in your configuration"
            fi
            exit 1
        fi
    done
    
    log_success "All required files found"
}

# Environment validation
validate_environment() {
    log_info "Validating environment configuration..."
    
    if [[ ! -f ".env" ]]; then
        log_error ".env file not found. Copy .env.example to .env and configure it."
        exit 1
    fi
    
    # Check critical environment variables
    source .env
    critical_vars=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "GEMINI_API_KEY" "JWT_SECRET")
    
    for var in "${critical_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            log_error "Required environment variable '$var' is not set in .env"
            exit 1
        fi
    done
    
    log_success "Environment configuration validated"
}

# Stop existing containers
stop_existing() {
    log_info "Stopping existing containers..."
    
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
        log_success "Stopped existing container"
    else
        log_info "No existing container to stop"
    fi
}

# Build and start services
deploy_services() {
    log_info "Building and starting services..."
    
    # Build the application
    log_info "Building Docker image..."
    docker-compose build --no-cache
    
    # Start services
    log_info "Starting services..."
    docker-compose up -d
    
    log_success "Services started"
}

# Health check
wait_for_health() {
    log_info "Waiting for service to be healthy..."
    
    local wait_time=0
    while [[ $wait_time -lt $MAX_WAIT_TIME ]]; do
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            log_success "Service is healthy and responding"
            return 0
        fi
        
        echo -n "."
        sleep 5
        wait_time=$((wait_time + 5))
    done
    
    log_error "Service failed to become healthy within $MAX_WAIT_TIME seconds"
    log_info "Checking container logs..."
    docker-compose logs mcp-server
    exit 1
}

# Display service information
show_service_info() {
    log_info "Deployment completed successfully! 🎉"
    echo
    echo "Service Information:"
    echo "==================="
    echo "🌐 MCP Server: http://localhost:3002"
    echo "🔧 Health Check: http://localhost:3002/health"
    echo "📊 WebSocket Chat: ws://localhost:3002/ws/chat"
    echo "🗄️ Redis: localhost:6379"
    echo
    echo "Available API Endpoints:"
    echo "========================"
    echo "GET  /health                  - Health check"
    echo "GET  /api/status             - Service status"
    echo "POST /api/chat               - AI Chat"
    echo "GET  /api/tools              - Available tools"
    echo "GET  /api/memory             - Memory status"
    echo "WS   /ws/chat                - Real-time chat"
    echo
    echo "Management Commands:"
    echo "===================="
    echo "docker-compose logs -f       - View logs"
    echo "docker-compose ps            - Check status"
    echo "docker-compose down          - Stop services"
    echo "docker-compose restart       - Restart services"
    echo
    echo "Monitoring:"
    echo "==========="
    echo "docker stats $CONTAINER_NAME - Resource usage"
    echo "curl http://localhost:3002/health - Quick health check"
}

# Cleanup function
cleanup_on_failure() {
    log_error "Deployment failed. Cleaning up..."
    docker-compose down || true
    exit 1
}

# Main deployment process
main() {
    # Set trap for cleanup on failure
    trap cleanup_on_failure ERR
    
    echo "🐔 Charnoks MCP Server Deployment Script"
    echo "========================================"
    echo
    
    # Pre-deployment checks
    check_docker
    check_requirements
    validate_environment
    
    # Deployment process
    stop_existing
    deploy_services
    wait_for_health
    
    # Post-deployment
    show_service_info
}

# Script options
case "${1:-}" in
    "stop")
        log_info "Stopping services..."
        docker-compose down
        log_success "Services stopped"
        ;;
    "restart")
        log_info "Restarting services..."
        docker-compose restart
        log_success "Services restarted"
        ;;
    "logs")
        docker-compose logs -f
        ;;
    "status")
        docker-compose ps
        echo
        curl -s "$HEALTH_CHECK_URL" || echo "Service not responding"
        ;;
    "clean")
        log_info "Cleaning up all containers and images..."
        docker-compose down -v --rmi all
        log_success "Cleanup completed"
        ;;
    *)
        main
        ;;
esac