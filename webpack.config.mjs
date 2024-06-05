/** @type {import('webpack').Configuration} */
export default {
  mode: "development",
  devtool: "inline-source-map",
  entry: {
    main: "./src/index.ts",
  },
  experiments: {
    outputModule: true,
  },
  output: {
    module: true,
    filename: "xcm-programs.js",
    library: {
      type: "module",
    },
    libraryTarget: "module",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
      },
    ],
  },
};
