const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude temp directories from file watching.
// These are created/deleted by tools (tailwindcss, expo install) and race
// with Metro's FallbackWatcher, causing ENOENT crashes.
config.resolver.blockList = [
  /node_modules[/\\]\.tailwindcss-.*/,
  /node_modules[/\\]\.[a-z]+-[A-Za-z0-9]{8}.*/,
];

module.exports = config;
