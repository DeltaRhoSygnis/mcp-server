// Simple IndexedDB test - paste this in browser console
async function testIndexedDB() {
  console.log('🧪 Testing IndexedDB...');
  
  try {
    // Test 1: Check if IndexedDB exists
    if (!window.indexedDB) {
      throw new Error('IndexedDB not supported');
    }
    console.log('✅ IndexedDB available');
    
    // Test 2: Open database
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('TestDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const store = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status');
      };
    });
    console.log('✅ Database opened');
    
    // Test 3: Save data
    const noteId = await new Promise((resolve, reject) => {
      const tx = db.transaction(['notes'], 'readwrite');
      const store = tx.objectStore('notes');
      const request = store.add({
        content: 'Test note',
        status: 'pending',
        created_at: new Date().toISOString()
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    console.log('✅ Data saved with ID:', noteId);
    
    // Test 4: Read data
    const notes = await new Promise((resolve, reject) => {
      const tx = db.transaction(['notes'], 'readonly');
      const store = tx.objectStore('notes');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    console.log('✅ Data retrieved:', notes);
    
    db.close();
    console.log('🎉 IndexedDB test PASSED!');
    return true;
    
  } catch (error) {
    console.error('❌ IndexedDB test FAILED:', error);
    return false;
  }
}

// Run test
testIndexedDB();