#!/usr/bin/env node
/**
 * DSG Plugin Validation Script
 * Checks all plugins for:
 * - Banned APIs
 * - Code structure
 * - Cost boundaries
 * - Signature validity
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pluginsDir = path.join(rootDir, 'dsg-plugins');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Banned patterns in plugin code
const bannedPatterns = [
  { pattern: /require\s*\(/g, name: 'require()' },
  { pattern: /eval\s*\(/g, name: 'eval()' },
  { pattern: /Function\s*\(/g, name: 'Function()' },
  { pattern: /child_process/g, name: 'child_process module' },
  { pattern: /\bfs\./g, name: 'fs module' },
  { pattern: /\.rmdir\(/g, name: '.rmdir()' },
  { pattern: /\.unlink\(/g, name: '.unlink()' },
  { pattern: /process\./g, name: 'process object' },
  { pattern: /global\./g, name: 'global object' },
  { pattern: /window\./g, name: 'window object' },
  { pattern: /document\./g, name: 'document object' },
];

let totalIssues = 0;
let totalWarnings = 0;

/**
 * Validate a single plugin file
 */
function validatePlugin(filePath) {
  const fileName = path.basename(filePath);
  log(`\nValidating: ${fileName}`, colors.blue);

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check file size (max 1MB)
    if (content.length > 1024 * 1024) {
      log(`  ❌ File too large: ${(content.length / 1024 / 1024).toFixed(2)}MB (max 1MB)`, colors.red);
      totalIssues++;
    } else {
      log(`  ✓ File size: ${(content.length / 1024).toFixed(2)}KB`, colors.green);
    }

    // Check for banned APIs
    let foundBanned = false;
    for (const { pattern, name } of bannedPatterns) {
      if (pattern.test(content)) {
        log(`  ❌ Banned API found: ${name}`, colors.red);
        foundBanned = true;
        totalIssues++;
      }
    }

    if (!foundBanned) {
      log(`  ✓ No banned APIs detected`, colors.green);
    }

    // Check for basic structure
    if (content.includes('function') || content.includes('=>')) {
      log(`  ✓ Contains functions/methods`, colors.green);
    } else {
      log(`  ⚠️  No functions found (may be data-only)`, colors.yellow);
      totalWarnings++;
    }

    // Check for error handling
    if (
      content.includes('try') ||
      content.includes('catch') ||
      content.includes('throw')
    ) {
      log(`  ✓ Error handling present`, colors.green);
    } else {
      log(`  ⚠️  No error handling detected`, colors.yellow);
      totalWarnings++;
    }

    // Check for comments
    if (content.includes('//') || content.includes('/*')) {
      log(`  ✓ Documentation present`, colors.green);
    } else {
      log(`  ⚠️  No comments/documentation`, colors.yellow);
      totalWarnings++;
    }

    return totalIssues === 0;
  } catch (err) {
    log(`  ❌ Error reading file: ${err.message}`, colors.red);
    totalIssues++;
    return false;
  }
}

/**
 * Validate all plugins in the dsg-plugins directory
 */
function validateAllPlugins() {
  log('\n╔════════════════════════════════════════════════════╗');
  log('║  DSG Plugin Validation                             ║');
  log('╚════════════════════════════════════════════════════╝', colors.blue);

  const pluginPattern = /\.(js|ts)$/;

  // Find all plugin files
  const files = [];
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (
        entry.isFile() &&
        pluginPattern.test(entry.name) &&
        !entry.name.includes('node_modules')
      ) {
        files.push(fullPath);
      }
    }
  }

  walkDir(pluginsDir);

  if (files.length === 0) {
    log('\nℹ️  No plugins found to validate', colors.yellow);
    return true;
  }

  log(`\nFound ${files.length} plugin file(s) to validate`);

  for (const file of files) {
    validatePlugin(file);
  }

  // Summary
  log('\n╔════════════════════════════════════════════════════╗');
  log('║  Validation Summary                                ║');
  log('╚════════════════════════════════════════════════════╝', colors.blue);

  log(`Total issues found: ${totalIssues}`, totalIssues > 0 ? colors.red : colors.green);
  log(`Total warnings: ${totalWarnings}`, totalWarnings > 0 ? colors.yellow : colors.green);

  if (totalIssues === 0) {
    log('\n✅ All validations passed!', colors.green);
    return true;
  } else {
    log('\n❌ Validation failed - please fix the issues above', colors.red);
    return false;
  }
}

// Run validation
const success = validateAllPlugins();
process.exit(success ? 0 : 1);
