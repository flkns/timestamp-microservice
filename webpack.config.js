const path = require("path");
const webpack = require("webpack");
const zlib = require("zlib");

const nodeExternals = require("webpack-node-externals");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const MarkoPlugin = require("@marko/webpack/plugin").default;
const SpawnServerPlugin = require("spawn-server-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin");
// const TerserPlugin = require("terser-webpack-plugin");

const { NODE_ENV } = process.env;
const isProd = NODE_ENV === "production";
const isDev = !isProd;

const markoPlugin = new MarkoPlugin();
const spawnedServer =
  isDev &&
  new SpawnServerPlugin({
    args: [
      "--enable-source-maps",
      // Allow debugging spawned server with the INSPECT=1 env var.
      process.env.INSPECT && "--inspect",
    ].filter(Boolean),
  });

const filenameTemplate = `${isProd ? "" : `[name].`}[contenthash:8]`;

const compiler = (config) => {
  return {
    ...config,
    mode: isProd ? "production" : "development",
    stats: 'verbose', // isDev && "minimal",
    cache: {
      type: "filesystem",
    },
    output: {
      publicPath: "/assets/",
      assetModuleFilename: `${filenameTemplate}[ext][query]`,
      ...config.output,
    },
    resolve: {
      extensions: [".js", ".json"],
    },
    module: {
      rules: [
        ...config.module.rules,
        {
          test: /\.marko$/,
          loader: "@marko/webpack/loader",
          options: {
            babelConfig: {
              "presets": [["@babel/preset-env", { "targets": { node: 'current' } }]]
            }
          }
        },
        {
          test: /\.(less|css)$/i,
          use: [
            { loader: MiniCssExtractPlugin.loader },
            { loader: "css-loader", options: { sourceMap: true, importLoaders: 2 } },
            { loader: "postcss-loader", options: { sourceMap: true } },
            { loader: "less-loader", options: { sourceMap: true } }
          ],
          // mimetype: "text/css",
          // type: "asset/resource"
        },
        {
          test: /\.(jpg|jpeg|gif|png|eot|svg|ttf|woff|woff2)$/,
          loader: "file-loader",
          options: {
            // File assets from server & browser compiler output to client folder.
            outputPath: "../browser"
          },
          generator: {emit: false},
          type: 'asset/resource'
        }
      ],
    },
    plugins: [
      ...config.plugins,
      new MiniCssExtractPlugin({
        filename: `${filenameTemplate}.css`,
        linkType: 'text/css',
        ignoreOrder: true,
      })
    ].filter(Boolean),
  }
}

module.exports = [
  compiler({
    name: "browser",
    target: "web",
    devtool: isProd
      ? "cheap-module-source-map"
      : "eval-cheap-module-source-map",
    output: {
      filename: `${filenameTemplate}.js`,
      path: path.join(__dirname, "dist/assets"),
    },
    optimization: {
      runtimeChunk: "single",
      splitChunks: {
        chunks: "all",
        maxInitialRequests: 3,
      },
      minimize: isProd,
      minimizer: [new MiniCssExtractPlugin()]
    },
    devServer: isProd
      ? undefined
      : {
        hot: false,
        static: false,
        host: "0.0.0.0",
        allowedHosts: "all",
        port: parseInt(process.env.PORT || 3000, 10),
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        ...spawnedServer.devServerConfig,
      },
    module: {
      rules: [

        {
          test: /\.(jpg|jpeg|gif|png|svg)$/,
          type: "asset",
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        "typeof window": "'object'",
        "process.browser": true,
      }),
      // new webpack.BannerPlugin({
      //   banner: 'require("source-map-support").install();',
      //   raw: true
      // }),
      isProd && new CompressionPlugin({
        filename: `${filenameTemplate}.br`,
        algorithm: "brotliCompress",
        test: /\.(js|css|less|html|svg)$/,
        compressionOptions: {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
          },
        },
        threshold: 10240,
        minRatio: 0.8,
        deleteOriginalAssets: false,
      }),
      markoPlugin.browser,
    ],
  }),
  compiler({
    name: "server",
    target: "async-node",
    devtool: "inline-nosources-cheap-module-source-map",
    externals: [
      // Exclude node_modules, but ensure non js files are bundled.
      // Eg: `.marko`, `.css`, etc.
      nodeExternals({
        allowlist: [/\.(?!(?:js|json)$)[^.]+$/],
      }),
    ],
    optimization: {
      minimize: false
    },
    output: {
      libraryTarget: "commonjs2",
      path: path.join(__dirname, "dist"),
      devtoolModuleFilenameTemplate: "[absolute-resource-path]",
    },
    module: {
      rules: [
        {
          test: /\.(jpg|jpeg|gif|png|svg)$/,
          generator: { emit: false },
          type: "asset/resource",
        },
      ],
    },
    plugins: [
      new webpack.IgnorePlugin({
        resourceRegExp: /\.(css|less)$/,
      }),
      new webpack.DefinePlugin({
        "typeof window": "'undefined'",
        "process.browser": undefined,
        "process.env.BUNDLE": true,
      }),
      spawnedServer,
      markoPlugin.server,
    ]
  }),
];