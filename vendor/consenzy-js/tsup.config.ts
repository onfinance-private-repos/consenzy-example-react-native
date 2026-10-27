import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", server: "src/server.ts", widget: "src/widget/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  // Shared chunks so ConsentApiError etc. are one class across ".", "./server" and "./widget"
  // (instanceof works no matter which entry threw).
  splitting: true,
  treeshake: true,
  banner: { js: "/* @onfinance/consenzy. Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0 */" },
});
