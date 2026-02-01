const React = require('react');
const { View, Text, StyleSheet, Switch, TextInput } = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const GlassCard = require('../components/GlassCard');
const PrimaryButton = require('../components/PrimaryButton');
const NavBar = require('../components/NavBar');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const LogoBadge = require('../components/LogoBadge');
const { colors, gradients, spacing, radii, typography } = require('../theme');

function OnboardingScreen({ current, onNavigate, onBack }) {
  const [discoverable, setDiscoverable] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [icsLink, setIcsLink] = React.useState('');

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <LogoBadge />
      <View style={styles.header}>
        <Text style={styles.kicker}>UW schedule sync</Text>
        <Text style={styles.title}>link & sync</Text>
        <Text style={styles.subtitle}>Make plans without the schedule chaos.</Text>
      </View>

      <GlassCard style={styles.card}>
        <Text style={styles.cardTitle}>Get started</Text>
        <View style={styles.field}>
          <Text style={styles.label}>UW email</Text>
          <TextInput
            style={styles.input}
            placeholder="yourname@uw.edu"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>MyPlan ICS link</Text>
          <TextInput
            style={styles.input}
            placeholder="Paste your ICS link"
            placeholderTextColor={colors.textSecondary}
            value={icsLink}
            onChangeText={setIcsLink}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Discoverable on campus</Text>
            <Text style={styles.helper}>Off by default for privacy.</Text>
          </View>
          <Switch
            value={discoverable}
            onValueChange={setDiscoverable}
            thumbColor={discoverable ? colors.accentFree : colors.textSecondary}
            trackColor={{ false: 'rgba(255,255,255,0.2)', true: 'rgba(124,246,231,0.35)' }}
          />
        </View>

        <PrimaryButton label="Connect MyPlan (ICS)" onPress={() => {}} style={styles.cta} />
        <Text style={styles.micro}>You can edit classes later.</Text>
      </GlassCard>

      <NavBar current={current} onNavigate={onNavigate} onBack={onBack} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  kicker: {
    color: colors.accentFree,
    fontSize: 12,
    fontFamily: typography.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 40,
    fontFamily: typography.display,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontSize: 16,
    fontFamily: typography.body,
  },
  card: {
    borderRadius: radii.lg,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontFamily: typography.heading,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: typography.bodyMedium,
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rowText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
  },
  cta: {
    marginTop: spacing.sm,
  },
  micro: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: typography.body,
    marginTop: spacing.sm,
  },
});

module.exports = OnboardingScreen;
