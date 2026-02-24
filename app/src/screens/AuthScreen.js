/*
 Renders authentication UI and handles Google sign-in via Supabase OAuth.
*/

const React = require('react');
const { View, Text, StyleSheet, TouchableOpacity, Image, Platform } = require('react-native');
const WebBrowser = require('expo-web-browser');
const { Ionicons } = require('@expo/vector-icons');
const { LinearGradient } = require('expo-linear-gradient');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const { colors, gradients, spacing, radii, typography } = require('../theme');
const { supabase } = require('../lib/supabase');

WebBrowser.maybeCompleteAuthSession();

function isUwEmail(value) {
  return /^[^@]+@uw\.edu$/i.test((value || '').trim());
}

function AuthScreen({ banner, onClearBanner }) {
  const [status, setStatus] = React.useState('');
  const [signingIn, setSigningIn] = React.useState(false);

  const getTokenFromUrl = (url, key) => {
    try {
      const hash = url.includes('#') ? url.split('#')[1] : '';
      const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const hashParams = new URLSearchParams(hash);
      const queryParams = new URLSearchParams(query);
      return hashParams.get(key) || queryParams.get(key);
    } catch (_err) {
      return null;
    }
  };

  const handleGoogleSignIn = async () => {
    setStatus('');
    setSigningIn(true);
    try {
      const redirectTo = 'linksync://auth/callback';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { hd: 'uw.edu', prompt: 'select_account' },
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Google sign-in URL was not generated.');
      if (!/^https:\/\/.+/i.test(data.url)) {
        throw new Error('OAuth URL is invalid. Check Supabase URL/key in EAS env.');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        setStatus('Google sign-in was canceled.');
        return;
      }

      const access_token = getTokenFromUrl(result.url, 'access_token');
      const refresh_token = getTokenFromUrl(result.url, 'refresh_token');
      const code = getTokenFromUrl(result.url, 'code');

      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessionError) throw sessionError;
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else {
        throw new Error('Could not complete Google sign-in.');
      }

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || '';
      if (!isUwEmail(userEmail)) {
        await supabase.auth.signOut();
        setStatus('Use your @uw.edu Google account.');
      }
    } catch (err) {
      setStatus(err?.message || 'Google sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    setStatus('');
    setSigningIn(true);
    try {
      const redirectTo = 'linksync://auth/callback';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Apple sign-in URL was not generated.');
      if (!/^https:\/\/.+/i.test(data.url)) {
        throw new Error('OAuth URL is invalid. Check Supabase URL/key in EAS env.');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        setStatus('Apple sign-in was canceled.');
        return;
      }

      const access_token = getTokenFromUrl(result.url, 'access_token');
      const refresh_token = getTokenFromUrl(result.url, 'refresh_token');
      const code = getTokenFromUrl(result.url, 'code');

      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessionError) throw sessionError;
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else {
        throw new Error('Could not complete Apple sign-in.');
      }
    } catch (err) {
      setStatus(err?.message || 'Apple sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <View style={styles.card}>
        {banner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{banner}</Text>
            <TouchableOpacity onPress={onClearBanner}>
              <Text style={styles.bannerAction}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Continue with Google or Apple.</Text>
        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={signingIn}>
          <Image
            source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
            style={styles.googleLogo}
            resizeMode="contain"
          />
          <Text style={styles.googleButtonText}>{signingIn ? 'Opening Google...' : 'Sign in with Google'}</Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' ? (
          <TouchableOpacity style={styles.appleButton} onPress={handleAppleSignIn} disabled={signingIn}>
            <Ionicons name="logo-apple" size={18} color="#FFFFFF" style={styles.appleLogo} />
            <Text style={styles.appleButtonText}>{signingIn ? 'Opening Apple...' : 'Sign in with Apple'}</Text>
          </TouchableOpacity>
        ) : null}

        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  banner: {
    backgroundColor: 'rgba(124,246,231,0.18)',
    borderColor: colors.accentFree,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: {
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  bannerAction: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
    marginTop: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontFamily: typography.heading,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    fontFamily: typography.body,
  },
  googleButton: {
    marginTop: spacing.md,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#202124',
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogo: {
    width: 18,
    height: 18,
    marginRight: spacing.sm,
  },
  googleButtonText: {
    color: '#1F1F1F',
    fontFamily: typography.bodySemi,
    fontSize: 24 * 0.66,
  },
  appleButton: {
    marginTop: spacing.sm,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2B2B2B',
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleLogo: {
    marginLeft: -4,
    marginRight: spacing.sm,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontFamily: typography.bodySemi,
    fontSize: 24 * 0.66,
  },
  status: {
    color: colors.textPrimary,
    marginTop: spacing.sm,
    fontFamily: typography.body,
  },
});

module.exports = AuthScreen;
