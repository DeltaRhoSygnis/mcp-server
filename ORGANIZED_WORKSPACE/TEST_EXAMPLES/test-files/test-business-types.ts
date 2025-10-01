// Test file to verify BusinessAdvice interface
import { BusinessAdvice } from './src/types/business';
import { ContextualAdvice } from './src/services/aiStoreAdvisor';

// Test that BusinessAdvice has all required properties
const testAdvice: BusinessAdvice = {
  // ContextualAdvice properties
  type: 'guidance',
  priority: 'medium',
  title: 'Test Advice',
  message: 'This is a test message',
  action_suggested: 'Test action',
  data_source: 'test',
  confidence: 0.8,
  // BusinessAdvice extensions
  business_impact: 'medium',
  recommended_timeline: 'short_term',
  implementation_difficulty: 'moderate',
  category: 'operations'
};

console.log('BusinessAdvice type test passed:', testAdvice);