# 🚀 **COMPLETE PRODUCTION DEPLOYMENT GUIDE**
## Step-by-step deployment instructions for your MCP-integrated Charnoks application

---

## 📋 **Deployment Overview**

Your Charnoks application consists of three main components:
1. **Frontend** (React/Vue) - User interface
2. **Backend** (Express.js) - API server with MCP integration
3. **MCP Server** - AI processing and business logic

---

## 🛠️ **Prerequisites & Setup**

### **1. Required Accounts**
- ✅ **GitHub** - Code repository
- ✅ **Vercel/Netlify** - Frontend hosting
- ✅ **Render/Railway** - Backend hosting
- ✅ **Supabase** - Database
- ✅ **OpenAI** - AI services

### **2. Environment Variables Setup**

#### **Frontend (.env.production)**
```bash
VITE_MCP_SERVER_URL=https://your-mcp-server.onrender.com
VITE_MCP_WS_URL=wss://your-mcp-server.onrender.com
VITE_MCP_AUTH_TOKEN=your_production_frontend_token
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_ENABLE_VOICE_STREAMING=true
VITE_ENABLE_REAL_TIME_CHAT=true
```

#### **Backend (.env.production)**
```bash
NODE_ENV=production
PORT=8000
MCP_SERVER_URL=https://your-mcp-server.onrender.com
MCP_AUTH_TOKEN=your_production_backend_token
JWT_SECRET=your_super_secure_jwt_secret_min_32_chars
DATABASE_URL=postgresql://user:password@host:port/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

#### **MCP Server (.env.production)**
```bash
NODE_ENV=production
PORT=3002
JWT_SECRET=your_super_secure_jwt_secret_min_32_chars
MCP_AUTH_TOKEN=your_mcp_production_token
OPENAI_API_KEY=sk-your-openai-api-key
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-backend.onrender.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

---

## 🌐 **Frontend Deployment (Vercel)**

### **Step 1: Prepare Your Frontend**
1. Copy integration files to your frontend project:
   - `src/services/mcpClient.ts`
   - `src/hooks/useMCPClient.ts`
   - `src/components/` (MCP components)

2. Install dependencies:
```bash
npm install @types/ws ws uuid zod
```

3. Test build locally:
```bash
npm run build
npm run preview
```

### **Step 2: Deploy to Vercel**
1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel login
vercel --prod
```

3. Set environment variables in Vercel dashboard or CLI:
```bash
vercel env add VITE_MCP_SERVER_URL production
vercel env add VITE_MCP_WS_URL production
vercel env add VITE_MCP_AUTH_TOKEN production
```

### **Step 3: Configure vercel.json**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

---

## 🖥️ **Backend Deployment (Render)**

### **Step 1: Prepare Your Backend**
1. Copy integration files to your backend project:
   - `src/services/mcpBackendClient.ts`
   - `src/routes/mcpRoutes.ts`
   - `src/middleware/mcpAuth.ts`
   - `src/complete-express-app.ts`

2. Install dependencies:
```bash
npm install @modelcontextprotocol/sdk axios express-rate-limit jsonwebtoken ws uuid zod helmet compression cors
```

3. Update package.json scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/complete-express-app.js",
    "dev": "ts-node src/complete-express-app.ts"
  }
}
```

### **Step 2: Deploy to Render**
1. Connect GitHub repository to Render
2. Create new "Web Service"
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node

4. Add all environment variables in Render dashboard

---

## 🤖 **MCP Server Deployment (Render)**

### **Step 1: Prepare MCP Server**
1. Ensure your MCP server has production configuration
2. Add health check endpoint:
```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
```

### **Step 2: Deploy MCP Server**
1. Create another Render web service for MCP server
2. Use same configuration as backend
3. Set MCP-specific environment variables

### **Step 3: Update URLs**
After both backend and MCP server are deployed, update environment variables with actual URLs.

---

## 🗄️ **Database Setup (Supabase)**

### **Step 1: Create Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Wait for provisioning

### **Step 2: Run Database Schema**
Execute this SQL in Supabase SQL editor:
```sql
-- Create tables
CREATE TABLE branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,  
  name TEXT,
  role TEXT DEFAULT 'customer',
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chicken_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  local_uuid TEXT,
  branch_id UUID REFERENCES branches(id),
  author_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  user_role TEXT DEFAULT 'owner',
  status TEXT DEFAULT 'pending',
  parsed_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_chicken_notes_branch_created ON chicken_notes(branch_id, created_at DESC);
CREATE INDEX idx_chicken_notes_status ON chicken_notes(status);

-- Enable Row Level Security
ALTER TABLE chicken_notes ENABLE ROW LEVEL SECURITY;

-- Basic policy example
CREATE POLICY "Users can view their branch notes" ON chicken_notes
  FOR SELECT USING (branch_id IN (
    SELECT branch_id FROM users WHERE id = auth.uid()
  ));
```

### **Step 3: Get Database Credentials**
1. Go to Settings → Database
2. Copy connection string and API keys
3. Add to environment variables

---

## 🔄 **Testing Your Deployment**

### **Step 1: Health Checks**
```bash
# Test all endpoints
curl https://your-frontend.vercel.app
curl https://your-backend.onrender.com/health
curl https://your-mcp-server.onrender.com/health
```

### **Step 2: API Testing**
```bash
# Test backend MCP integration
curl -X POST https://your-backend.onrender.com/api/mcp/process-note \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"content": "Fed 20 chickens, collected 15 eggs"}'
```

### **Step 3: Frontend Testing**
1. Open your frontend URL
2. Try creating a chicken note
3. Test AI chat functionality
4. Verify WebSocket connections

---

## 🔐 **Security Configuration**

### **SSL/HTTPS**
- Vercel and Render provide automatic HTTPS
- All platforms handle SSL certificates automatically

### **CORS Configuration**
Ensure your backend CORS allows your frontend domain:
```typescript
const allowedOrigins = [
  'https://your-frontend.vercel.app',
  'https://your-custom-domain.com'
];
```

### **API Rate Limiting**
Your middleware already includes rate limiting:
- 100 requests per minute per user
- Configurable via environment variables

---

## 📊 **Monitoring Setup**

### **Error Tracking (Sentry)**
1. Create Sentry account
2. Add Sentry DSN to environment variables
3. Errors will be automatically tracked

### **Performance Monitoring**
Monitor these metrics:
- Response times
- Error rates  
- Memory usage
- Database query performance

---

## 🚀 **Going Live Checklist**

### **Pre-Launch**
- [ ] All services deployed and healthy
- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] SSL certificates active
- [ ] Error monitoring configured

### **Launch Day**
- [ ] Test all functionality end-to-end
- [ ] Monitor error rates and performance
- [ ] Have rollback plan ready
- [ ] Monitor user feedback

### **Post-Launch**
- [ ] Set up regular backups
- [ ] Monitor performance metrics
- [ ] Plan for scaling if needed
- [ ] Regular security updates

---

## 🔧 **Common Issues & Solutions**

### **Build Failures**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### **CORS Errors**
- Verify ALLOWED_ORIGINS includes your frontend URL
- Check browser network tab for exact error

### **Database Connection Issues**
- Verify connection string format
- Check Supabase service status
- Ensure correct credentials

### **WebSocket Issues**
- Test with WSS (not WS) in production
- Verify WebSocket endpoint is accessible
- Check firewall/proxy settings

---

## 📞 **Support & Next Steps**

Your Charnoks application is now production-ready! 🎉

**Key URLs to bookmark:**
- Frontend: `https://your-app.vercel.app`
- Backend API: `https://your-backend.onrender.com`
- MCP Server: `https://your-mcp-server.onrender.com`
- Database: Supabase dashboard

**Need help?**
- Check health endpoints first
- Review logs in deployment dashboards
- Test API endpoints with curl
- Monitor error tracking (Sentry)

Your MCP-integrated chicken business application is ready to help users manage their operations with AI-powered insights! 🐔🤖