<template>
  <v-container>
    <div class="d-flex justify-space-between">
      <div class="text-h5">Dataset</div>
      <v-btn
        v-if="!isLoadingFiles && !fetchingMetadata"
        size="small"
        color="primary"
        prepend-icon="mdi-pen"
        variant="outlined"
        @click="$router.push({ name: 'edit-dataset' })"
        >Edit</v-btn
      >
    </div>
    <v-divider class="mb-6"></v-divider>

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
    <v-skeleton-loader v-else type="card"></v-skeleton-loader>

    <v-skeleton-loader v-if="fetchingMetadata" type="card"></v-skeleton-loader>
    <cz-form
      v-else
      :schema="schema"
      :uischema="uischema"
      v-model="data"
      :config="config"
      ref="form"
    />
  </v-container>
</template>

<script lang="ts">
import { Component, Vue, toNative, Ref } from "vue-facing-decorator";
import {
  CzForm,
  CzFileExplorer,
  Notifications,
} from "@cznethub/cznet-vue-core";
import type { IFile, IFolder } from "@cznethub/cznet-vue-core/dist/types";
import { S3Client, GetObjectCommand, _Object } from "@aws-sdk/client-s3";
import { stringify } from "@/utils";
import { onFileDownload, readRootFolder } from "./shared";

@Component({
  components: { CzForm, CzFileExplorer },
  name: "App",
})
class App extends Vue {
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
  fetchingMetadata = true;

  s3Client!: S3Client;

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
      endpoint: "https://s3.beta.hydroshare.org",
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

    this.startS3Client();

    /* @ts-ignore */
    this.schema = await import(
      `@/schemas/hydroshare/scientific_dataset_json_schema.json`
    );

    /* @ts-ignore */
    this.uischema = await import(`@/schemas/hydroshare/view-uischema.json`);

    this.updateMetadata();
  }

  async updateMetadata() {
    this.fetchingMetadata = true;
    try {
      // Use resourceId from prop or fallback to example
      const resourceId = this.resourceId;
      const response = await fetch(
        `https://beta.hydroshare.org/hsapi/resource/s3/${resourceId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      this.s3Info = await response.json();
      const key = `md/${resourceId}/dataset_metadata.json`;

      console.log(`Fetching metadata from S3: ${this.s3Info.bucket}/${key}`);
      const result = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.s3Info.bucket, Key: key }),
      );
      const bodyContents = await result.Body?.transformToString();

      try {
        const parsed = JSON.parse(bodyContents || "");
        this.data = parsed;
        console.log(`Form data loaded from ${this.s3Info.bucket}/${key}`);
      } catch (error) {
        console.warn("JSON parse failed, loading defaults:", error);
      }

      try {
        const initialStructure = await readRootFolder(
          `${resourceId}/data/contents/`,
          this.s3Client,
          this.s3Info.bucket,
        );
        // @ts-expect-error The key property is generated when the component is initialized
        this.rootDirectory.children = initialStructure;
        this.isLoadingFiles = false;
      } catch (e) {
        Notifications.toast({
          message: "Failed to load existing files.",
          type: "error",
          location: "top center",
        });
        this.isLoadingFiles = false;
      }
    } catch (error) {
      console.error("S3 fetch failed:", error);
      Notifications.toast({
        title: "Error",
        message: "Failed to load metadata from S3.",
        type: "error",
      });
    } finally {
      this.fetchingMetadata = false;
    }
  }
}
export default toNative(App);
</script>

<style lang="scss" scoped></style>
