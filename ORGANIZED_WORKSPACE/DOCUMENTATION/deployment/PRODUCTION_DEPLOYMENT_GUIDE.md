# Production Deployment Guide - MCP Server with Separated Architecture

## Overview
This guide covers deploying the Chicken Business MCP Server with separated architecture optimized for 2M context window and 100k token input per minute. The system uses distinct databases for business operations and AI memory, with comprehensive backup strategies.

## Architecture Summary

### Separated Systems
- **Business Database**: Supabase PostgreSQL for operational data (sales, expenses, notes)
- **AI Memory System**: Vector Database (Pinecone/Weaviate/Chroma) + MCP memory for AI interactions
- **Backup System**: Secondary Supabase instance + Google Drive for archival
- **Caching Layer**: Redis for performance optimization

### AI Service Tiers (29 Models Total)
1. **Tier 1 (Premium)**: Gemini 2.5 series - 5 models
2. **Tier 2 (Standard)**: Gemini 2.0 series - 4 models  
3. **Tier 3 (Fallback)**: External APIs - 20 models (OpenRouter, HuggingFace, Cohere)

## Prerequisites

### Required Environment Variables
```bash
# Business Database (Primary Supabase)
SUPABASE_URL=your_primary_supabase_url
SUPABASE_KEY=your_primary_supabase_key

# Backup Database (Secondary Supabase)
SUPABASE_BACKUP_URL=your_backup_supabase_url
SUPABASE_BACKUP_KEY=your_backup_supabase_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
COHERE_API_KEY=your_cohere_api_key

# Vector Database
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment

# Google Drive Integration
GOOGLE_DRIVE_CLIENT_ID=your_google_drive_client_id
GOOGLE_DRIVE_CLIENT_SECRET=your_google_drive_client_secret
GOOGLE_DRIVE_REFRESH_TOKEN=your_google_drive_refresh_token

# Caching (Optional)
REDIS_URL=your_redis_url
```

### System Requirements
- **Node.js**: >= 18.0.0
- **npm**: Latest version
- **PostgreSQL Client**: For database operations
- **Redis**: For caching (optional but recommended)
- **Docker**: For containerized deployment (optional)

## Deployment Options

### Option 1: Automated Deployment Script (Recommended)

#### Linux/macOS
```bash
# Make script executable
chmod +x deploy-production.sh

# Set environment variables first
export SUPABASE_URL="your_url"
export SUPABASE_KEY="your_key"
# ... set all required variables

# Run deployment
./deploy-production.sh
```

#### Windows
```cmd
REM Set environment variables first
set SUPABASE_URL=your_url
set SUPABASE_KEY=your_key
REM ... set all required variables

REM Run deployment
deploy-production.bat
```

### Option 2: Docker Deployment

1. **Set up environment file**:
```bash
cp .env.example .env.production
# Edit .env.production with your values
```

2. **Build and deploy**:
```bash
# Build production image
docker build -f Dockerfile.production -t mcp-server:production .

# Run with docker-compose
docker-compose -f docker-compose.production.yml up -d
```

3. **Verify deployment**:
```bash
# Check container status
docker-compose -f docker-compose.production.yml ps

# Check logs
docker-compose -f docker-compose.production.yml logs -f mcp-server

# Test health endpoint
curl http://localhost:3000/health
```

### Option 3: Manual Deployment

1. **Install dependencies**:
```bash
npm ci --production
```

2. **Build TypeScript**:
```bash
npm run build
```

3. **Set up databases**:
```bash
# Apply business database schema
psql "$SUPABASE_URL" -f sql/business-database-monitoring.sql

# Apply memory database schema  
psql "$MEMORY_DB_URL" -f sql/memory-tables-schema.sql
```

4. **Start application**:
```bash
NODE_ENV=production node dist/src/index.js
```

## Database Setup

### Business Database (Primary Supabase)
```sql
-- Run this on your primary Supabase instance
\i sql/business-database-monitoring.sql

-- Verify monitoring tables
SELECT * FROM business_db_metrics;
SELECT * FROM backup_logs;
```

### AI Memory Database
```sql
-- Run this on your vector database or backup Supabase
\i sql/memory-tables-schema.sql

-- Verify memory tables
SELECT * FROM memory_entities;
SELECT * FROM memory_relations;
```

## Performance Configuration

### Context Window & Rate Limiting
```bash
# Environment variables for optimal performance
export MCP_CONTEXT_WINDOW_SIZE=2000000    # 2M tokens
export MCP_MAX_TOKENS_PER_MINUTE=100000   # 100k TPM
export MCP_ENABLE_RATE_LIMITING=true
export MCP_ENABLE_CACHING=true
export MCP_ENABLE_COMPRESSION=true
```

### Memory Management
- **Automatic archival**: Records older than 3 months moved to backup
- **Storage monitoring**: Alerts when tables exceed 80% capacity
- **Backup scheduling**: Daily incremental, weekly full backups

## Testing & Validation

### Production Readiness Test
```bash
# Run comprehensive test suite
npx ts-node production-readiness-test.ts
```

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Database connectivity
curl http://localhost:3000/health/database

# AI services status
curl http://localhost:3000/health/ai-services

# Memory system status
curl http://localhost:3000/health/memory
```

### Performance Tests
```bash
# Context window test (2M tokens)
curl -X POST http://localhost:3000/test/context-window \
  -H "Content-Type: application/json" \
  -d '{"test_size": "2M"}'

# Rate limiting test (100k TPM)  
curl -X POST http://localhost:3000/test/rate-limit \
  -H "Content-Type: application/json" \
  -d '{"test_duration": "60"}'
```

## Service Management

### Linux (systemd)
```bash
# Install service
sudo cp mcp-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mcp-server.service

# Manage service
sudo systemctl start mcp-server
sudo systemctl stop mcp-server
sudo systemctl restart mcp-server
sudo systemctl status mcp-server

# View logs
journalctl -u mcp-server -f
```

### Windows (NSSM)
```cmd
REM Download NSSM from https://nssm.cc/download
REM Run as Administrator

REM Install service
install-windows-service.bat

REM Manage service
nssm start chicken-business-mcp
nssm stop chicken-business-mcp
nssm restart chicken-business-mcp
```

### Docker Services
```bash
# Start all services
docker-compose -f docker-compose.production.yml up -d

# Stop all services
docker-compose -f docker-compose.production.yml down

# Restart specific service
docker-compose -f docker-compose.production.yml restart mcp-server

# View logs
docker-compose -f docker-compose.production.yml logs -f mcp-server
```

## Monitoring & Maintenance

### Log Management
- **Application logs**: `./logs/app.log`
- **Error logs**: `./logs/error.log`
- **Database logs**: Check Supabase dashboard
- **AI service logs**: `./logs/ai-services.log`

### Database Monitoring
```sql
-- Check storage usage
SELECT * FROM check_storage_limits();

-- View backup status
SELECT * FROM get_backup_status();

-- Monitor table metrics
SELECT * FROM get_table_metrics('sales');
```

### Google Drive Backup Management
```bash
# Check backup status
curl http://localhost:3000/admin/backup-status

# Trigger manual backup
curl -X POST http://localhost:3000/admin/backup \
  -H "Content-Type: application/json" \
  -d '{"table": "sales", "type": "manual"}'

# List Google Drive backups
curl http://localhost:3000/admin/google-drive/list
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors
```bash
# Test connections
curl http://localhost:3000/health/database

# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_BACKUP_URL

# Verify network connectivity
telnet your-supabase-url.supabase.co 443
```

#### 2. AI Service Failures
```bash
# Test individual services
curl http://localhost:3000/health/ai-services

# Check API keys
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models

# Review service logs
tail -f logs/ai-services.log
```

#### 3. Memory System Issues
```bash
# Test memory operations
curl -X POST http://localhost:3000/test/memory \
  -H "Content-Type: application/json" \
  -d '{"test": "basic_operations"}'

# Check vector database
curl http://localhost:3000/health/memory

# Verify Pinecone connection
curl -H "Api-Key: $PINECONE_API_KEY" \
  https://controller.us-east1-gcp.pinecone.io/databases
```

#### 4. Performance Issues
```bash
# Monitor resource usage
top -p $(pgrep -f "node.*index.js")

# Check rate limiting status
curl http://localhost:3000/admin/rate-limits

# Analyze slow queries
curl http://localhost:3000/admin/performance-metrics
```

### Log Analysis
```bash
# Search for errors
grep -i error logs/app.log | tail -20

# Monitor API calls
grep -i "api call" logs/app.log | tail -10

# Check backup operations
grep -i backup logs/app.log | tail -10

# Watch real-time logs
tail -f logs/app.log | grep -E "(ERROR|WARN|backup|ai-service)"
```

## Security Considerations

### API Key Management
- Store API keys in environment variables only
- Use different keys for development and production
- Rotate keys regularly (quarterly recommended)
- Monitor API usage for unexpected patterns

### Database Security
- Use least-privilege database users
- Enable SSL connections
- Regular security updates
- Monitor for suspicious queries

### Network Security
- Use HTTPS in production
- Configure proper CORS headers
- Implement rate limiting
- Regular security audits

## Backup & Recovery

### Automated Backups
- **Daily**: Incremental backups to backup Supabase
- **Weekly**: Full backups to Google Drive
- **Monthly**: Archive old data (3+ months)

### Manual Backup
```bash
# Backup specific table
curl -X POST http://localhost:3000/admin/backup \
  -H "Content-Type: application/json" \
  -d '{"table": "sales", "type": "manual", "destination": "google_drive"}'

# Export all data
curl -X POST http://localhost:3000/admin/export-all \
  -H "Content-Type: application/json" \
  -d '{"format": "excel", "destination": "google_drive"}'
```

### Recovery Procedures
```bash
# Restore from backup database
curl -X POST http://localhost:3000/admin/restore \
  -H "Content-Type: application/json" \
  -d '{"source": "backup_db", "table": "sales", "date": "2024-01-15"}'

# Restore from Google Drive
curl -X POST http://localhost:3000/admin/restore \
  -H "Content-Type: application/json" \
  -d '{"source": "google_drive", "file_id": "1234567890abcdef"}'
```

## Scaling Considerations

### Horizontal Scaling
- Deploy multiple instances behind load balancer
- Use shared Redis for session management
- Implement distributed rate limiting
- Database read replicas for heavy queries

### Vertical Scaling
- Monitor CPU/memory usage
- Increase instance size as needed
- Optimize database queries
- Configure connection pooling

### Cost Optimization
- Use free tier limits efficiently (10-20% of TPM)
- Archive old data regularly
- Monitor API usage costs
- Optimize backup frequency

## Support & Maintenance

### Regular Tasks
- **Daily**: Check logs for errors
- **Weekly**: Review performance metrics
- **Monthly**: Archive old data, rotate API keys
- **Quarterly**: Security audit, dependency updates

### Update Procedures
```bash
# Update application
git pull origin main
npm ci --production
npm run build
sudo systemctl restart mcp-server

# Update dependencies
npm audit
npm update
npm run build
```

### Contact & Resources
- **Documentation**: See `REVISED_ARCHITECTURE_SEPARATED_SYSTEMS.md`
- **Configuration**: Review `DEPLOYMENT_SUMMARY.md`
- **Testing**: Run `production-readiness-test.ts`
- **Logs**: Check `./logs/` directory

---

## Quick Reference

### Essential Commands
```bash
# Health check
curl http://localhost:3000/health

# View logs
tail -f logs/app.log

# Restart service
sudo systemctl restart mcp-server

# Backup data
curl -X POST http://localhost:3000/admin/backup

# Test AI services  
curl http://localhost:3000/health/ai-services

# Check performance
curl http://localhost:3000/admin/performance-metrics
```

### Configuration Files
- `.env.production` - Production environment
- `docker-compose.production.yml` - Docker deployment
- `nginx.conf` - Reverse proxy configuration
- `sql/business-database-monitoring.sql` - Database monitoring
- `sql/memory-tables-schema.sql` - AI memory schema

This guide ensures successful deployment of your MCP server with separated architecture, optimized for high-performance AI operations with comprehensive backup and monitoring capabilities.