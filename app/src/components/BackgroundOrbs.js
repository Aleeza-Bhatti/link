const React = require('react');
const { View, StyleSheet, Animated } = require('react-native');
const { LinearGradient } = require('expo-linear-gradient');

function BackgroundOrbs() {
  const floatA = React.useRef(new Animated.Value(0)).current;
  const floatB = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animA = Animated.loop(
      Animated.sequence([
        Animated.timing(floatA, { toValue: 1, duration: 6000, useNativeDriver: true }),
        Animated.timing(floatA, { toValue: 0, duration: 6000, useNativeDriver: true }),
      ])
    );
    const animB = Animated.loop(
      Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 7000, useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 7000, useNativeDriver: true }),
      ])
    );

    animA.start();
    animB.start();

    return () => {
      animA.stop();
      animB.stop();
    };
  }, [floatA, floatB]);

  const orbATransform = {
    transform: [
      {
        translateX: floatA.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 16],
        }),
      },
      {
        translateY: floatA.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -18],
        }),
      },
    ],
  };

  const orbBTransform = {
    transform: [
      {
        translateX: floatB.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -18],
        }),
      },
      {
        translateY: floatB.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 16],
        }),
      },
    ],
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.orb, styles.orbTop, orbATransform]}>
        <LinearGradient
          colors={['rgba(124,246,231,0.35)', 'rgba(124,246,231,0.0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.orb, styles.orbBottom, orbBTransform]}>
        <LinearGradient
          colors={['rgba(255,183,227,0.35)', 'rgba(255,183,227,0.0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    overflow: 'hidden',
  },
  orbTop: {
    top: -120,
    right: -80,
  },
  orbBottom: {
    bottom: -140,
    left: -100,
  },
});

module.exports = BackgroundOrbs;
