# 🐔 Charnoks MCP Server - Docker Deployment Guide

## Quick Start

### 1. Prerequisites
- Docker Desktop installed and running
- Git (to clone the repository)
- Text editor for configuration

### 2. Setup Environment
```bash
# Copy the environment template
cp .env.example .env

# Edit .env with your configuration
# Required variables:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY  
# - GEMINI_API_KEY
# - JWT_SECRET
```

### 3. Deploy
```bash
# Linux/macOS
chmod +x deploy.sh
./deploy.sh

# Windows
deploy.bat
```

## Docker Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `production` |
| `PORT` | Server port | Yes | `3002` |
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key | Yes | - |
| `GEMINI_API_KEY` | Google Gemini API key | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `MCP_AUTH_TOKEN` | MCP authentication token | No | - |
| `MAX_REQUESTS_PER_MINUTE` | Rate limiting | No | `100` |
| `REDIS_URL` | Redis connection string | No | `redis://redis:6379` |

### Container Services

#### MCP Server Container
- **Image**: Custom built from Dockerfile
- **Port**: 3002
- **Health Check**: `/health` endpoint
- **Resources**: 1 CPU, 1GB RAM limit
- **Restart Policy**: `unless-stopped`

#### Redis Container
- **Image**: `redis:7-alpine`
- **Port**: 6379
- **Persistence**: Volume mounted
- **Configuration**: Custom `redis.conf`
- **Resources**: 0.5 CPU, 512MB RAM limit

#### Optional Services
- **Nginx**: Reverse proxy (production profile)
- **Prometheus**: Monitoring (monitoring profile)
- **Grafana**: Dashboards (monitoring profile)

## Management Commands

### Basic Operations
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Using Deployment Scripts
```bash
# Deploy (Linux/macOS)
./deploy.sh

# Deploy (Windows)
deploy.bat

# Stop services
./deploy.sh stop
deploy.bat stop

# View logs
./deploy.sh logs
deploy.bat logs

# Check status
./deploy.sh status
deploy.bat status

# Clean up everything
./deploy.sh clean
deploy.bat clean
```

### Service Profiles
```bash
# Start with production services (nginx)
docker-compose --profile production up -d

# Start with monitoring services
docker-compose --profile monitoring up -d

# Start everything
docker-compose --profile production --profile monitoring up -d
```

## Health Monitoring

### Health Checks
- **Server**: `http://localhost:3002/health`
- **Redis**: Built-in ping command
- **Container**: Docker health check every 30s

### Monitoring Endpoints
```bash
# Health check
curl http://localhost:3002/health

# Service status
curl http://localhost:3002/api/status

# Container stats
docker stats charnoks-mcp-server

# Container logs
docker logs charnoks-mcp-server -f
```

## Scaling and Performance

### Resource Limits
- **MCP Server**: 1 CPU, 1GB RAM (configurable)
- **Redis**: 0.5 CPU, 512MB RAM (configurable)
- **Memory Policy**: LRU eviction for Redis

### Scaling Options
```bash
# Scale MCP server instances
docker-compose up -d --scale mcp-server=3

# Use external load balancer
# Configure nginx upstream for multiple instances
```

### Performance Tuning
```yaml
# In docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '2.0'      # Increase CPU limit
      memory: 2G       # Increase memory limit
```

## Security Configuration

### Network Security
- Internal Docker network (172.20.0.0/16)
- Redis protected mode enabled
- Rate limiting configured
- CORS origins configured

### SSL/TLS (Production)
```bash
# Generate SSL certificates
mkdir ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem

# Update docker-compose.yml nginx volumes
```

### Authentication
- JWT tokens for API authentication
- MCP protocol authentication token
- Redis password protection

## Troubleshooting

### Common Issues

#### Docker Build Fails
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

#### Service Won't Start
```bash
# Check logs
docker-compose logs mcp-server

# Check environment variables
docker-compose config

# Verify .env file
cat .env
```

#### Health Check Fails
```bash
# Check if service is listening
docker exec charnoks-mcp-server netstat -tlnp

# Test health endpoint directly
docker exec charnoks-mcp-server curl localhost:3002/health

# Check container resources
docker stats charnoks-mcp-server
```

#### Redis Connection Issues
```bash
# Test Redis connectivity
docker exec charnoks-redis redis-cli ping

# Check Redis logs
docker logs charnoks-redis

# Verify Redis configuration
docker exec charnoks-redis cat /etc/redis/redis.conf
```

### Log Analysis
```bash
# Application logs
docker-compose logs mcp-server

# System logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f --tail=100
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Analyze container performance
docker exec charnoks-mcp-server top

# Check disk usage
docker system df
```

## Production Deployment

### Environment Setup
1. **Server Requirements**
   - 2 CPU cores minimum
   - 4GB RAM minimum
   - 20GB disk space
   - Docker and Docker Compose

2. **Network Configuration**
   - Open port 3002 (or configure proxy)
   - Configure firewall rules
   - Set up domain/DNS if needed

3. **SSL Configuration**
   - Generate SSL certificates
   - Configure nginx proxy
   - Update CORS origins

### Backup and Recovery
```bash
# Backup Redis data
docker exec charnoks-redis redis-cli BGSAVE
docker cp charnoks-redis:/data/dump.rdb ./backup/

# Backup application data
docker cp charnoks-mcp-server:/app/data ./backup/

# Restore data
docker cp ./backup/dump.rdb charnoks-redis:/data/
docker-compose restart redis
```

### Updates and Maintenance
```bash
# Update application
git pull
docker-compose build --no-cache
docker-compose up -d

# Update base images
docker-compose pull
docker-compose up -d
```

## API Usage Examples

### Health Check
```bash
curl http://localhost:3002/health
```

### Chat API
```bash
curl -X POST http://localhost:3002/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, what can you help me with?",
    "role": "customer"
  }'
```

### WebSocket Chat
```javascript
const ws = new WebSocket('ws://localhost:3002/ws/chat');
ws.send(JSON.stringify({
  type: 'message',
  content: 'Hello from WebSocket!',
  role: 'customer'
}));
```

## Support and Documentation

- **MCP Protocol**: [Official Documentation](https://modelcontextprotocol.io)
- **Docker**: [Docker Documentation](https://docs.docker.com)
- **Issues**: Create GitHub issues for bugs or feature requests
- **Logs**: Always include container logs when reporting issues