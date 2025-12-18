import { defineConfig, PluginOption } from "vite";

const fake_plugin = (): PluginOption => {
  return {
    name: 'plugin',
    // configureServer(server) {
    //   server.ssrLoadModule('')
    //   server.environments.client
    // }
    config(config, env) {
    },
 }
}

export default defineConfig({
  base: './',
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  plugins: [fake_plugin()],
});