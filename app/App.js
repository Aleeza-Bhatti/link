import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text } from 'react-native';
import { useMemo, useState, useEffect } from 'react';
import { useFonts, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from '@expo-google-fonts/manrope';
import * as Linking from 'expo-linking';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SyncScreen from './src/screens/SyncScreen';
import LinkScreen from './src/screens/LinkScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SplashScreen from './src/screens/SplashScreen';
import AuthScreen from './src/screens/AuthScreen';
import { supabase } from './src/lib/supabase';

const SCREENS = {
  Onboarding: OnboardingScreen,
  Sync: SyncScreen,
  Link: LinkScreen,
  Profile: ProfileScreen,
};

export default function App() {
  const [stack, setStack] = useState(['Sync']);
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [banner, setBanner] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);

  const current = stack[stack.length - 1];
  const Screen = useMemo(() => SCREENS[current], [current]);
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
  });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleUrl = ({ url }) => {
      const parsed = Linking.parse(url);
      if (parsed?.path?.includes('auth-callback')) {
        setBanner('Email verified. Please sign in.');
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.user) {
        setProfileReady(false);
        setCheckingProfile(false);
        return;
      }
      setCheckingProfile(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single();
      if (!error && data?.id) {
        setProfileReady(true);
      } else {
        setProfileReady(false);
      }
      setCheckingProfile(false);
    };

    loadProfile();
  }, [session]);

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

  if (!session) {
    return <AuthScreen banner={banner} onClearBanner={() => setBanner('')} />;
  }

  if (checkingProfile) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Preparing your profile…</Text>
      </View>
    );
  }

  if (!profileReady || editingProfile) {
    return (
      <OnboardingScreen
        current="Onboarding"
        onNavigate={handleNavigate}
        onBack={handleBack}
        user={session.user}
        onComplete={() => {
          setProfileReady(true);
          setEditingProfile(false);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Screen
        current={current}
        onNavigate={handleNavigate}
        onBack={handleBack}
        user={session.user}
        onEditProfile={() => setEditingProfile(true)}
      />
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
