const React = require('react');
const { View, StyleSheet } = require('react-native');
const { colors, radii, spacing } = require('../theme');

function GlassCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    shadowColor: '#110B23',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
  },
});

module.exports = GlassCard;
