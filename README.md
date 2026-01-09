# Notes AI Organizer

An intelligent AI-powered system for organizing and managing Apple Notes on macOS. This multi-agent system uses advanced algorithms to analyze, categorize, and optimize your note collection.

## 🚀 Quick Start

### Ready-to-Run macOS App
```bash
# Full AI-powered analysis (recommended)
npm run macos

# Or run directly
node macos-app.js
```

### Interactive Demo
```bash
# Command-line demo with specific features
node simple-demo.js analyze
node simple-demo.js duplicates
node simple-demo.js junk
node simple-demo.js organize
node simple-demo.js utility
```

## ✨ Features

### 🤖 AI-Powered Analysis
- **Duplicate Detection**: Finds similar notes using content analysis
- **Junk Note Identification**: Detects low-utility notes for cleanup
- **Smart Organization**: Suggests better titles and folder structures
- **Utility Scoring**: Ranks notes by importance and usefulness
- **Content Understanding**: Semantic analysis of note content

### 🔒 Privacy & Security
- **Local Processing**: All AI analysis happens on your device
- **No Cloud Dependencies**: Your notes never leave your Mac
- **Encrypted Storage**: Secure caching and data handling
- **Permission Management**: Respects Apple Notes access controls

### 📱 Cross-Platform Support
- **macOS**: Full desktop experience with Apple Notes integration
- **iOS**: Mobile companion app (React Native)
- **CLI Interface**: Command-line tools for power users

## 🛠 Installation & Setup

### Prerequisites
- macOS 10.15+ or iOS 13+
- Node.js 18+ (for development/CLI)
- Xcode (for iOS development)

### Quick Demo Setup
```bash
# Clone the repository
git clone https://github.com/manidanesh/NoteCleanerAgent.git
cd NoteCleanerAgent

# Run the demo (no installation needed)
node simple-demo.js analyze
```

### Full Development Setup
```bash
# Install dependencies
npm install

# Build the project (currently has compilation issues - use demo instead)
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

## 📊 AI Capabilities Demo

The demo showcases all the core AI features:

### Duplicate Detection
```bash
node simple-demo.js duplicates
```
- Finds notes with similar titles and content
- Calculates similarity scores
- Provides confidence ratings
- Suggests merge or review actions

### Junk Note Detection
```bash
node simple-demo.js junk
```
- Identifies notes with generic titles ("Untitled", "Note")
- Detects very short or empty content
- Flags old, unmodified notes
- Provides cleanup recommendations

### Smart Organization
```bash
node simple-demo.js organize
```
- Suggests better titles based on content
- Recommends folder organization
- Detects content types (meetings, shopping lists, etc.)
- AI-powered categorization

### Utility Scoring
```bash
node simple-demo.js utility
```
- Scores notes based on content quality
- Considers recency and usage patterns
- Provides actionable recommendations
- Helps prioritize note management

## 🏗 Architecture

### Multi-Agent System
- **Content Extractor Agent**: Analyzes text, images, and attachments
- **Utility Scorer Agent**: Calculates note importance and usefulness
- **Duplicate Detector Agent**: Finds similar and redundant notes
- **Organization Agent**: Suggests improvements to structure
- **Learning Component**: Adapts to user preferences over time

### Core Services
- **LLM Integration**: Local language model processing
- **Security Service**: Encryption and privacy protection
- **Notes API Service**: Apple Notes integration
- **Performance Optimizer**: Efficient processing for large collections

### Testing Framework
- **Property-Based Testing**: Comprehensive correctness validation
- **Unit Tests**: Component-level testing
- **Integration Tests**: End-to-end system validation

## 🎯 Use Cases

### Personal Note Management
- Clean up years of accumulated notes
- Find and merge duplicate content
- Organize notes into logical folders
- Identify important vs. disposable notes

### Professional Workflows
- Organize meeting notes and project documentation
- Clean up research and reference materials
- Maintain knowledge bases and documentation
- Archive completed project notes

### Academic Research
- Organize research notes and citations
- Find related content across note collections
- Clean up draft notes and temporary content
- Maintain organized reference libraries

## 🔧 Development Status

### ✅ Completed Features
- Core AI algorithms and analysis engine
- Multi-agent coordination system
- Security and privacy framework
- Property-based testing suite
- CLI demo interface
- Cross-platform architecture

### 🚧 In Progress
- Apple Notes API integration
- React Native UI components
- Real-time processing pipeline
- Advanced ML model integration

### 📋 Planned Features
- Voice note transcription and analysis
- Image content recognition (OCR)
- Collaborative note organization
- Advanced search and filtering
- Export and backup capabilities

## 🤝 Contributing

This project follows a spec-driven development approach with comprehensive testing:

1. **Requirements**: Formal EARS-compliant specifications
2. **Design**: Detailed architecture with correctness properties
3. **Implementation**: Property-based testing ensures correctness
4. **Validation**: Extensive test coverage for all components

See the `.kiro/specs/notes-ai-organizer/` directory for detailed specifications.

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

Built with modern AI and software engineering practices:
- Property-based testing with fast-check
- Multi-agent system architecture
- Privacy-first design principles
- Cross-platform React Native framework

---

**Note**: This is a demonstration of AI-powered note organization capabilities. The current demo uses mock data to showcase the algorithms. Full Apple Notes integration is in development.