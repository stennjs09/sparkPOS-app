import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';

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
};

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

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

  // Memoized navigation handler
  const handleNavigationStateChange = useCallback(async (navState: any) => {
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
});
