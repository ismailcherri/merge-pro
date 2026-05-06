const path = require('path');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

/** @type {import('webpack').Configuration[]} */
module.exports = [
  // Panel bundle (no Monaco)
  {
    name: 'panel',
    entry: './webview/panel/index.tsx',
    output: {
      path: path.resolve(__dirname, 'out', 'webview'),
      filename: 'panel.js',
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.webview.json' } }],
          exclude: /node_modules/,
        },
      ],
    },
  },
  // Editor bundle (with Monaco)
  {
    name: 'editor',
    entry: './webview/editor/index.tsx',
    output: {
      path: path.resolve(__dirname, 'out', 'webview'),
      filename: 'editor.js',
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.webview.json' } }],
          exclude: /node_modules/,
        },
        { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        { test: /\.ttf$/, use: ['file-loader'] },
      ],
    },
    plugins: [new MonacoWebpackPlugin({ languages: [] })],
  },
];
