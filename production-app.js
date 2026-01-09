#!/usr/bin/env node

/**
 * Production Notes AI Organizer Application Entry Point
 * Complete integration with all components and real Apple Notes
 */

const { runProductionApp } = require('./dist/production-app');

// Get command line arguments (skip node and script name)
const args = process.argv.slice(2);

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n🔄 Gracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run the production app
runProductionApp(args).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});