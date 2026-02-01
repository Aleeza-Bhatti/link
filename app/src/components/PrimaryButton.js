const React = require('react');
const { TouchableOpacity, Text, StyleSheet } = require('react-native');
const { colors, radii, spacing, typography } = require('../theme');

function PrimaryButton({ label, onPress, style }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.button, style]}>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accentFree,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  label: {
    color: '#1B1530',
    fontSize: 16,
    fontFamily: typography.bodySemi,
  },
});

module.exports = PrimaryButton;
