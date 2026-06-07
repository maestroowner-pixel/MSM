const React = require('react');
const { View } = require('react-native');
const Svg = ({ children, width, height, style }) =>
  React.createElement(View, { style: [{ width, height }, style] }, children);
const mock = () => null;
module.exports = {
  default: Svg, __esModule: true, Svg,
  Path: mock, Rect: mock, Circle: mock, Line: mock, Polyline: mock, Polygon: mock,
  G: mock, Text: mock, TSpan: mock, TextPath: mock, Image: mock, ClipPath: mock,
  Defs: mock, LinearGradient: mock, RadialGradient: mock, Stop: mock, Symbol: mock,
  Use: mock, Ellipse: mock, Mask: mock, Pattern: mock, Marker: mock,
};
