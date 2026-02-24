const React = require('react');
const { View, Pressable, Text, StyleSheet } = require('react-native');
const { colors, spacing, radii, typography } = require('../theme');

const tabs = ['Sync', 'Link', 'Profile'];

function NavBar({ current, onNavigate, onBack }) {
  return (
    <View style={styles.wrap}>
      <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <View style={styles.tabs}>
        {tabs.map((tab) => {
          const isActive = current === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => onNavigate(tab)}
              style={({ pressed }) => [
                styles.tab,
                tab !== 'Profile' && styles.tabDivider,
                isActive && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
            </Pressable>
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
    backgroundColor: '#000000',
    borderColor: colors.accentFree,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    marginRight: spacing.sm,
  },
  backPressed: {
    backgroundColor: '#4A235F',
  },
  backText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: typography.bodySemi,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderColor: colors.accentFree,
    borderWidth: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
  },
  tabDivider: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.2)',
  },
  tabActive: {
    backgroundColor: '#0E8E78',
  },
  tabPressed: {
    backgroundColor: '#4A235F',
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: typography.bodyMedium,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemi,
  },
});

module.exports = NavBar;
