<template>
  <v-container>
    <v-card class="my-5" flat>
      <v-card-text>
        <cz-file-explorer
          v-if="!isLoadingFiles"
          ref="fileExplorer"
          id="cz-folder-structure"
          v-model:valid-items="toUpload"
          :root-directory="rootDirectory"
          :has-folders="fileExplorerConfig.hasFolders"
          :is-read-only="config.isViewMode"
          :has-file-metadata="() => false"
          :folder-name-regex="folderNameRegex"
          :upload="!config.isViewMode ? uploadFiles : undefined"
          :delete-file-or-folder="
            !config.isViewMode ? deleteFileOrFolder : undefined
          "
        >
          <template #prepend>
            <span />
          </template>
        </cz-file-explorer>
        <center v-else>
          <div class="text-body-2 mb-4">Loading files...</div>
          <v-progress-circular indeterminate></v-progress-circular>
        </center>
      </v-card-text>
      <v-card-text>
        <cz-form
          :schema="schema"
          :uischema="uischema"
          v-model="data"
          :errors.sync="errors"
          @update:errors="onUpdateErrors"
          :isValid.sync="isValid"
          :config="config"
          ref="form"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-menu open-on-hover bottom left offset-y transition="fade">
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
                  depressed
                  @click="submit"
                  :disabled="
                    config.isReadOnly ||
                    config.isViewMode ||
                    config.isDisabled ||
                    !isValid
                  "
                >
                  Submit
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
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue, toNative, Ref, Watch } from "vue-facing-decorator";
import {
  CzForm,
  CzFileExplorer,
  Notifications,
} from "@cznethub/cznet-vue-core";
import type { IFile, IFolder } from "@cznethub/cznet-vue-core/dist/types";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CommonPrefix,
  _Object,
} from "@aws-sdk/client-s3";
import { stringify } from "@/utils";

// Define interfaces for better type safety
interface FormError {
  title: string;
  message: string;
}

interface SchemaDefinition {
  title: string;
  type: string;
  additionalProperties?: boolean;
  properties: {
    [key: string]: {
      anyOf?: Array<{ type: string }>;
      default?: any;
      title?: string;
      description?: string;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
    };
  };
  required?: string[];
}

interface SchemaCollectionItem {
  index: number;
  name: string;
  schema: SchemaDefinition;
  uischema: any | null;
  defaults: Record<string, any>;
}

interface FileItem {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  isFolder: boolean;
}

@Component({
  components: { CzForm, CzFileExplorer },
  name: "App",
})
class App extends Vue {
  // Add prop for resourceId
  resourceId!: string;

  @Ref("form") form!: InstanceType<typeof CzForm>;
  @Ref("fileInput") fileInput!: HTMLInputElement;
  @Ref("folderInput") folderInput!: HTMLInputElement;
  @Ref("fileExplorer") fileExplorer!: InstanceType<typeof CzFileExplorer>;

  isValid: boolean = false;
  errors: FormError[] = [];
  data: Record<string, any> = {};
  stringify = stringify;

  selectedSchema: number = -1;
  schemaCollection: SchemaCollectionItem[] = [];

  accessKey = localStorage.getItem("s3AccessKey") || "";
  secretKey = localStorage.getItem("s3SecretKey") || "";

  fileList: FileItem[] = [];
  isLoadingFiles: boolean = true;
  currentPath: string = "";
  folderNameRegex = /^[-()\w\s]*$/;

  s3 = new S3Client({
    region: "us-central-2",
    endpoint: "https://s3.beta.hydroshare.org",
    forcePathStyle: true,
    credentials: {
      accessKeyId: this.accessKey,
      secretAccessKey: this.secretKey,
    },
  });

  fileHeaders = [
    { title: "Name", key: "name" },
    { title: "Size", key: "size" },
    { title: "Last Modified", key: "lastModified" },
    { title: "Actions", key: "actions", sortable: false },
  ];

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

  formatSize(size: number): string {
    if (!size) return "-";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  formatDate(date: Date): string {
    return date ? date.toLocaleString() : "-";
  }

  async created() {
    // Get resourceId from route params if not passed as prop
    if (
      !this.resourceId &&
      this.$route &&
      this.$route.params &&
      this.$route.params.resourceId
    ) {
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

    const schema: SchemaDefinition = await import(
      /* @vite-ignore */
      `@/schemas/hydroshare/edit_schema.json`
    );

    const { default: uischema } = await import(
      /* @vite-ignore */
      `@/schemas/hydroshare/uischema.json`
    );

    const defaults = {
      name: null,
      description: null,
    };

    this.schemaCollection.push({
      index: 0,
      name: "EditableScientificDataset",
      schema,
      uischema,
      defaults,
    });

    this.selectedSchema = 0;
    this.updateData();

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
      const s3Info = await response.json();

      const bucket = s3Info.bucket;
      const prefix = s3Info.prefix;

      const key = `${prefix}hs_user_meta.json`;

      console.log(`Fetching metadata from S3: ${bucket}/${key}`);
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const bodyContents = await result.Body?.transformToString();

      try {
        const parsed = JSON.parse(bodyContents || "");
        this.data = parsed;
        console.log(`Form data loaded from ${bucket}/${key}`);
      } catch (error) {
        console.warn("JSON parse failed, loading defaults:", error);
        this.data = { ...this.defaults };
      }

      try {
        const initialStructure = await await this.readRootFolder(
          bucket,
          `${resourceId}/data/contents/`,
        );
        // @ts-expect-error The key property is generated when the component is initialized
        // TODO: this component should have a load function instead of populating the `children` object directly
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
      this.data = { ...this.defaults };
      Notifications.toast({
        title: "Error",
        message: "Failed to load metadata from S3.",
        type: "error",
      });
    }
  }

  get schema(): SchemaDefinition | undefined {
    return this.schemaCollection[this.selectedSchema]?.schema;
  }

  get uischema(): any | null {
    return this.schemaCollection[this.selectedSchema]?.uischema;
  }

  get defaults(): Record<string, any> {
    return this.schemaCollection[this.selectedSchema]?.defaults || {};
  }

  updateData() {
    this.data = { ...this.data, ...this.defaults };
  }

  @Watch("errors")
  onErrorsChange(newErrors: FormError[]) {
    if (newErrors.length === 0) {
      this.isValid = true;
    }
  }

  onUpdateErrors(errors: FormError[]) {
    this.errors = errors;
  }

  sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };
    if (sanitized.name) {
      sanitized.name = sanitized.name.replace(/\t/g, " ").trim();
    }
    if (sanitized.description) {
      sanitized.description = sanitized.description.replace(/\t/g, " ").trim();
    }
    return sanitized;
  }

  async submit() {
    console.log("Submitting data:", this.data, "isValid:", this.isValid);
    try {
      // Use resourceId from prop or fallback to example
      const resourceId = this.resourceId;
      const bucket = "sblack";
      const key = `${resourceId}/data/contents/hs_user_meta.json`;

      const content = JSON.stringify(
        { name: this.data.name, description: this.data.description },
        null,
        2,
      );
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: "application/json",
      });
      await this.s3.send(command);

      Notifications.toast({
        title: "Success",
        message: "Metadata uploaded to S3 successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error uploading to S3:", error);
      Notifications.toast({
        title: "Error",
        message: `Failed to upload metadata to S3. Details: ${error.message}`,
        type: "error",
      });
    }
  }

  async readRootFolder(
    bucket: string,
    path: string,
  ): Promise<Partial<IFile | IFolder>[]> {
    return this._readFolderRecursive(bucket, path);
  }

  private async _readFolderRecursive(
    bucket: string,
    path: string,
  ): Promise<Partial<IFile | IFolder>[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: path,
        Delimiter: "/",
      });
      const s3Response = await this.s3.send(command);

      let files: Partial<IFile>[] = [];
      let folders: Partial<IFolder>[] = [];

      // FILES
      if (s3Response.Contents) {
        files = s3Response.Contents.map((f: _Object, _index: number) => {
          return {
            name: f.Key?.replace(path, ""),
            isUploaded: true,
            file: null,
            uploadedSize: f.Size,
          };
        });
      }

      // FOLDERS
      if (s3Response.CommonPrefixes) {
        folders = s3Response.CommonPrefixes.map(
          (p: CommonPrefix, _index: number) => {
            const folderKey = p.Prefix;
            const name = folderKey?.replace(path, "").replace(/\/$/, "");
            return {
              name: name,
              children: [],
              isUploaded: true,
            };
          },
        );
      }

      if (folders.length) {
        const readSubfolderPromises: Promise<Partial<IFile | IFolder>[]>[] =
          folders.map((f) => {
            return this._readFolderRecursive(bucket, `${path}${f.name}/`);
          });
        const responses = await Promise.all(readSubfolderPromises);

        folders.forEach((f, i) => {
          // @ts-expect-error Doesn't matter because we just need the initial structure to load the component. The keys will be generated then.
          f.children = responses[i] || [];
        });
      }

      return [...folders, ...files];
    } catch (e: any) {
      console.log(e);
    }

    return [];
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

    const bucket = "sblack";
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
        return that.s3.send(
          new PutObjectCommand({
            Bucket: bucket,
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
          await that.s3.send(
            new PutObjectCommand({
              Bucket: bucket,
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
        // @ts-expect-error TODO: typing
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

  async downloadFile(key: string) {
    const bucket = "sblack";
    try {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      const blob = await result.Body?.transformToByteArray();
      if (blob) {
        const url = window.URL.createObjectURL(new Blob([blob]));
        const a = document.createElement("a");
        a.href = url;
        a.download = key.split("/").pop() || "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        Notifications.toast({
          title: "Success",
          message: "File downloaded successfully!",
          type: "success",
        });
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      Notifications.toast({
        title: "Error",
        message: `Failed to download file: ${error.message}`,
        type: "error",
      });
    }
  }

  async deleteFileOrFolder(item: IFile | IFolder): Promise<boolean> {
    const path = this.fileExplorer.getPathString(item);
    const isFolder = Object.prototype.hasOwnProperty.call(item, "children");
    const bucket = "sblack";
    const basePrefix = `${this.resourceId}/data/contents/`;
    try {
      if (isFolder) {
        let continuationToken: string | undefined;
        const objectsToDelete: { Key: string }[] = [];

        do {
          const listCommand = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: path,
            ContinuationToken: continuationToken,
          });
          const listResponse = await this.s3.send(listCommand);

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
            await this.s3.send(
              new DeleteObjectsCommand({
                Bucket: bucket,
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
          Bucket: bucket,
          Prefix: `${basePrefix}${path}`,
        });
        const verifyResponse = await this.s3.send(verifyCommand);
        if (verifyResponse.Contents && verifyResponse.Contents.length > 0) {
          console.warn(
            `Objects still exist after deletion for ${item.key}:`,
            verifyResponse.Contents.map((obj) => obj.Key),
          );
        } else {
          console.log(`Verified: No objects remain under ${item.key}`);
        }

        const listParentCommand = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `${this.resourceId}/data/contents/`,
          Delimiter: "/",
        });
        const parentResponse = await this.s3.send(listParentCommand);
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
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: [{ Key: `${basePrefix}${path}` }] }, // d7b526e24f7e449098b428ae9363f514/data/contents/vite.config.ts
          }),
        );
        console.log(`Deleted file: ${basePrefix}${path}`);
        return true;
      }

      Notifications.toast({
        title: "Success",
        message: `${isFolder ? "Folder" : "File"} deleted successfully!`,
        type: "success",
      });
    } catch (error: any) {
      console.error(`Error deleting ${isFolder ? "folder" : "file"}:`, error);
      Notifications.toast({
        title: "Error",
        message: `Failed to delete ${isFolder ? "folder" : "file"}: ${error.message}`,
        type: "error",
      });
      return false;
    }

    return false;
  }
}

App.__decorators__ = [
  (options: any) => {
    options.props = options.props || {};
    options.props.resourceId = {
      type: String,
      required: false,
    };
  },
];

export default toNative(App);
</script>

<style lang="scss" scoped>
pre {
  white-space: pre-wrap;
}
</style>
