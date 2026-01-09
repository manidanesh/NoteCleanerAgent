/**
 * LLM Resource Manager Override - Development Mode
 * Completely bypasses resource constraints for development/testing
 */

import { LLMRequest } from '../models/LLMModels';

export class LLMResourceManagerOverride {
  constructor() {
    console.log('🚀 LLM Resource Manager Override: Development mode - all constraints disabled');
  }

  /**
   * Always allow processing - no resource constraints in development
   */
  async canProcessRequest(request: LLMRequest): Promise<boolean> {
    console.log('✅ LLM Resource Override: Always allowing processing (development mode)');
    return true;
  }

  /**
   * No optimization needed in development
   */
  optimizeRequest(request: LLMRequest): LLMRequest {
    return request;
  }

  /**
   * No-op shutdown
   */
  shutdown(): void {
    console.log('LLM Resource Manager Override shutdown');
  }
}