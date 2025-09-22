// Simple test to check environment variables
console.log('🔧 Environment Variables Test:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✅ SET' : '❌ MISSING');
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '✅ SET' : '❌ MISSING');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ SET' : '❌ MISSING');

// Check if values are not 'undefined' strings
if (process.env.VITE_SUPABASE_URL === 'undefined') {
  console.log('⚠️ VITE_SUPABASE_URL is set to string "undefined"');
}
if (process.env.VITE_SUPABASE_ANON_KEY === 'undefined') {
  console.log('⚠️ VITE_SUPABASE_ANON_KEY is set to string "undefined"');
}

console.log('✅ Environment test complete');