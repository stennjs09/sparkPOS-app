import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, StyleSheet, Text, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import type { WebView as WebViewType } from 'react-native-webview';
import { WebView } from 'react-native-webview';

// Configuration - URL de l'application web
const WEB_APP_URL = 'http://192.168.1.10:8080/';

export default function App() {
  const [webViewKey, setWebViewKey] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [shouldLoadWebView, setShouldLoadWebView] = useState(false);
  const [initialConnectionChecked, setInitialConnectionChecked] = useState(false);
  const webViewRef = useRef<WebViewType>(null);

  // Surveiller la connexion internet
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable;
      setIsConnected(connected ?? false);

      if (!initialConnectionChecked) {
        setInitialConnectionChecked(true);
        if (connected) {
          setShouldLoadWebView(true);
        } else {
          setShowConnectionDialog(true);
        }
      } else {
        if (connected && !shouldLoadWebView) {
          setShouldLoadWebView(true);
          setShowConnectionDialog(false);
          setTimeout(() => setWebViewKey(prev => prev + 1), 100);
        } else if (!connected) {
          setShowConnectionDialog(true);
        }
      }
    });

    return () => unsubscribe();
  }, [initialConnectionChecked, shouldLoadWebView]);

  // Vérifier la connexion initiale
  useEffect(() => {
    const checkInitialConnection = async () => {
      try {
        const state = await NetInfo.fetch();
        const connected = state.isConnected && state.isInternetReachable;
        setIsConnected(connected ?? false);
        setInitialConnectionChecked(true);

        if (connected) {
          setShouldLoadWebView(true);
        } else {
          setShowConnectionDialog(true);
        }
      } catch {
        setInitialConnectionChecked(true);
        setShowConnectionDialog(true);
      }
    };

    checkInitialConnection();
  }, []);

  const refreshWebView = () => {
    if (isConnected) {
      setWebViewKey(prev => prev + 1);
    }
  };

  const handleConnectionDialogOK = () => {
    if (!isConnected) {
      BackHandler.exitApp();
    } else {
      setShowConnectionDialog(false);
      if (!shouldLoadWebView) {
        setShouldLoadWebView(true);
      }
    }
  };

  const handleRetry = async () => {
    try {
      const state = await NetInfo.fetch();
      const connected = state.isConnected && state.isInternetReachable;

      if (connected) {
        setIsConnected(true);
        setShowConnectionDialog(false);
        setShouldLoadWebView(true);
        setTimeout(() => setWebViewKey(prev => prev + 1), 100);
      } else {
        setShowConnectionDialog(true);
      }
    } catch {
      setShowConnectionDialog(true);
    }
  };

  const ConnectionDialog = () => (
    <Modal
      visible={showConnectionDialog}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.dialogContainer}>
          <Text style={styles.dialogTitle}>Connectez-vous à un réseau</Text>
          <Text style={styles.dialogMessage}>
            Pour utiliser SparkPOS, activez les données mobiles ou connectez-vous au Wi-Fi.
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.retryButton]}
              onPress={handleRetry}
            >
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.okButton]}
              onPress={handleConnectionDialogOK}
            >
              <Text style={styles.okButtonText}>
                {isConnected ? 'OK' : 'Quitter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.brandingContainer}>
          <Text style={styles.brandingText}>from</Text>
          <Text style={styles.brandingLogo}>SparkPOS</Text>
        </View>
      </View>
    </Modal>
  );

  // Écran de chargement initial
  if (!initialConnectionChecked) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Vérification de la connexion...</Text>
      </View>
    );
  }

  // JavaScript injecté pour gérer le scroll clavier sur Android
  // Stratégie Standard : Scroll simple sur resize
  const injectedJavaScript = `
    window.addEventListener("resize", function() {
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
        document.activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    true;
  `;

  return (
    <View style={styles.container}>
      {shouldLoadWebView && isConnected ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <WebView
            ref={webViewRef}
            key={webViewKey}
            style={styles.webview}
            source={{ uri: WEB_APP_URL }}

            // Essentiels
            javaScriptEnabled={true}
            injectedJavaScript={injectedJavaScript}
            domStorageEnabled={true}
            startInLoadingState={true}

            // Android
            mixedContentMode="compatibility"
            thirdPartyCookiesEnabled={true}
            textZoom={100}
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}

            // iOS
            allowsInlineMediaPlayback={true}
            bounces={false}
            scrollEnabled={true}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}

            // Cache
            cacheEnabled={true}
            incognito={false}

            // UI
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            pullToRefreshEnabled={true}

            // Événements
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              if (
                nativeEvent.description?.includes('net::') ||
                nativeEvent.description?.includes('network') ||
                nativeEvent.description?.includes('ERR_INTERNET_DISCONNECTED') ||
                !isConnected
              ) {
                setShowConnectionDialog(true);
              }
            }}

            onRenderProcessGone={refreshWebView}
            onContentProcessDidTerminate={refreshWebView}

            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              if (nativeEvent.statusCode >= 500 || nativeEvent.statusCode === 0) {
                setShowConnectionDialog(true);
              }
            }}

            containerStyle={{ flex: 1 }}
          />
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.container, styles.loadingContainer]}>
          <Text style={styles.loadingText}>
            {!isConnected ? 'Pas de connexion internet' : 'Connexion en cours...'}
          </Text>
        </View>
      )}

      <ConnectionDialog />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: Constants.statusBarHeight,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialogContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1e21',
    marginBottom: 12,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 14,
    color: '#65676b',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
    minWidth: 80,
  },
  retryButton: {
    backgroundColor: '#42a5f5',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  okButton: {
    backgroundColor: '#1877f2',
  },
  okButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  brandingContainer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  brandingText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 4,
  },
  brandingLogo: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
});