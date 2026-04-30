const {getDefaultConfig, mergeConfig} = require('metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const config = {};
module.exports = mergeConfig(defaultConfig, config);