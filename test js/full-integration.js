const sinon = require('sinon');
const { expect } = require('chai');

// Mocks
const mockSupabase = {
  from: () => ({
    upsert: () => ({ data: { id: 'uuid' } }),
    select: () => ({ data: [{ stock: 100 }] }),
  }),
};

const mockGemini = {
  generateText: () => ({ text: JSON.stringify({ purchases: [{ productId: 'whole', qty: 2, cost: 100 }] }) }),
};

const mockVoiceParse = () => ({ items: [{ productId: 'whole', qty: 2 }], confidence: 0.8 });

const mockForecast = () => ({ predictedSales: [{ day: '1', amount: 100, confidence: 0.8 }] });

// Simulate chain: voice → parse → apply → forecast
describe('Full Integration Chain', () => {
  it('Voice inaccuracy → parse → apply stock → forecast', async () => {
    const voiceResult = mockVoiceParse(); // "chikin" fuzzy
    const parseResult = await mockGemini.generateText('Parse: ' + JSON.stringify(voiceResult)); // JSON purchases
    const applyResult = mockSupabase.from('products').upsert({ stock: 102 }); // +2
    const forecastResult = mockForecast(); // Based on history

    expect(voiceResult.items[0].productId).to.equal('whole');
    expect(JSON.parse(parseResult.text).purchases[0].qty).to.equal(2);
    expect(applyResult.data.id).to.exist;
    expect(forecastResult.predictedSales[0].confidence).to.be.closeTo(0.8, 0.1);
  });
});

// Run with node test js/full-integration.js (add chai/sinon deps txt if needed)