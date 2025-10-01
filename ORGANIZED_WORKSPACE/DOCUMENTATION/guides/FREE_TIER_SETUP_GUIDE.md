# Free Tier Database Setup Guide

## 🎯 What You Need to Add to Your .env

Based on your current setup, you only need to add these new environment variables:

### 1. **Neon Database (Memory DB) - REQUIRED**
```bash
# Sign up at https://neon.tech (Free: 0.5GB storage)
NEON_DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/database_name
```

### 2. **Google Drive Integration - REQUIRED for Backups**
```bash
GOOGLE_DRIVE_CLIENT_ID=your_google_client_id_here
GOOGLE_DRIVE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_DRIVE_FOLDER_ID=your_backup_folder_id
```

### 3. **Performance Configuration - RECOMMENDED**
```bash
MCP_SEPARATED_ARCHITECTURE=true
MCP_MEMORY_DB_TYPE=neon
MCP_CONTEXT_WINDOW_SIZE=2000000
MCP_MAX_TOKENS_PER_MINUTE=100000
MCP_ENABLE_RATE_LIMITING=true
MCP_ENABLE_CACHING=true
PINECONE_INDEX_NAME=chicken-business-memory
```

**✅ You already have these (great!):**
- Supabase (business database)
- Pinecone (vector database)
- Gemini API (primary AI)
- OpenRouter, HuggingFace, Cohere APIs (fallback tiers)

---

## 🆓 Step-by-Step Setup

### Step 1: Set up Neon Database (5 minutes)

1. **Sign up at [Neon.tech](https://neon.tech)**
   - Click "Sign up" (free account)
   - Choose "Continue with GitHub" for easy setup

2. **Create a new database**
   - Click "Create Project"
   - Project name: `chicken-business-memory`
   - Region: Choose closest to you (US East recommended)
   - PostgreSQL version: 15 (latest)

3. **Get connection string**
   - After creation, click "Connection Details"
   - Copy the connection string that looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/database_name
   ```

4. **Add to your .env file**
   ```bash
   NEON_DATABASE_URL=postgresql://your_actual_connection_string_here
   ```

### Step 2: Set up Google Drive API (10 minutes)

1. **Go to [Google Cloud Console](https://console.cloud.google.com)**
   - Create new project or use existing
   - Enable Google Drive API

2. **Create credentials**
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Desktop application"
   - Name: "Chicken Business MCP Backup"

3. **Download credentials JSON**
   - You'll get `client_id` and `client_secret`

4. **Get refresh token**
   ```bash
   # Use this Node.js script (I'll create it for you)
   node setup-google-drive-auth.js
   ```

### Step 3: Test Your Setup

```bash
# Test all connections
npx ts-node production-readiness-test.ts
```

---

## 🔧 Why This Architecture?

### **Current (Potential Conflicts):**
```
Business Data → Supabase #1
AI Memory → Supabase #2 ← Could conflict
Vector Data → Pinecone
```

### **New (Clean Separation):**
```
Business Data → Supabase (your current)
AI Memory → Neon PostgreSQL (separate provider)
Vector Data → Pinecone (your current)
Archives → Google Drive (long-term backup)
```

### **Benefits:**
- ✅ No Supabase conflicts
- ✅ Dedicated resources for each concern
- ✅ Better performance isolation
- ✅ Free tier optimization
- ✅ Easier debugging and monitoring

---

## 📊 Free Tier Limits

| Service | Free Tier | Your Usage | Status |
|---------|-----------|------------|---------|
| **Supabase** | 500MB, 2GB bandwidth | Business data only | ✅ Plenty |
| **Neon** | 0.5GB storage | AI memory only | ✅ Perfect |
| **Pinecone** | 1 index, 1GB vectors | Vector embeddings | ✅ Sufficient |
| **Google Drive** | 15GB storage | Excel backups | ✅ Massive |
| **Gemini** | Free tier | Primary AI | ✅ Current |
| **OpenRouter** | Free models | AI fallback | ✅ Current |

---

## 🚀 Quick Start Commands

After adding environment variables:

```bash
# 1. Install any missing dependencies
npm install pg @types/pg

# 2. Test your setup
npx ts-node production-readiness-test.ts

# 3. Deploy if tests pass
./deploy-production.sh  # Linux/macOS
# OR
deploy-production.bat   # Windows
```

---

## ❓ Need Help?

**Common Issues:**

1. **Neon connection fails**
   - Check if connection string includes `?sslmode=require`
   - Verify SSL is enabled in connection

2. **Google Drive authentication**
   - Make sure OAuth consent screen is configured
   - Use "Desktop Application" type, not "Web Application"

3. **Pinecone index not found**
   - Create index named `chicken-business-memory`
   - Use 1536 dimensions (standard for embeddings)

**Test individual components:**
```bash
# Test Neon connection
node -e "const {Client} = require('pg'); const client = new Client('$NEON_DATABASE_URL'); client.connect().then(() => console.log('✅ Neon connected')).catch(console.error)"

# Test Google Drive
curl -H "Authorization: Bearer $GOOGLE_DRIVE_ACCESS_TOKEN" https://www.googleapis.com/drive/v3/files

# Test Pinecone
curl -H "Api-Key: $PINECONE_API_KEY" https://controller.us-east1-gcp.pinecone.io/databases
```

This setup gives you a robust, conflict-free architecture using only free tier services! 🎉