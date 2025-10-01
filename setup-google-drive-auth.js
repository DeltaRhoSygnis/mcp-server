/**
 * Google Drive OAuth Setup Script
 * Run this to get your refresh token for Google Drive integration
 */

const { google } = require('googleapis');
const readline = require('readline');

// Replace these with your actual credentials from Google Cloud Console
const CLIENT_ID = 'your_google_client_id_here';
const CLIENT_SECRET = 'your_google_client_secret_here';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly'
];

async function setupGoogleDriveAuth() {
  console.log('🔐 Google Drive OAuth Setup');
  console.log('============================');
  
  if (CLIENT_ID === 'your_google_client_id_here' || CLIENT_SECRET === 'your_google_client_secret_here') {
    console.log('❌ Please update CLIENT_ID and CLIENT_SECRET in this file first');
    console.log('   Get them from: https://console.cloud.google.com/apis/credentials');
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Generate the URL for authorization
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to get refresh token
  });

  console.log('📋 Steps to complete setup:');
  console.log('1. Open this URL in your browser:');
  console.log(`   ${authUrl}`);
  console.log('');
  console.log('2. Complete the authorization process');
  console.log('3. Copy the authorization code from the callback URL');
  console.log('4. Paste it below when prompted');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('📝 Enter the authorization code: ', async (code) => {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      console.log('');
      console.log('✅ Success! Add these to your .env file:');
      console.log('==========================================');
      console.log(`GOOGLE_DRIVE_CLIENT_ID=${CLIENT_ID}`);
      console.log(`GOOGLE_DRIVE_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
      
      if (tokens.access_token) {
        console.log('');
        console.log('🧪 Testing Google Drive access...');
        
        oauth2Client.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        const response = await drive.files.list({
          pageSize: 1,
          fields: 'files(id, name)'
        });
        
        console.log('✅ Google Drive connection successful!');
        console.log(`   Found ${response.data.files?.length || 0} files in your Drive`);
      }
      
    } catch (error) {
      console.log('❌ Error getting tokens:', error.message);
    }
    
    rl.close();
  });
}

// Run the setup
setupGoogleDriveAuth().catch(console.error);