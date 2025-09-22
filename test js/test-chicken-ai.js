/**
 * Test script for ChickenBusinessAI system
 * Tests the complete flow from note input to stock integration
 */

import { chickenBusinessAI } from './services/chickenBusinessAI.js';

// Test chicken business note processing
async function testChickenAI() {
  console.log('🐔 Testing ChickenBusinessAI System...\n');

  const testNotes = [
    "Bought 50 kg chicken feed for ₹2500 today",
    "Sold 20 chickens to local restaurant for ₹4000", 
    "Processed 15 chickens - got 45kg meat, stored in freezer",
    "Cooked chicken curry for 30 customers, used 8kg chicken",
    "Need to order more chicken feed for next week"
  ];

  const testBranchId = 'test-branch-001';
  const testUserRole = 'worker';

  for (let i = 0; i < testNotes.length; i++) {
    console.log(`\n--- Test ${i + 1}: Processing Note ---`);
    console.log(`Input: "${testNotes[i]}"`);
    
    try {
      const result = await chickenBusinessAI.processChickenNote(
        testNotes[i], 
        testUserRole, 
        testBranchId
      );
      
      console.log('✅ AI Processing Result:');
      console.log(`  Pattern Type: ${result.pattern?.type || 'none'}`);
      console.log(`  Confidence: ${result.pattern?.confidence || 0}%`);
      console.log(`  Items Detected: ${result.pattern?.items?.length || 0}`);
      
      if (result.stockResults) {
        console.log(`  Stock Updates: ${result.stockResults.length} operations`);
        result.stockResults.forEach((stockOp, idx) => {
          console.log(`    ${idx + 1}. ${stockOp.type}: ${stockOp.message}`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Error processing note: ${error.message}`);
    }
    
    console.log('---');
  }
  
  console.log('\n🎉 ChickenBusinessAI Test Complete!');
}

// Run the test
testChickenAI().catch(console.error);