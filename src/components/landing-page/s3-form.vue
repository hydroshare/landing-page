<template>
  <v-alert class="mb-8" color="info" variant="outlined" icon="mdi-information">
    Change these settings and click the <b>Apply</b> button below to reload the
    resource.
  </v-alert>

  <v-text-field
    class="mb-2"
    label="Hydroshare Host"
    v-model="_hydroshareHost"
    variant="outlined"
    density="compact"
    clearable
    prepend-icon="mdi-server"
  />
  <v-text-field
    class="mb-2"
    label="S3 Host"
    v-model="_s3Host"
    variant="outlined"
    density="compact"
    clearable
    prepend-icon="mdi-server"
  />
  <v-text-field
    class="mb-2"
    label="Bucket"
    v-model="_bucket"
    variant="outlined"
    density="compact"
    clearable
    prepend-icon="mdi-bucket"
  />
  <v-text-field
    class="mb-2"
    label="Prefix"
    v-model="_prefix"
    variant="outlined"
    density="compact"
    clearable
    prepend-icon="mdi-text-box-plus"
  />

  <div class="d-flex gap-1">
    <v-btn color="default" variant="flat" @click="$emit('restore-defaults')"
      >Restore Defaults</v-btn
    >
    <v-spacer></v-spacer>
    <!-- <v-btn color="default" variant="flat">Cancel</v-btn> -->

    <v-btn color="primary" @click="apply">Apply</v-btn>
  </div>
</template>

<script lang="ts">
import { Component, Prop, toNative, Vue } from "vue-facing-decorator";

@Component({
  components: {},
  name: "App",
  emits: [
    "update:hydroshareHost",
    "update:s3Host",
    "update:bucket",
    "update:prefix",
    "restore-defaults",
    "apply-changes",
  ],
})
class S3Form extends Vue {
  @Prop() hydroshareHost!: string;
  @Prop() s3Host!: string;
  @Prop() bucket!: string;
  @Prop() prefix!: string;

  _hydroshareHost = "";
  _s3Host = "";
  _bucket = "";
  _prefix = "";

  created() {
    this._hydroshareHost = this.hydroshareHost;
    this._s3Host = this.s3Host;
    this._bucket = this.bucket;
    this._prefix = this.prefix;
  }

  apply() {
    this.$emit("apply-changes", {
      hydroshareHost: this._hydroshareHost,
      s3Host: this._s3Host,
      bucket: this._bucket,
      prefix: this._prefix,
    });
  }
}

export default toNative(S3Form);
</script>

<style scoped lang="scss"></style>
