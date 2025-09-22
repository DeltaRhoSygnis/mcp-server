// Quick test to verify offline data functionality
// Run this in browser console to test IndexedDB and offline services

async function testOfflineData() {
  console.log('🧪 Testing Offline Data System...');
  
  try {
    // Import services (adjust path as needed)
    const { offlineDB } = await import('./services/offlineService.js');
    const { offlineDataInitService } = await import('./services/offlineDataInitService.js');
    const { offlineFirstDataService } = await import('./services/offlineFirstDataService.js');
    
    // Initialize
    await offlineDB.init();
    await offlineDataInitService.initializeOfflineData();
    
    // Test data availability
    const stats = await offlineDataInitService.getOfflineDataStats();
    console.log('📊 Offline Data Stats:', stats);
    
    // Test offline-first loading
    const sales = await offlineFirstDataService.getSales(5);
    const expenses = await offlineFirstDataService.getExpenses(5);
    
    console.log('💰 Sample Sales:', sales.slice(0, 2));
    console.log('💸 Sample Expenses:', expenses.slice(0, 2));
    
    // Test data creation
    const testSale = {
      description: 'Test Offline Sale',
      total: 99.99,
      items: [{ name: 'Test Item', quantity: 1, price: 99.99 }],
      worker_name: 'Test Worker',
      payment_method: 'cash'
    };
    
    await offlineDB.save('sales', testSale);
    console.log('✅ Test sale saved to IndexedDB');
    
    // Verify it was saved
    const allSales = await offlineDB.getAll('sales');
    const testSaleFound = allSales.find(s => s.description === 'Test Offline Sale');
    
    if (testSaleFound) {
      console.log('✅ Test sale successfully retrieved from IndexedDB');
      console.log('🎉 ALL TESTS PASSED - Offline system is working!');
    } else {
      console.error('❌ Test sale not found in IndexedDB');
    }
    
    return {
      success: true,
      stats,
      salesCount: sales.length,
      expensesCount: expenses.length,
      testSaleCreated: !!testSaleFound
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

// Auto-run test if in browser
if (typeof window !== 'undefined') {
  console.log('🚀 Run testOfflineData() in console to test offline functionality');
  window.testOfflineData = testOfflineData;
}

export { testOfflineData };