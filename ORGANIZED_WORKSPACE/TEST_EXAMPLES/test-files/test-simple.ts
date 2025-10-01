/**
 * Simple Test Runner for MCP Server
 * Manual testing without complex dependencies
 */

import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3002';
const testBranchId = uuidv4();
const testUserId = uuidv4();
const testContent = `Daily chicken report:
- Fed 50 chickens with 10kg layer feed
- Collected 35 eggs (small: 5, medium: 20, large: 10)
- Sold 30 eggs to local market for $2 each (total: $60)
- Purchased 5kg corn feed for $25
- Noticed 2 chickens with slight cough, isolated them`;

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration: number;
  data?: any;
}

class SimpleTestRunner {
  private results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        success: true,
        message: 'Test passed',
        duration
      });
      
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      
      this.results.push({
        name,
        success: false,
        message,
        duration
      });
      
      console.log(`❌ ${name} - ${message} (${duration}ms)`);
    }
  }

  async waitForServer(maxAttempts = 30): Promise<void> {
    console.log('⏳ Waiting for server to be ready...');
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${SERVER_URL}/health`);
        if (response.status === 200) {
          console.log('✅ Server is ready');
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Server did not become ready within timeout');
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting MCP Server Tests...\n');

    try {
      // Wait for server
      await this.waitForServer();

      // Test 1: Health Check
      await this.runTest('Health Check', async () => {
        const response = await fetch(`${SERVER_URL}/health`);
        const data = await response.json() as any;
        
        if (response.status !== 200) {
          throw new Error(`Health check failed: ${response.status}`);
        }
        
        if (!data.status || !['healthy', 'degraded'].includes(data.status)) {
          throw new Error(`Invalid health status: ${data.status}`);
        }
      });

      // Test 2: List Tools
      await this.runTest('List Tools', async () => {
        const response = await fetch(`${SERVER_URL}/api/tools`);
        const data = await response.json() as any;
        
        if (response.status !== 200) {
          throw new Error(`Tools endpoint failed: ${response.status}`);
        }
        
        if (!Array.isArray(data.tools) || data.tools.length === 0) {
          throw new Error('No tools returned');
        }
        
        const hasParseNote = data.tools.some((tool: any) => tool.name === 'parse_chicken_note');
        if (!hasParseNote) {
          throw new Error('parse_chicken_note tool not found');
        }
      });

      // Test 3: Parse Note
      await this.runTest('Parse Chicken Note', async () => {
        const response = await fetch(`${SERVER_URL}/api/tools/call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': testUserId
          },
          body: JSON.stringify({
            name: 'parse_chicken_note',
            arguments: {
              content: testContent,
              branch_id: testBranchId,
              author_id: testUserId,
              local_uuid: uuidv4()
            }
          })
        });

        const data = await response.json() as any;
        
        if (response.status !== 200) {
          throw new Error(`Parse note failed: ${response.status} - ${data.error || 'Unknown error'}`);
        }
        
        if (!data.success) {
          throw new Error(`Parse note unsuccessful: ${data.error}`);
        }
        
        if (!data.result.note_id || !data.result.parsed) {
          throw new Error('Missing note_id or parsed data');
        }
      });

      // Test 4: Generate Embeddings
      await this.runTest('Generate Embeddings', async () => {
        const response = await fetch(`${SERVER_URL}/api/tools/call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': testUserId
          },
          body: JSON.stringify({
            name: 'generate_embeddings',
            arguments: {
              texts: ['Chicken feed report', 'Egg collection data']
            }
          })
        });

        const data = await response.json() as any;
        
        if (response.status !== 200) {
          throw new Error(`Generate embeddings failed: ${response.status} - ${data.error || 'Unknown error'}`);
        }
        
        if (!data.success) {
          throw new Error(`Generate embeddings unsuccessful: ${data.error}`);
        }
        
        if (!Array.isArray(data.result.embeddings) || data.result.embeddings.length !== 2) {
          throw new Error('Invalid embeddings result');
        }
      });

      // Test 5: Sync Operations
      await this.runTest('Sync Operations', async () => {
        const operations = [
          {
            local_uuid: uuidv4(),
            operation_type: 'sale',
            operation_details: {
              product: 'eggs',
              quantity: 30,
              unit_price: 2.00,
              total: 60.00
            },
            branch_id: testBranchId,
            author_id: testUserId
          }
        ];

        const response = await fetch(`${SERVER_URL}/api/tools/call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': testUserId
          },
          body: JSON.stringify({
            name: 'sync_operations',
            arguments: { operations }
          })
        });

        const data = await response.json() as any;
        
        if (response.status !== 200) {
          throw new Error(`Sync operations failed: ${response.status} - ${data.error || 'Unknown error'}`);
        }
        
        if (!data.success) {
          throw new Error(`Sync operations unsuccessful: ${data.error}`);
        }
        
        if (!Array.isArray(data.result) || data.result[0].status !== 'success') {
          throw new Error('Sync operations did not succeed');
        }
      });

      // Test 6: Error Handling
      await this.runTest('Error Handling', async () => {
        const response = await fetch(`${SERVER_URL}/api/tools/call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': testUserId
          },
          body: JSON.stringify({
            name: 'invalid_tool',
            arguments: {}
          })
        });

        if (response.status !== 404) {
          throw new Error(`Expected 404 for invalid tool, got ${response.status}`);
        }
        
        const data = await response.json() as any;
        
        if (data.success !== false) {
          throw new Error('Expected success: false for invalid tool');
        }
      });

      // Test 7: Performance Check
      await this.runTest('Performance Check', async () => {
        const startTime = Date.now();
        
        const response = await fetch(`${SERVER_URL}/health`);
        
        const responseTime = Date.now() - startTime;
        
        if (response.status !== 200) {
          throw new Error(`Health check failed: ${response.status}`);
        }
        
        if (responseTime > 2000) {
          throw new Error(`Response too slow: ${responseTime}ms`);
        }
      });

    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
    }

    this.printSummary();
  }

  private printSummary(): void {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;
    
    console.log('\n📊 Test Summary:');
    console.log(`Total: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.name}: ${r.message}`));
    }
    
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`\nTotal Duration: ${totalDuration}ms`);
    
    if (passed === total) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n⚠️  Some tests failed. Check the output above for details.');
      process.exit(1);
    }
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new SimpleTestRunner();
  runner.runAllTests().catch(console.error);
}

export { SimpleTestRunner };