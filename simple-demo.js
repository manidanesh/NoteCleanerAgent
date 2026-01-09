#!/usr/bin/env node

/**
 * Simple Demo of Notes AI Organizer
 * Pure JavaScript version for macOS
 */

console.log('🚀 Notes AI Organizer - Demo Version');
console.log('=====================================');
console.log('');

// Mock data representing Apple Notes
const mockNotes = [
  {
    id: '1',
    title: 'Shopping List',
    content: 'Milk, Bread, Eggs, Butter',
    folder: 'Quick Notes',
    createdDate: new Date('2024-01-15'),
    modifiedDate: new Date('2024-01-15'),
    wordCount: 4
  },
  {
    id: '2',
    title: 'Meeting Notes - Project Alpha',
    content: 'Discussed project timeline, deliverables, and team assignments. Next meeting scheduled for Friday.',
    folder: 'Work',
    createdDate: new Date('2024-01-10'),
    modifiedDate: new Date('2024-01-12'),
    wordCount: 15
  },
  {
    id: '3',
    title: 'Untitled',
    content: 'Random thoughts...',
    folder: 'Notes',
    createdDate: new Date('2024-01-08'),
    modifiedDate: new Date('2024-01-08'),
    wordCount: 2
  },
  {
    id: '4',
    title: 'Shopping List',
    content: 'Apples, Bananas, Oranges, Grapes',
    folder: 'Quick Notes',
    createdDate: new Date('2024-01-20'),
    modifiedDate: new Date('2024-01-20'),
    wordCount: 4
  },
  {
    id: '5',
    title: 'Note',
    content: 'Test',
    folder: 'Notes',
    createdDate: new Date('2024-01-05'),
    modifiedDate: new Date('2024-01-05'),
    wordCount: 1
  },
  {
    id: '6',
    title: 'Important Ideas',
    content: 'AI-powered note organization could revolutionize how we manage information. Key features: duplicate detection, smart categorization, content analysis.',
    folder: 'Ideas',
    createdDate: new Date('2024-01-18'),
    modifiedDate: new Date('2024-01-19'),
    wordCount: 22
  }
];

// AI Analysis Functions
function analyzeNotes() {
  console.log('📊 Analyzing your notes with AI...');
  console.log(`Found ${mockNotes.length} notes to analyze\n`);
  
  const duplicates = findDuplicates();
  const junkNotes = findJunkNotes();
  const organizationSuggestions = generateOrganizationSuggestions();
  const utilityScores = calculateUtilityScores();
  
  console.log('📈 AI Analysis Results:');
  console.log(`- Potential duplicates: ${duplicates.length}`);
  console.log(`- Low-utility notes: ${junkNotes.length}`);
  console.log(`- Organization suggestions: ${organizationSuggestions.length}`);
  console.log(`- Notes analyzed for utility: ${utilityScores.length}\n`);
  
  return { duplicates, junkNotes, organizationSuggestions, utilityScores };
}

function findDuplicates() {
  const duplicates = [];
  const titleGroups = new Map();
  
  // Group by similar titles (AI-like similarity detection)
  mockNotes.forEach(note => {
    const normalizedTitle = note.title.toLowerCase().trim();
    if (!titleGroups.has(normalizedTitle)) {
      titleGroups.set(normalizedTitle, []);
    }
    titleGroups.get(normalizedTitle).push(note);
  });
  
  // Find groups with multiple notes
  titleGroups.forEach((notes, title) => {
    if (notes.length > 1) {
      // Calculate content similarity
      const similarity = calculateContentSimilarity(notes);
      duplicates.push({
        title,
        notes,
        similarity,
        confidence: similarity > 0.8 ? 'High' : 'Medium',
        recommendation: similarity > 0.8 ? 'Merge recommended' : 'Review suggested'
      });
    }
  });
  
  return duplicates;
}

function calculateContentSimilarity(notes) {
  // Simple content similarity based on word overlap
  if (notes.length < 2) return 0;
  
  const words1 = notes[0].content.toLowerCase().split(/\s+/);
  const words2 = notes[1].content.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / totalWords;
}

function findJunkNotes() {
  return mockNotes.filter(note => {
    const reasons = [];
    
    // AI heuristics for junk detection
    const isUntitled = note.title.toLowerCase().includes('untitled');
    const isGenericTitle = ['note', 'new note', 'untitled'].includes(note.title.toLowerCase());
    const isVeryShort = note.wordCount < 3;
    const isOld = (Date.now() - note.modifiedDate.getTime()) > (30 * 24 * 60 * 60 * 1000); // 30 days
    
    if (isUntitled) reasons.push('Untitled note');
    if (isGenericTitle) reasons.push('Generic title');
    if (isVeryShort) reasons.push('Very short content');
    if (isOld) reasons.push('Not modified recently');
    
    if (reasons.length >= 2) {
      note.junkReasons = reasons;
      note.confidence = reasons.length >= 3 ? 'High' : 'Medium';
      return true;
    }
    
    return false;
  });
}

function generateOrganizationSuggestions() {
  const suggestions = [];
  
  mockNotes.forEach(note => {
    // AI-powered title suggestions
    if (note.title.toLowerCase().includes('untitled') || note.title.toLowerCase() === 'note') {
      const firstWords = note.content.split(' ').slice(0, 3).join(' ');
      if (firstWords.length > 0) {
        suggestions.push({
          noteId: note.id,
          type: 'Rename',
          current: note.title,
          suggested: firstWords,
          reason: 'AI detected generic title',
          confidence: 'High'
        });
      }
    }
    
    // Smart folder organization
    const content = note.content.toLowerCase();
    if (content.includes('meeting') || content.includes('discussed')) {
      suggestions.push({
        noteId: note.id,
        type: 'Move to folder',
        current: note.folder,
        suggested: 'Meetings',
        reason: 'AI detected meeting content',
        confidence: 'High'
      });
    }
    
    if (content.includes('buy') || content.includes('shopping') || note.title.toLowerCase().includes('shopping')) {
      suggestions.push({
        noteId: note.id,
        type: 'Move to folder',
        current: note.folder,
        suggested: 'Shopping Lists',
        reason: 'AI detected shopping list',
        confidence: 'High'
      });
    }
  });
  
  return suggestions;
}

function calculateUtilityScores() {
  return mockNotes.map(note => {
    // AI utility scoring algorithm
    let contentScore = Math.min(note.wordCount * 5, 100); // More content = higher score
    let behavioralScore = 50; // Default behavioral score
    let semanticScore = 50; // Default semantic score
    
    // Adjust based on recency
    const daysSinceModified = (Date.now() - note.modifiedDate.getTime()) / (24 * 60 * 60 * 1000);
    const recencyMultiplier = Math.max(0.5, 1 - (daysSinceModified / 365));
    
    // Adjust based on title quality
    const titleQuality = note.title.toLowerCase().includes('untitled') ? 0.5 : 1;
    
    const overallScore = Math.round((contentScore + behavioralScore + semanticScore) / 3 * recencyMultiplier * titleQuality);
    
    return {
      noteId: note.id,
      noteTitle: note.title,
      overallScore,
      contentScore: Math.round(contentScore),
      behavioralScore,
      semanticScore,
      confidence: overallScore > 70 ? 'High' : overallScore > 40 ? 'Medium' : 'Low',
      recommendation: overallScore < 30 ? 'Consider for cleanup' : overallScore > 80 ? 'Keep - High value' : 'Review'
    };
  });
}

function displayResults(results) {
  const { duplicates, junkNotes, organizationSuggestions, utilityScores } = results;
  
  if (duplicates.length > 0) {
    console.log('🔍 AI-Detected Duplicate Notes:');
    duplicates.forEach((group, index) => {
      console.log(`${index + 1}. "${group.title}" (${group.notes.length} notes, ${Math.round(group.similarity * 100)}% similar)`);
      console.log(`   Confidence: ${group.confidence} | ${group.recommendation}`);
      group.notes.forEach(note => {
        console.log(`   - ${note.id}: "${note.content.substring(0, 40)}..."`);
      });
      console.log('');
    });
  }
  
  if (junkNotes.length > 0) {
    console.log('🗑️  AI-Detected Low-Utility Notes:');
    junkNotes.forEach((note, index) => {
      console.log(`${index + 1}. "${note.title}" (Confidence: ${note.confidence})`);
      console.log(`   Content: "${note.content.substring(0, 50)}..."`);
      console.log(`   Reasons: ${note.junkReasons.join(', ')}`);
      console.log('');
    });
  }
  
  if (organizationSuggestions.length > 0) {
    console.log('📁 AI Organization Suggestions:');
    organizationSuggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion.type}: "${suggestion.current}" → "${suggestion.suggested}"`);
      console.log(`   Reason: ${suggestion.reason} (Confidence: ${suggestion.confidence})`);
      console.log('');
    });
  }
  
  if (utilityScores.length > 0) {
    console.log('⭐ AI Utility Scores (Top 3):');
    const topScores = utilityScores.sort((a, b) => b.overallScore - a.overallScore).slice(0, 3);
    topScores.forEach((score, index) => {
      console.log(`${index + 1}. "${score.noteTitle}" - Score: ${score.overallScore}/100`);
      console.log(`   Content: ${score.contentScore}, Behavioral: ${score.behavioralScore}, Semantic: ${score.semanticScore}`);
      console.log(`   Recommendation: ${score.recommendation}`);
      console.log('');
    });
  }
}

function showHelp() {
  console.log(`
📱 Notes AI Organizer - Demo CLI

Usage: node simple-demo.js [command]

Commands:
  analyze     Full AI analysis with recommendations
  duplicates  Find potential duplicate notes using AI
  junk        Find low-utility notes for cleanup
  organize    AI-powered organization suggestions
  utility     Show utility scores for all notes
  help        Show this help message

Examples:
  node simple-demo.js analyze
  node simple-demo.js duplicates
  node simple-demo.js help

Features Demonstrated:
✅ AI-powered duplicate detection
✅ Smart junk note identification  
✅ Intelligent organization suggestions
✅ Utility scoring algorithm
✅ Content analysis and semantic understanding
✅ Confidence scoring for recommendations
`);
}

// Command line interface
const command = process.argv[2] || 'help';

switch (command) {
  case 'analyze':
    const results = analyzeNotes();
    displayResults(results);
    break;
    
  case 'duplicates':
    console.log('🔍 AI Duplicate Detection...\n');
    const duplicates = findDuplicates();
    displayResults({ duplicates, junkNotes: [], organizationSuggestions: [], utilityScores: [] });
    break;
    
  case 'junk':
    console.log('🗑️  AI Junk Note Detection...\n');
    const junkNotes = findJunkNotes();
    displayResults({ duplicates: [], junkNotes, organizationSuggestions: [], utilityScores: [] });
    break;
    
  case 'organize':
    console.log('📁 AI Organization Analysis...\n');
    const suggestions = generateOrganizationSuggestions();
    displayResults({ duplicates: [], junkNotes: [], organizationSuggestions: suggestions, utilityScores: [] });
    break;
    
  case 'utility':
    console.log('⭐ AI Utility Scoring...\n');
    const scores = calculateUtilityScores();
    displayResults({ duplicates: [], junkNotes: [], organizationSuggestions: [], utilityScores: scores });
    break;
    
  case 'help':
  default:
    showHelp();
    break;
}

if (command !== 'help') {
  console.log('✅ AI Analysis Complete!');
  console.log('');
  console.log('💡 This demo shows the AI capabilities with mock data.');
  console.log('   The full version integrates with Apple Notes API for real analysis.');
  console.log('   Run "node simple-demo.js help" for more commands.');
}