import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text } from 'react-native';
import { useMemo, useState } from 'react';
import { useFonts, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from '@expo-google-fonts/manrope';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SyncScreen from './src/screens/SyncScreen';
import LinkScreen from './src/screens/LinkScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SplashScreen from './src/screens/SplashScreen';

const SCREENS = {
  Onboarding: OnboardingScreen,
  Sync: SyncScreen,
  Link: LinkScreen,
  Profile: ProfileScreen,
};

export default function App() {
  const [stack, setStack] = useState(['Onboarding']);
  const [showSplash, setShowSplash] = useState(true);
  const current = stack[stack.length - 1];
  const Screen = useMemo(() => SCREENS[current], [current]);
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
  });

  const handleNavigate = (next) => {
    setStack((prev) => (prev[prev.length - 1] === next ? prev : [...prev, next]));
  };

  const handleBack = () => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Screen current={current} onNavigate={handleNavigate} onBack={handleBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E1A47',
  },
  loadingText: {
    color: '#F6F0FF',
    fontSize: 16,
  },
});
