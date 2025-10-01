# 🖥️ **BACKEND INTEGRATION PACKAGE**
## Complete MCP integration files for your backend application

This folder contains all the necessary files to integrate your backend (Express.js/Node.js) with the MCP server.

---

## 📁 **File Structure**

```
BACKEND_INTEGRATION/
├── README.md                           # This file
├── services/
│   └── mcpBackendClient.ts            # MCP client for server-to-server communication
├── middleware/
│   └── mcpMiddleware.ts               # Express.js middleware collection
├── routes/
│   └── mcpRoutes.ts                   # API routes for MCP integration
├── jobs/
│   └── mcpCronJobs.ts                 # Background jobs and cron tasks
├── config/
│   ├── database.ts                    # Database configuration
│   └── cors.ts                        # CORS configuration
├── types/
│   └── mcp.types.ts                   # TypeScript type definitions
└── examples/
    ├── complete-express-app.ts        # Complete Express.js application
    └── basic-integration.ts           # Basic usage example
```

---

## 🚀 **Quick Start**

### **1. Copy Files to Your Project**
Copy all files from this directory to your backend project:

```bash
# Copy to your Express.js project
cp -r BACKEND_INTEGRATION/services/* src/services/
cp -r BACKEND_INTEGRATION/middleware/* src/middleware/
cp -r BACKEND_INTEGRATION/routes/* src/routes/
cp -r BACKEND_INTEGRATION/jobs/* src/jobs/
cp -r BACKEND_INTEGRATION/config/* src/config/
cp -r BACKEND_INTEGRATION/types/* src/types/
```

### **2. Install Dependencies**
```bash
npm install @modelcontextprotocol/sdk axios express-rate-limit jsonwebtoken ws uuid zod helmet compression cors
```

### **3. Environment Variables**
Add to your `.env`:
```bash
NODE_ENV=production
MCP_SERVER_URL=https://your-mcp-server.onrender.com
MCP_AUTH_TOKEN=your_backend_auth_token
JWT_SECRET=your_super_secure_jwt_secret_min_32_chars
DATABASE_URL=postgresql://user:password@host:port/database
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### **4. Basic Usage**
```typescript
import express from 'express';
import { MCPMiddleware } from './middleware/mcpMiddleware';
import mcpRoutes from './routes/mcpRoutes';

const app = express();

// Apply MCP middleware
app.use(MCPMiddleware.complete({
  authRequired: true,
  corsEnabled: true
}));

// Use MCP routes
app.use('/api/mcp', mcpRoutes);

app.listen(8000, () => {
  console.log('🚀 Backend with MCP integration running on port 8000');
});
```

---

## 🎯 **Key Features**

- ✅ **Server-to-Server Communication** - Secure MCP client
- ✅ **Express.js Middleware** - Authentication, rate limiting, CORS
- ✅ **RESTful API Routes** - Complete MCP endpoints
- ✅ **Background Jobs** - Cron jobs for automated tasks
- ✅ **Authentication** - JWT token management
- ✅ **Error Handling** - Comprehensive error management
- ✅ **Rate Limiting** - Per-user and per-branch limits
- ✅ **Batch Processing** - Handle multiple requests efficiently

---

## 🔧 **API Endpoints**

### **Authentication**
- `POST /auth/login` - User authentication
- `POST /auth/refresh` - Token refresh

### **MCP Integration**
- `POST /api/mcp/process-note` - Process single chicken note
- `POST /api/mcp/batch-process-notes` - Batch process multiple notes
- `POST /api/mcp/business-advice` - Get AI business advice
- `POST /api/mcp/search-context` - Search business context
- `POST /api/mcp/forecast` - Generate sales forecasts
- `POST /api/mcp/call-tool` - Generic tool calling
- `GET /api/mcp/tools` - List available tools
- `GET /api/mcp/metrics` - Performance metrics

### **Health Checks**
- `GET /health` - Overall health status
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

---

## 📚 **Documentation**

- See `../DOCUMENTATION/COMPLETE_MCP_INTEGRATION_GUIDE.md` for comprehensive guide
- Check `examples/` folder for implementation examples
- Review middleware documentation for customization options

---

## 🔧 **Customization**

All files are designed to be customizable:

- **Authentication**: Modify JWT implementation in middleware
- **Database**: Update database configuration and models
- **API Endpoints**: Add custom routes and business logic
- **Background Jobs**: Configure cron schedules and tasks
- **Rate Limiting**: Adjust limits per your requirements

---

## 🛡️ **Security Features**

- ✅ **JWT Authentication** - Secure token management
- ✅ **CORS Protection** - Configurable origin whitelist
- ✅ **Rate Limiting** - Prevent abuse and DoS attacks
- ✅ **Input Validation** - Zod schema validation
- ✅ **Error Sanitization** - Safe error responses
- ✅ **Security Headers** - Helmet.js integration

---

## 📊 **Monitoring & Logging**

- ✅ **Request Logging** - Structured logging with metadata
- ✅ **Performance Metrics** - Response times and success rates
- ✅ **Health Checks** - Multiple health check endpoints
- ✅ **Error Tracking** - Comprehensive error handling

---

**Ready to integrate! 🚀**