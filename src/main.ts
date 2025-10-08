import { ViteSSG } from "vite-ssg";
import App from "./App.vue";
import type { UserModule } from "./types";
import axios from "axios";
import User, { PrivilegeCodes } from "./models/user.model";

import "./assets/css/global.scss";
import { routes } from "./routes";
// import { createWebHistory } from "vue-router";

// Configure axios to send cookies with all requests for Django cookie authentication
axios.defaults.withCredentials = true;

// Temporarily expose User and PrivilegeCodes to global scope for debugging
if (typeof window !== 'undefined') {
  (window as any).User = User;
  (window as any).PrivilegeCodes = PrivilegeCodes;
}

// https://github.com/antfu/vite-ssg
export const createApp = ViteSSG(
  App,
  {
    routes,
    scrollBehavior: async (to, from, savedPosition) => {
      await (new Promise(resolve => setTimeout(resolve, 0)))

      if (to.hash) {
        return {
          el: to.hash,
          behavior: 'smooth',
          top: 0,
        }
      } else if (savedPosition) return savedPosition
      else return { top: 0 }
    },
    base: import.meta.env.BASE_URL,
    // TODO: enable history mode and configure server to handle routes
    // history: createWebHistory(),
  },
  (ctx) => {
    // install all modules under `modules/`
    Object.values(
      import.meta.glob<{ install: UserModule }>("./modules/*.ts", {
        eager: true,
      }),
    ).forEach((i) => i.install?.(ctx));
  },
);
