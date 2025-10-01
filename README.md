# 🚀 **DEPLOYMENT CONFIGURATIONS**
## Ready-to-use deployment configurations and scripts

This folder contains deployment configurations, scripts, and Docker files for various platforms and environments.

---

## 📁 **File Structure**

```
DEPLOYMENT_CONFIGS/
├── README.md                    # This file
├── docker/
│   ├── Dockerfile              # Multi-stage Docker build
│   ├── docker-compose.yml      # Complete stack composition
│   ├── .dockerignore           # Docker ignore rules
│   └── docker-entrypoint.sh    # Container startup script
├── scripts/
│   ├── deploy-production.sh    # Production deployment script
│   ├── deploy-production.bat   # Windows deployment script
│   ├── cleanup-workspace.sh    # Workspace cleanup
│   └── setup-environment.sh    # Environment setup
├── configs/
│   ├── Procfile                # Heroku process file
│   ├── vercel.json             # Vercel configuration
│   ├── netlify.toml            # Netlify configuration
│   ├── render.yaml             # Render service config
│   └── railway.json            # Railway configuration
├── environments/
│   ├── .env.example            # Environment template
│   ├── .env.production         # Production environment
│   ├── .env.development        # Development environment
│   └── .env.test               # Test environment
└── ci-cd/
    ├── github-actions.yml      # GitHub Actions workflow
    ├── gitlab-ci.yml           # GitLab CI configuration
    └── jenkins.groovy          # Jenkins pipeline
```

---

## 🎯 **Quick Deployment**

### **Docker Deployment**
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t charnoks-mcp .
docker run -p 3002:3002 charnoks-mcp
```

### **Platform-Specific Deployment**

#### **Vercel (Frontend)**
```bash
# Copy vercel.json to your frontend root
cp configs/vercel.json /path/to/your/frontend/
vercel --prod
```

#### **Render (Backend)**
```bash
# Copy render.yaml to your backend root
cp configs/render.yaml /path/to/your/backend/
# Connect GitHub repo to Render
```

#### **Heroku**
```bash
# Copy Procfile to your root
cp configs/Procfile /path/to/your/app/
heroku create your-app-name
git push heroku main
```

---

## 🐳 **Docker Configuration**

### **Features**
- ✅ **Multi-stage build** for optimal image size
- ✅ **Node.js 18** Alpine base image
- ✅ **Non-root user** for security
- ✅ **Health checks** built-in
- ✅ **Environment variables** support
- ✅ **Production optimizations**

### **Usage**
```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.prod.yml up -d

# With custom environment
docker-compose --env-file .env.production up
```

---

## 📜 **Deployment Scripts**

### **deploy-production.sh**
Complete production deployment script with:
- Environment validation
- Dependency installation
- Build process
- Health checks
- Rollback capability

### **cleanup-workspace.sh**
Workspace cleanup script that:
- Removes test files
- Cleans build artifacts
- Optimizes for production
- Creates deployment package

### **setup-environment.sh**
Environment setup script for:
- Node.js installation
- Dependency management
- Environment configuration
- Database setup

---

## ⚡ **Platform Configurations**

### **Vercel (vercel.json)**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build"
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### **Render (render.yaml)**
```yaml
services:
  - type: web
    name: charnoks-mcp
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
```

### **Netlify (netlify.toml)**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 🔄 **CI/CD Pipelines**

### **GitHub Actions**
- ✅ **Automated testing** on PR
- ✅ **Multi-environment deployment**
- ✅ **Security scanning**
- ✅ **Performance monitoring**

### **Features**
- Build and test on multiple Node.js versions
- Deploy to staging and production
- Automated dependency updates
- Security vulnerability scanning

---

## 🌍 **Environment Management**

### **Environment Files**
- `.env.example` - Template with all variables
- `.env.development` - Development configuration
- `.env.production` - Production configuration  
- `.env.test` - Testing configuration

### **Variables Structure**
```bash
# Server Configuration
NODE_ENV=production
PORT=3002

# MCP Server
MCP_AUTH_TOKEN=your_token_here
JWT_SECRET=your_jwt_secret

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...

# AI Services
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=...

# Features
ENABLE_VOICE_STREAMING=true
ENABLE_REAL_TIME_CHAT=true
```

---

## 🔧 **Customization Guide**

### **Modify Docker Configuration**
1. Update `Dockerfile` for custom base image
2. Modify `docker-compose.yml` for additional services  
3. Update environment variables in compose files

### **Adapt Deployment Scripts**
1. Modify platform-specific settings
2. Add custom build steps
3. Include additional health checks
4. Configure monitoring and logging

### **Configure CI/CD**
1. Update GitHub Actions for your workflow
2. Modify deployment triggers
3. Add custom testing steps
4. Configure notifications

---

## 📊 **Deployment Matrix**

| Platform | Frontend | Backend | Database | Cost |
|----------|----------|---------|----------|------|
| Vercel + Render | ✅ | ✅ | Supabase | Free Tier |
| Netlify + Railway | ✅ | ✅ | PostgreSQL | Free Tier |
| Docker + VPS | ✅ | ✅ | Self-hosted | ~$5/month |
| Heroku Full Stack | ✅ | ✅ | Heroku Postgres | ~$7/month |

---

## 🚀 **Quick Start Commands**

```bash
# Copy all configs to your project
cp -r DEPLOYMENT_CONFIGS/* /path/to/your/project/

# Make scripts executable
chmod +x scripts/*.sh

# Run production deployment
./scripts/deploy-production.sh

# Or use Docker
docker-compose up -d
```

---

**Everything you need to deploy! 🚀✨**