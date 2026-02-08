// SplashScreen: simple intro that shows the logo briefly, then moves into the app.
const React = require('react');
const { View, Text, StyleSheet, Animated, Image, useWindowDimensions, Easing } = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');
const BackgroundOrbs = require('../components/BackgroundOrbs');
const { colors, gradients, typography } = require('../theme');

function SplashScreen({ onDone }) {
  const logoY = React.useRef(new Animated.Value(60)).current;
  const logoScale = React.useRef(new Animated.Value(0.85)).current;
  const titleOpacity = React.useRef(new Animated.Value(0)).current;
  const titleY = React.useRef(new Animated.Value(0)).current;
  const sweepX = React.useRef(new Animated.Value(-240)).current;
  const logoX = React.useRef(new Animated.Value(0)).current;
  const titleX = React.useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const exitX = width + 240;

  React.useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoY, { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(sweepX, { toValue: 420, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(logoX, { toValue: exitX, duration: 620, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleX, { toValue: exitX, duration: 620, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(titleY, { toValue: -6, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(() => {
      setTimeout(onDone, 450);
    });
  }, [exitX, logoScale, logoX, logoY, onDone, titleOpacity, titleX, titleY, sweepX]);

  return (
    <LinearGradient colors={gradients.background} style={styles.container}>
      <BackgroundOrbs />
      <Animated.View style={[styles.sweep, { transform: [{ translateX: sweepX }, { rotate: '-6deg' }] }]} />
      <Animated.View
        style={[
          styles.sweepSoft,
          { transform: [{ translateX: Animated.add(sweepX, 60) }, { rotate: '-6deg' }] },
        ]}
      />
      <Animated.View
        style={[
          styles.sweepThin,
          { transform: [{ translateX: Animated.add(sweepX, 120) }, { rotate: '-6deg' }] },
        ]}
      />
      <Animated.Image
        source={require('../../assets/logo.png')}
        style={[styles.logo, { transform: [{ translateX: logoX }, { translateY: logoY }, { scale: logoScale }] }]}
      />
      <Animated.Text
        style={[
          styles.title,
          { opacity: titleOpacity, transform: [{ translateX: titleX }, { translateY: titleY }] },
        ]}
      >
        Link & Sync
      </Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 200,
    backgroundColor: 'rgba(255,255,255,0.18)',
    opacity: 0.65,
  },
  sweepSoft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 260,
    backgroundColor: 'rgba(255,255,255,0.12)',
    opacity: 0.5,
  },
  sweepThin: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.22)',
    opacity: 0.45,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontFamily: typography.heading,
    marginTop: 16,
  },
});

module.exports = SplashScreen;
