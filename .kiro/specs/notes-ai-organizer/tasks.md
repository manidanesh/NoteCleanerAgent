# Implementation Plan

## Phase 1: Core LLM Integration (Critical Priority)

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for agents, services, models, and UI components
  - Define TypeScript interfaces for all data models (Note, UtilityScore, Recommendation, etc.)
  - Set up testing framework with fast-check for property-based testing
  - Configure build system for iOS/macOS cross-platform development
  - _Requirements: 1.1, 23.1, 24.1, 25.1_

- [x] 2. Implement working LLM service layer
  - Replace mock LLMService with actual Ollama integration for macOS
  - Add Core ML integration for iOS (simplified model)
  - Implement proper error handling and fallbacks to rule-based processing
  - Add LLM request queuing and resource management
  - Create LLM response caching and optimization
  - _Requirements: 4.1, 4.2, 24.1, 24.5_

- [ ] 2.1 Write property test for LLM service functionality
  - **Property 13: On-device processing boundary**
  - **Validates: Requirements 4.1**

- [ ] 2.2 Write property test for LLM resource management
  - **Property 16: Offline operation capability**
  - **Validates: Requirements 4.4**

- [ ] 3. Upgrade Content Extractor Agent with real LLM
  - Replace mock content analysis with actual LLM-powered semantic understanding
  - Implement structured prompt engineering for content extraction
  - Add fallback to rule-based extraction when LLM unavailable
  - Integrate with OCR results for handwritten text processing
  - Create content classification using LLM (meeting, idea, task, reference)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3.1 Write property test for LLM-powered content extraction
  - **Property 3: OCR processing for handwritten content**
  - **Validates: Requirements 2.1**

- [ ] 3.2 Write property test for content classification
  - **Property 4: Image content analysis**
  - **Validates: Requirements 2.2**

- [ ] 4. Upgrade Utility Scorer Agent with real LLM
  - Replace mock scoring with LLM-powered content quality assessment
  - Implement hybrid scoring combining traditional metrics with LLM insights
  - Add explanation generation using LLM for human-readable reasoning
  - Create user preference learning through LLM pattern recognition
  - Integrate semantic analysis with embedding-based similarity
  - _Requirements: 3.1, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 4.1 Write property test for LLM-enhanced utility scoring
  - **Property 8: Valid utility score assignment**
  - **Validates: Requirements 3.1**

- [ ] 4.2 Write property test for explanation generation
  - **Property 10: Explanation provision**
  - **Validates: Requirements 3.3**

- [ ] 5. Upgrade Organization Agent with real LLM
  - Replace mock title suggestions with LLM-powered title generation
  - Implement LLM-based folder organization recommendations
  - Add content theme extraction using semantic analysis
  - Create batch organizational improvements with LLM insights
  - Implement before/after comparison generation with reasoning
  - _Requirements: 3.2, 3.5, 20.1, 20.2, 20.3, 20.4, 20.5_

- [ ] 5.1 Write property test for LLM-powered organization
  - **Property 9: Valid recommendation generation**
  - **Validates: Requirements 3.2**

- [ ] 5.2 Write property test for title suggestions
  - **Property 12: Title suggestion for unclear titles**
  - **Validates: Requirements 3.5**

- [ ] 6. Upgrade Duplicate Detector Agent with real LLM
  - Implement FAISS vector indexing with actual embeddings
  - Add LLM-powered semantic similarity detection
  - Create intelligent merge strategy determination using LLM
  - Implement conflict resolution with LLM analysis
  - Add duplicate ranking by completeness and quality assessment
  - _Requirements: 3.4, 9.1, 9.2, 9.3, 9.4, 9.5, 19.1, 19.2, 19.3, 19.4, 19.5, 24.2_

- [ ] 6.1 Write property test for LLM-powered duplicate detection
  - **Property 11: Duplicate detection for similar content**
  - **Validates: Requirements 3.4**

- [ ] 7. Checkpoint - LLM integration complete
  - Ensure all LLM-powered agents function correctly
  - Validate fallback mechanisms work when LLM unavailable
  - Test agent coordination with real LLM processing
  - Verify performance requirements with actual LLM calls

## Phase 2: Apple Notes API Integration (High Priority)

- [x] 8. Implement real Apple Notes API integration
  - Create EventKit wrapper for iOS Notes access with proper permissions
  - Implement NSAppleScript bridge for macOS Notes access
  - Add proper permission management and revocation detection
  - Implement rate limiting (max 100 notes/second) and retry logic
  - Add FSEvents monitoring for real-time note changes on macOS
  - _Requirements: 1.1, 1.4, 23.1, 23.2, 23.3_

- [ ] 8.1 Write property test for permission handling
  - **Property 1: Permission revocation stops processing**
  - **Validates: Requirements 1.4**

- [ ] 8.2 Write property test for API rate limiting
  - **Property 17: Cloud processing consent requirement**
  - **Validates: Requirements 4.5**

- [ ] 9. Replace mock data with real Notes integration
  - Update all agents to work with real Apple Notes data structures
  - Implement proper note content parsing (text, images, attachments)
  - Add support for Notes-specific features (checklists, drawings, etc.)
  - Create data transformation layer between Notes API and internal models
  - Handle Notes app permission changes and data updates
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 23.3, 23.4_

- [ ] 9.1 Write property test for Notes data integration
  - **Property 5: Attachment processing**
  - **Validates: Requirements 2.3**

- [ ] 9.2 Write property test for checklist preservation
  - **Property 6: Checklist structure preservation**
  - **Validates: Requirements 2.4**

- [ ] 10. Checkpoint - Apple Notes integration complete
  - Ensure system works with real Apple Notes data instead of mock data
  - Validate all note types and content formats are supported
  - Test permission handling and revocation scenarios
  - Verify rate limiting and error handling work correctly

## Phase 3: Property-Based Testing Implementation (High Priority)

- [ ] 11. Implement comprehensive property-based test suite
  - Set up fast-check testing framework with proper configuration
  - Create intelligent test data generators for Notes, Recommendations, etc.
  - Implement test execution with minimum 100 iterations per property
  - Add property test reporting and failure analysis
  - Configure continuous integration for property test execution
  - _Requirements: All requirements - comprehensive validation_

- [ ] 11.1 Implement core data model property tests
  - **Property 8: Valid utility score assignment**
  - **Property 11: Duplicate detection for similar content**
  - **Property 18: Original note preservation in recommendations**
  - **Validates: Requirements 3.1, 3.4, 5.1**

- [ ] 11.2 Implement agent coordination property tests
  - **Property 15: Privacy-preserving coordination**
  - **Property 23: Reversible operation recording**
  - **Property 28: Feedback recording with context**
  - **Validates: Requirements 4.3, 6.1, 7.1**

- [ ] 11.3 Implement system behavior property tests
  - **Property 13: On-device processing boundary**
  - **Property 16: Offline operation capability**
  - **Property 20: Deletion confirmation**
  - **Validates: Requirements 4.1, 4.4, 5.3**

- [ ] 11.4 Implement LLM integration property tests
  - **Property 3: OCR processing for handwritten content**
  - **Property 7: Extraction failure resilience**
  - **Property 10: Explanation provision**
  - **Validates: Requirements 2.1, 2.5, 3.3**

- [ ] 11.5 Implement remaining correctness properties (Properties 1-32)
  - Complete all 32 properties specified in design document
  - Ensure each property runs minimum 100 test iterations
  - Add property-specific test data generators
  - Implement proper failure reporting and debugging
  - **Validates: All requirements comprehensively**

- [ ] 12. Checkpoint - Property-based testing complete
  - All 32 correctness properties implemented and passing
  - Test suite runs reliably in CI/CD pipeline
  - Property test failures provide actionable debugging information
  - Test coverage meets requirements for all critical system behaviors

## Phase 4: Integration and Production Readiness (Medium Priority)

- [ ] 13. Create end-to-end integration tests
  - Test complete workflow from Notes API to recommendations
  - Validate agent coordination with real LLM and Notes data
  - Test error handling and recovery scenarios with real data
  - Verify performance requirements are met (100 notes in 30 seconds)
  - Test cross-device synchronization functionality
  - _Requirements: 14.1, 14.2, 14.3, 15.1, 15.2, 16.1, 16.2_

- [ ] 13.1 Write integration test for complete workflow
  - **Property 21: Rejection feedback recording**
  - **Validates: Requirements 5.4**

- [ ] 13.2 Write integration test for performance requirements
  - **Property 24: Complete state restoration**
  - **Validates: Requirements 6.2**

- [ ] 14. Implement production deployment preparation
  - Create build scripts for iOS and macOS applications
  - Add proper logging and monitoring for production use
  - Implement user onboarding flow with real data
  - Create installation and setup documentation
  - Add crash reporting and analytics (privacy-compliant)
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

- [ ] 15. Upgrade UI components to work with real data
  - Update dashboard to show real processing status and recommendation counts
  - Modify recommendation cards to display actual LLM-generated content
  - Enhance detail views with real AI analysis and explanations
  - Implement batch action interface with real Notes API integration
  - Add progress indicators for actual background processing
  - _Requirements: 5.1, 5.2, 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 15.1 Write property test for real recommendation display
  - **Property 18: Original note preservation in recommendations**
  - **Validates: Requirements 5.1**

- [ ] 15.2 Write property test for real review interface
  - **Property 19: Complete recommendation review interface**
  - **Validates: Requirements 5.2**

- [ ] 16. Final validation and optimization
  - Run complete property-based test suite with real data
  - Perform performance testing with large note collections (1000+ notes)
  - Validate privacy and security requirements in production environment
  - Test all error handling and recovery scenarios
  - Optimize LLM usage for production performance
  - _Requirements: 13.1, 13.2, 13.3, 14.4, 14.5_

- [ ] 17. Final checkpoint - Production ready system
  - All agents use real LLM processing with appropriate fallbacks
  - System works with actual Apple Notes data instead of mock data
  - All 32 correctness properties pass with 100+ test iterations
  - End-to-end workflow functions correctly from Notes access to recommendations
  - Performance requirements met and validated in production environment

## Implementation Priority Summary

**Phase 1 (Critical)**: Tasks 2-7 - LLM integration transforms mock AI into real AI capabilities
**Phase 2 (High)**: Tasks 8-10 - Apple Notes API enables real-world usage instead of demos  
**Phase 3 (High)**: Tasks 11-12 - Property-based testing ensures correctness and reliability
**Phase 4 (Medium)**: Tasks 13-17 - Integration and deployment for production readiness

## Success Criteria

- [ ] All agents use real LLM processing with appropriate fallbacks
- [ ] System works with actual Apple Notes data instead of mock data  
- [ ] All 32 correctness properties pass with 100+ test iterations
- [ ] End-to-end workflow functions correctly from Notes access to recommendations
- [ ] Performance requirements met (100 notes in 30 seconds, <25% CPU usage)