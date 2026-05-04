<template>
  <v-app id="app" app>
    <v-main app>
      <v-container id="main-container" fluid>
        <v-sheet min-height="70vh" class="d-flex justify-space-between">
          <router-view name="content" :key="String($route.params.resourceId)" />
        </v-sheet>
      </v-container>
    </v-main>

    <router-view name="toc"></router-view>

    <cz-notifications />

    <link
      href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900"
      rel="stylesheet"
    />
    <link
      href="https://cdn.jsdelivr.net/npm/@mdi/font@6.x/css/materialdesignicons.min.css"
      rel="stylesheet"
    />
  </v-app>
</template>

<script lang="ts">
import { Component, Vue, toNative } from "vue-facing-decorator";
import { APP_NAME } from "./constants";
import { CzNotifications } from "@cznethub/cznet-vue-core";
import { addRouteTags } from "./modules/router";
import { useRoute } from "vue-router";

@Component({
  name: "app",
  components: { CzNotifications },
})
class App extends Vue {
  route = useRoute();

  async created() {
    document.title = APP_NAME;
    addRouteTags(this.route, this.route);
  }
}
export default toNative(App);
</script>
