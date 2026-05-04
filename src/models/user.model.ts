import type { RouteLocationRaw } from "vue-router";
import { Notifications } from "@cznethub/cznet-vue-core";
import { Model } from "@vuex-orm/core";

export interface ICzCurrentUserState {
  orcid: string;
  orcidAccessToken: string;
}

export interface IUserState {
  isLoggedIn: boolean;
  next: string;
  hasUnsavedChanges: boolean;
  toc: { to: string, text: string, level?: number }[];
  isTocReady: boolean;
  credentials: { accessKey: string, secretKey: string },
  CSRFToken: string
}

/**
 * Enum for resource privilege codes
 */
export enum PrivilegeCodes {
  /** The user owns the object */
  OWNER = 1,

  /** The user can change the content of the object but not its state */
  CHANGE = 2,

  /** The user can view but not change the object */
  VIEW = 3,

  /** The user has no privilege over the object */
  NONE = 4,
}

export default class User extends Model {
  static entity = "users";

  private static readonly hydroshareHost = "http://localhost:8000";
  private static readonly apiBase = "";

  static fields() {
    return {};
  }

  static get $state(): IUserState {
    return this.store().state.entities[this.entity];
  }

  static state(): IUserState {
    return {
      isLoggedIn: false,
      next: "",
      hasUnsavedChanges: false,
      toc: [],
      isTocReady: false,
      credentials: { accessKey: "", secretKey: "" },
      CSRFToken: ""
    };
  }

  static openLogInDialog(redirectTo?: RouteLocationRaw) {
    // With Django cookie auth, we just redirect directly to login
    this.logIn();
  }

  static async logIn(callback?: () => any) {
    // Use Django cookie authentication with redirect
    // Try using the current window location as the next parameter
    const currentUrl = window.location.href;
    const loginUrl = `${this.hydroshareHost}/accounts/login/?next=${encodeURIComponent(currentUrl)}`;
    console.log("Redirecting to login:", loginUrl);
    window.location.href = loginUrl;
  }

  static async checkLoginStatus() {
    try {
      // Check if user is already authenticated via Django cookies
      const response = await fetch(`${this.apiBase}/hsapi/userInfo/`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        await User.commit((state) => {
          state.isLoggedIn = true;
          state.orcid = data.orcid || data.username || "";
          state.orcidAccessToken = "";
        });
        return true;
      }
    } catch (e) {
      // network error
    }

    User.commit((state) => {
      state.isLoggedIn = false;
      state.orcid = "";
      state.orcidAccessToken = "";
    });
    return false;
  }

  static async checkAuthorization() {
    try {
      const response = await fetch(`${this.apiBase}/hsapi/userInfo/`, {
        credentials: "include",
      });

      console.log("checkAuthorization response:", response.status);

      if (!response.ok) {
        console.log("Authorization failed - setting logged out");
        User.commit((state) => {
          state.isLoggedIn = false;
        });
      } else {
        console.log("Authorization successful - user is authenticated");
      }
    } catch (e: any) {
      console.log("checkAuthorization error:", e);
      User.commit((state) => {
        state.isLoggedIn = false;
      });
    }
  }

  static async getResourceS3prefix(res_id: string): Promise<{ bucket: string; prefix: string } | null> {
    try {
      const response = await fetch(`${this.apiBase}/hsapi/resource/s3/${res_id}/`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        console.log("getResourceS3prefix response:", data);
        return { bucket: data.bucket, prefix: data.prefix };
      }
    } catch (e: any) {
      console.log("getResourceS3prefix error:", e);
      const message = `Failed to get S3 prefix for resource ${res_id}: ${e.message}`;
      Notifications.toast({ message, type: "error" });
      throw new Error(message);
    }
    return null;
  }

  static async getCSRFToken(forceRefresh: boolean = false): Promise<string | null> {
    // Return cached token if available and not forcing refresh
    if (!forceRefresh && this.$state.CSRFToken) {
      return this.$state.CSRFToken;
    }

    try {
      // Use Django's @ensure_csrf_cookie endpoint to get/set the CSRF cookie
      await fetch(`${this.apiBase}/csrf-cookie/`, {
        credentials: "include",
      });

      // After calling the endpoint, the CSRF cookie should be set
      // Now read it from the cookies
      const token = this._readCSRFCookie();
      if (token) {
        await User.commit((state) => {
          state.CSRFToken = token
        })
        return token;
      }
    } catch (e) {
      console.log("CSRF endpoint error:", e);
    }

    // Fallback: try to get CSRF token from cookie (in case it was already set)
    const token = this._readCSRFCookie();
    if (token) {
      await User.commit((state) => {
        state.CSRFToken = token
      })
      return token;
    }

    console.warn("No CSRF token found");
    await User.commit((state) => {
      state.CSRFToken = ""
    })
    return User.$state.CSRFToken;
  }

  private static _readCSRFCookie(): string | null {
    for (const cookie of document.cookie.split(';')) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrftoken') return decodeURIComponent(value);
    }
    return null;
  }

  private static _buildHeaders(csrfToken: string | null): HeadersInit {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRFToken'] = csrfToken;
    return headers;
  }

  static async getOrCreateS3Credentials() {
    // Return cached credentials if available
    if (this.$state.credentials.accessKey && this.$state.credentials.secretKey) {
      return this.$state.credentials;
    }

    const doRequest = async (csrfToken: string | null) =>
      fetch(`${this.apiBase}/hsapi/user/service/accounts/s3/`, {
        method: "POST",
        credentials: "include",
        headers: this._buildHeaders(csrfToken),
        body: JSON.stringify({}),
      });

    try {
      let response = await doRequest(await this.getCSRFToken());

      if (response.status === 403) {
        const body = await response.json().catch(() => ({}));
        if (body?.detail?.includes('CSRF')) {
          console.log("CSRF token invalid, refreshing and retrying...");
          response = await doRequest(await this.getCSRFToken(true));
        }
      }

      if (response.ok) {
        const data = await response.json();
        await User.commit((state) => {
          state.credentials = { accessKey: data.access_key, secretKey: data.secret_key };
        });
      }
    } catch (e: any) {
      console.log("getOrCreateS3Credentials error:", e);
      throw new Error(`Failed to create S3 credentials: ${e.message}`);
    }
    return this.$state.credentials;;
  }

  static async manageResourceAccess(resource_id: string, user_id: number, privilege: number | PrivilegeCodes) {
    // Validate privilege values using enum values
    const validPrivileges = Object.values(PrivilegeCodes);
    if (!validPrivileges.includes(privilege as PrivilegeCodes)) {
      throw new Error(
        `Invalid privilege value: ${privilege}. Allowed values are: ` +
        `${PrivilegeCodes.OWNER} (OWNER), ${PrivilegeCodes.CHANGE} (CHANGE), ` +
        `${PrivilegeCodes.VIEW} (VIEW), ${PrivilegeCodes.NONE} (NONE).`
      );
    }

    const endpoint = `${this.apiBase}/hsapi/resource/${resource_id}/access/`;

    const doRequest = async (csrfToken: string | null) => {
      const headers = this._buildHeaders(csrfToken);
      if (privilege === PrivilegeCodes.NONE) {
        return fetch(`${endpoint}?user_id=${user_id}`, { method: "DELETE", credentials: "include", headers });
      } else {
        return fetch(endpoint, {
          method: "PUT",
          credentials: "include",
          headers,
          body: JSON.stringify({ privilege, user_id }),
        });
      }
    };

    try {
      let csrfToken = await this.getCSRFToken();
      let response = await doRequest(csrfToken);

      if (response.status === 403) {
        const body = await response.json().catch(() => ({}));
        if (body?.detail?.includes('CSRF')) {
          console.log("CSRF token invalid, refreshing and retrying...");
          response = await doRequest(await this.getCSRFToken(true));
        }
      }

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log("manageResourceAccess response:", response.status, data);
        return {
          success: true,
          action: privilege === PrivilegeCodes.NONE ? 'removed' : 'updated',
          resource_id,
          user_id,
          privilege: privilege === PrivilegeCodes.NONE ? null : privilege,
          data,
        };
      }
    } catch (e: any) {
      console.log("manageResourceAccess error:", e);
      throw new Error(`Failed to manage resource access: ${e.message}`);
    }

    return { success: false, message: 'Unexpected response from server' };
  }

  static async logOut() {
    try {
      await fetch(`${this.apiBase}/accounts/logout/`, {
        credentials: "include",
      });
    } catch (e) {
      // We don't care about the response status. We at least log the user out in the frontend.
    }
    this._logOut();
  }

  private static async _logOut() {
    await User.commit((state) => {
      state.isLoggedIn = false;
      state.orcidAccessToken = "";
      state.CSRFToken = ""
    });

    Notifications.toast({
      message: "You have logged out!",
      type: "info",
    });

    // if (useRouter().currentRoute.meta?.hasLoggedInGuard)
    //   useRouter().push({ path: '/' })
  }
}
