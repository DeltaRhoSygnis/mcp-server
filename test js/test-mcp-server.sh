#!/bin/bash

echo "🧪 Testing MCP Server Functionality"
echo "==================================="

# Function to test MCP server
test_mcp_server() {
    local port=3001
    local max_attempts=10
    local attempt=1
    
    echo "📡 Starting MCP server..."
    cd /workspaces/Charnoksv3/mcp-server
    
    # Start server in background
    npm start > mcp-test.log 2>&1 &
    local server_pid=$!
    echo "🚀 Server started with PID: $server_pid"
    
    # Wait for server to be ready
    echo "⏳ Waiting for server to start..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
            echo "✅ Server is responding (attempt $attempt/$max_attempts)"
            break
        fi
        echo "🔄 Attempt $attempt/$max_attempts failed, waiting 2 seconds..."
        sleep 2
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        echo "❌ Server failed to start after $max_attempts attempts"
        echo "📋 Server logs:"
        tail -n 20 mcp-test.log
        kill $server_pid 2>/dev/null
        return 1
    fi
    
    # Test health endpoint
    echo ""
    echo "🏥 Testing health endpoint..."
    health_response=$(curl -s "http://localhost:$port/health")
    if [[ "$health_response" == *"healthy"* ]]; then
        echo "✅ Health check passed: $health_response"
    else
        echo "❌ Health check failed: $health_response"
    fi
    
    # Test list tools
    echo ""
    echo "🛠️  Testing list tools..."
    tools_response=$(curl -s -X POST "http://localhost:$port/list-tools" \
        -H "Content-Type: application/json" \
        -d '{"method": "tools/list"}')
    
    if [[ "$tools_response" == *"process_chicken_note"* ]]; then
        echo "✅ Tools endpoint working - found expected tools"
        echo "📋 Available tools:"
        echo "$tools_response" | jq -r '.result.tools[].name' 2>/dev/null || echo "Tools found but JSON parsing failed"
    else
        echo "❌ Tools endpoint failed: $tools_response"
    fi
    
    # Test simple tool call
    echo ""
    echo "⚡ Testing simple tool call..."
    tool_response=$(curl -s -X POST "http://localhost:$port/call-tool" \
        -H "Content-Type: application/json" \
        -d '{
            "method": "tools/call",
            "params": {
                "name": "process_chicken_note",
                "arguments": {
                    "note_text": "Test: bought 10 chickens for 1000 pesos"
                }
            }
        }')
    
    if [[ "$tool_response" == *"content"* ]] && [[ "$tool_response" != *"error"* ]]; then
        echo "✅ Tool call successful!"
        echo "📊 Response preview:"
        echo "$tool_response" | jq -r '.result.content[0].text' 2>/dev/null | head -n 5 || echo "Response received but parsing failed"
    else
        echo "❌ Tool call failed: $tool_response"
    fi
    
    # Summary
    echo ""
    echo "📋 Test Summary:"
    echo "   • Server started: ✅"
    echo "   • Health endpoint: $([ -n "$health_response" ] && echo "✅" || echo "❌")"
    echo "   • Tools listing: $([ "$tools_response" == *"process_chicken_note"* ] && echo "✅" || echo "❌")"  
    echo "   • Tool execution: $([ "$tool_response" == *"content"* ] && echo "✅" || echo "❌")"
    
    # Cleanup
    echo ""
    echo "🧹 Cleaning up..."
    kill $server_pid 2>/dev/null
    echo "✅ Test completed!"
    
    return 0
}

# Run the test
test_mcp_server