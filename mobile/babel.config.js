module.exports = (api) => {
  api.cache(true);
  // babel-preset-expo alone. In SDK 57 it handles worklets and reanimated
  // itself, and `expo-router/babel` has been deprecated since SDK 50 — adding
  // either by hand is how you get a duplicate-plugin build failure.
  return { presets: ["babel-preset-expo"] };
};
