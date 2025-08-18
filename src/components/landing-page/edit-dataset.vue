<template>
  <v-container>
    <div class="d-flex gap-1">
      <div class="text-h5">Edit Resource</div>
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
                @apply-changes="onS3FormUpdate"
                @restore-defaults="onRestoreDefaults"
              ></s3-form>
            </v-card-text>
          </v-card>
        </v-menu>
      </template>
    </div>
    <v-divider class="mb-6"></v-divider>

    <template v-if="wasLoaded">
      <cz-file-explorer
        v-if="!isLoadingFiles"
        ref="fileExplorer"
        id="cz-folder-structure"
        v-model:valid-items="toUpload"
        :root-directory="rootDirectory"
        :has-folders="fileExplorerConfig.hasFolders"
        :is-read-only="false"
        :has-file-metadata="() => false"
        :folder-name-regex="folderNameRegex"
        :canDownloadItem="() => true"
        :upload="uploadFiles"
        :delete-file-or-folder="deleteFileOrFolder"
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
        :errors.sync="errors"
        @update:errors="onUpdateErrors"
        v-model:is-valid="isValid"
        :config="config"
        ref="form"
      />

      <div v-if="!isFetchingMetadata" class="d-flex gap-1">
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          @click="$router.push({ name: 'landing', params: { resourceId } })"
        >
          Cancel
        </v-btn>
        <v-menu
          :disabled="!errors.length"
          open-on-hover
          bottom
          left
          offset-y
          transition="fade"
        >
          <template #activator="{ props }">
            <div
              v-bind="props"
              class="d-flex form-controls flex-column flex-sm-row"
            >
              <v-badge
                :model-value="!isValid"
                bordered
                color="error"
                icon="mdi-exclamation-thick"
                overlap
              >
                <v-btn
                  color="primary"
                  variant="elevated"
                  @click="submit"
                  :disabled="!isValid || isSubmitting"
                >
                  {{ isSubmitting ? "Saving Changes..." : "Save Changes" }}
                </v-btn>
              </v-badge>
            </div>
          </template>
          <v-card>
            <v-card-text>
              <ul class="text-subtitle-1 ml-4">
                <li v-for="(error, index) of errors" :key="index">
                  <b>{{ error.title }}</b> {{ error.message }}.
                </li>
              </ul>
            </v-card-text>
          </v-card>
        </v-menu>
      </div>
      <v-skeleton-loader v-else type="actions"></v-skeleton-loader>
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
import {
  CzForm,
  CzFileExplorer,
  Notifications,
} from "@cznethub/cznet-vue-core";
import type { IFile, IFolder } from "@cznethub/cznet-vue-core/dist/types";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  _Object,
} from "@aws-sdk/client-s3";
import { stringify } from "@/utils";
import { fetchResource, onFileDownload } from "./shared";

interface FormError {
  title: string;
  message: string;
}

@Component({
  components: { CzForm, CzFileExplorer },
  name: "App",
})
class App extends Vue {
  resourceId!: string;

  @Ref("form") form!: InstanceType<typeof CzForm>;
  @Ref("fileInput") fileInput!: HTMLInputElement;
  @Ref("folderInput") folderInput!: HTMLInputElement;
  @Ref("fileExplorer") fileExplorer!: InstanceType<typeof CzFileExplorer>;

  schema!: any;
  uischema!: any;
  defaults!: any;
  onFileDownload = onFileDownload;

  isValid: boolean = false;
  errors: FormError[] = [];
  data: Record<string, any> = {};
  stringify = stringify;

  accessKey = localStorage.getItem("s3AccessKey") || "";
  secretKey = localStorage.getItem("s3SecretKey") || "";

  isLoadingFiles: boolean = true;
  isSubmitting: boolean = false;
  currentPath: string = "";
  folderNameRegex = /^[-()\w\s]*$/;
  isFetchingMetadata = true;
  wasLoaded = true;

  s3Client!: S3Client;
  s3Host: string = "https://s3.beta.hydroshare.org";
  hydroshareHost: string = "https://beta.hydroshare.org";
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
    isViewMode: false,
    isReadOnly: false,
    isDisabled: false,
  };

  toUpload = [];
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
      endpoint: `${this.s3Host}`,
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
    this.uischema = await import(`@/schemas/hydroshare/edit-uischema.json`);

    /* @ts-ignore */
    this.defaults = await import(`@/schemas/hydroshare/defaults.json`);

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
      `${this.s3Info.prefix}hs_user_meta.json`,
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

  onUpdateErrors(errors: FormError[]) {
    this.errors = errors;
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
    this.s3Host = "https://s3.beta.hydroshare.org";
    this.hydroshareHost = "https://beta.hydroshare.org";
    await this.fetchS3Info();
    this.startS3Client();
    this.loadResource();
  }

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
  }

  async submit() {
    try {
      const resourceId = this.resourceId;
      const key = `${resourceId}/data/contents/hs_user_meta.json`;

      const content = JSON.stringify(
        { name: this.data.name, description: this.data.description },
        null,
        2,
      );
      const command = new PutObjectCommand({
        Bucket: this.s3Info.bucket,
        Key: key,
        Body: content,
        ContentType: "application/json",
      });
      this.isSubmitting = true;
      await this.s3Client.send(command);

      Notifications.toast({
        title: "Success",
        message: "Metadata uploaded to S3 successfully!",
        type: "success",
      });

      // @ts-ignore
      this.$router.push({
        name: "landing",
        params: { resourceId: this.resourceId },
      });
    } catch (error: any) {
      console.error("Error uploading to S3:", error);
      Notifications.toast({
        title: "Error",
        message: `Failed to upload metadata to S3. Details: ${error.message}`,
        type: "error",
      });
    } finally {
      this.isSubmitting = false;
    }
  }

  async uploadFiles(files: IFile[]): Promise<boolean[]> {
    if (files.length) {
      // Annotate file paths before uploading
      files.forEach((f) => {
        f.isDisabled = true;
        f.path = this.fileExplorer.getPathString(f);
      });
      return this._uploadFiles(files);
    }
    return [];
  }

  private async _uploadFiles(
    itemsToUpload: (IFile | IFolder)[],
  ): Promise<boolean[]> {
    itemsToUpload.map((i) => (i.isDisabled = true));
    const filesToUpload = itemsToUpload.filter((i) =>
      Object.prototype.hasOwnProperty.call(i, "file"),
    ) as IFile[];
    const foldersToUpload = itemsToUpload.filter((i) =>
      Object.prototype.hasOwnProperty.call(i, "children"),
    ) as IFolder[];

    const basePrefix = `${this.resourceId}/data/contents/${this.currentPath}`;

    // TODO: compute folder paths
    let folderPaths = foldersToUpload
      .map((f) => f.path)
      .filter((f) => !!f) as string[];

    // Get unique paths
    folderPaths = [...new Set(folderPaths)].sort(
      (a, b) => b.split("/").length - a.split("/").length,
    );

    // HydroShare can only create multiple folders at a time if the parent folder already exists
    // So we traverse the tree by depth and create folders in each depth at a time
    const that = this;
    let responses;
    itemsToUpload.map((i) => (i.isDisabled = false));

    if (folderPaths.length) {
      // Create folders
      responses = await _createFoldersByDepth(folderPaths, 1);
    } else {
      // No folders to create. Just upload files directly.
      responses = await _uploadFiles();
    }

    async function _createFoldersByDepth(
      paths: string[],
      depth: number,
    ): Promise<boolean[]> {
      const depthPaths = paths.filter((p) => p.split("/").length === depth);

      const folderCreatePromises = depthPaths.map((path: string) => {
        const basePrefix = `${that.resourceId}/data/contents/`;

        // TODO: how to create an empty folder
        return that.s3Client.send(
          new PutObjectCommand({
            Bucket: that.s3Info.bucket,
            Key: `${basePrefix}${path}`,
            Body: "",
            ContentType: "application/x-directory",
          }),
        );
      });

      await Promise.allSettled(folderCreatePromises);
      const remaining = paths.filter((p) => p.split("/").length > depth);

      return remaining.length
        ? _createFoldersByDepth(remaining, depth + 1)
        : _uploadFiles(); // Finished creating folders. Files can be added.
    }

    async function _uploadFiles(): Promise<boolean[]> {
      const fileUploadPromises = filesToUpload.map(async (file: IFile) => {
        const form = new window.FormData();
        if (file.file) form.append("file", file.file, file.name);
        const path = that.fileExplorer.getPathString(file);
        try {
          const key = `${basePrefix}${path}`;
          const arrayBuffer = await file.file?.arrayBuffer();
          await that.s3Client.send(
            new PutObjectCommand({
              Bucket: that.s3Info.bucket,
              Key: key,
              Body: arrayBuffer,
              ContentType: file.file?.type || "application/octet-stream",
            }),
          );
          return true;
        } catch (e) {
          return false;
        }
      });

      const response: PromiseSettledResult<any>[] =
        await Promise.allSettled(fileUploadPromises);

      filesToUpload.forEach((f, index) => {
        if (response[index].status === "fulfilled") {
          f.isUploaded = true;
        } else {
          // Uplaod failed for this file
          response[index].status = "rejected";
          // f.parent.children = f.parent.children.filter(
          //   file => file.name !== f.name,
          // )
        }
      });

      // TODO: figure out how to identify that fail was due to a name that already exists
      if (response.some((r) => r.status === "rejected")) {
        Notifications.toast({
          message: "Some of your files failed to upload",
          type: "error",
        });
      }

      return response.map((r) => r.status === "fulfilled");
    }

    return responses;
  }

  async deleteFileOrFolder(item: IFile | IFolder): Promise<boolean> {
    const path = this.fileExplorer.getPathString(item);
    const isFolder = Object.prototype.hasOwnProperty.call(item, "children");
    const basePrefix = `${this.resourceId}/data/contents/`;
    try {
      if (isFolder) {
        let continuationToken: string | undefined;
        const objectsToDelete: { Key: string }[] = [];

        do {
          const listCommand = new ListObjectsV2Command({
            Bucket: this.s3Info.bucket,
            Prefix: path,
            ContinuationToken: continuationToken,
          });
          const listResponse = await this.s3Client.send(listCommand);

          if (listResponse.Contents) {
            listResponse.Contents.forEach((obj) => {
              if (obj.Key) {
                objectsToDelete.push({ Key: obj.Key });
                console.log(`Added to delete: ${obj.Key}`);
              }
            });
          }

          continuationToken = listResponse.NextContinuationToken;
        } while (continuationToken);

        if (!objectsToDelete.some((obj) => obj.Key === path)) {
          objectsToDelete.push({ Key: path });
          console.log(`Added top-level folder marker: ${path}`);
        }

        const batchSize = 1000;
        if (objectsToDelete.length === 0) {
          console.log(`No objects found to delete for folder: ${item.key}`);
        } else {
          for (let i = 0; i < objectsToDelete.length; i += batchSize) {
            const batch = objectsToDelete.slice(i, i + batchSize);
            await this.s3Client.send(
              new DeleteObjectsCommand({
                Bucket: this.s3Info.bucket,
                Delete: { Objects: batch },
              }),
            );
            console.log(
              `Deleted batch of ${batch.length} objects:`,
              batch.map((obj) => obj.Key),
            );
          }
        }

        const verifyCommand = new ListObjectsV2Command({
          Bucket: this.s3Info.bucket,
          Prefix: `${basePrefix}${path}`,
        });
        const verifyResponse = await this.s3Client.send(verifyCommand);
        if (verifyResponse.Contents && verifyResponse.Contents.length > 0) {
          console.warn(
            `Objects still exist after deletion for ${item.key}:`,
            verifyResponse.Contents.map((obj) => obj.Key),
          );
        } else {
          console.log(`Verified: No objects remain under ${item.key}`);
        }

        const listParentCommand = new ListObjectsV2Command({
          Bucket: this.s3Info.bucket,
          Prefix: `${this.resourceId}/data/contents/`,
          Delimiter: "/",
        });
        const parentResponse = await this.s3Client.send(listParentCommand);
        if (
          parentResponse.CommonPrefixes &&
          parentResponse.CommonPrefixes.some(
            (p) => p.Prefix === `${basePrefix}${path}`,
          )
        ) {
          console.warn(
            `Folder ${item.key} still appears in CommonPrefixes after deletion`,
          );
        } else {
          console.log(`Verified: ${item.key} no longer in CommonPrefixes`);
        }
      } else {
        await this.s3Client.send(
          new DeleteObjectsCommand({
            Bucket: this.s3Info.bucket,
            Delete: { Objects: [{ Key: `${basePrefix}${path}` }] }, // d7b526e24f7e449098b428ae9363f514/data/contents/vite.config.ts
          }),
        );
        console.log(`Deleted file: ${basePrefix}${path}`);
      }

      Notifications.toast({
        title: "Success",
        message: `${isFolder ? "Folder" : "File"} deleted successfully!`,
        type: "success",
      });
      return true;
    } catch (error: any) {
      console.error(`Error deleting ${isFolder ? "folder" : "file"}:`, error);
      Notifications.toast({
        title: "Error",
        message: `Failed to delete ${isFolder ? "folder" : "file"}: ${error.message}`,
        type: "error",
      });
      return false;
    }
  }
}
export default toNative(App);
</script>

<style lang="scss" scoped></style>
