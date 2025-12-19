/**
 * VeilForms - SDK Builder
 * Minifies the VeilForms SDK for production use
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { minify } from 'terser';

const SDK_SOURCE_PATH = join(process.cwd(), 'public/sdk/veilforms.js');
const SDK_OUTPUT_PATH = join(process.cwd(), 'public/sdk/veilforms.min.js');
const SDK_VERSIONED_PATH = join(process.cwd(), 'public/sdk/veilforms-1.0.0.min.js');

async function buildSDK() {
  console.log('Building VeilForms SDK...');

  try {
    // Read source
    const source = readFileSync(SDK_SOURCE_PATH, 'utf-8');
    console.log(`Read source: ${SDK_SOURCE_PATH}`);

    // Minify
    const result = await minify(source, {
      compress: {
        dead_code: true,
        drop_console: false, // Keep console for debugging
        drop_debugger: true,
        pure_funcs: [], // Don't remove any functions
      },
      mangle: {
        reserved: ['VeilForms'], // Don't mangle the main class name
      },
      format: {
        comments: /^!/,
        preamble: '/* VeilForms SDK v1.0.0 | https://veilforms.com */',
      },
    });

    if (!result.code) {
      throw new Error('Minification failed - no output code');
    }

    // Write minified version
    writeFileSync(SDK_OUTPUT_PATH, result.code, 'utf-8');
    console.log(`✓ Written minified: ${SDK_OUTPUT_PATH}`);

    // Write versioned copy
    writeFileSync(SDK_VERSIONED_PATH, result.code, 'utf-8');
    console.log(`✓ Written versioned: ${SDK_VERSIONED_PATH}`);

    // Stats
    const originalSize = Buffer.byteLength(source, 'utf-8');
    const minifiedSize = Buffer.byteLength(result.code, 'utf-8');
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log('\nBuild complete:');
    console.log(`  Original: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  Minified: ${(minifiedSize / 1024).toFixed(2)} KB`);
    console.log(`  Savings:  ${savings}%`);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  buildSDK();
}

export { buildSDK };
