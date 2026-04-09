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
        Table of contents
      </div>
    </template>

    <ul class="ms-5">
      <template v-if="toc?.length">
        <li
          v-for="item of toc"
          :key="item.to"
          :class="[
            'ps-3 text-medium-emphasis text-body-2 py-1 font-weight-regular',
            {
              'text-primary active': activeItem === item.to,
              'ps-6': item.level === 3,
              'ps-9': item.level === 4,
              'ps-12': item.level === 5,
            },
          ]"
        >
          <a
            href="#"
            class="v-toc-link d-block text-decoration-none"
            @click.prevent="onClick(item.to)"
            v-text="item.text"
          />
        </li>
      </template>
      <template v-else>
        <li
          v-for="item of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]"
          :key="item"
          class="ps-3 py-1"
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
import { nextTick } from "vue";
import { Component, Vue, Watch, toNative } from "vue-facing-decorator";
import User from "@/models/user.model";

@Component({
  name: "toc",
  components: {},
})
class Toc extends Vue {
  activeItem = "";
  observer!: IntersectionObserver;

  created() {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.activeItem = "#" + entry.target.id;
            break;
          }
        }
      },
      {
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      },
    );
  }

  unmounted() {
    this.observer.disconnect();
  }

  get toc() {
    return User.$state.toc;
  }

  onClick(hash: string): void {
    const el = document.querySelector(hash);
    if (!el) return;
    this.activeItem = hash;
    const navbarHeight = document.getElementById("app-bar")?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - navbarHeight;
    window.scrollTo({ top, behavior: "smooth" });
  }
}

export default toNative(Toc);
</script>

<style lang="scss" scoped>
#app-toc ul {
  list-style-type: none;
}

li {
  border-left: 2px solid rgb(var(--v-theme-on-surface-variant));
  &.active {
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
