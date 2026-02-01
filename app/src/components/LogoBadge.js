const React = require('react');
const { Image, StyleSheet } = require('react-native');

function LogoBadge({ style }) {
  return <Image source={require('../../assets/logo.png')} style={[styles.logo, style]} />;
}

const styles = StyleSheet.create({
  logo: {
    width: 50,
    height: 50,
    position: 'absolute',
    top: 65,
    right: 20,
    borderRadius: 21,
  },
});

module.exports = LogoBadge;
