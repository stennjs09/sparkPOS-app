import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState, useEffect } from 'react';
import { BackHandler, StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import Constants from 'expo-constants';

// Configuration - URL de l'application web
const WEB_APP_URL = 'https://sparkpos.bluetech.team/';
const APP_DOMAIN = 'sparkpos.bluetech.team';

// User-Agent custom pour identifier l'app mobile
const CUSTOM_USER_AGENT = `SparkPOS-Mobile/1.0 ${Platform.OS === 'ios' ? 'iOS' : 'Android'}`;

// Couleurs du thème SparkPOS
const COLORS = {
  primary: '#1877f2',
  background: '#f5f5f5',
};

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Facebook Lite Strategy: Loading ONLY at startup (once)
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 3000); // Max 3s at startup

    return () => clearTimeout(timer);
  }, []);

  // Gestion de la navigation hybride (WebView vs Chrome Custom Tabs)
  const handleNavigationStateChange = async (navState: any) => {
    try {
      const url = new URL(navState.url);

      // Navigation interne (même domaine) → rester dans WebView
      if (url.hostname === APP_DOMAIN) {
        return true; // Continue navigation dans WebView
      }

      // Navigation externe → ouvrir Chrome Custom Tabs
      if (navState.url !== WEB_APP_URL && !navState.loading) {
        // Empêcher la navigation dans WebView
        webViewRef.current?.stopLoading();

        // Ouvrir dans le navigateur système
        await WebBrowser.openBrowserAsync(navState.url, {
          toolbarColor: COLORS.primary,
          controlsColor: '#ffffff',
          showTitle: true,
          dismissButtonStyle: 'close',
        });

        // Retourner à l'URL principale
        webViewRef.current?.goBack();

        return false; // Empêcher navigation WebView
      }
    } catch (error) {
      // Navigation error silently handled
    }

    return true;
  };

  // Gestion du bouton retour Android
  const handleBackPress = () => {
    if (webViewRef.current) {
      webViewRef.current.goBack();
      return true;
    }
    return false;
  };

  // JS Bridge - Communication Native ↔ Web
  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'NAVIGATION':
          if (message.url) {
            handleNavigationStateChange({ url: message.url, loading: false });
          }
          break;

        case 'SHARE':
          // TODO: Implémenter partage natif si requis
          break;

        case 'HAPTIC':
          // TODO: Implémenter vibration si requis
          break;

        default:
        // Unknown message type
      }
    } catch (error) {
      // Message handling error silently handled
    }
  };

  // Script injecté pour JS Bridge
  const injectedJavaScript = `
    (function() {
      // Interface de communication Web → Native
      window.ReactNativeWebView = window.ReactNativeWebView || {};
      
      // Détection environnement WebView
      window.isNativeApp = true;
      window.platform = '${Platform.OS}';
      
      // Helper pour envoyer messages au natif
      window.nativeBridge = {
        postMessage: function(type, data) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
          }
        }
      };
      
      // Intercepter clics sur liens pour gestion hybride
      document.addEventListener('click', function(e) {
        const target = e.target.closest('a');
        if (target && target.href) {
          const url = new URL(target.href);
          if (url.hostname !== '${APP_DOMAIN}') {
            e.preventDefault();
            window.nativeBridge.postMessage('NAVIGATION', { url: target.href });
          }
        }
      }, true);
      
      true; // Required for iOS
    })();
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}

        // Performance & Cache
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        startInLoadingState={false} // CRITICAL: No built-in loading state

        // Security
        allowsBackForwardNavigationGestures={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}

        // Keyboard handling (Android)
        keyboardDisplayRequiresUserAction={false}
        nestedScrollEnabled={true}

        // Storage
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}

        // User Agent
        userAgent={CUSTOM_USER_AGENT}

        // JS Bridge
        injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
        onMessage={handleMessage}
        javaScriptEnabled={true}

        // Navigation
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={(request) => {
          try {
            // Allow data URLs and about:blank (system navigation)
            if (request.url.startsWith('data:') || request.url.startsWith('about:')) {
              return true;
            }

            const url = new URL(request.url);

            // Allow navigation to main domain
            if (url.hostname === APP_DOMAIN || url.hostname.endsWith(`.${APP_DOMAIN}`)) {
              return true;
            }

            // Block external navigation (will be handled by onNavigationStateChange)
            return false;
          } catch (error) {
            // If URL parsing fails, allow navigation by default
            return true;
          }
        }}

        // Loading - Facebook Lite style: only on FIRST load
        onLoadStart={() => {
          // Do nothing - no loading indicator on navigation
        }}
        onLoadEnd={() => {
          // Only hide initial loading, never show loading again
          if (initialLoading) {
            setInitialLoading(false);
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          // WebView error silently handled
          setInitialLoading(false);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          // HTTP error silently handled
          setInitialLoading(false);
        }}

        // iOS specific
        bounces={false}
        scrollEnabled={true}

        // Style
        style={styles.webview}
      />

      {/* Loading indicator - ONLY at initial startup */}
      {initialLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    marginTop: Constants.statusBarHeight,
  },
  webview: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});