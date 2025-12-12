# Notes AI Organizer

A multi-agent AI system for intelligently analyzing and organizing Apple Notes libraries with privacy-first design and on-device processing.

## Project Structure

```
src/
├── agents/                 # Specialized AI agents
│   ├── ContentExtractorAgent.ts
│   ├── UtilityScorerAgent.ts
│   ├── DuplicateDetectorAgent.ts
│   ├── OrganizationAgent.ts
│   ├── LearningComponent.ts
│   └── AgentCoordinator.ts
├── models/                 # TypeScript data models
│   ├── Note.ts
│   ├── UtilityScore.ts
│   ├── Recommendation.ts
│   ├── DuplicateGroup.ts
│   ├── LLMModels.ts
│   └── index.ts
├── services/               # Core services
│   ├── LLMService.ts
│   ├── NotesAPIService.ts
│   └── VectorIndexingService.ts
├── ui/                     # User interface components
│   └── components/
│       ├── Dashboard.tsx
│       ├── RecommendationCard.tsx
│       └── DetailView.tsx
└── index.ts               # Main entry point

tests/
├── generators/            # Property-based test generators
│   ├── NoteGenerators.ts
│   └── RecommendationGenerators.ts
├── property/              # Property-based tests
│   └── models.test.ts
└── setup.ts              # Test configuration
```

## Key Features

- **Multi-Agent Architecture**: Specialized AI agents for different aspects of note analysis
- **Privacy-First Design**: All processing occurs on-device by default
- **Property-Based Testing**: Comprehensive testing using fast-check library
- **Cross-Platform**: iOS and macOS support with React Native
- **TypeScript**: Full type safety and modern development experience

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- React Native development environment

### Installation

```bash
npm install
```

### Available Scripts

```bash
# Build the project
npm run build

# Run tests
npm run test

# Run property-based tests specifically
npm run test:pbt

# Watch mode for tests
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint

# iOS build
npm run build:ios

# macOS build
npm run build:macos
```

## Architecture Overview

The system follows a multi-agent architecture with clear separation of concerns:

1. **Content Extractor Agent**: Processes note content including text, handwriting, images, and attachments
2. **Utility Scorer Agent**: Assigns utility scores using multiple algorithms (TF-IDF, behavioral, semantic, rule-based)
3. **Duplicate Detector Agent**: Identifies similar notes using vector embeddings and FAISS indexing
4. **Organization Agent**: Generates recommendations for note actions and improvements
5. **Learning Component**: Adapts system behavior based on user feedback
6. **Agent Coordinator**: Orchestrates communication between agents

## Data Models

### Core Models
- **Note**: Represents an Apple Note with content, metadata, and attachments
- **UtilityScore**: Scoring information for note importance and usefulness
- **Recommendation**: AI-generated suggestions for note actions
- **DuplicateGroup**: Collections of similar notes for potential merging

### LLM Integration
- **LLMRequest/Response**: Models for AI language model interactions
- **ContentAnalysis**: Structured content understanding results
- **Entity**: Extracted entities from note content

## Testing Strategy

The project uses a dual testing approach:

1. **Unit Tests**: Specific examples and edge cases
2. **Property-Based Tests**: Universal properties verified across all inputs using fast-check

Property-based tests run a minimum of 100 iterations per property to ensure comprehensive coverage.

## Requirements Coverage

This implementation addresses requirements from the specification:
- **1.1, 23.1**: Apple Notes API integration structure
- **24.1**: ML model management interfaces
- **25.1**: Agent coordination architecture

## Next Steps

This is the foundational structure. Subsequent tasks will implement:
1. LLM integration layer
2. Apple Notes API integration
3. Individual agent implementations
4. UI components
5. Testing and validation

## License

[License information to be added]