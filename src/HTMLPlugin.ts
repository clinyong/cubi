import * as webpack from "webpack";
import { ServerStyleSheet } from "styled-components";
import * as fse from "fs-extra";
import * as path from "path";
import * as React from "react";
import * as ReactDOMServer from "react-dom/server";
import * as ejs from "ejs";
import { DEFAULT_EXTENSIONS } from "@babel/core";
import * as babelRegister from "@babel/register";
import { Route } from "./config";
import { findEntryPath } from "./utils";

babelRegister({
  plugins: [
    "@babel/plugin-transform-modules-commonjs",
    path.resolve(__dirname, "./RemoveCSSPlugin")
  ],
  presets: ["@babel/preset-react", "@babel/preset-typescript"],
  extensions: [...DEFAULT_EXTENSIONS, ".tsx"]
});

export interface HTMLExternalOptions {
  /**
   * 指定输出的 html 模板，ejs 语法
   */
  template?: string;
  /**
   * 页面的 title
   */
  title?: string;
  /**
   * map entry 对应 单个输出的 html 模板
   */
  entryTemplates?: { [key: string]: string };
}

export interface HTMLOptions extends HTMLExternalOptions {
  dllEntry: webpack.Entry;
  entry: webpack.Entry;
  isProd: boolean;
  exportPathMap: () => Promise<{ [index: string]: Route }>;
}

function getAssetName(rawName: string): string {
  let name = rawName;
  if (name.includes("/")) {
    let list = name.split("/");
    name = list[list.length - 1];
  }

  return name.split(".")[0];
}

export class HTMLPlugin {
  options: HTMLOptions;

  constructor(options: HTMLOptions) {
    this.options = Object.assign<Partial<HTMLOptions>, HTMLOptions>(
      {
        template: path.resolve(__dirname, "../config/index.html"),
        title: ""
      },
      options
    );
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.emit.tapAsync("HTMLPlugin", async (compilation, cb) => {
      const { entry, exportPathMap, isProd } = this.options;
      const { assets, chunks } = compilation.getStats().toJson();

      const allAssets = chunks
        .filter(chunk => chunk.initial)
        .map(chunk => chunk.files[0]) as string[];
      const entryAssetMap = {};
      let shareAssets: string[] = [];
      allAssets.forEach(asset => {
        const name = getAssetName(asset);
        if (entry[name]) {
          entryAssetMap[name] = asset;
        } else {
          shareAssets.push(asset);
        }
      });

      const manifestIndex = shareAssets.findIndex(item =>
        item.includes("manifest")
      );
      let manifestContent = "";
      if (manifestIndex !== -1) {
        const manifestItem = shareAssets.splice(manifestIndex, 1)[0];
        manifestContent = compilation.assets[manifestItem].source();
        delete compilation.assets[manifestItem];
      }

      // get dll entry
      const dllAssets: string[] = assets
        .filter(
          item => item.name.endsWith(".dll.js") || item.name.includes("__")
        )
        .map(asset => asset.name);

      const shareScripts = shareAssets.concat(
        dllAssets.filter(name => !name.includes("__"))
      );

      const templateContent = await fse.readFile(
        path.resolve(__dirname, "../config/template.html"),
        "utf8"
      );

      const routesMap = await exportPathMap();

      Object.keys(routesMap).forEach(k => {
        const routeItem = routesMap[k];
        const entryItem = entry[routeItem.page] as string;
        if (entryItem) {
          const entryPath = findEntryPath(entryItem);
          const props = routeItem.query;

          if (entryPath) {
            let initContent = "";
            let initStyles = "";
            let initProps = props ? JSON.stringify(props) : "{}";
            let entryList = [routeItem.page + ".js"];
            if (isProd) {
              const sheet = new ServerStyleSheet();
              const Component = require(entryPath).default;
              const ins = React.createElement(Component, props);
              initContent = ReactDOMServer.renderToString(
                sheet.collectStyles(ins)
              );
              initStyles = sheet.getStyleTags();
              entryList = [].concat(entryAssetMap[routeItem.page]);
            }

            const pageDLL = dllAssets.filter(name =>
              name.includes(`__${routeItem.page}`)
            );

            const cssFiles: string[] = [];
            if (pageDLL.length > 0) {
              const jsDLL = pageDLL.find(name => name.endsWith(".js"));
              if (jsDLL) {
                entryList.unshift(jsDLL);
              }

              const cssDLL = pageDLL.find(name => name.endsWith(".css"));
              if (cssDLL) {
                cssFiles.push(cssDLL);
              }
            }

            const content = ejs.render(templateContent, {
              title: this.options.title,
              scripts: shareScripts.concat(entryList),
              cssFiles,
              manifestContent,
              initContent,
              initProps,
              initStyles
            });
            compilation.assets[`${k}.html`] = {
              source: () => content,
              size: () => content.length
            };
          }
        }
      });

      return cb();
    });
  }
}
