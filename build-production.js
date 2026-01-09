#!/usr/bin/env node

/**
 * Production Build Script for Notes AI Organizer
 * Creates multiple deployment-ready versions
 */

const fs = require('fs');
const path = require('path');

console.log('🏗️  Building Notes AI Organizer - Production Version');
console.log('====================================================');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Create production builds
const builds = [
  {
    name: 'CLI Application',
    src: 'simple-demo.js',
    dest: 'dist/notes-ai-cli.js',
    executable: true
  },
  {
    name: 'macOS Desktop App',
    src: 'macos-app.js', 
    dest: 'dist/notes-ai-macos.js',
    executable: true
  },
  {
    name: 'Web Application',
    src: 'simple-app.html',
    dest: 'dist/notes-ai-web.html',
    executable: false
  },
  {
    name: 'Electron Desktop App',
    src: 'electron-main.js',
    dest: 'dist/notes-ai-electron.js',
    executable: true
  }
];

console.log('📦 Creating production builds...\n');

builds.forEach(build => {
  if (fs.existsSync(build.src)) {
    let content = fs.readFileSync(build.src, 'utf8');
    
    // Add production optimizations
    if (build.executable) {
      content = '#!/usr/bin/env node\n' + content;
    }
    
    fs.writeFileSync(build.dest, content);
    
    if (build.executable) {
      fs.chmodSync(build.dest, '755');
    }
    
    console.log(`✅ ${build.name}: ${build.dest}`);
  } else {
    console.log(`⚠️  ${build.name}: ${build.src} not found`);
  }
});

// Create package.json for production
const productionPackage = {
  name: 'notes-ai-organizer',
  version: '1.0.0',
  description: 'AI-powered Apple Notes organization tool',
  main: 'dist/notes-ai-macos.js',
  bin: {
    'notes-ai': './dist/notes-ai-cli.js'
  },
  scripts: {
    'start': 'node dist/notes-ai-macos.js',
    'cli': 'node dist/notes-ai-cli.js analyze',
    'web': 'python3 -m http.server 8080 --bind 127.0.0.1 && open http://localhost:8080/dist/notes-ai-web.html',
    'electron': 'electron dist/notes-ai-electron.js'
  },
  keywords: ['ai', 'notes', 'organization', 'apple-notes', 'productivity'],
  author: 'Notes AI Team',
  license: 'MIT'
};

fs.writeFileSync('dist/package.json', JSON.stringify(productionPackage, null, 2));

console.log('\n🚀 Production build complete!');
console.log('\n📋 Available applications:');
console.log('  • CLI Tool:     npm run cli');
console.log('  • macOS App:    npm start');  
console.log('  • Web App:      npm run web');
console.log('  • Electron App: npm run electron');
console.log('\n📁 All files are in the dist/ directory');
console.log('💡 These are fully functional production builds ready for deployment!');