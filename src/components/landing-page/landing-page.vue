<template>
  <v-container>
    <div class="d-flex gap-1">
      <div class="text-h5">Resource</div>
      <v-spacer></v-spacer>
      <template v-if="!isLoadingFiles && !isFetchingMetadata">
        <v-menu width="500" :close-on-content-click="false">
          <template v-slot:activator="{ props }">
            <v-btn
              size="small"
              v-bind="props"
              color="primary"
              prepend-icon="mdi-cog"
              variant="plain"
              >Settings</v-btn
            >
          </template>
          <v-card>
            <v-card-title
              class="bg-grey-lighten-3 text-body-1 text-medium-emphasis"
              >Settings</v-card-title
            >
            <v-divider></v-divider>
            <v-card-text flat>
              <s3-form
                :prefix="s3Info.prefix"
                :bucket="s3Info.bucket"
                :s3-host="s3Host"
                :hydroshare-host="hydroshareHost"
                :accessKey="accessKey"
                :secret-key="secretKey"
                @apply-changes="onS3FormUpdate"
                @restore-defaults="onRestoreDefaults"
              ></s3-form>
            </v-card-text>
          </v-card>
        </v-menu>

        <v-btn
          size="small"
          color="primary"
          prepend-icon="mdi-pen"
          variant="outlined"
          @click="$router.push({ name: 'edit-dataset' })"
          >Edit</v-btn
        >
      </template>
    </div>
    <v-divider class="mb-6"></v-divider>

    <template v-if="wasLoaded">
      <cz-file-explorer
        class="ma-4"
        v-if="!isLoadingFiles"
        ref="fileExplorer"
        id="cz-folder-structure"
        :root-directory="rootDirectory"
        :has-folders="fileExplorerConfig.hasFolders"
        :is-read-only="true"
        :has-file-metadata="() => false"
        :canDownloadItem="() => true"
        @download="onFileDownload($event, resourceId, s3Client, s3Info.bucket)"
      >
        <template #prepend>
          <span />
        </template>
      </cz-file-explorer>
      <v-skeleton-loader class="mb-12" v-else type="card"></v-skeleton-loader>

      <v-skeleton-loader
        v-if="isFetchingMetadata"
        type="card"
      ></v-skeleton-loader>
      <cz-form
        v-else
        :schema="schema"
        :uischema="uischema"
        v-model="data"
        :config="config"
        ref="form"
      />
    </template>
    <v-empty-state
      v-else
      icon="mdi-cloud-cancel"
      text="Try adjusting your settings."
      title="We couldn't load this resource."
    ></v-empty-state>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue, toNative, Ref } from "vue-facing-decorator";
import { CzForm, CzFileExplorer } from "@cznethub/cznet-vue-core";
import type { IFolder } from "@cznethub/cznet-vue-core/dist/types";
import { S3Client, _Object } from "@aws-sdk/client-s3";
import { stringify } from "@/utils";
import { fetchResource, onFileDownload } from "./shared";
import S3Form from "./s3-form.vue";

@Component({
  components: { CzForm, CzFileExplorer, S3Form },
  name: "App",
})
class LandingPage extends Vue {
  resourceId!: string;

  @Ref("form") form!: InstanceType<typeof CzForm>;
  @Ref("fileExplorer") fileExplorer!: InstanceType<typeof CzFileExplorer>;

  schema!: any;
  uischema!: any;
  onFileDownload = onFileDownload;

  data: Record<string, any> = {};
  stringify = stringify;

  accessKey = localStorage.getItem("s3AccessKey") || "";
  secretKey = localStorage.getItem("s3SecretKey") || "";

  isLoadingFiles: boolean = true;
  currentPath: string = "";
  isFetchingMetadata = true;
  wasLoaded = true;

  s3Client!: S3Client;
  s3Host: string = "http://localhost:9000";
  hydroshareHost: string = "http://localhost:8000";

  s3Info = {
    bucket: "",
    prefix: "",
  };

  config = {
    restrict: true,
    trim: true,
    showUnfocusedDescription: false,
    hideRequiredAsterisk: false,
    collapseNewItems: false,
    breakHorizontal: false,
    initCollapsed: false,
    hideAvatar: false,
    hideArraySummaryValidation: false,
    vuetify: {
      commonAttrs: {
        density: "compact",
        variant: "outlined",
        "persistent-hint": true,
        "hide-details": false,
      },
    },
    isViewMode: true,
    isReadOnly: false,
    isDisabled: false,
  };

  rootDirectory: Partial<IFolder> = {
    name: "root",
    children: [],
  };
  fileExplorerConfig = {
    isReadOnly: true, // Unused for now
    hasFolders: true,
  };

  startS3Client() {
    this.s3Client = new S3Client({
      region: "us-central-2",
      endpoint: this.s3Host,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.accessKey,
        secretAccessKey: this.secretKey,
      },
    });
  }

  async created() {
    if (!this.resourceId && this.$route?.params?.resourceId) {
      this.resourceId = this.$route.params.resourceId as string;
    }

    // notify if the resourceId is not set
    if (!this.resourceId) {
      alert(
        "No resourceId provided. Using example resourceId: d7b526e24f7e449098b428ae9363f514.",
      );
      this.resourceId = "d7b526e24f7e449098b428ae9363f514";
    }

    // https://cuahsi.atlassian.net/browse/CAM-769
    // TODO: for now we store access and secret keys in localStorage
    // Replace when we update to Pinia

    if (!this.accessKey || !this.secretKey) {
      this.accessKey = prompt("Enter your S3 Access Key:") || "";
      this.secretKey = prompt("Enter your S3 Secret Key:") || "";

      if (this.accessKey && this.secretKey) {
        localStorage.setItem("s3AccessKey", this.accessKey);
        localStorage.setItem("s3SecretKey", this.secretKey);
      } else {
        alert("Access key and secret key are required to proceed.");
        return;
      }
    }

    if (!this.s3Info.bucket || !this.s3Info.prefix) {
      await this.fetchS3Info();
    }

    this.startS3Client();

    /* @ts-ignore */
    this.schema = await import(
      `@/schemas/hydroshare/scientific_dataset_json_schema.json`
    );

    /* @ts-ignore */
    this.uischema = await import(`@/schemas/hydroshare/view-uischema.json`);

    this.loadResource();
  }

  async loadResource() {
    this.isFetchingMetadata = true;
    this.isLoadingFiles = true;
    this.wasLoaded = true;

    const resource = await fetchResource(
      this.resourceId,
      this.s3Client,
      this.s3Info.bucket,
      `${this.resourceId}/data/contents/dataset_metadata.json`,
    );

    if (resource) {
      this.data = resource.data;
      // @ts-expect-error The key property is generated when the component is initialized
      this.rootDirectory.children = resource.initialStructure;
    } else {
      this.wasLoaded = false;
    }
    this.isFetchingMetadata = false;
    this.isLoadingFiles = false;
  }

  async onS3FormUpdate(params: any) {
    this.isFetchingMetadata = true;
    this.isLoadingFiles = true;
    this.s3Info.bucket = params.bucket;
    this.s3Info.prefix = params.prefix;
    this.hydroshareHost = params.hydroshareHost;
    this.s3Host = params.s3Host;

    this.secretKey = params.secretKey;
    this.accessKey = params.accessKey;
    localStorage.setItem("s3AccessKey", this.accessKey);
    localStorage.setItem("s3SecretKey", this.secretKey);

    this.startS3Client();
    this.loadResource();
  }

  async onRestoreDefaults() {
    this.isFetchingMetadata = true;
    this.isLoadingFiles = true;
    this.s3Host = "http://localhost:9000";
    this.hydroshareHost = "http://localhost:8000";
    await this.fetchS3Info();
    this.startS3Client();
    this.loadResource();
  }

  /**
   * @deprecated We are trying to avoid this coupling.
   */
  async fetchS3Info() {
    const response = await fetch(
      `${this.hydroshareHost}/hsapi/resource/s3/${this.resourceId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    this.s3Info = await response.json();
    this.s3Info.prefix = `md/${this.resourceId}/`; // TODO: overriding wrong api response value
  }
}
export default toNative(LandingPage);
</script>

<style lang="scss" scoped></style>
