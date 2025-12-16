import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Configuration - URL de l'application web
const WEB_APP_URL = 'https://sparkpos.bluetech.team/';

// Couleurs du thème SparkPOS
const COLORS = {
  primary: '#1877f2',
  background: '#f5f5f5',
  text: '#1c1e21',
  white: '#ffffff',
};

export default function App() {
  const [showRetry, setShowRetry] = useState(false);

  const openBrowser = async () => {
    try {
      setShowRetry(false);

      // Préchauffe le navigateur pour de meilleures performances
      await WebBrowser.warmUpAsync();

      // Ouvre l'application dans Chrome Custom Tabs (Android) ou SFSafariViewController (iOS)
      const result = await WebBrowser.openBrowserAsync(WEB_APP_URL, {
        // Options pour Chrome Custom Tabs (Android)
        toolbarColor: COLORS.primary,
        controlsColor: COLORS.white,

        // Options communes
        enableBarCollapsing: true,
        showTitle: true,
        enableDefaultShare: true,

        // iOS SFSafariViewController
        preferredBarTintColor: COLORS.primary,
        preferredControlTintColor: COLORS.white,

        // Comportement
        dismissButtonStyle: 'close',
        readerMode: false,
      });

      // Nettoie le navigateur
      await WebBrowser.coolDownAsync();

      // Ferme l'application après que l'utilisateur a fermé le navigateur
      setTimeout(() => {
        BackHandler.exitApp();
      }, 100);
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de SparkPOS:', error);
      setShowRetry(true);
    }
  };

  // Ouvre automatiquement Chrome Custom Tabs au lancement
  useEffect(() => {
    openBrowser();

    // Timeout de sécurité: si le navigateur ne s'ouvre pas en 3 secondes, affiche le bouton retry
    const timeout = setTimeout(() => {
      setShowRetry(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  // Écran de chargement simple pendant l'ouverture
  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>S</Text>
      </View>
      <Text style={styles.appTitle}>SparkPOS</Text>

      <TouchableOpacity
        style={styles.retryButton}
        onPress={openBrowser}
        activeOpacity={0.8}
      >
        <Text style={styles.retryButtonText}>Commencer</Text>
        <Ionicons name="arrow-forward" size={20} color={COLORS.white} style={styles.arrowIcon} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Constants.statusBarHeight,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 60,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 24,
  },
  loader: {
    marginVertical: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.text,
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  arrowIcon: {
    marginLeft: 8,
  },
});