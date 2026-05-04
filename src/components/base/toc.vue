<template>
  <v-navigation-drawer
    v-if="isTocReady && visibleToc.length"
    id="app-toc"
    location="left"
    width="220"
    floating
    sticky
    class="mt-2"
  >
    <template #prepend>
      <div class="toc-title text-caption font-weight-bold text-uppercase text-medium-emphasis ms-4 mt-4 mb-2">
        On this page
      </div>
    </template>

    <ul class="ms-4 me-2">
      <li
        v-for="item of visibleToc"
        :key="item.to"
        :class="[
          'toc-item text-body-2 py-1',
          {
            'active': activeItem === item.to,
            'toc-nested': item.level && item.level >= 4,
          },
        ]"
      >
        <a
          href="#"
          class="toc-link d-block text-decoration-none"
          @click.prevent="onClick(item.to)"
          v-text="item.text"
        />
      </li>
    </ul>
  </v-navigation-drawer>
</template>

<script lang="ts">
import { Component, Vue, toNative } from "vue-facing-decorator";
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

  get visibleToc() {
    return this.toc.filter((item) => {
      const el = document.querySelector(item.to);
      return el && el.offsetParent !== null;
    });
  }

  get isTocReady() {
    return User.$state.isTocReady;
  }

  onClick(hash: string): void {
    const el = document.querySelector(hash);
    if (!el) return;
    this.activeItem = hash;
    const top = el.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top, behavior: "smooth" });
  }
}

export default toNative(Toc);
</script>

<style lang="scss" scoped>
#app-toc ul {
  list-style-type: none;
  padding-left: 0;
}

.toc-item {
  padding-left: 12px;
  border-left: 2px solid transparent;
  transition: border-color 0.15s, color 0.15s;
  color: rgba(0, 0, 0, 0.54);

  &:hover {
    color: rgba(0, 0, 0, 0.87);
  }

  &.active {
    border-left-color: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-primary));
    font-weight: 500;
  }

  &.toc-nested {
    padding-left: 24px;
    font-size: 0.8125rem;
  }
}

.toc-link {
  color: inherit;
}

:deep(.v-navigation-drawer__content) {
  height: auto;
  margin-right: 12px;
}
</style>
