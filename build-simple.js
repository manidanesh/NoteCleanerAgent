#!/usr/bin/env node

/**
 * Simple Build Script for Notes AI Organizer
 * Creates a working executable from the demo components
 */

const fs = require('fs');
const path = require('path');

console.log('🔨 Building Notes AI Organizer...');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Copy working demo files to dist
const filesToCopy = [
  { src: 'simple-demo.js', dest: 'dist/cli.js' },
  { src: 'macos-app.js', dest: 'dist/macos-app.js' },
  { src: 'simple-app.html', dest: 'dist/app.html' },
  { src: 'electron-main.js', dest: 'dist/electron-main.js' }
];

filesToCopy.forEach(({ src, dest }) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied ${src} → ${dest}`);
  } else {
    console.log(`⚠️  ${src} not found, skipping...`);
  }
});

// Create package scripts
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson.scripts = {
  ...packageJson.scripts,
  'start:cli': 'node dist/cli.js analyze',
  'start:macos': 'node dist/macos-app.js',
  'start:web': 'python3 -m http.server 8080 --bind 127.0.0.1',
  'start:electron': 'electron dist/electron-main.js'
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

console.log('');
console.log('🚀 Build Complete!');
console.log('');
console.log('Available commands:');
console.log('  npm run start:cli     - Run CLI analysis');
console.log('  npm run start:macos   - Run macOS app');
console.log('  npm run start:web     - Start web server (then open http://localhost:8080/dist/app.html)');
console.log('  npm run start:electron - Run Electron desktop app');
console.log('');
console.log('📁 Built files are in the dist/ directory');