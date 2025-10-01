# 🚀 **AI MODELS REQUIREMENTS & FREE TIER ANALYS#### **TIER 3: External APIs (Final Fallback - As Needed)**
- **Emergency Fallback Operations**
- **Load Balancing During Peak**
- **Free Tier Optimization**
- **Specialized Model Access**

| Required Model | Purpose | Current Usage | TPM Requirement | Priority |
|---------------|---------|---------------|-----------------|----------|
| OpenRouter Models | Free tier alternatives | Fallback processing | Variable (free limits) | **EXTERNAL_HIGH** |
| HuggingFace Models | Specialized tasks | Embeddings, chat | Variable (free inference) | **EXTERNAL_MEDIUM** |
| Cohere Models | Premium features | High-quality embeddings | Variable (trial credits) | **EXTERNAL_PREMIUM** |sed on current MCP server implementation and Gemini 2.0 migration analysis*

## 📋 **CURRENT SYSTEM ANALYSIS**

### **Vector Database Implementation:**
- ✅ **Currently using:** Supabase PostgreSQL with pgvector extension (NOT Pinecone)
- ✅ **Embedding model:** `text-embedding-004` (Gemini Embedding - confirmed active)
- ✅ **Vector functions:** PostgreSQL stored procedures for similarity search
- ✅ **Storage:** 1536-dimensional vectors stored in PostgreSQL tables

### **Deprecated Models Found (Need Migration):**
```typescript
// DEPRECATED - Found in codebase, needs migration
'gemini-1.5-pro': { // ❌ DEPRECATED
  rateLimit: { rpm: 5, tpm: 300000 }
},
'gemini-1.5-flash': { // ❌ DEPRECATED  
  rateLimit: { rpm: 15, tpm: 1000000 }
}
```

## 🎯 **REQUIRED AI MODELS FOR MIGRATION**

### **1. PRIMARY TEXT GENERATION MODELS**

#### **TIER 1: Gemini 2.5 Series (Primary Layer - 10-20% TPM Usage)**
- **Ultra-High Performance Business Analysis**
- **Advanced Voice Processing with Preview Features**
- **Strategic Decision Making with Latest Models**
- **Cutting-Edge AI Capabilities**

| Required Model | Purpose | Current Usage | TPM Requirement | Priority |
|---------------|---------|---------------|-----------------|----------|
| `gemini-2.5-pro` | Complex business analysis, strategic insights | Business intelligence, forecasting | 25,000-50,000 TPM (10-20% of 250k) | **CRITICAL** |
| `gemini-2.5-flash` | Fast structured parsing, primary processing | Voice parsing, business conversations | 18,750-37,500 TPM (7.5-15% of 250k) | **HIGH** |
| `gemini-2.5-flash-preview` | Preview features, cutting-edge analysis | Experimental parsing, advanced features | 18,750-37,500 TPM (7.5-15% of 250k) | **HIGH** |
| `gemini-2.5-flash-lite` | Lightweight, efficient processing | Quick classification, real-time chat | 12,500-25,000 TPM (5-10% of 250k) | **MEDIUM** |
| `gemini-2.5-flash-lite-preview` | Experimental lightweight features | Beta testing, preview capabilities | 12,500-25,000 TPM (5-10% of 250k) | **MEDIUM** |

#### **TIER 2: Gemini 2.0 Series (Fallback Layer - 5-20% TPM Usage)**
- **Reliable Secondary Processing**
- **High-Throughput Operations**
- **Experimental Features Testing**
- **Backup for Primary Models**

| Required Model | Purpose | Current Usage | TPM Requirement | Priority |
|---------------|---------|---------------|-----------------|----------|
| `gemini-2.0-flash-thinking-exp` | Multi-step reasoning, complex analysis | Complex note parsing, decision trees | 100,000-200,000 TPM (10-20% of 1M) | **FALLBACK_HIGH** |
| `gemini-2.0-flash` | General processing, conversations | Chat, worker advice, general parsing | 75,000-150,000 TPM (7.5-15% of 1M) | **FALLBACK_MEDIUM** |
| `gemini-2.0-flash-exp` | Experimental features, high throughput | Development, testing, experimental features | 50,000-100,000 TPM (5-10% of 1M) | **FALLBACK_LOW** |
| `gemini-2.0-flash-lite` | Lightweight processing, quick responses | Simple classifications, lightweight tasks | 25,000-50,000 TPM (2.5-5% of 1M) | **FALLBACK_LIGHT** |

#### **Low-Severity Tasks (1-5% TPM Usage)**
- **Simple Classifications**
- **Quick Responses**
- **Basic Parsing**

| Required Model | Purpose | Current Usage | TPM Requirement | Priority |
|---------------|---------|---------------|-----------------|----------|
| `gemini-2.0-flash-lite` | Lightweight, fast processing | Simple classifications, quick responses | 10,000-50,000 TPM (1-5% of 1M) | **LOW** |
| `gemini-2.0-flash-exp` | Experimental features, high throughput | Development, testing, experimental features | 10,000-50,000 TPM (1-5% of 1M) | **LOW** |

### **2. EMBEDDING & VECTOR MODELS**

#### **Semantic Search & Vector Operations**
| Required Model | Purpose | Current Usage | TPM Requirement | Priority |
|---------------|---------|---------------|-----------------|----------|
| `text-embedding-004` ✅ | Vector embeddings, semantic search | Already implemented - vector DB operations | 3,000-6,000 TPM (10-20% of 30k) | **CRITICAL** |

## 🔍 **OPENROUTER, HUGGINGFACE & COHERE REQUIREMENTS**

### **OpenRouter Models Needed (Free Tier):**

#### **Primary Text Generation (Fallback/Load Balancing)**
```yaml
OpenRouter_Models_Required:
  - model: "meta-llama/llama-3.2-11b-vision-instruct:free"
    purpose: "Business analysis, visual receipt processing"
    tpm_needed: 50000
    function: "Complex business intelligence, receipt OCR"
    
  - model: "meta-llama/llama-3.2-3b-instruct:free" 
    purpose: "Fast text processing, conversations"
    tpm_needed: 100000
    function: "Chat responses, quick classifications"
    
  - model: "google/gemma-2-9b-it:free"
    purpose: "Structured data extraction, JSON parsing"
    tpm_needed: 75000
    function: "Voice parsing, note analysis"
    
  - model: "microsoft/phi-3-mini-128k-instruct:free"
    purpose: "Long context processing, document analysis"
    tpm_needed: 60000
    function: "Daily summaries, long business reports"
```

#### **Specialized Models**
```yaml
OpenRouter_Specialized:
  - model: "qwen/qwen-2.5-7b-instruct:free"
    purpose: "Reasoning and planning tasks"
    tpm_needed: 40000
    function: "Strategic business planning, workflow optimization"
    
  - model: "openchat/openchat-7b:free"
    purpose: "Conversational AI, customer support"
    tpm_needed: 30000
    function: "Worker assistance, customer chat"
```

### **HuggingFace Models Needed (Free Inference API):**

#### **Text Generation Models**
```yaml
HuggingFace_Models_Required:
  - model: "microsoft/DialoGPT-large"
    purpose: "Conversational AI, chat responses"
    function: "Worker chat, customer support automation"
    tpm_needed: 20000
    
  - model: "facebook/blenderbot-400M-distill"
    purpose: "Quick responses, simple conversations"
    function: "Fast chat replies, basic Q&A"
    tpm_needed: 30000
    
  - model: "google/flan-t5-large"
    purpose: "Instruction following, task completion"
    function: "Business task automation, instruction parsing"
    tpm_needed: 25000
```

#### **Embedding Models (Alternative to Gemini)**
```yaml
HuggingFace_Embeddings:
  - model: "sentence-transformers/all-MiniLM-L6-v2"
    purpose: "Lightweight embeddings, semantic search"
    function: "Vector search fallback, similarity matching"
    dimensions: 384
    
  - model: "sentence-transformers/all-mpnet-base-v2"
    purpose: "High-quality embeddings, better accuracy"
    function: "Primary vector search, business document similarity"
    dimensions: 768
    
  - model: "sentence-transformers/multi-qa-MiniLM-L6-cos-v1"
    purpose: "Question-answering, customer support"
    function: "FAQ matching, customer query understanding"
    dimensions: 384
```

### **Cohere Models Needed (Free Trial):**

#### **Text Generation & Analysis**
```yaml
Cohere_Models_Required:
  - model: "command-light"
    purpose: "Fast text generation, quick responses"
    function: "Real-time chat, immediate responses"
    tpm_needed: 40000
    
  - model: "command"
    purpose: "Complex text analysis, business insights"
    function: "Business intelligence, detailed analysis"
    tpm_needed: 20000
```

#### **Embedding Models**
```yaml
Cohere_Embeddings:
  - model: "embed-english-v3.0"
    purpose: "High-quality English embeddings"
    function: "Business document embeddings, semantic search"
    dimensions: 1024
    
  - model: "embed-multilingual-v3.0"
    purpose: "Multi-language support"
    function: "International business operations"
    dimensions: 1024
```

## 🛠️ **FUNCTION-SPECIFIC MODEL REQUIREMENTS**

### **Voice Processing Pipeline (3-Tier Fallback)**
```yaml
Voice_Processing_Functions:
  primary_parsing:
    tier1: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash-preview"]
    tier2: ["gemini-2.0-flash", "gemini-2.0-flash-exp"]
    tier3: ["meta-llama/llama-3.2-3b-instruct:free", "microsoft/DialoGPT-large"]
    tpm_allocation: 80000
    
  complex_voice_analysis:
    tier1: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-preview"]
    tier2: ["gemini-2.0-flash-thinking-exp", "gemini-2.0-flash"]
    tier3: ["meta-llama/llama-3.2-11b-vision-instruct:free", "command"]
    tpm_allocation: 40000
```

### **Business Intelligence Functions (3-Tier Fallback)**
```yaml
Business_Intelligence:
  daily_summaries:
    tier1: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash-preview"]
    tier2: ["gemini-2.0-flash", "gemini-2.0-flash-exp"]
    tier3: ["google/gemma-2-9b-it:free", "command-light"]
    tpm_allocation: 60000
    
  strategic_analysis:
    tier1: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-preview"]
    tier2: ["gemini-2.0-flash-thinking-exp", "gemini-2.0-flash"]
    tier3: ["qwen/qwen-2.5-7b-instruct:free", "command"]
    tpm_allocation: 50000
    
  forecasting:
    tier1: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-preview"]
    tier2: ["gemini-2.0-flash-thinking-exp", "gemini-2.0-flash-exp"]
    tier3: ["microsoft/phi-3-mini-128k-instruct:free", "facebook/blenderbot-400M-distill"]
    tpm_allocation: 70000
```

### **Vector & Embedding Operations**
```yaml
Vector_Operations:
  primary_embeddings:
    models_needed: ["text-embedding-004"]
    fallback: ["sentence-transformers/all-mpnet-base-v2", "embed-english-v3.0"]
    tpm_allocation: 6000
    
  semantic_search:
    models_needed: ["text-embedding-004"]
    fallback: ["sentence-transformers/all-MiniLM-L6-v2"]
    tpm_allocation: 4000
```

### **Real-time Chat & Support (3-Tier Fallback)**
```yaml
Chat_Functions:
  worker_assistance:
    tier1: ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite-preview"]
    tier2: ["gemini-2.0-flash", "gemini-2.0-flash-lite"]
    tier3: ["openchat/openchat-7b:free", "microsoft/DialoGPT-large"]
    tpm_allocation: 30000
    
  customer_support:
    tier1: ["gemini-2.5-flash-lite", "gemini-2.5-flash-lite-preview", "gemini-2.5-flash"]
    tier2: ["gemini-2.0-flash-lite", "gemini-2.0-flash"]
    tier3: ["meta-llama/llama-3.2-3b-instruct:free", "facebook/blenderbot-400M-distill"]
    tpm_allocation: 25000
```

## 📊 **TOTAL TPM REQUIREMENTS (Peak Usage)**

### **TIER 1: Gemini 2.5 Models (Primary Layer)**
```
gemini-2.5-pro:                50,000 TPM (20% of 250k limit)
gemini-2.5-flash:              37,500 TPM (15% of 250k limit)
gemini-2.5-flash-preview:      37,500 TPM (15% of 250k limit)
gemini-2.5-flash-lite:         25,000 TPM (10% of 250k limit)
gemini-2.5-flash-lite-preview: 25,000 TPM (10% of 250k limit)
text-embedding-004:             6,000 TPM (20% of 30k limit)
```

### **TIER 2: Gemini 2.0 Models (Fallback Layer)**
```
gemini-2.0-flash-thinking-exp: 200,000 TPM (20% of 1M limit)
gemini-2.0-flash:              150,000 TPM (15% of 1M limit)
gemini-2.0-flash-exp:          100,000 TPM (10% of 1M limit)
gemini-2.0-flash-lite:          50,000 TPM (5% of 1M limit)
```

### **OpenRouter Models (Fallback/Load Balancing)**
```
llama-3.2-11b-vision:   50,000 TPM
llama-3.2-3b-instruct:  100,000 TPM
gemma-2-9b-it:          75,000 TPM
phi-3-mini-128k:        60,000 TPM
qwen-2.5-7b:            40,000 TPM
```

### **HuggingFace Models (Specialized Tasks)**
```
DialoGPT-large:         20,000 TPM
blenderbot-400M:        30,000 TPM
flan-t5-large:          25,000 TPM
sentence-transformers:  10,000 TPM
```

### **Cohere Models (Premium Features)**
```
command:                20,000 TPM
command-light:          40,000 TPM
embed-english-v3.0:     15,000 TPM
```

## ⚡ **IMPLEMENTATION PRIORITY**

### **Phase 1: Tier 1 Implementation (Week 1)**
1. ✅ Confirm `text-embedding-004` is working (already implemented)
2. ✅ Migrate `gemini-1.5-pro` → `gemini-2.5-pro` (completed)
3. ✅ Add `gemini-2.5-flash` variants as primary layer (completed)
4. ✅ Implement intelligent fallback selection (completed)

### **Phase 2: Tier 2 Fallback System (Week 2)**
1. ✅ Add `gemini-2.0-flash-thinking-exp` for complex reasoning (completed)
2. ✅ Add `gemini-2.0-flash` series as secondary layer (completed)
3. 🔄 Optimize rate limiting for multi-tier usage
4. 🔄 Implement dynamic load balancing

### **Phase 3: Tier 3 External APIs (Week 3)**
1. 🆕 Implement OpenRouter integration
2. 🆕 Add HuggingFace fallbacks
3. 🆕 Add Cohere premium features
4. 🆕 Complete 3-tier fallback testing

## 🎯 **VECTOR DATABASE CLARIFICATION**

**Current Implementation:**
- ✅ **PostgreSQL + pgvector** (NOT Pinecone)
- ✅ **Supabase managed PostgreSQL** with vector extension
- ✅ **1536-dimensional vectors** from `text-embedding-004`
- ✅ **SQL functions** for similarity search (cosine similarity)

**No Pinecone needed** - your vector database is already implemented efficiently with PostgreSQL pgvector extension.

## 💰 **COST OPTIMIZATION STRATEGY**

### **Free Tier Maximization:**
1. **Gemini models** - Use 10-20% of TPM limits to stay within free tier
2. **OpenRouter** - Rotate between free models for load balancing  
3. **HuggingFace** - Use free inference API for specialized tasks
4. **Cohere** - Use free trial credits for premium features

### **Usage Monitoring:**
- Real-time TPM tracking per model
- Automatic fallback when approaching limits
- Cost alerts at 80% of free tier usage
- Weekly usage reports and optimization recommendations

This comprehensive analysis provides the exact models needed for your chicken business MCP server with optimal free tier usage and high-performance AI capabilities.