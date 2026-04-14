/**
 * auth.js — Azure AD SSO management on the front end
 * Calls /auth/me to check the server session (cookie)
 */

const Auth = {

  _user: null,

  /**
   * Verifies the SSO session with the backend.
   * If not logged in → redirects to /auth/login
   */
  async init(options = { redirect: true }) {
    try {
      const res = await fetch("/auth/me", { credentials: "include" });

      if (res.status === 401 || res.status === 403) {
        if (options.redirect) {
          // Remember the current page for post-login redirection
          sessionStorage.setItem("next_url", window.location.pathname);
          window.location.href = "/auth/login";
        }
        return null;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      this._user = await res.json();
      this._renderUserBadge();
      return this._user;

    } catch (err) {
      console.warn("[Auth] Error verifying session:", err);
      return null;
    }
  },

  /** Returns the current user (null if not logged in) */
  getUser() {
    return this._user;
  },

  /** Logout */
  logout() {
    window.location.href = "/auth/logout";
  },

  /** Injects a user badge into #auth-badge if present */
  _renderUserBadge() {
    const el = document.getElementById("auth-badge");
    if (!el || !this._user) return;

    el.innerHTML = `
      <span class="auth-user-name">👤 ${this._escHtml(this._user.name)}</span>
      <span class="auth-user-email">${this._escHtml(this._user.email)}</span>
      <button class="auth-logout-btn" onclick="Auth.logout()">Déconnexion</button>
    `;
    el.style.display = "flex";
  },

  _escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
};


window.Auth = Auth;
export default Auth;