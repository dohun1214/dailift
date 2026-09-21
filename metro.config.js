const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// drizzle 마이그레이션(.sql)을 번들에 포함한다.
config.resolver.sourceExts.push('sql');

module.exports = config;
