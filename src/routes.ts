import { RouteRecordRaw } from "vue-router";
import CdSearchResults from "@/components/search-results/cd.search-results.vue";
import LandingPage from "@/components/landing-page/landing-page-v2.vue";
import EditDataset from "@/components/landing-page/edit-dataset.vue";
import CdFooter from "@/components/base/cd.footer.vue";
import AuthRedirect from "@/components/account/auth-redirect.vue";
import Toc from "./components/base/toc.vue";

export const routes: RouteRecordRaw[] = [
  {
    name: "search",
    path: "/",
    alias: ["/", "/home", "/search"],
    components: {
      content: CdSearchResults,
      footer: CdFooter,
    },
    meta: {
      title: "Search",
    },
  },
  {
    name: "landing",
    path: "/resource/:resourceId?",
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
    path: "/resource/:resourceId/edit",
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
  { path: "/:pathMatch(.*)*", name: "not-found", redirect: { name: "search" } },
  {
    path: "/:pathMatch(.*)",
    name: "bad-not-found",
    redirect: { name: "search" },
  },
];
