import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
  Modal,
  TouchableOpacity,
  Pressable
} from 'react-native';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

// ====================================
// FACEBOOK LITE CONFIGURATION
// ====================================
const WEB_APP_URL = 'https://sparkpos.bluetech.team/';
const APP_DOMAIN = 'sparkpos.bluetech.team';

// Ultra-minimal User-Agent
const CUSTOM_USER_AGENT = `SparkPOS/1.0 ${Platform.OS}`;

// Theme colors
const COLORS = {
  primary: '#1877f2',
  background: '#f5f5f5',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  white: '#ffffff',
  gray: '#6b7280',
  grayLight: '#f3f4f6',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(WEB_APP_URL);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const backHandledRef = useRef<boolean | null>(null);

  // Network monitoring for offline-first behavior
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  // Facebook Lite Strategy: Loading ONLY at startup (once)
  useEffect(() => {
    const timer = setTimeout(() => setInitialLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Android Back Button Handler
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleBackPress = () => {
      // Reset the response flag
      backHandledRef.current = null;

      // First, try to close any modal in the web app
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          (function() {
            window.dispatchEvent(new CustomEvent('BACK_BUTTON_PRESSED'));
            true;
          })();
        `);
      }

      // Wait a bit for the web app to respond
      setTimeout(() => {
        // If web app handled it (closed a modal), we're done
        if (backHandledRef.current === true) {
          return;
        }

        // Check if we're on the home page or auth page
        let isHomePage = false;
        let isAuthPage = false;
        try {
          const url = new URL(currentUrl);
          isHomePage = url.pathname === '/' || url.pathname === '';
          isAuthPage = url.pathname === '/auth' || url.pathname.startsWith('/auth');
        } catch {
          isHomePage = currentUrl === WEB_APP_URL || currentUrl === WEB_APP_URL.slice(0, -1);
        }

        // On home or auth page, or no back history: show exit confirmation
        if (isHomePage || isAuthPage || !canGoBack) {
          setShowExitDialog(true);
        } else {
          // Navigate back in WebView history
          webViewRef.current?.goBack();
        }
      }, 150);

      // Return true to prevent default back behavior
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [canGoBack, currentUrl]);

  // Memoized navigation handler
  const handleNavigationStateChange = useCallback(async (navState: any) => {
    // Track navigation state for back button
    setCanGoBack(navState.canGoBack);
    setCurrentUrl(navState.url);

    try {
      const url = new URL(navState.url);

      // Internal navigation → stay in WebView
      if (url.hostname === APP_DOMAIN) return true;

      // External navigation → Chrome Custom Tabs
      if (navState.url !== WEB_APP_URL && !navState.loading) {
        webViewRef.current?.stopLoading();

        await WebBrowser.openBrowserAsync(navState.url, {
          toolbarColor: COLORS.primary,
          controlsColor: '#ffffff',
          showTitle: true,
          dismissButtonStyle: 'close',
        });

        webViewRef.current?.goBack();
        return false;
      }
    } catch (error) {
      // Silent error handling
    }
    return true;
  }, []);

  // Memoized message handler
  const handleMessage = useCallback((event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      // Handle back button response from web app
      if (message.type === 'BACK_HANDLED') {
        backHandledRef.current = message.handled;
        return;
      }

      if (message.type === 'NAVIGATION' && message.url) {
        handleNavigationStateChange({ url: message.url, loading: false });
      }
    } catch (error) {
      // Silent error handling
    }
  }, [handleNavigationStateChange]);

  // Memoized request filter
  const handleShouldStartLoad = useCallback((request: any) => {
    try {
      if (request.url.startsWith('data:') || request.url.startsWith('about:')) {
        return true;
      }
      const url = new URL(request.url);
      return url.hostname === APP_DOMAIN || url.hostname.endsWith(`.${APP_DOMAIN}`);
    } catch (error) {
      return true;
    }
  }, []);

  // Minimal JS Bridge + Keyboard scroll fix
  const injectedJS = `
    (function() {
      window.isNativeApp = true;
      window.platform = '${Platform.OS}';
      window.nativeBridge = {
        postMessage: function(t, d) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: t, ...d }));
          }
        }
      };
      
      // Handle external link clicks
      document.addEventListener('click', function(e) {
        var a = e.target.closest('a');
        if (a && a.href) {
          try {
            var u = new URL(a.href);
            if (u.hostname !== '${APP_DOMAIN}') {
              e.preventDefault();
              window.nativeBridge.postMessage('NAVIGATION', { url: a.href });
            }
          } catch(err) {}
        }
      }, true);
      
      // KEYBOARD FIX: Scroll focused input into view
      document.addEventListener('focus', function(e) {
        var el = e.target;
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          // Wait for keyboard animation
          setTimeout(function() {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
      }, true);
      
      true;
    })();
  `;

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <WebView
          ref={webViewRef}
          source={{ uri: WEB_APP_URL }}

          // === PERFORMANCE (Facebook Lite) ===
          cacheEnabled={true}
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          startInLoadingState={false}

          // === MEMORY OPTIMIZATION ===
          incognito={false}
          pullToRefreshEnabled={false}
          overScrollMode="never"

          // === KEYBOARD ===
          keyboardDisplayRequiresUserAction={false}
          nestedScrollEnabled={true}
          automaticallyAdjustContentInsets={true}

          // === STORAGE ===
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}

          // === USER AGENT ===
          userAgent={CUSTOM_USER_AGENT}

          // === JS BRIDGE ===
          injectedJavaScriptBeforeContentLoaded={injectedJS}
          onMessage={handleMessage}
          javaScriptEnabled={true}

          // === NAVIGATION ===
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          allowsBackForwardNavigationGestures={true}

          // === MEDIA ===
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}

          // === LOADING ===
          onLoadEnd={() => initialLoading && setInitialLoading(false)}
          onError={() => setInitialLoading(false)}
          onHttpError={() => setInitialLoading(false)}

          // === iOS ===
          bounces={false}
          scrollEnabled={true}
          contentInsetAdjustmentBehavior="automatic"

          // === ANDROID HARDWARE ACCELERATION ===
          androidLayerType="hardware"

          // === Style ===
          style={styles.webview}
        />

        {/* Initial loading only */}
        {initialLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Beautiful Exit Confirmation Dialog - Outside KeyboardAvoidingView for full screen coverage */}
      <Modal
        visible={showExitDialog}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowExitDialog(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowExitDialog(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="exit-outline" size={36} color={COLORS.danger} />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>Quitter l'application ?</Text>

            {/* Description */}
            <Text style={styles.modalDescription}>
              Êtes-vous sûr de vouloir quitter SparkPOS ?
            </Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.exitButton}
                onPress={() => BackHandler.exitApp()}
                activeOpacity={0.7}
              >
                <Text style={styles.exitButtonText}>Quitter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowExitDialog(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.grayLight,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray,
  },
  exitButton: {
    flex: 1,
    backgroundColor: COLORS.danger,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  exitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});

