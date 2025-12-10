<template>
  <v-navigation-drawer
    id="app-toc"
    location="left"
    width="256"
    floating
    sticky
    class="mt-4 ml-4"
  >
    <template #prepend>
      <div class="mt-4 mb-2 ms-4 text-body-2 text-medium-emphasis">
        Table of contents {{ activeItem }}
      </div>
    </template>

    <ul class="ms-5">
      <template v-if="toc?.length">
        <router-link
          v-for="item of toc"
          :key="item.text"
          v-slot="{ href }"
          :to="item.to"
          custom
        >
          <li
            :class="[
              'ps-3 text-medium-emphasis text-body-2 py-1 font-weight-regular',
              {
                'text-primary router-link-active': activeItem === item.to,
                'ps-6': item.level === 3,
                'ps-9': item.level === 4,
                'ps-12': item.level === 5,
              },
            ]"
          >
            <a
              :href="href"
              class="v-toc-link d-block text-decoration-none"
              @click.prevent.stop="onClick(item.to)"
              v-text="item.text"
            />
          </li>
        </router-link>
      </template>
      <template v-else>
        <li
          v-for="item of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]"
          :class="['ps-3 py-1 ']"
        >
          <v-skeleton-loader
            :loading="true"
            type="text"
            class="pa-0 ma-0"
          ></v-skeleton-loader>
        </li>
      </template>
    </ul>
  </v-navigation-drawer>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-facing-decorator";
import User from "@/models/user.model";

@Component({
  name: "toc",
  components: {},
})
export default class Toc extends Vue {
  activeStack: string[] = [];
  activeItem = "";
  scrolling = false;
  observer!: IntersectionObserver;
  internalScrolling = false;
  timeout = -1;

  created() {
    if (this.$route.hash) {
      this.internalScrolling = true;
      this.activeItem = this.$route.hash;
      setTimeout(() => {
        this.internalScrolling = true;
        const el = document.getElementById(
          this.$route.hash.substr(1, this.$route.hash.length - 1),
        );
        el.scrollIntoView({ behavior: "smooth" });

        this.internalScrolling = false;
      }, 0);
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        if (this.internalScrolling) return;
        console.log("IntersectionObserver");
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log("#" + entry.target.id);
            this.activeStack.push("#" + entry.target.id);
          }
        });
        this.activeItem =
          this.activeStack.at(0) || this.activeItem || this.toc?.[0].to || "";
      },
      {
        // root: document.querySelector("html"),
        rootMargin: "64px",
        threshold: 1.0,
      } as IntersectionObserverInit,
    );
  }

  @Watch("activeItem")
  async onActiveItemChange(val: string) {
    if (!val || this.internalScrolling) return;
    console.log("onActiveItemChange");

    this.scrolling = true;
    const query = this.$route.query;

    const item = this.toc?.find((v) => v.to === val);
    if (item) {
      await this.$router.replace({
        path: this.$route.path,
        hash: item.to,
        query,
      });
    }
    clearTimeout(this.timeout);
    this.timeout = window.setTimeout(() => {
      this.scrolling = false;
    }, 200);
  }

  get toc() {
    return User.$state.toc;
  }

  @Watch("toc")
  async observeToc() {
    this.scrolling = false;
    this.activeStack.length = 0;
    this.activeItem = "";
    this.observer.disconnect();
    await nextTick();
    this.toc?.forEach((v) => {
      const el = document.querySelector(v.to);
      el && this.observer.observe(el);
    });
  }

  async onClick(hash: string) {
    if (this.$route.hash === hash) return;

    this.internalScrolling = true;
    await this.$router.replace({ path: this.$route.path, hash });
    this.activeItem = hash;
    setTimeout(() => {
      this.internalScrolling = false;
    }, 1000);
  }
}
</script>

<style lang="scss" scoped>
#app-toc ul {
  list-style-type: none;
}

li {
  border-left: 2px solid rgb(var(--v-theme-on-surface-variant));
  &.router-link-active {
    border-left-color: currentColor;
  }
}

.v-toc-link {
  color: inherit;
}

:deep(.v-navigation-drawer__content) {
  height: auto;
  margin-right: 12px;
}

:deep(.v-skeleton-loader__text) {
  margin: 0;
}
</style>
