<template>
  <v-container>
    <template v-if="config.isViewMode">
      <div v-if="!isLoadingFiles && !fetchingMetadata" class="d-flex justify-end mb-5">
        <v-btn color="primary" prepend-icon="mdi-pen" variant="outlined" @click="config.isViewMode = false">
          Edit
        </v-btn>
      </div>
      <v-skeleton-loader v-else type="button" class="justify-end"></v-skeleton-loader>
    </template>

    <cz-file-explorer v-if="!isLoadingFiles" ref="fileExplorer" id="cz-folder-structure" v-model:valid-items="toUpload"
      :root-directory="rootDirectory" :has-folders="fileExplorerConfig.hasFolders" :is-read-only="config.isViewMode"
      :has-file-metadata="() => false" :folder-name-regex="folderNameRegex" :canDownloadItem="() => true"
      :upload="!config.isViewMode ? uploadFiles : undefined"
      :delete-file-or-folder="!config.isViewMode ? deleteFileOrFolder : undefined"
      :rename-file-or-folder="!config.isViewMode ? renameFileOrFolder : undefined" @download="onFileDownload($event)">
      <template #prepend>
        <span />
      </template>
    </cz-file-explorer>
    <v-skeleton-loader v-else type="card"></v-skeleton-loader>

    <v-skeleton-loader v-if="fetchingMetadata" type="card"></v-skeleton-loader>
    <cz-form v-else :schema="schema" :uischema="uischema" v-model="data" :errors.sync="errors"
      @update:errors="onUpdateErrors" v-model:is-valid="isValid" :config="config" ref="form" />

    <div class="d-flex" v-if="!config.isViewMode">
      <v-spacer></v-spacer>
      <v-menu :disabled="!errors.length" open-on-hover bottom left offset-y transition="fade">
        <template #activator="{ props }">
          <div v-bind="props" class="d-flex form-controls flex-column flex-sm-row">
            <v-badge :model-value="!isValid" bordered color="error" icon="mdi-exclamation-thick" overlap>
              <v-btn color="primary" variant="elevated" @click="submit"
                :disabled="config.isViewMode || !isValid || isSubmitting">
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
  </v-container>
</template>

<script lang="ts">
import { Component, Vue, toNative, Ref } from "vue-facing-decorator";
import { CzForm, CzFileExplorer, Notifications } from "@cznethub/cznet-vue-core";
import type { IFile, IFolder } from "@cznethub/cznet-vue-core/dist/types";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  CommonPrefix,
  _Object,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { stringify } from "@/utils";

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

  isValid: boolean = false;
  errors: FormError[] = [];
  data: Record<string, any> = {};
  stringify = stringify;

  selectedSchema: number = -1;
  schemaCollection: SchemaCollectionItem[] = [];

  accessKey = localStorage.getItem("s3AccessKey") || "";
  secretKey = localStorage.getItem("s3SecretKey") || "";

  isLoadingFiles: boolean = true;
  isSubmitting: boolean = false;
  currentPath: string = "";
  folderNameRegex = /^[-()\w\s]*$/;
  fetchingMetadata = false;

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

  toUpload: any[] = [];
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

    if (!this.resourceId) {
      alert(
        "No resourceId provided. Using example resourceId: d7b526e24f7e449098b428ae9363f514."
      );
      this.resourceId = "d7b526e24f7e449098b428ae9363f514";
    }

    // temporary local storage for S3 keys (will move to Pinia later)
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

    // Load schema + uischema
    /* @ts-ignore */
    const schema: SchemaDefinition = await import(
      /* @vite-ignore */ "@/schemas/hydroshare/schema.json"
    );

    const { default: uischema } = await import(
      /* @vite-ignore */ "@/schemas/hydroshare/uischema.json"
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
    this.updateMetadata();
  }

  async updateMetadata() {
    this.fetchingMetadata = true;
    try {
      const resourceId = this.resourceId;
      const response = await fetch(
        `https://beta.hydroshare.org/hsapi/resource/s3/${resourceId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      this.s3Info = await response.json();

      const key = `${this.s3Info.prefix}hs_user_meta.json`;

      console.log(`Fetching metadata from S3: ${this.s3Info.bucket}/${key}`);
      const result = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.s3Info.bucket, Key: key })
      );
      const bodyContents = await result.Body?.transformToString();

      try {
        const parsed = JSON.parse(bodyContents || "");
        this.data = parsed;
        console.log(`Form data loaded from ${this.s3Info.bucket}/${key}`);
      } catch (error) {
        console.warn("JSON parse failed, loading defaults:", error);
        this.data = { ...this.defaults };
      }

      try {
        const initialStructure = await this.readRootFolder(
          `${resourceId}/data/contents/`
        );
        // @ts-expect-error The key property is generated when the component is initialized
        this.rootDirectory.children = initialStructure;
        this.isLoadingFiles = false;
      } catch (_e) {
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
    } finally {
      this.fetchingMetadata = false;
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

  onUpdateErrors(errors: FormError[]) {
    this.errors = errors;
  }

  async submit() {
    try {
      const resourceId = this.resourceId;
      const key = `${resourceId}/data/contents/hs_user_meta.json`;

      const content = JSON.stringify(
        { name: this.data.name, description: this.data.description },
        null,
        2
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
      this.config.isViewMode = true;
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

  async readRootFolder(
    path: string,
    retries = 5
  ): Promise<Partial<IFile | IFolder>[]> {
    let attempt = 0;
    while (attempt < retries) {
      try {
        const result = await this._readFolderRecursive(path);
        if (result.length === 0 && attempt < retries - 1) {
          console.warn(`Empty folder listing for ${path}, retrying (${attempt + 1}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          attempt++;
          continue;
        }
        return result;
      } catch (error) {
        console.warn(`Error reading folder ${path}, retrying (${attempt + 1}/${retries}):`, error);
        if (attempt === retries - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempt++;
      }
    }
    return [];
  }

private async _readFolderRecursive(path: string): Promise<Partial<IFile | IFolder>[]> {
  const HIDE_EMPTY_FOLDERS = true;
  try {
    const listCmd = new ListObjectsV2Command({
      Bucket: this.s3Info.bucket,
      Prefix: path,
      Delimiter: "/",
    });
    const s3Response = await this.s3Client.send(listCmd);

    // Filter out folder markers (objects ending with "/") from files
    const files: Partial<IFile>[] = (s3Response.Contents || [])
      .filter(obj => {
        const name = (obj.Key || "").replace(path, "");
        return name !== "" && !name.endsWith("/"); // Exclude folder markers
      })
      .map(obj => ({
        name: (obj.Key || "").replace(path, ""),
        isUploaded: true,
        file: null,
        uploadedSize: obj.Size,
      }));

    let folders: Partial<IFolder>[] = [];
    if (s3Response.CommonPrefixes && s3Response.CommonPrefixes.length) {
      const folderPromises = s3Response.CommonPrefixes.map(async (p: CommonPrefix) => {
        const folderKey = p.Prefix || "";
        const name = folderKey.replace(path, "").replace(/\/$/, "");

        if (HIDE_EMPTY_FOLDERS) {
          const probe = await this.s3Client.send(new ListObjectsV2Command({
            Bucket: this.s3Info.bucket,
            Prefix: folderKey,
            MaxKeys: 2,
          }));
          const hasNonMarker = !!(probe.Contents && probe.Contents.some(o => o.Key && o.Key !== folderKey));
          if (!hasNonMarker) return null; // Skip truly empty folders
        }

        const children = await this._readFolderRecursive(`${path}${name}/`);
        return { name, children, isUploaded: true } as Partial<IFolder>;
      });

      const resolved = await Promise.all(folderPromises);
      folders = resolved.filter(Boolean) as Partial<IFolder>[];
    }

    return [...folders, ...files];
  } catch (e) {
    console.log(e);
    return [];
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

  private async _uploadFiles(itemsToUpload: (IFile | IFolder)[]): Promise<boolean[]> {
    itemsToUpload.forEach((i) => (i.isDisabled = true));
    const filesToUpload = itemsToUpload.filter((i) =>
      Object.prototype.hasOwnProperty.call(i, "file")
    ) as IFile[];
    const foldersToUpload = itemsToUpload.filter((i) =>
      Object.prototype.hasOwnProperty.call(i, "children")
    ) as IFolder[];

    const basePrefix = `${this.resourceId}/data/contents/${this.currentPath}`;

    // compute folder paths
    let folderPaths = foldersToUpload.map((f) => f.path).filter((f) => !!f) as string[];

    // unique + sort deeper first
    folderPaths = [...new Set(folderPaths)].sort(
      (a, b) => b.split("/").length - a.split("/").length
    );

    const that = this;
    let responses: boolean[] = [];
    itemsToUpload.forEach((i) => (i.isDisabled = false));

    if (folderPaths.length) {
      responses = await _createFoldersByDepth(folderPaths, 1);
    } else {
      responses = await _uploadFiles();
    }

async function _createFoldersByDepth(paths: string[], depth: number): Promise<boolean[]> {
  const depthPaths = paths.filter((p) => p.split("/").length === depth);

  const folderCreatePromises = depthPaths.map((path: string) => {
    const rootPrefix = `${that.resourceId}/data/contents/`;
    const folderKey = `${rootPrefix}${path}/`; // Ensure trailing slash for folder marker

    return that.s3Client.send(
      new PutObjectCommand({
        Bucket: that.s3Info.bucket,
        Key: folderKey,
        Body: "",
        ContentType: "application/x-directory",
      })
    );
  });

  await Promise.allSettled(folderCreatePromises);
  const remaining = paths.filter((p) => p.split("/").length > depth);

  return remaining.length ? _createFoldersByDepth(remaining, depth + 1) : _uploadFiles();
}
    async function _uploadFiles(): Promise<boolean[]> {
      const fileUploadPromises = filesToUpload.map(async (file: IFile) => {
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
            })
          );
          return true;
        } catch (_e) {
          return false;
        }
      });

      const response = await Promise.allSettled(fileUploadPromises);

      filesToUpload.forEach((f, index) => {
        if (response[index].status === "fulfilled") {
          f.isUploaded = true;
        }
      });

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

  async onFileDownload(items: (IFile | IFolder)[]) {
    try {
      for (const item of items) {
        const basePrefix = `${this.resourceId}/data/contents/`;
        const key = `${basePrefix}${item.path}`;
        const result = await this.s3Client.send(
          new GetObjectCommand({ Bucket: this.s3Info.bucket, Key: key })
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
        }
      }
      Notifications.toast({
        title: "Success",
        message: "File downloaded successfully!",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error downloading file:", error);
      Notifications.toast({
        title: "Error",
        message: `Failed to download file: ${error.message}`,
        type: "error",
      });
    }
  }

  async deleteFileOrFolder(item: IFile | IFolder): Promise<boolean> {
    let path = this.fileExplorer.getPathString(item);
    const isFolder = Object.prototype.hasOwnProperty.call(item, "children");
    if (isFolder && !path.endsWith("/")) {
      path += "/";
    }
    const basePrefix = `${this.resourceId}/data/contents/`;
    try {
      if (isFolder) {
        let continuationToken: string | undefined;
        const objectsToDelete: { Key: string }[] = [];

        do {
          const listCommand = new ListObjectsV2Command({
            Bucket: this.s3Info.bucket,
            Prefix: `${basePrefix}${path}`,
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

        // Add the folder marker key if not already included
        const folderMarkerKey = `${basePrefix}${path}`;
        if (!objectsToDelete.some((obj) => obj.Key === folderMarkerKey)) {
          objectsToDelete.push({ Key: folderMarkerKey });
          console.log(`Added top-level folder marker: ${folderMarkerKey}`);
        }

        const batchSize = 1000;
        if (objectsToDelete.length === 0) {
          console.log(`No objects found to delete for folder: ${path}`);
        } else {
          for (let i = 0; i < objectsToDelete.length; i += batchSize) {
            const batch = objectsToDelete.slice(i, i + batchSize);
            await this.s3Client.send(
              new DeleteObjectsCommand({
                Bucket: this.s3Info.bucket,
                Delete: { Objects: batch },
              })
            );
            console.log(
              `Deleted batch of ${batch.length} objects:`,
              batch.map((obj) => obj.Key)
            );
          }
        }

        // Verify deletion
        const verifyCommand = new ListObjectsV2Command({
          Bucket: this.s3Info.bucket,
          Prefix: `${basePrefix}${path}`,
        });
        const verifyResponse = await this.s3Client.send(verifyCommand);
        if (verifyResponse.Contents && verifyResponse.Contents.length > 0) {
          console.warn(
            `Objects still exist after deletion for ${path}:`,
            verifyResponse.Contents.map((obj) => obj.Key)
          );
        } else {
          console.log(`Verified: No objects remain under ${path}`);
        }

        // Check parent listing for CommonPrefixes
        const listParentCommand = new ListObjectsV2Command({
          Bucket: this.s3Info.bucket,
          Prefix: `${this.resourceId}/data/contents/`,
          Delimiter: "/",
        });
        const parentResponse = await this.s3Client.send(listParentCommand);
        if (
          parentResponse.CommonPrefixes &&
          parentResponse.CommonPrefixes.some(
            (p) => p.Prefix === `${basePrefix}${path}`
          )
        ) {
          console.warn(`Folder ${path} still appears in CommonPrefixes after deletion`);
        } else {
          console.log(`Verified: ${path} no longer in CommonPrefixes`);
        }
      } else {
        await this.s3Client.send(
          new DeleteObjectsCommand({
            Bucket: this.s3Info.bucket,
            Delete: { Objects: [{ Key: `${basePrefix}${path}` }] },
          })
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

  async renameFileOrFolder(item: IFile | IFolder, newNameOrPath: string): Promise<void> {
    const isFolder = Object.prototype.hasOwnProperty.call(item, "children");

    // --- in-scope utils ---
    const normalizeRel = (p: string) => {
      let s = (p || "").trim();
      s = s.replace(/^\/+/, "").replace(/\/{2,}/g, "/").replace(/^\.\/+/, "").replace(/\/+$/g, "");
      const parts: string[] = [];
      s.split("/").forEach(seg => { if (!seg || seg === ".") return; if (seg === "..") parts.pop(); else parts.push(seg); });
      return parts.join("/");
    };
    const asFolder = (p: string) => (p.endsWith("/") ? p : p + "/");
    const splitParentBase = (rel: string, folder: boolean) => {
      const clean = normalizeRel(folder ? rel.replace(/\/+$/, "") : rel);
      const parts = clean.split("/").filter(Boolean);
      const base = parts.pop() || "";
      const parent = parts.join("/");
      return { parent, base };
    };
    const sameRel = (a: string, b: string) =>
      normalizeRel(a.replace(/\/+$/, "")) === normalizeRel(b.replace(/\/+$/, ""));
    const encodeCopySourceKey = (key: string) => encodeURIComponent(key).replace(/%2F/g, "/");

    // --- resolve old/new relative paths ---
    let oldRel = this.fileExplorer.getPathString(item);
    if (isFolder && !oldRel.endsWith("/")) oldRel += "/";
    const { parent: oldParent, base: oldBase } = splitParentBase(oldRel, isFolder);

    const raw = (newNameOrPath || "").trim();
    const isRootExplicit = raw === "/" || raw === "";
    const hasSlash = raw.includes("/");

    let newRel: string;

    if (isRootExplicit) {
      // explicit move to root
      newRel = isFolder ? asFolder(oldBase) : oldBase;
    } else if (!hasSlash) {
      // **Key change**:
      // If no slash AND same basename AND item has a parent -> interpret as MOVE TO ROOT
      if (oldParent && raw === oldBase) {
        newRel = isFolder ? asFolder(oldBase) : oldBase; // move to root, keep name
      } else {
        // true rename: keep same parent
        newRel = oldParent ? `${oldParent}/${raw}` : raw;
        if (isFolder) newRel = asFolder(newRel);
      }
    } else {
      // path includes "/": could be "drop ON folder" or full path
      let candidate = normalizeRel(raw);
      // If it ends with "/" or a folder marker exists, move INTO it and keep basename
      let treatAsFolder = raw.endsWith("/");
      if (!treatAsFolder) {
        try {
          await this.s3Client.send(new HeadObjectCommand({
            Bucket: this.s3Info.bucket,
            Key: `${this.s3Info.prefix}${asFolder(candidate)}`,
          }));
          treatAsFolder = true;
        } catch { /* not a marker */ }
      }
      newRel = treatAsFolder
        ? (isFolder ? asFolder(`${candidate}/${oldBase}`) : `${candidate}/${oldBase}`)
        : (isFolder ? asFolder(candidate) : candidate);
    }

    const oldKey = `${this.s3Info.prefix}${oldRel}`;
    const newKey = `${this.s3Info.prefix}${newRel}`;

    // self / no-op guard
    if (sameRel(oldRel, newRel)) {
      Notifications.toast({ title: "No change", message: "Item is already there.", type: "info" });
      return;
    }

    // --- do the move/rename safely ---
    try {
      // ensure destination parent for files
      if (!isFolder) {
        const { parent: destParent } = splitParentBase(newRel, false);
        if (destParent) {
          const destFolderKey = `${this.s3Info.prefix}${asFolder(destParent)}`;
          try {
            await this.s3Client.send(new HeadObjectCommand({ Bucket: this.s3Info.bucket, Key: destFolderKey }));
          } catch (err: any) {
            if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
              await this.s3Client.send(new PutObjectCommand({
                Bucket: this.s3Info.bucket, Key: destFolderKey, Body: "", ContentType: "application/x-directory",
              }));
            } else { throw err; }
          }
        }
      }

      // copy (skip copy-to-self; encode CopySource)
      if (isFolder) {
        let token: string | undefined;
        const jobs: Promise<any>[] = [];
        do {
          const list = await this.s3Client.send(new ListObjectsV2Command({
            Bucket: this.s3Info.bucket, Prefix: oldKey, ContinuationToken: token,
          }));
          (list.Contents || []).forEach(obj => {
            if (!obj.Key) return;
            const rel = obj.Key.replace(oldKey, "");
            const dest = `${newKey}${rel}`;
            if (dest === obj.Key) return; // prevent illegal self-copy
            jobs.push(this.s3Client.send(new CopyObjectCommand({
              Bucket: this.s3Info.bucket,
              CopySource: `${this.s3Info.bucket}/${encodeCopySourceKey(obj.Key)}`,
              Key: dest,
            })));
          });
          token = list.NextContinuationToken;
        } while (token);
        await Promise.allSettled(jobs);
      } else {
        if (oldKey !== newKey) {
          await this.s3Client.send(new CopyObjectCommand({
            Bucket: this.s3Info.bucket,
            CopySource: `${this.s3Info.bucket}/${encodeCopySourceKey(oldKey)}`,
            Key: newKey,
          }));
        }
      }

      // verify destination
      if (isFolder) {
        const verify = await this.s3Client.send(new ListObjectsV2Command({
          Bucket: this.s3Info.bucket, Prefix: newKey, MaxKeys: 1,
        }));
        if (!verify.Contents || verify.Contents.length === 0) throw new Error(`Verification failed: nothing at ${newKey}`);
      } else {
        await this.s3Client.send(new HeadObjectCommand({ Bucket: this.s3Info.bucket, Key: newKey }));
      }

      // delete originals (and clean ancestor markers)
      const cleanupEmptyAncestors = async (startParentRel: string) => {
        let cur = startParentRel;
        while (cur) {
          const markerKey = `${this.s3Info.prefix}${asFolder(cur)}`;
          const probe = await this.s3Client.send(new ListObjectsV2Command({
            Bucket: this.s3Info.bucket, Prefix: markerKey, MaxKeys: 2
          }));
          const hasNonMarker = !!(probe.Contents && probe.Contents.some(o => o.Key && o.Key !== markerKey));
          if (!hasNonMarker) {
            try { await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.s3Info.bucket, Key: markerKey })); }
            catch { }
            cur = cur.split("/").slice(0, -1).join("/");
          } else break;
        }
      };

      if (isFolder) {
        let token: string | undefined;
        do {
          const list = await this.s3Client.send(new ListObjectsV2Command({
            Bucket: this.s3Info.bucket, Prefix: oldKey, ContinuationToken: token,
          }));
          const objs = (list.Contents || []).map(o => ({ Key: o.Key! }))
            .filter(o => !o.Key!.startsWith(newKey));
          if (objs.length) {
            await this.s3Client.send(new DeleteObjectsCommand({
              Bucket: this.s3Info.bucket, Delete: { Objects: objs },
            }));
          }
          token = list.NextContinuationToken;
        } while (token);
        try { await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.s3Info.bucket, Key: oldKey })); } catch { }
        if (oldParent) await cleanupEmptyAncestors(oldParent);
      } else {
        await this.s3Client.send(new DeleteObjectsCommand({
          Bucket: this.s3Info.bucket, Delete: { Objects: [{ Key: oldKey }] },
        }));
        if (oldParent) await cleanupEmptyAncestors(oldParent);
      }

      // refresh
      const root = `${this.resourceId}/data/contents/`;
      this.rootDirectory.children = await this.readRootFolder(root);

      Notifications.toast({
        title: "Success",
        message: `${hasSlash || isRootExplicit ? "Moved" : "Renamed"} ${isFolder ? "folder" : "file"} successfully!`,
        type: "success",
      });
    } catch (error: any) {
      console.error("Rename/move failed:", error);
      Notifications.toast({
        title: "Error",
        message: `Failed to ${hasSlash || isRootExplicit ? "move" : "rename"} ${isFolder ? "folder" : "file"}: ${error?.message || error}`,
        type: "error",
      });
    }
  }


}
export default toNative(App);
</script>

<style lang="scss" scoped></style>
