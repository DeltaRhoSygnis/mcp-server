#!/bin/bash
# Workspace Cleanup Script
# Removes unnecessary files for production deployment

echo "🧹 Cleaning up workspace for production deployment..."

# Create backup directory
mkdir -p .backup/test-files
mkdir -p .backup/examples
mkdir -p .backup/docs

echo "📦 Backing up files to .backup/ directory..."

# Backup test files
mv test-*.ts .backup/test-files/ 2>/dev/null || true
mv *test*.ts .backup/test-files/ 2>/dev/null || true
mv *.spec.ts .backup/test-files/ 2>/dev/null || true
mv production-readiness-test.ts .backup/test-files/ 2>/dev/null || true

# Backup example files
mv *example*.ts .backup/examples/ 2>/dev/null || true
mv production-*.ts .backup/examples/ 2>/dev/null || true
mv connection-pooling-*.ts .backup/examples/ 2>/dev/null || true
mv intelligent-cache-*.ts .backup/examples/ 2>/dev/null || true
mv request-batching-*.ts .backup/examples/ 2>/dev/null || true
mv mcpClient*.ts .backup/examples/ 2>/dev/null || true
mv mcpIntegration*.ts .backup/examples/ 2>/dev/null || true
mv mcpWebSocket.ts .backup/examples/ 2>/dev/null || true
mv MIGRATION-GUIDE-*.ts .backup/examples/ 2>/dev/null || true

# Backup documentation (keep README.md)
find . -maxdepth 1 -name "*.md" ! -name "README.md" -exec mv {} .backup/docs/ \; 2>/dev/null || true

# Move client-side services to backup
mkdir -p .backup/client-services
mv src/services/smartStockIntegration.ts .backup/client-services/ 2>/dev/null || true
mv src/services/dataFixService.ts .backup/client-services/ 2>/dev/null || true
mv src/services/offlineService.ts .backup/client-services/ 2>/dev/null || true

# Remove unnecessary directories
rm -rf "test js" 2>/dev/null || true
rm -rf ".tmp.driveupload" 2>/dev/null || true

# Remove temporary/meta files
rm -f metadata.json 2>/dev/null || true
rm -f mcpserver.zip 2>/dev/null || true
rm -f validation.md 2>/dev/null || true
rm -f .replitignore 2>/dev/null || true

echo "✅ Workspace cleanup completed!"
echo "📦 Backed up files are in .backup/ directory"
echo "🚀 Ready for production deployment"

# Test build
echo "🧪 Testing build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Ready for deployment."
else
    echo "❌ Build failed. Check remaining issues."
    exit 1
fi