#!/usr/bin/env node

/**
 * Simple CLI for Notes AI Organizer
 * Basic functionality without complex dependencies
 */

console.log('🚀 Notes AI Organizer - Simple CLI');
console.log('');

// Mock data for demonstration
const mockNotes = [
  { id: '1', title: 'Shopping List', content: 'Milk, Bread, Eggs', folder: 'Quick Notes' },
  { id: '2', title: 'Meeting Notes', content: 'Discussed project timeline and deliverables', folder: 'Work' },
  { id: '3', title: 'Untitled', content: 'Random thoughts...', folder: 'Notes' },
  { id: '4', title: 'Shopping List', content: 'Apples, Bananas, Oranges', folder: 'Quick Notes' },
];

function analyzeNotes() {
  console.log('📊 Analyzing notes...');
  console.log(`Found ${mockNotes.length} notes to analyze`);
  
  // Simple analysis
  const duplicates = findDuplicates();
  const junkNotes = findJunkNotes();
  const organizationSuggestions = generateOrganizationSuggestions();
  
  console.log('\n📈 Analysis Results:');
  console.log(`- Potential duplicates: ${duplicates.length}`);
  console.log(`- Junk notes detected: ${junkNotes.length}`);
  console.log(`- Organization suggestions: ${organizationSuggestions.length}`);
  
  return { duplicates, junkNotes, organizationSuggestions };
}

function findDuplicates() {
  const duplicates: any[] = [];
  const titleGroups = new Map<string, any[]>();
  
  // Group by similar titles
  mockNotes.forEach(note => {
    const normalizedTitle = note.title.toLowerCase().trim();
    if (!titleGroups.has(normalizedTitle)) {
      titleGroups.set(normalizedTitle, []);
    }
    titleGroups.get(normalizedTitle)!.push(note);
  });
  
  // Find groups with multiple notes
  titleGroups.forEach((notes, title) => {
    if (notes.length > 1) {
      duplicates.push({
        title,
        notes,
        similarity: 0.9
      });
    }
  });
  
  return duplicates;
}

function findJunkNotes() {
  return mockNotes.filter(note => {
    // Simple heuristics for junk detection
    const isUntitled = note.title.toLowerCase().includes('untitled');
    const isShort = note.content.length < 20;
    const isGeneric = note.title.toLowerCase().includes('note');
    
    return isUntitled || (isShort && isGeneric);
  });
}

function generateOrganizationSuggestions() {
  const suggestions: any[] = [];
  
  mockNotes.forEach(note => {
    // Suggest better titles for generic ones
    if (note.title.toLowerCase().includes('untitled')) {
      const firstWords = note.content.split(' ').slice(0, 3).join(' ');
      suggestions.push({
        noteId: note.id,
        type: 'rename',
        current: note.title,
        suggested: firstWords || 'New Note',
        reason: 'Generic title detected'
      });
    }
    
    // Suggest folder organization
    if (note.content.toLowerCase().includes('meeting')) {
      suggestions.push({
        noteId: note.id,
        type: 'move',
        current: note.folder,
        suggested: 'Meetings',
        reason: 'Contains meeting content'
      });
    }
  });
  
  return suggestions;
}

function displayResults(results: any) {
  const { duplicates, junkNotes, organizationSuggestions } = results;
  
  if (duplicates.length > 0) {
    console.log('\n🔍 Potential Duplicates:');
    duplicates.forEach((group: any, index: number) => {
      console.log(`${index + 1}. "${group.title}" (${group.notes.length} notes)`);
      group.notes.forEach((note: any) => {
        console.log(`   - ${note.id}: "${note.content.substring(0, 50)}..."`);
      });
    });
  }
  
  if (junkNotes.length > 0) {
    console.log('\n🗑️  Potential Junk Notes:');
    junkNotes.forEach((note: any, index: number) => {
      console.log(`${index + 1}. "${note.title}" - ${note.content.substring(0, 50)}...`);
    });
  }
  
  if (organizationSuggestions.length > 0) {
    console.log('\n📁 Organization Suggestions:');
    organizationSuggestions.forEach((suggestion: any, index: number) => {
      console.log(`${index + 1}. ${suggestion.type}: "${suggestion.current}" → "${suggestion.suggested}"`);
      console.log(`   Reason: ${suggestion.reason}`);
    });
  }
}

function showHelp() {
  console.log(`
📱 Notes AI Organizer - Simple CLI

Usage: npm run simple [command]

Commands:
  analyze     Analyze notes and show recommendations
  duplicates  Find potential duplicate notes
  junk        Find potential junk notes
  organize    Show organization suggestions
  help        Show this help message

Examples:
  npm run simple analyze
  npm run simple duplicates
  npm run simple help
`);
}

// Parse command line arguments
const command = process.argv[2] || 'help';

switch (command) {
  case 'analyze':
    const results = analyzeNotes();
    displayResults(results);
    break;
    
  case 'duplicates':
    console.log('🔍 Finding duplicates...');
    const duplicates = findDuplicates();
    displayResults({ duplicates, junkNotes: [], organizationSuggestions: [] });
    break;
    
  case 'junk':
    console.log('🗑️  Finding junk notes...');
    const junkNotes = findJunkNotes();
    displayResults({ duplicates: [], junkNotes, organizationSuggestions: [] });
    break;
    
  case 'organize':
    console.log('📁 Generating organization suggestions...');
    const suggestions = generateOrganizationSuggestions();
    displayResults({ duplicates: [], junkNotes: [], organizationSuggestions: suggestions });
    break;
    
  case 'help':
  default:
    showHelp();
    break;
}

console.log('\n✅ Complete!');
console.log('Note: This is a demo version with mock data.');
console.log('The full version will integrate with Apple Notes API.');