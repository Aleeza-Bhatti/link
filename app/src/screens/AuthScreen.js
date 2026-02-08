/*
 Renders the authentication UI and handles sign‑in/sign‑up via Supabase.
*/

const React = require('react');
const { View, Text, StyleSheet, TextInput, TouchableOpacity } = require('react-native');
const Linking = require('expo-linking');
const { LinearGradient } = require('expo-linear-gradient');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const { colors, gradients, spacing, radii, typography } = require('../theme');
const { supabase } = require('../lib/supabase');

// Validates inputs, calls Supabase auth, and displays success/error state.
function AuthScreen({ banner, onClearBanner }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [mode, setMode] = React.useState('signin');
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleAuth = async () => {
    setStatus('');
    if (!email || !password) {
      setStatus('Email and password are required.');
      return;
    }

    // DEV: allow any email for testing multi-user flows.
    // Re-enable UW-only check before launch.

    setLoading(true);
    try {
      if (mode === 'signup') {
        const redirectUrl = Linking.createURL('auth-callback');
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) throw error;
        setStatus('Check your email to verify your account.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setStatus(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
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
        <Text style={styles.title}>{mode === 'signup' ? 'Create account' : 'Welcome back'}</Text>
        <Text style={styles.subtitle}>Use your UW email to continue.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="netid@uw.edu"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="********"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={[styles.primary, mode === 'signup' && styles.primarySignup]} onPress={handleAuth} disabled={loading}>
          <Text style={styles.primaryText}>{loading ? 'Please wait...' : mode === 'signup' ? 'Sign up' : 'Sign in'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
        >
          <Text style={styles.secondaryText}>
            {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Text>
        </TouchableOpacity>

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
  label: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: {
    height: 46,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  primary: {
    marginTop: spacing.md,
    backgroundColor: colors.accentFree,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  primaryText: {
    color: '#1B1530',
    fontFamily: typography.bodySemi,
    fontSize: 16,
  },
  secondary: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.textSecondary,
    fontFamily: typography.body,
    fontSize: 12,
  },
  status: {
    color: colors.textPrimary,
    marginTop: spacing.sm,
    fontFamily: typography.body,
  },
});

module.exports = AuthScreen;

