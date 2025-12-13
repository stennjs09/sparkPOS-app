import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WebView as WebViewType } from 'react-native-webview';
import { WebView } from 'react-native-webview';

export default function App() {
  const [webViewKey, setWebViewKey] = useState(0);
  const [isConnected, setIsConnected] = useState(false); // Commencer par false
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldLoadWebView, setShouldLoadWebView] = useState(false); // Contrôler le chargement
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
        // Connexion établie après avoir été déconnecté
        if (connected && !shouldLoadWebView) {
          setShouldLoadWebView(true);
          setShowConnectionDialog(false);
          // Recharger la WebView
          setTimeout(() => {
            setWebViewKey(prev => prev + 1);
          }, 100);
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
      } catch (error) {
        console.error('Erreur lors de la vérification de connexion:', error);
        setInitialConnectionChecked(true);
        setShowConnectionDialog(true);
      }
    };

    checkInitialConnection();
  }, []);

  const injectedJavaScript = `
    // Approche simplifiée avec meta viewport
    let metaViewport = document.querySelector('meta[name="viewport"]');
    if (!metaViewport) {
      metaViewport = document.createElement('meta');
      metaViewport.name = 'viewport';
      document.head.appendChild(metaViewport);
    }
    
    // Définir le viewport pour un zoom fixe à 80%
    metaViewport.content = 'width=device-width, initial-scale=0.8, minimum-scale=0.8, maximum-scale=0.8, user-scalable=no, viewport-fit=cover';
    
    // Désactiver les gestes de zoom
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', e => e.preventDefault(), { passive: false });
    
    // Désactiver le double-tap pour zoomer
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
    
    // Empêcher le zoom par raccourcis clavier
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '0'].includes(e.key)) {
        e.preventDefault();
      }
    });

    // Optimisations pour la fluidité
    document.addEventListener('DOMContentLoaded', function() {
      // Désactiver le zoom involontaire
      document.addEventListener('gesturestart', function (e) {
        e.preventDefault();
      });
      
      // Optimiser les transitions CSS
      document.body.style.setProperty('-webkit-overflow-scrolling', 'touch');
      document.body.style.setProperty('transform', 'translateZ(0)');
      document.body.style.setProperty('-webkit-tap-highlight-color', 'transparent');
      document.body.style.setProperty('-webkit-touch-callout', 'none');
      document.body.style.setProperty('overscroll-behavior', 'contain');
      document.body.style.setProperty('touch-action', 'manipulation');
      
      // Améliorer le scrolling
      document.documentElement.style.setProperty('scroll-behavior', 'smooth');
      
      // Précharger les images pour éviter les saccades
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (!img.complete) {
          img.loading = 'eager';
        }
      });
    });
    true;
  `;

  const preloadContent = () => {
    webViewRef.current?.injectJavaScript(`
      // Précharger le contenu supplémentaire
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (!img.complete) {
          img.loading = 'eager';
        }
      });
      
      // Forcer le repaint pour éviter les glitches
      document.body.style.display = 'none';
      document.body.offsetHeight;
      document.body.style.display = 'block';
    `);
  };

  const refreshWebView = () => {
    if (isConnected) {
      setWebViewKey(prev => prev + 1);
    }
  };

  const onRefresh = () => {
    console.log('Pull-to-refresh déclenché');
    if (isConnected) {
      webViewRef.current?.reload();
    } else {
      setShowConnectionDialog(true);
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
        // Recharger la WebView
        setTimeout(() => {
          setWebViewKey(prev => prev + 1);
        }, 100);
      } else {
        // Toujours pas de connexion, garder le dialog ouvert
        setShowConnectionDialog(true);
      }
    } catch (error) {
      console.error('Erreur lors de la nouvelle tentative:', error);
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

  // Afficher un écran de chargement si la connexion n'a pas encore été vérifiée
  if (!initialConnectionChecked) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Vérification de la connexion...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {shouldLoadWebView && isConnected ? (
        <WebView
          ref={webViewRef}
          key={webViewKey}
          style={styles.webview}
          source={{ uri: 'https://sparkpos.bluetech.team/' }}
          injectedJavaScript={injectedJavaScript}

          // Performances essentielles
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}

          // Optimisations Android
          mixedContentMode="compatibility"
          thirdPartyCookiesEnabled={true}
          allowsBackForwardNavigationGestures={true}

          // Optimisations iOS
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          bounces={false}
          scrollEnabled={true}

          // Cache et performances
          cacheEnabled={true}
          incognito={false}

          // Indicateurs de scroll
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}

          // Ajustements de contenu
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}

          // Contrôle du zoom
          minimumZoomScale={0.8}
          maximumZoomScale={0.8}
          zoomScale={0.8}

          // Pull-to-refresh ACTIVÉ
          pullToRefreshEnabled={true}
          onRefresh={onRefresh}

          // Gestion des événements
          onLoadStart={() => {
            console.log('Chargement démarré');
            setIsLoading(true);
          }}
          onLoad={() => {
            console.log('Page chargée');
            setIsLoading(false);
            preloadContent();
          }}
          onLoadEnd={() => {
            console.log('Chargement terminé');
            setIsLoading(false);
          }}

          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('Erreur WebView:', nativeEvent);
            setIsLoading(false);

            // Afficher le dialog de connexion si erreur de réseau
            if (nativeEvent.description?.includes('net::') ||
              nativeEvent.description?.includes('network') ||
              nativeEvent.description?.includes('ERR_INTERNET_DISCONNECTED') ||
              !isConnected) {
              setShowConnectionDialog(true);
            }
          }}

          onRenderProcessGone={() => {
            // Redémarrer la WebView en cas de crash
            console.log('Redémarrage WebView');
            refreshWebView();
          }}

          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('Erreur HTTP:', nativeEvent.statusCode);
            setIsLoading(false);

            // Afficher le dialog pour certaines erreurs HTTP
            if (nativeEvent.statusCode >= 500 || nativeEvent.statusCode === 0) {
              setShowConnectionDialog(true);
            }
          }}

          onContentProcessDidTerminate={() => {
            // iOS uniquement - redémarrer si le processus se termine
            refreshWebView();
          }}

          // Optimisations supplémentaires
          containerStyle={{ flex: 1 }}

          // Améliorer les performances sur Android
          textZoom={100}
          setBuiltInZoomControls={false}
          setDisplayZoomControls={false}
        />
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