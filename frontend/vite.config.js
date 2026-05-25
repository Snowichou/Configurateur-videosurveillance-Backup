import { defineConfig } from "vite";
import pdfProxy from './vite-plugin-pdf-proxy.js'

/**
 * Petit plugin maison : permet d'accéder à la page admin via /admin
 * (au lieu de /admin.html) en dev local. En prod le backend FastAPI
 * a déjà la route GET /admin → admin.html.
 */
function adminRouteAlias() {
  return {
    name: 'comelit-admin-alias',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        // /admin, /admin/, /admin?foo=bar  → /admin.html (en preservant la querystring)
        const m = req.url.match(/^\/admin(\/?)($|\?.*$)/);
        if (m) {
          req.url = '/admin.html' + (m[2] || '');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [pdfProxy(), adminRouteAlias()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/data": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
