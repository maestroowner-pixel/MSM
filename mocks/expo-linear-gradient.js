const React = require('react');
const { View } = require('react-native');
// macOS / Windows mock for expo-linear-gradient (no native gradient view).
// Render a flat View using the gradient's FIRST color as a solid background. The
// `colors` prop carries the gradient fill; dropping it leaves the View transparent,
// which makes full-screen gradient backgrounds (e.g. the Consent overlay) see-through
// so the screen behind (the Dashboard) bleeds through. An explicit color keeps it opaque.
module.exports = {
  LinearGradient: ({ children, style, colors }) => {
    const bg = Array.isArray(colors) && colors.length ? colors[0] : undefined;
    return React.createElement(View, { style: [{ backgroundColor: bg }, style] }, children);
  },
};
