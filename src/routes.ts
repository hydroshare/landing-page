import { RouteRecordRaw } from "vue-router";
import LandingPage from "@/components/landing-page/landing-page.vue";
import EditDataset from "@/components/landing-page/edit-dataset.vue";
import CdFooter from "@/components/base/cd.footer.vue";
import AuthRedirect from "@/components/account/auth-redirect.vue";
import Toc from "./components/base/toc.vue";

export const routes: RouteRecordRaw[] = [
  {
    name: "landing",
    path: "/:resourceId?",
    components: {
      content: LandingPage,
      footer: CdFooter,
      toc: Toc
    },
    meta: {
      title: "Landing Page",

    },
  },
  {
    name: "edit-dataset",
    path: "/:resourceId/edit",
    props: true,
    components: {
      content: EditDataset,
      footer: CdFooter,
    },
    meta: {
      title: "Edit dataset",
    },
  },
  {
    name: "auth-redirect",
    path: "/auth-redirect",
    components: {
      content: AuthRedirect,
    },
    meta: {
      hideNavigation: true,
    },
  },
  /** @see https://router.vuejs.org/guide/migration/#removed-star-or-catch-all-routes */
  { path: "/:pathMatch(.*)*", name: "not-found", redirect: { name: "landing" } },
  {
    path: "/:pathMatch(.*)",
    name: "bad-not-found",
    redirect: { name: "landing" },
  },
];
