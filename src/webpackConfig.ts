import * as webpack from "webpack";
import * as merge from "webpack-merge";
import * as path from "path";
import DllLinkPlugin = require("dll-link-webpack-plugin");
import { HTMLPlugin } from "./HTMLPlugin";
import { getLocalIP, MODULE_PATH } from "./utils";
import { Config } from "./config";
import { ServiceWorkerPlugin } from "./ServiceWorkerPlugin";

function genDllConfig(options: Config, isProd: boolean): any {
  const env = isProd ? "production" : "development";
  const filename = isProd ? "js/[name].[chunkhash:8].dll.js" : "[name].dll.js";

  const library = "[name]_lib";

  return {
    entry: options.dllEntry,
    output: {
      filename,
      path: options.outputPath,
      library
    },
    mode: env,
    module: {
      rules: [
        {
          test: /\.css/,
          use: ["style-loader", "css-loader"]
        }
      ]
    },
    plugins: [
      new webpack.DllPlugin({
        path: "[name]-manifest.json",
        name: library,
        context: options.outputPath
      }),
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(env)
      })
    ]
  };
}

export function genConfig(config: Config, isProd: boolean) {
  const entryList: string[] = Object.keys(config.entry).map(
    k => config.entry[k]
  );
  const babelPresets = [
    "@babel/preset-env",
    "@babel/preset-react",
    "@babel/preset-typescript"
  ];
  const webpackConfig: webpack.Configuration = {
    entry: config.entry,
    output: {
      path: config.outputPath
    },
    resolve: {
      extensions: [".webpack.js", ".js", ".jsx", ".tsx", ".ts"],
      modules: [config.rootPath, "node_modules", MODULE_PATH]
    },
    resolveLoader: {
      modules: ["node_modules", MODULE_PATH]
    },
    mode: isProd ? "production" : "development",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: [/(node_modules|bower_components)/, ...entryList],
          use: [
            {
              loader: "babel-loader",
              options: {
                presets: babelPresets
              }
            }
          ]
        },
        {
          test: /\.tsx$/,
          include: entryList,
          use: [
            {
              loader: "babel-loader",
              options: {
                presets: babelPresets
              }
            },
            {
              loader: path.resolve(__dirname, "./ReactHydrate"),
              options: {
                isProd
              }
            }
          ]
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"]
        }
      ]
    }
  };

  const plugins: any[] = [];
  if (config.dllEntry) {
    plugins.push(
      new DllLinkPlugin({
        config: genDllConfig(config, isProd),
        appendVersion: isProd,
        assetsMode: true
      })
    );
  }
  plugins.push(
    new HTMLPlugin({
      entry: config.entry,
      dllEntry: config.dllEntry,
      isProd,
      exportPathMap: config.exportPathMap,
      template: config.htmlTemplate
    })
  );
  webpackConfig.plugins = plugins;

  return webpackConfig;
}

export function genDevConfig(config: Config) {
  const baseConfig = genConfig(config, false);
  return merge(baseConfig, {
    output: {
      publicPath: `http://${getLocalIP()}:${config.devPort}/`,
      filename: "[name].js",
      chunkFilename: "[name].chunk.js"
    },
    devtool: "cheap-module-eval-source-map",
    plugins: [
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify("development")
      }),
      new webpack.NamedModulesPlugin(),
      new webpack.HotModuleReplacementPlugin()
    ]
  });
}

export function genProdConfig(config: Config) {
  const baseConfig = genConfig(config, true);
  const plugins = [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("production")
    }),
    new ServiceWorkerPlugin()
  ];
  const prodConfig: webpack.Configuration = {
    output: {
      filename: `js/[name].[chunkhash:8].js`,
      chunkFilename: `js/[name].[chunkhash:8].chunk.js`
    },
    devtool: false,
    plugins
  };

  return merge(baseConfig, prodConfig);
}
