import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { SecurityService } from '../../services/SecurityService';

/**
 * BiometricAuthProvider implements requirement 13.5 for biometric authentication
 * and requirement 13.4 for clearing sensitive data when app is backgrounded
 */

interface BiometricAuthContextType {
  isAuthenticated: boolean;
  isBiometricAvailable: boolean;
  authenticate: () => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const BiometricAuthContext = createContext<BiometricAuthContextType | undefined>(undefined);

interface BiometricAuthProviderProps {
  children: ReactNode;
  requireAuthOnStart?: boolean;
  requireAuthOnForeground?: boolean;
}

export const BiometricAuthProvider: React.FC<BiometricAuthProviderProps> = ({
  children,
  requireAuthOnStart = true,
  requireAuthOnForeground = true
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appState, setAppState] = useState(AppState.currentState);
  
  const securityService = SecurityService.getInstance();

  useEffect(() => {
    initializeBiometricAuth();
    setupAppStateHandling();
    
    return () => {
      // Cleanup when component unmounts
      securityService.cleanup();
    };
  }, []);

  /**
   * Requirement 13.5: Initialize biometric authentication
   */
  const initializeBiometricAuth = async () => {
    try {
      setIsLoading(true);
      
      // Check if biometric authentication is available
      const available = await securityService.isBiometricAuthenticationAvailable();
      setIsBiometricAvailable(available);
      
      // If biometric auth is required and available, authenticate on start
      if (requireAuthOnStart && available) {
        const success = await authenticate();
        setIsAuthenticated(success);
      } else {
        // If biometric auth is not available, allow access without it
        setIsAuthenticated(!available || !requireAuthOnStart);
      }
    } catch (error) {
      console.error('Failed to initialize biometric authentication:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Requirement 13.4: Setup app state handling for background/foreground transitions
   */
  const setupAppStateHandling = () => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        handleAppForeground();
      } else if (nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        handleAppBackground();
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  /**
   * Requirement 13.4: Handle app going to background
   */
  const handleAppBackground = () => {
    // Clear sensitive data when app is backgrounded
    securityService.onAppBackground();
    
    // Require re-authentication when app returns to foreground
    if (requireAuthOnForeground && isBiometricAvailable) {
      setIsAuthenticated(false);
    }
  };

  /**
   * Requirement 13.4: Handle app coming to foreground
   */
  const handleAppForeground = async () => {
    securityService.onAppForeground();
    
    // Require re-authentication if biometric auth is available and required
    if (requireAuthOnForeground && isBiometricAvailable && !isAuthenticated) {
      const success = await authenticate();
      setIsAuthenticated(success);
    }
  };

  /**
   * Requirement 13.5: Perform biometric authentication
   */
  const authenticate = async (): Promise<boolean> => {
    try {
      if (!isBiometricAvailable) {
        // If biometric auth is not available, allow access
        return true;
      }

      const success = await securityService.authenticateWithBiometrics();
      
      if (success) {
        setIsAuthenticated(true);
        return true;
      } else {
        // Show error alert if authentication fails
        Alert.alert(
          'Authentication Failed',
          'Biometric authentication is required to access your notes. Please try again.',
          [
            {
              text: 'Retry',
              onPress: () => authenticate()
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
        return false;
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      
      Alert.alert(
        'Authentication Error',
        'An error occurred during biometric authentication. Please try again.',
        [
          {
            text: 'Retry',
            onPress: () => authenticate()
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      
      return false;
    }
  };

  /**
   * Logout and clear authentication state
   */
  const logout = () => {
    setIsAuthenticated(false);
    securityService.clearAllSensitiveData();
  };

  const contextValue: BiometricAuthContextType = {
    isAuthenticated,
    isBiometricAvailable,
    authenticate,
    logout,
    isLoading
  };

  return (
    <BiometricAuthContext.Provider value={contextValue}>
      {children}
    </BiometricAuthContext.Provider>
  );
};

/**
 * Hook to use biometric authentication context
 */
export const useBiometricAuth = (): BiometricAuthContextType => {
  const context = useContext(BiometricAuthContext);
  if (context === undefined) {
    throw new Error('useBiometricAuth must be used within a BiometricAuthProvider');
  }
  return context;
};

/**
 * Higher-order component to protect components with biometric authentication
 */
export const withBiometricAuth = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => {
    const { isAuthenticated, isLoading, authenticate } = useBiometricAuth();

    if (isLoading) {
      // Show loading screen while checking biometric availability
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '18px'
        }}>
          Initializing Security...
        </div>
      );
    }

    if (!isAuthenticated) {
      // Show authentication required screen
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2>Authentication Required</h2>
          <p>Please authenticate to access your notes securely.</p>
          <button 
            onClick={authenticate}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#007AFF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            Authenticate
          </button>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

export default BiometricAuthProvider;