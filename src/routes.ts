import { RouteRecordRaw } from "vue-router";
import LandingPage from "@/components/landing-page/landing-page.vue";
import Toc from "./components/base/toc.vue";

export const routes: RouteRecordRaw[] = [
  {
    name: "landing",
    path: "/:resourceId?",
    components: {
      content: LandingPage,
      toc: Toc,
    },
    meta: {
      title: "Landing Page",
    },
  },
  { path: "/", redirect: "/3ef746d6aaa54ad7844ffbed7c248c36" },
  /** @see https://router.vuejs.org/guide/migration/#removed-star-or-catch-all-routes */
  { path: "/:pathMatch(.*)*", name: "not-found", redirect: "/3ef746d6aaa54ad7844ffbed7c248c36" },
  { path: "/:pathMatch(.*)", name: "bad-not-found", redirect: "/3ef746d6aaa54ad7844ffbed7c248c36" },
];
