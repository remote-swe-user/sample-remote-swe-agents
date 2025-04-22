import * as cdk from 'aws-cdk-lib';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * This test validates that the Worker script contains the necessary etag caching logic
 * We check the actual TypeScript code instead of running a full CDK snapshot test
 * which would require Docker and be more fragile/environment-dependent.
 */
test('Worker script includes S3 etag caching logic', () => {
  // Load the worker implementation file directly
  const workerIndexPath = join(__dirname, '..', 'lib', 'constructs', 'worker', 'index.ts');
  const workerContent = readFileSync(workerIndexPath, 'utf8');
  
  // Verify key components of the etag caching implementation
  const requiredPatterns = [
    // Etag file path constant
    /SOURCE_ETAG_FILE="\/opt\/myapp\/source.etag"/,
    
    // Get and save etag when downloading
    /aws s3api head-object.*--query ETag.*--output text > \$SOURCE_ETAG_FILE/,
    
    // Download needed variable
    /DOWNLOAD_NEEDED=true/,
    
    // Check for existing etag file and node_modules
    /if \[ -f "\$SOURCE_ETAG_FILE" \] && \[ -d "\$SOURCE_DIR\/node_modules" \]/,
    
    // Read saved etag
    /SAVED_ETAG=\$\(cat \$SOURCE_ETAG_FILE\)/,
    
    // Get current etag from S3
    /CURRENT_ETAG=\$\(aws s3api head-object.*--query ETag.*--output text\)/,
    
    // Compare etags
    /if \[ "\$SAVED_ETAG" == "\$CURRENT_ETAG" \]/,
    
    // Skip download when etags match
    /echo "Source code unchanged\. Using existing installation\."/,
    /DOWNLOAD_NEEDED=false/,
    
    // Download when etags don't match
    /echo "Source code has changed\. Downloading new version\."/,
    
    // Handle first run case
    /echo "No previous installation found or etag file missing\. Downloading source\."/,
    
    // Only download if needed
    /if \[ "\$DOWNLOAD_NEEDED" == "true" \]/,
  ];
  
  // Assert that all required patterns are present in the code
  for (const pattern of requiredPatterns) {
    expect(workerContent).toMatch(pattern);
  }
});
