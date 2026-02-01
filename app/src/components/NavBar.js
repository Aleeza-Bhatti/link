const React = require('react');
const { View, TouchableOpacity, Text, StyleSheet } = require('react-native');
const { colors, spacing, radii, typography } = require('../theme');

const tabs = ['Onboarding', 'Sync', 'Link', 'Profile'];

function NavBar({ current, onNavigate, onBack }) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const isActive = current === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onNavigate(tab)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
  },
  backText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontFamily: typography.bodyMedium,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(124,246,231,0.25)',
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: typography.bodyMedium,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
  },
});

module.exports = NavBar;
