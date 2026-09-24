import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["tests/**/*.test.{ts,tsx}"],
      setupFiles: ["tests/setup.ts"],
      // A cross-origin API base on purpose — production serves api. and
      // app. from different subdomains, and axios only attaches the
      // X-XSRF-TOKEN header cross-origin when withXSRFToken is set, so
      // the tests exercise that exact path rather than a same-origin one.
      env: { VITE_API_BASE_URL: "http://api.test/api/v1" },
      restoreMocks: true,
    },
  }),
);
