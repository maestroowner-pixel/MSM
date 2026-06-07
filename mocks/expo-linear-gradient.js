const React = require('react');
const { View } = require('react-native');
// Render as a plain View (flat background) on Windows.
module.exports = {
  LinearGradient: ({ children, style }) => React.createElement(View, { style }, children),
};
