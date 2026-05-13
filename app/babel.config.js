const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: path.join(__dirname, '.env'),
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  };
};
