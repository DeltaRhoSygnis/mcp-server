@echo off
setlocal enabledelayedexpansion

REM Production Deployment Script for Charnoks MCP Server (Windows)
REM This script handles the complete deployment process on Windows

echo ^🚀 Starting Charnoks MCP Server Deployment...

REM Configuration
set "CONTAINER_NAME=charnoks-mcp-server"
set "IMAGE_NAME=charnoks/mcp-server"
set "HEALTH_CHECK_URL=http://localhost:3002/health"
set "MAX_WAIT_TIME=120"

REM Check if Docker is running
echo [INFO] Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop first.
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    exit /b 1
)
echo [SUCCESS] Docker is running

REM Check if required files exist
echo [INFO] Checking required files...
if not exist "Dockerfile" (
    echo [ERROR] Dockerfile not found
    exit /b 1
)
if not exist "docker-compose.yml" (
    echo [ERROR] docker-compose.yml not found
    exit /b 1
)
if not exist "package.json" (
    echo [ERROR] package.json not found
    exit /b 1
)
if not exist ".env" (
    echo [ERROR] .env file not found. Copy .env.example to .env and configure it.
    exit /b 1
)
echo [SUCCESS] All required files found

REM Stop existing containers
echo [INFO] Stopping existing containers...
docker ps -q -f name="%CONTAINER_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    docker stop %CONTAINER_NAME% >nul 2>&1
    docker rm %CONTAINER_NAME% >nul 2>&1
    echo [SUCCESS] Stopped existing container
) else (
    echo [INFO] No existing container to stop
)

REM Build and start services
echo [INFO] Building and starting services...
echo [INFO] Building Docker image...
docker-compose build --no-cache
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build Docker image
    exit /b 1
)

echo [INFO] Starting services...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start services
    exit /b 1
)
echo [SUCCESS] Services started

REM Health check with timeout
echo [INFO] Waiting for service to be healthy...
set /a wait_time=0
:health_check_loop
if %wait_time% geq %MAX_WAIT_TIME% (
    echo [ERROR] Service failed to become healthy within %MAX_WAIT_TIME% seconds
    echo [INFO] Checking container logs...
    docker-compose logs mcp-server
    exit /b 1
)

curl -f -s "%HEALTH_CHECK_URL%" >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Service is healthy and responding
    goto :deployment_success
)

echo|set /p=.
timeout /t 5 /nobreak >nul
set /a wait_time+=5
goto :health_check_loop

:deployment_success
echo.
echo [INFO] Deployment completed successfully! 🎉
echo.
echo Service Information:
echo ===================
echo 🌐 MCP Server: http://localhost:3002
echo 🔧 Health Check: http://localhost:3002/health
echo 📊 WebSocket Chat: ws://localhost:3002/ws/chat
echo 🗄️ Redis: localhost:6379
echo.
echo Available API Endpoints:
echo ========================
echo GET  /health                  - Health check
echo GET  /api/status             - Service status
echo POST /api/chat               - AI Chat
echo GET  /api/tools              - Available tools
echo GET  /api/memory             - Memory status
echo WS   /ws/chat                - Real-time chat
echo.
echo Management Commands:
echo ====================
echo docker-compose logs -f       - View logs
echo docker-compose ps            - Check status
echo docker-compose down          - Stop services
echo docker-compose restart       - Restart services
echo.
echo Monitoring:
echo ===========
echo docker stats %CONTAINER_NAME% - Resource usage
echo curl http://localhost:3002/health - Quick health check

goto :eof

REM Handle script arguments
if "%1"=="stop" (
    echo [INFO] Stopping services...
    docker-compose down
    echo [SUCCESS] Services stopped
    goto :eof
)

if "%1"=="restart" (
    echo [INFO] Restarting services...
    docker-compose restart
    echo [SUCCESS] Services restarted
    goto :eof
)

if "%1"=="logs" (
    docker-compose logs -f
    goto :eof
)

if "%1"=="status" (
    docker-compose ps
    echo.
    curl -s "%HEALTH_CHECK_URL%" || echo Service not responding
    goto :eof
)

if "%1"=="clean" (
    echo [INFO] Cleaning up all containers and images...
    docker-compose down -v --rmi all
    echo [SUCCESS] Cleanup completed
    goto :eof
)

endlocal