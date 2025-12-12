import { LLMService, LLMServiceImpl, LLMProviderPreference, PrivacyLevel } from './LLMService';

/**
 * Factory for creating configured LLM service instances
 */
export class LLMServiceFactory {
  /**
   * Create LLM service with default privacy-first configuration
   */
  static createPrivacyFirst(): LLMService {
    const preference: LLMProviderPreference = {
      preferOnDevice: true,
      allowCloudWithConsent: false,
      fallbackToRules: true,
      privacyLevel: PrivacyLevel.STRICT_ON_DEVICE
    };

    return new LLMServiceImpl(preference);
  }

  /**
   * Create LLM service with balanced privacy and capability
   */
  static createBalanced(): LLMService {
    const preference: LLMProviderPreference = {
      preferOnDevice: true,
      allowCloudWithConsent: true,
      fallbackToRules: true,
      maxCloudRequests: 100,
      privacyLevel: PrivacyLevel.ON_DEVICE_PREFERRED
    };

    return new LLMServiceImpl(preference);
  }

  /**
   * Create LLM service with cloud capabilities enabled
   */
  static createCloudEnabled(): LLMService {
    const preference: LLMProviderPreference = {
      preferOnDevice: false,
      allowCloudWithConsent: true,
      fallbackToRules: true,
      maxCloudRequests: 1000,
      privacyLevel: PrivacyLevel.CLOUD_WITH_CONSENT
    };

    return new LLMServiceImpl(preference);
  }

  /**
   * Create LLM service with custom configuration
   */
  static createCustom(preference: LLMProviderPreference): LLMService {
    return new LLMServiceImpl(preference);
  }

  /**
   * Create development/testing service with mock providers
   */
  static createForTesting(): LLMService {
    const preference: LLMProviderPreference = {
      preferOnDevice: true,
      allowCloudWithConsent: false,
      fallbackToRules: true,
      privacyLevel: PrivacyLevel.STRICT_ON_DEVICE
    };

    return new LLMServiceImpl(preference);
  }
}

/**
 * Convenience function to get the default LLM service instance
 */
export function getDefaultLLMService(): LLMService {
  return LLMServiceFactory.createPrivacyFirst();
}

/**
 * Configuration presets for different use cases
 */
export const LLMServicePresets = {
  /**
   * Maximum privacy - only on-device processing
   */
  PRIVACY_FIRST: {
    preferOnDevice: true,
    allowCloudWithConsent: false,
    fallbackToRules: true,
    privacyLevel: PrivacyLevel.STRICT_ON_DEVICE
  } as LLMProviderPreference,

  /**
   * Balanced approach - prefer on-device but allow cloud with consent
   */
  BALANCED: {
    preferOnDevice: true,
    allowCloudWithConsent: true,
    fallbackToRules: true,
    maxCloudRequests: 100,
    privacyLevel: PrivacyLevel.ON_DEVICE_PREFERRED
  } as LLMProviderPreference,

  /**
   * Performance focused - allow cloud processing for better results
   */
  PERFORMANCE: {
    preferOnDevice: false,
    allowCloudWithConsent: true,
    fallbackToRules: true,
    maxCloudRequests: 1000,
    privacyLevel: PrivacyLevel.CLOUD_WITH_CONSENT
  } as LLMProviderPreference,

  /**
   * Development and testing
   */
  DEVELOPMENT: {
    preferOnDevice: true,
    allowCloudWithConsent: false,
    fallbackToRules: true,
    privacyLevel: PrivacyLevel.STRICT_ON_DEVICE
  } as LLMProviderPreference
};