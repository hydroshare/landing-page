import type { RouteLocationRaw } from "vue-router";
import { Notifications } from "@cznethub/cznet-vue-core";
import { Model } from "@vuex-orm/core";
import axios from "axios";

export interface ICzCurrentUserState {
  orcid: string;
  orcidAccessToken: string;
}

export interface IUserState {
  isLoggedIn: boolean;
  orcid: string;
  orcidAccessToken: string;
  next: string;
  hasUnsavedChanges: boolean;
  showZenodoWarning: boolean;
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

  // Cache CSRF token to avoid repeated requests
  private static _cachedCSRFToken: string | null = null;

  // Base URL for HydroShare API - can be configured for different environments
  private static readonly hydroshareHost = "http://localhost:8000";

  static fields() {
    return {};
  }

  static get $state(): IUserState {
    return this.store().state.entities[this.entity];
  }

  static get accessToken() {
    return this.$state?.orcidAccessToken;
  }

  static state(): IUserState {
    return {
      isLoggedIn: false,
      orcid: "",
      orcidAccessToken: "",
      next: "",
      hasUnsavedChanges: false,
      showZenodoWarning: true,
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
      const response = await axios.get(`${this.hydroshareHost}/hsapi/userInfo/`, {
        withCredentials: true,
      });

      if (response.status === 200 && response.data) {
        await User.commit((state) => {
          state.isLoggedIn = true;
          // Use username if orcid is not available, or map to appropriate field
          state.orcid = response.data.orcid || response.data.username || "";
          // Note: we're not storing orcidAccessToken anymore with cookie auth
          state.orcidAccessToken = "";
        });
        return true;
      }
    } catch (e) {
      await User.commit((state) => {
        state.isLoggedIn = false;
        state.orcid = "";
        state.orcidAccessToken = "";
      });
    }
    return false;
  }

  static async checkAuthorization() {
    try {
      // With Django cookie authentication, cookies are automatically sent
      const response = await axios.get(`${this.hydroshareHost}/hsapi/userInfo/`, {
        withCredentials: true, // Ensure cookies are sent
      });

      console.log("checkAuthorization response:", response.status, response.data);

      if (response.status !== 200) {
        // Something went wrong, authorization may be invalid
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

  static async getResourceS3prefix(res_id: string) {
    try {
      const response = await axios.get(`${this.hydroshareHost}/hsapi/resource/s3/${res_id}/`, {
        withCredentials: true, // Ensure cookies are sent for authentication
      });

      if (response.status === 200 && response.data) {
        console.log("getResourceS3prefix response:", response.data);
        return {
          bucket: response.data.bucket,
          prefix: response.data.prefix,
        };
      }
    } catch (e: any) {
      console.log("getResourceS3prefix error:", e);
      throw new Error(`Failed to get S3 prefix for resource ${res_id}: ${e.message}`);
    }
    return null;
  }

  static async getCSRFToken(forceRefresh: boolean = false): Promise<string | null> {
    // Return cached token if available and not forcing refresh
    if (!forceRefresh && this._cachedCSRFToken) {
      return this._cachedCSRFToken;
    }

    try {
      // Use Django's @ensure_csrf_cookie endpoint to get/set the CSRF cookie
      await axios.get(`${this.hydroshareHost}/csrf-cookie/`, {
        withCredentials: true,
      });

      // After calling the endpoint, the CSRF cookie should be set
      // Now read it from the cookies
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') {
          this._cachedCSRFToken = decodeURIComponent(value);
          return this._cachedCSRFToken;
        }
      }
    } catch (e) {
      console.log("CSRF endpoint error:", e);
    }

    // Fallback: try to get CSRF token from cookie (in case it was already set)
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrftoken') {
        this._cachedCSRFToken = decodeURIComponent(value);
        return this._cachedCSRFToken;
      }
    }

    console.warn("No CSRF token found");
    this._cachedCSRFToken = null;
    return null;
  }

  static async createS3Credentials() {
    try {
      // Get CSRF token (cached if available)
      let csrfToken = await this.getCSRFToken();

      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const response = await axios.post(`${this.hydroshareHost}/hsapi/user/service/accounts/s3/`, {}, {
        withCredentials: true, // Ensure cookies are sent for authentication
        headers: headers,
      });

      if (response.status >= 200 && response.status < 300 && response.data) {
        console.log("createS3Credentials response:", response.data);
        return {
          access_key: response.data.access_key,
          secret_key: response.data.secret_key,
        };
      }
    } catch (e: any) {
      // If we get a 403 CSRF error, try refreshing the token once
      if (e.response?.status === 403 && e.response?.data?.detail?.includes('CSRF')) {
        console.log("CSRF token invalid, refreshing and retrying...");
        try {
          const csrfToken = await this.getCSRFToken(true); // Force refresh
          const headers: any = {
            'Content-Type': 'application/json',
          };

          if (csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
          }

          const retryResponse = await axios.post(`${this.hydroshareHost}/hsapi/user/service/accounts/s3/`, {}, {
            withCredentials: true,
            headers: headers,
          });

          if (retryResponse.status === 200 && retryResponse.data) {
            console.log("createS3Credentials retry response:", retryResponse.data);
            return {
              access_key: retryResponse.data.access_key,
              secret_key: retryResponse.data.secret_key,
            };
          }
        } catch (retryError: any) {
          console.log("createS3Credentials retry error:", retryError);
          throw new Error(`Failed to create S3 credentials after retry: ${retryError.message}`);
        }
      }

      console.log("createS3Credentials error:", e);
      throw new Error(`Failed to create S3 credentials: ${e.message}`);
    }
    return null;
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

    try {
      // Get CSRF token (cached if available)
      let csrfToken = await this.getCSRFToken();

      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }

      const endpoint = `${this.hydroshareHost}/hsapi/resource/${resource_id}/access/`;

      let response;

      if (privilege === PrivilegeCodes.NONE) {
        // DELETE request with user_id as query parameter
        response = await axios.delete(`${endpoint}?user_id=${user_id}`, {
          withCredentials: true,
          headers: headers,
        });
        console.log("manageResourceAccess DELETE response:", response.status, response.data);
      } else {
        // PUT request with JSON body
        const requestBody = {
          privilege: privilege,
          user_id: user_id,
        };

        response = await axios.put(endpoint, requestBody, {
          withCredentials: true,
          headers: headers,
        });
        console.log("manageResourceAccess PUT response:", response.status, response.data);
      }

      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          action: privilege === PrivilegeCodes.NONE ? 'removed' : 'updated',
          resource_id: resource_id,
          user_id: user_id,
          privilege: privilege === PrivilegeCodes.NONE ? null : privilege,
          data: response.data,
        };
      }
    } catch (e: any) {
      // If we get a 403 CSRF error, try refreshing the token once
      if (e.response?.status === 403 && e.response?.data?.detail?.includes('CSRF')) {
        console.log("CSRF token invalid, refreshing and retrying...");
        try {
          const csrfToken = await this.getCSRFToken(true); // Force refresh
          const headers: any = {
            'Content-Type': 'application/json',
          };

          if (csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
          }

          const endpoint = `${this.hydroshareHost}/hsapi/resource/${resource_id}/access/`;
          let retryResponse;

          if (privilege === PrivilegeCodes.NONE) {
            // Retry DELETE request
            retryResponse = await axios.delete(`${endpoint}?user_id=${user_id}`, {
              withCredentials: true,
              headers: headers,
            });
          } else {
            // Retry PUT request
            const requestBody = {
              privilege: privilege,
              user_id: user_id,
            };

            retryResponse = await axios.put(endpoint, requestBody, {
              withCredentials: true,
              headers: headers,
            });
          }

          if (retryResponse.status >= 200 && retryResponse.status < 300) {
            console.log("manageResourceAccess retry response:", retryResponse.status, retryResponse.data);
            return {
              success: true,
              action: privilege === PrivilegeCodes.NONE ? 'removed' : 'updated',
              resource_id: resource_id,
              user_id: user_id,
              privilege: privilege === PrivilegeCodes.NONE ? null : privilege,
              data: retryResponse.data,
            };
          }
        } catch (retryError: any) {
          console.log("manageResourceAccess retry error:", retryError);
          throw new Error(`Failed to manage resource access after retry: ${retryError.message}`);
        }
      }

      console.log("manageResourceAccess error:", e);
      throw new Error(`Failed to manage resource access: ${e.message}`);
    }

    return {
      success: false,
      message: 'Unexpected response from server'
    };
  }

  static async logOut() {
    try {
      await axios.get(`${this.hydroshareHost}/accounts/logout/`, {
        withCredentials: true, // Ensure cookies are sent for logout
      });
      this._logOut();
    } catch (e) {
      // We don't care about the response status. We at least log the user out in the frontend.
      this._logOut();
    }
  }

  private static async _logOut() {
    // Clear cached CSRF token on logout
    this._cachedCSRFToken = null;

    await User.commit((state) => {
      state.isLoggedIn = false;
      state.orcidAccessToken = "";
    });

    Notifications.toast({
      message: "You have logged out!",
      type: "info",
    });

    // if (useRouter().currentRoute.meta?.hasLoggedInGuard)
    //   useRouter().push({ path: '/' })
  }
}
