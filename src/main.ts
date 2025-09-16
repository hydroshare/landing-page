import { ViteSSG } from "vite-ssg";
import App from "./App.vue";
import type { UserModule } from "./types";
import axios from "axios";
import User, { PrivilegeCodes } from "./models/user.model";

import "./assets/css/global.scss";
import { routes } from "./routes";

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
    // scrollBehavior(_to, _from, _savedPosition) {
    //   document.getElementsByTagName("html")[0]?.scrollTo({ left: 0, top: 0 });
    // },
    base: import.meta.env.BASE_URL,
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
