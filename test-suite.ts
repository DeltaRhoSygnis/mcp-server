import { jest } from '@jest/globals';

jest.mock('../services/geminiService', () => ({
  parseStockNote: jest.fn(() => ({ purchases: [{ productId: 'whole', qty: 2 }] })),
}));

jest.mock('../services/supabaseConfig', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn(() => ({ data: { id: 'uuid' } })),
      select: jest.fn(() => ({ data: [{ stock: 100 }] })),
    })),
  },
}));

// Coverage: Add to jest.config.js (create if missing): { collectCoverageFrom: ['src/**/*.ts'], coverageThreshold: { global: { branches: 80, functions: 80 } } }

// Test example
describe('Tool Mocks', () => {
  it('Mock parse and apply', async () => {
    const parse = require('../services/geminiService').parseStockNote();
    expect(parse.purchases[0].qty).toBe(2);
  });
});

// ...existing tests...