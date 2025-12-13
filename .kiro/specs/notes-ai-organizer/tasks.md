# Implementation Plan

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for agents, services, models, and UI components
  - Define TypeScript interfaces for all data models (Note, UtilityScore, Recommendation, etc.)
  - Set up testing framework with fast-check for property-based testing
  - Configure build system for iOS/macOS cross-platform development
  - _Requirements: 1.1, 23.1, 24.1, 25.1_

- [x] 2. Implement local LLM integration layer
  - Create LLMService interface with multiple implementation options
  - Implement Core ML integration for iOS on-device processing
  - Implement Ollama integration for macOS local server
  - Implement GGML/llama.cpp integration as fallback option
  - Add LLM resource management and request queuing system
  - _Requirements: 4.1, 4.2, 24.1, 24.5_

- [x] 2.1 Write property test for LLM service reliability
  - **Property 13: On-device processing boundary**
  - **Validates: Requirements 4.1**

- [x] 2.2 Write property test for LLM resource management
  - **Property 16: Offline operation capability**
  - **Validates: Requirements 4.4**

- [x] 3. Implement Apple Notes API integration
  - Create Notes API wrapper using EventKit framework for iOS
  - Implement NSAppleScript bridge for enhanced macOS access
  - Add permission management and revocation detection
  - Implement rate limiting (max 100 notes/second) and retry logic
  - Add FSEvents monitoring for real-time note changes on macOS
  - _Requirements: 1.1, 1.4, 23.1, 23.2, 23.3_

- [x] 3.1 Write property test for permission handling
  - **Property 1: Permission revocation stops processing**
  - **Validates: Requirements 1.4**

- [x] 3.2 Write property test for API rate limiting
  - **Property 17: Cloud processing consent requirement**
  - **Validates: Requirements 4.5**

- [x] 4. Create Content Extractor Agent
  - Implement text processing and normalization
  - Add OCR integration for handwriting recognition
  - Create image analysis and metadata extraction
  - Implement attachment processing for various file types
  - Add checklist parser with structure preservation
  - Integrate with local LLM for semantic content understanding
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4.1 Write property test for OCR processing
  - **Property 3: OCR processing for handwritten content**
  - **Validates: Requirements 2.1**

- [x] 4.2 Write property test for image analysis
  - **Property 4: Image content analysis**
  - **Validates: Requirements 2.2**

- [x] 4.3 Write property test for attachment processing
  - **Property 5: Attachment processing**
  - **Validates: Requirements 2.3**

- [x] 4.4 Write property test for checklist preservation
  - **Property 6: Checklist structure preservation**
  - **Validates: Requirements 2.4**

- [x] 4.5 Write property test for extraction failure resilience
  - **Property 7: Extraction failure resilience**
  - **Validates: Requirements 2.5**

- [x] 5. Implement Utility Scorer Agent
  - Create TF-IDF analysis with keyword importance weighting
  - Implement behavioral scoring (access frequency, modification recency)
  - Add semantic analysis using embeddings and LLM assessment
  - Create rule-based classification (date aging, content length, checklist status)
  - Implement hybrid scoring model with user preference weighting
  - Integrate with local LLM for content quality assessment
  - _Requirements: 3.1, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 5.1 Write property test for valid utility scoring
  - **Property 8: Valid utility score assignment**
  - **Validates: Requirements 3.1**

- [x] 5.2 Write property test for explanation provision
  - **Property 10: Explanation provision**
  - **Validates: Requirements 3.3**

- [x] 6. Create Duplicate Detector Agent
  - Implement FAISS vector indexing (IndexFlatIP for <100K notes, IndexIVFFlat for larger)
  - Create embedding generation and similarity search
  - Add semantic similarity detection using LLM comparison
  - Implement duplicate ranking by completeness, recency, and quality
  - Create merge strategy determination and conflict resolution
  - _Requirements: 3.4, 9.1, 9.2, 9.3, 9.4, 9.5, 19.1, 19.2, 19.3, 19.4, 19.5, 24.2_

- [x] 6.1 Write property test for duplicate detection
  - **Property 11: Duplicate detection for similar content**
  - **Validates: Requirements 3.4**

- [x] 7. Implement Organization Agent
  - Create title analysis for generic/unclear titles detection
  - Implement LLM-powered title generation from content analysis
  - Add folder organization suggestions based on content themes
  - Create batch organizational improvement recommendations
  - Implement before/after comparison generation
  - _Requirements: 3.2, 3.5, 20.1, 20.2, 20.3, 20.4, 20.5_

- [x] 7.1 Write property test for recommendation generation
  - **Property 9: Valid recommendation generation**
  - **Validates: Requirements 3.2**

- [x]* 7.2 Write property test for title suggestions
  - **Property 12: Title suggestion for unclear titles**
  - **Validates: Requirements 3.5**

- [ ] 8. Create Learning Component
  - Implement feedback collection with context recording
  - Add pattern recognition in user preferences using LLM analysis
  - Create algorithm adaptation based on learned patterns
  - Implement privacy-preserving learning mechanisms
  - Add preference synchronization between devices
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8.1 Write property test for feedback recording
  - **Property 28: Feedback recording with context**
  - **Validates: Requirements 7.1**

- [x] 8.2 Write property test for privacy-preserving learning
  - **Property 32: Privacy-preserving learning**
  - **Validates: Requirements 7.5**

- [x] 9. Implement Agent Coordinator
  - Create lightweight agent orchestration system
  - Implement agent capability registration and communication protocols
  - Add workflow sequencing (indexing → extraction → scoring → detection → recommendations)
  - Create fallback mechanisms for agent failures
  - Implement data consistency across agent interactions
  - Add cross-device coordination between iOS and macOS
  - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

- [x] 9.1 Write property test for agent coordination
  - **Property 15: Privacy-preserving coordination**
  - **Validates: Requirements 4.3**

- [x] 10. Checkpoint - Core agent functionality complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Create iOS Client UI components
  - Implement dashboard with processing status and recommendation counts
  - Create recommendation cards with mobile-optimized layout
  - Add detail views with expandable note content and AI analysis
  - Implement batch action interface with confirmation dialogs
  - Add progress indicators for background processing
  - _Requirements: 5.1, 5.2, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 11.1 Write property test for recommendation display
  - **Property 18: Original note preservation in recommendations**
  - **Validates: Requirements 5.1**

- [x] 11.2 Write property test for review interface
  - **Property 19: Complete recommendation review interface**
  - **Validates: Requirements 5.2**

- [x] 12. Implement visual design system
  - Create color coding for utility score ranges (high/medium/low)
  - Add distinct icons and labels for recommendation types
  - Implement visual grouping for duplicate notes
  - Add accessibility support (VoiceOver, Dynamic Type, high contrast)
  - Create clear, non-technical explanation formatting
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 13. Add recommendation action handling
  - Implement deletion with confirmation and Apple Notes integration
  - Create rejection handling with feedback recording
  - Add high-impact recommendation prioritization
  - Implement reversible operation recording for all actions
  - Create undo functionality with complete state restoration
  - _Requirements: 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 13.1 Write property test for deletion confirmation
  - **Property 20: Deletion confirmation**
  - **Validates: Requirements 5.3**

- [x] 13.2 Write property test for rejection feedback
  - **Property 21: Rejection feedback recording**
  - **Validates: Requirements 5.4**

- [x] 13.3 Write property test for reversible operations
  - **Property 23: Reversible operation recording**
  - **Validates: Requirements 6.1**

- [x] 13.4 Write property test for undo functionality
  - **Property 24: Complete state restoration**
  - **Validates: Requirements 6.2**

- [x] 14. Implement security and privacy features
  - Add device-level encryption for cached data
  - Implement secure memory management to prevent data leaks
  - Create encrypted local network protocols for iOS-macOS communication
  - Add sensitive data clearing when app is backgrounded
  - Implement biometric authentication for note content access
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 15. Create performance optimization system
  - Implement batch processing for large note collections
  - Add resource throttling to maintain device responsiveness (max 25% CPU)
  - Create intelligent caching and memory cleanup
  - Add processing interruption and resumption capabilities
  - Optimize interface loading (target 2 seconds for recommendations display)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 16. Add error handling and recovery
  - Implement graceful OCR failure handling with text-only fallback
  - Create API retry logic with exponential backoff (max 3 attempts)
  - Add crash recovery with checkpoint resumption
  - Implement offline operation with locally cached data
  - Create user-friendly error messages with recovery suggestions
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 17. Implement device synchronization
  - Create secure device pairing with authentication key exchange
  - Add real-time progress updates between iOS and macOS
  - Implement preference synchronization (target 30 seconds)
  - Create offline sync queuing with conflict resolution
  - Add sync status notifications and conflict reporting
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 18. Create bulk cleanup functionality
  - Implement entire notes library analysis for bulk operations
  - Add safety level grouping (high/medium confidence, review needed)
  - Create storage savings estimation and progress reporting
  - Implement comprehensive backup creation before bulk actions
  - Add bulk action execution with safety confidence ordering
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 19. Add junk note detection
  - Implement pattern recognition for temporary notes (lists, scratch text, expired dates)
  - Create multi-stage validation to reduce false positives
  - Add junk note categorization (shopping lists, scratch pads, reminders, empty notes)
  - Implement uncertainty handling with manual review flagging
  - Create junk classification indicator highlighting
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 20. Implement onboarding and user education
  - Create interactive tutorial explaining agentic capabilities
  - Add example recommendations with AI reasoning demonstrations
  - Implement permission explanation with privacy protection details
  - Create progress indicators with estimated completion times
  - Add detailed privacy and security information with documentation links
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

- [x] 21. Add transparency and control features
  - Implement clear, non-technical explanation generation for all recommendations
  - Create detailed reasoning display with content factors and confidence levels
  - Add easy override options with feedback recording for learning
  - Implement detailed undo capabilities with exact state restoration
  - Create uncertainty indicators with safer action defaults
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

- [x] 22. Final checkpoint - Complete system integration
  - Ensure all tests pass, ask the user if questions arise.