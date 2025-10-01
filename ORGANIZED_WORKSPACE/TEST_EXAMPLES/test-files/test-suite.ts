/**
 * Comprehensive Test Suite for Production MCP Server
 * Tests API endpoints, MCP protocol compliance, and integration functionality
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3002';
const TEST_TIMEOUT = 30000;

// Helper function to handle unknown response types
function assertResponseData(data: unknown): any {
  return data as any;
}

// Test data
const testBranchId = uuidv4();
const testUserId = uuidv4();
const testNoteContent = `Daily chicken report for ${new Date().toDateString()}:
- Fed 50 chickens with 10kg layer feed
- Collected 35 eggs (small: 5, medium: 20, large: 10)
- Sold 30 eggs to local market for $2 each (total: $60)
- Purchased 5kg corn feed for $25
- Noticed 2 chickens with slight cough, isolated them
- Cleaned coop and water containers
- Next: order more layer feed, monitor sick chickens`;

describe('MCP Server Integration Tests', () => {
  let supabaseClient: any;

  beforeAll(async () => {
    // Initialize test database connection
    supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Wait for server to be ready
    await waitForServer();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('Health Checks', () => {
    test('Health endpoint returns healthy status', async () => {
      const response = await fetch(`${TEST_SERVER_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect((data as any).status).toMatch(/healthy|degraded/);
      expect((data as any).services).toBeDefined();
      expect((data as any).services.gemini).toBeDefined();
      expect((data as any).services.supabase).toBeDefined();
    });

    test('Health check includes all required services', async () => {
      const response = await fetch(`${TEST_SERVER_URL}/health`);
      const data = await response.json();

      expect(assertResponseData(data).services.gemini.overall).toMatch(/healthy|degraded|unhealthy/);
      expect(assertResponseData(data).services.supabase.status).toMatch(/healthy|unhealthy/);
      expect(assertResponseData(data).uptime).toBeGreaterThan(0);
      expect(assertResponseData(data).version).toBeDefined();
    });
  });

  describe('API Endpoints', () => {
    test('List tools endpoint returns available tools', async () => {
      const response = await fetch(`${TEST_SERVER_URL}/api/tools`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(assertResponseData(data).tools).toBeInstanceOf(Array);
      expect(assertResponseData(data).tools.length).toBeGreaterThan(0);

      const toolNames = assertResponseData(data).tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('parse_chicken_note');
      expect(toolNames).toContain('generate_business_analysis');
      expect(toolNames).toContain('search_similar_notes');
    });

    test('Models endpoint returns model information', async () => {
      const response = await fetch(`${TEST_SERVER_URL}/api/models`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(assertResponseData(data).models).toBeDefined();
      expect(typeof assertResponseData(data).models).toBe('object');
      expect(assertResponseData(data).default_selection_strategy).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    test('Parse chicken note tool works correctly', async () => {
      const requestBody = {
        name: 'parse_chicken_note',
        arguments: {
          content: testNoteContent,
          branch_id: testBranchId,
          author_id: testUserId,
          local_uuid: uuidv4(),
          priority: 'medium'
        }
      };

      const response = await fetch(`${TEST_SERVER_URL}/api/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(assertResponseData(data).success).toBe(true);
      expect(assertResponseData(data).result.note_id).toBeDefined();
      expect(assertResponseData(data).result.parsed).toBeDefined();
      expect(assertResponseData(data).result.status).toBe('parsed');

      // Validate parsed structure
      const parsed = assertResponseData(data).result.parsed;
      expect(parsed.purchases || parsed.sales || parsed.expenses).toBeDefined();
    }, TEST_TIMEOUT);

    test('Generate embeddings tool works correctly', async () => {
      const requestBody = {
        name: 'generate_embeddings',
        arguments: {
          texts: [
            'Daily chicken feeding report',
            'Egg collection summary',
            'Health observation notes'
          ],
          batch_size: 5
        }
      };

      const response = await fetch(`${TEST_SERVER_URL}/api/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(assertResponseData(data).success).toBe(true);
      expect(assertResponseData(data).result.embeddings).toBeInstanceOf(Array);
      expect(assertResponseData(data).result.embeddings.length).toBe(3);
      expect(assertResponseData(data).result.dimensions).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    test('Batch AI processing works correctly', async () => {
      const requestBody = {
        name: 'batch_ai_processing',
        arguments: {
          requests: [
            {
              prompt: 'Analyze this chicken health data: 2 chickens with cough symptoms',
              task_type: {
                complexity: 'medium',
                type: 'analysis',
                priority: 'high'
              },
              priority: 'high'
            },
            {
              prompt: 'Calculate profit from: sold 30 eggs at $2 each, feed cost $25',
              task_type: {
                complexity: 'simple',
                type: 'text',
                priority: 'medium'
              },
              priority: 'medium'
            }
          ],
          max_concurrency: 2
        }
      };

      const response = await fetch(`${TEST_SERVER_URL}/api/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(assertResponseData(data).success).toBe(true);
      expect(assertResponseData(data).result).toBeInstanceOf(Array);
      expect(assertResponseData(data).result.length).toBe(2);
      expect(assertResponseData(data).result.every((r: any) => r.success === true)).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Database Integration', () => {
    test('Note parsing stores data correctly in database', async () => {
      const localUuid = uuidv4();
      
      // Parse a note
      const parseResponse = await fetch(`${TEST_SERVER_URL}/api/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: JSON.stringify({
          name: 'parse_chicken_note',
          arguments: {
            content: testNoteContent,
            branch_id: testBranchId,
            author_id: testUserId,
            local_uuid: localUuid,
            priority: 'medium'
          }
        })
      });

      const parseData = await parseResponse.json();
      expect(assertResponseData(parseData).success).toBe(true);

      const noteId = assertResponseData(parseData).result.note_id;

      // Verify note exists in database
      const { data: noteData, error } = await supabaseClient
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();

      expect(error).toBeNull();
      expect(noteData).toBeDefined();
      expect(noteData.local_uuid).toBe(localUuid);
      expect(noteData.content).toBe(testNoteContent);
      expect(noteData.status).toBe('parsed');
      expect(noteData.parsed).toBeDefined();

      // Verify embedding exists
      const { data: embeddingData, error: embeddingError } = await supabaseClient
        .from('note_embeddings')
        .select('*')
        .eq('note_id', noteId)
        .single();

      expect(embeddingError).toBeNull();
      expect(embeddingData).toBeDefined();
      expect(assertResponseData(embeddingData).embedding).toBeInstanceOf(Array);
      expect(assertResponseData(embeddingData).embedding.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    test('Operations sync works correctly', async () => {
      const operations = [
        {
          local_uuid: uuidv4(),
          operation_type: 'sale',
          operation_details: {
            product: 'eggs',
            quantity: 30,
            unit_price: 2.00,
            total_amount: 60.00,
            customer: 'Local Market'
          },
          branch_id: testBranchId,
          author_id: testUserId
        },
        {
          local_uuid: uuidv4(),
          operation_type: 'purchase',
          operation_details: {
            item: 'corn feed',
            quantity: 5,
            unit_price: 5.00,
            total_cost: 25.00,
            supplier: 'Feed Store'
          },
          branch_id: testBranchId,
          author_id: testUserId
        }
      ];

      const response = await fetch(`${TEST_SERVER_URL}/api/tools/call`, {
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

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(assertResponseData(data).success).toBe(true);
      expect(assertResponseData(data).result).toBeInstanceOf(Array);
      expect(assertResponseData(data).result.length).toBe(2);
      expect(assertResponseData(data).result.every((r: any) => r.status === 'success')).toBe(true);

      // Verify operations in database
      for (const operation of operations) {
        const { data: opData, error } = await supabaseClient
          .from('operations')
          .select('*')
          .eq('local_uuid', operation.local_uuid)
          .single();

        expect(error).toBeNull();
        expect(opData).toBeDefined();
        expect(opData.operation_type).toBe(operation.operation_type);
      }
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    test('Invalid tool name returns appropriate error', async () => {
      const response = await fetch(`${TEST_SERVER_URL}/api/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: JSON.stringify({
          name: 'invalid_tool_name',
          arguments: {}
        })
      });

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(assertResponseData(data).success).toBe(false);
      expect(assertResponseData(data).error).toContain('Tool not found');
    });

    test('Missing required arguments returns validation error', async () => {
      const response = await fetch(`${TEST_SERVER_URL}/api/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': testUserId
        },
        body: JSON.stringify({
          name: 'parse_chicken_note',
          arguments: {
            // Missing required fields
            content: 'test'
            // branch_id and author_id missing
          }
        })
      });

      const data = await response.json();

      expect(response.status).toBe(500);
      expect(assertResponseData(data).success).toBe(false);
      expect(assertResponseData(data).error).toBeDefined();
    });

    test('Rate limiting works correctly', async () => {
      // Make many requests quickly to trigger rate limit
      const promises = Array.from({ length: 60 }, () =>
        fetch(`${TEST_SERVER_URL}/api/tools`, {
          headers: { 'X-User-ID': testUserId }
        })
      );

      const responses = await Promise.allSettled(promises);
      const rateLimitedResponses = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    test('API response times are within acceptable limits', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${TEST_SERVER_URL}/api/tools`);
      
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('Concurrent requests are handled correctly', async () => {
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, () =>
        fetch(`${TEST_SERVER_URL}/health`)
      );

      const startTime = Date.now();
      const responses = await Promise.allSettled(promises);
      const totalTime = Date.now() - startTime;

      const successfulResponses = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 200
      );

      expect(successfulResponses.length).toBe(concurrentRequests);
      expect(totalTime).toBeLessThan(5000); // All requests should complete within 5 seconds
    });
  });

  // Helper functions
  async function waitForServer(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${TEST_SERVER_URL}/health`);
        if (response.status === 200) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Server did not become ready within timeout');
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up test notes
      await supabaseClient
        .from('notes')
        .delete()
        .eq('branch_id', testBranchId);

      // Clean up test operations
      await supabaseClient
        .from('operations')
        .delete()
        .eq('branch_id', testBranchId);

      // Clean up test summaries
      await supabaseClient
        .from('summaries')
        .delete()
        .eq('branch_id', testBranchId);

      console.log('Test data cleanup completed');
    } catch (error) {
      console.warn('Test data cleanup failed:', error);
    }
  }
});

// Manual test runner for development
export async function runManualTests(): Promise<void> {
  console.log('🧪 Running manual MCP server tests...');

  try {
    // Test 1: Health Check
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await fetch(`${TEST_SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    console.log(`✅ Health status: ${assertResponseData(healthData).status}`);

    // Test 2: List Tools
    console.log('\n2. Testing tools endpoint...');
    const toolsResponse = await fetch(`${TEST_SERVER_URL}/api/tools`);
    const toolsData = await toolsResponse.json();
    console.log(`✅ Available tools: ${assertResponseData(toolsData).tools.length}`);

    // Test 3: Parse Note
    console.log('\n3. Testing note parsing...');
    const parseResponse = await fetch(`${TEST_SERVER_URL}/api/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': testUserId
      },
      body: JSON.stringify({
        name: 'parse_chicken_note',
        arguments: {
          content: testNoteContent,
          branch_id: testBranchId,
          author_id: testUserId,
          local_uuid: uuidv4()
        }
      })
    });

    const parseData = await parseResponse.json();
    if (assertResponseData(parseData).success) {
      console.log('✅ Note parsing successful');
      console.log(`   Note ID: ${assertResponseData(parseData).result.note_id}`);
    } else {
      console.log('❌ Note parsing failed:', assertResponseData(parseData).error);
    }

    // Test 4: Generate Embeddings
    console.log('\n4. Testing embedding generation...');
    const embeddingResponse = await fetch(`${TEST_SERVER_URL}/api/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': testUserId
      },
      body: JSON.stringify({
        name: 'generate_embeddings',
        arguments: {
          texts: ['Test chicken report', 'Egg collection data'],
          batch_size: 2
        }
      })
    });

    const embeddingData = await embeddingResponse.json();
    if (assertResponseData(embeddingData).success) {
      console.log('✅ Embedding generation successful');
      console.log(`   Generated ${assertResponseData(embeddingData).result.embeddings.length} embeddings`);
    } else {
      console.log('❌ Embedding generation failed:', assertResponseData(embeddingData).error);
    }

    console.log('\n🎉 Manual tests completed!');

  } catch (error) {
    console.error('❌ Manual tests failed:', error);
  }
}

// Export for use in other test files
export { TEST_SERVER_URL, testBranchId, testUserId, testNoteContent };