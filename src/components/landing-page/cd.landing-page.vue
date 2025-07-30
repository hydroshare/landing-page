<template>
  <v-app class="bg-grey-lighten-4">
    <v-container>
      <div class="text-h5 text-center">HS Landing Page</div>

      <v-card class="my-5">
        <v-card-title class="d-flex justify-space-between align-center flex-column flex-md-row">
          <span>CzForm</span>
          <v-select v-if="selectedSchema >= 0" class="my-2" label="Schema" :items="schemaCollection"
            v-model="selectedSchema" @update:model-value="updateData" item-value="index" item-title="name"
            max-width="200px" variant="outlined" hide-details density="compact"></v-select>
        </v-card-title>

        <v-divider />
        <v-card-text class="d-flex">
          <v-checkbox label="ReadOnly" v-model="config.isReadOnly" class="mr-4" hide-details />
          <v-checkbox label="View mode" v-model="config.isViewMode" class="mr-4" hide-details />
          <v-checkbox label="Disabled" v-model="config.isDisabled" class="mr-4" hide-details />
        </v-card-text>

        <v-divider />
        <v-card-text>
          <cz-form :schema="schema" :uischema="uischema" v-model="data" :errors.sync="errors"
            @update:errors="onUpdateErrors" :isValid.sync="isValid" :config="config" ref="form" />
        </v-card-text>

        <v-divider />
        <v-card-text>
          <v-expansion-panels :model-value="0">
            <v-expansion-panel>
              <v-expansion-panel-title class="bg-grey-lighten-4">
                <div class="text-overline">Form Data</div>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <pre>{{ sanitizeData(data) }}</pre>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>

        <v-divider />
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-menu open-on-hover bottom left offset-y transition="fade">
            <template #activator="{ props }">
              <div v-bind="props" class="d-flex form-controls flex-column flex-sm-row">
                <v-badge :model-value="!isValid" bordered color="error" icon="mdi-exclamation-thick" overlap>
                  <v-btn color="primary" depressed @click="submit"
                    :disabled="config.isReadOnly || config.isViewMode || config.isDisabled || !isValid">
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

      <!-- File Browser Section -->
      <v-card class="my-5">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>File Browser - {{ currentPath || 'contents' }}</span>
          <div>
            <v-btn color="primary" variant="outlined" @click="$refs.fileInput.click()"
              :disabled="config.isReadOnly || config.isDisabled">
              Upload Files
            </v-btn>
            <v-btn color="primary" variant="outlined" @click="$refs.folderInput.click()"
              :disabled="config.isReadOnly || config.isDisabled" class="ml-2">
              Upload Folder
            </v-btn>
            <input ref="fileInput" type="file" multiple style="display: none" @change="handleFileUpload" />
            <input ref="folderInput" type="file" multiple webkitdirectory style="display: none"
              @change="handleFileUpload" />
          </div>
        </v-card-title>

        <v-divider />
        <v-card-text>
          <v-btn v-if="currentPath" color="secondary" variant="text" @click="navigateUp">
            <v-icon left>mdi-arrow-up</v-icon>Up
          </v-btn>
          <v-data-table :headers="fileHeaders" :items="fileList" :loading="isLoadingFiles" class="elevation-1"
            hide-default-footer :items-per-page="-1">
            <template v-slot:item="{ item }">
              <tr>
                <td>
                  <v-icon v-if="item.isFolder" left>mdi-folder</v-icon>
                  <a v-if="item.isFolder" href="#" @click.prevent="navigateFolder(item.key)">{{ item.name }}</a>
                  <span v-else>{{ item.name }}</span>
                </td>
                <td>{{ formatSize(item.size) }}</td>
                <td>{{ formatDate(item.lastModified) }}</td>
                <td>
                  <v-btn v-if="!item.isFolder" icon color="primary" @click="downloadFile(item.key)"
                    :disabled="config.isReadOnly || config.isDisabled">
                    <v-icon>mdi-download</v-icon>
                  </v-btn>
                  <v-btn icon color="error" @click="deleteItem(item)"
                    :disabled="config.isReadOnly || config.isDisabled">
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-container>
    <cz-notifications />
  </v-app>
</template>

<script lang="ts">
import { Component, Vue, toNative, Ref, Watch } from 'vue-facing-decorator';
import { CzForm, CzNotifications, Notifications } from '@cznethub/cznet-vue-core';
import { Config } from '@/types';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { stringify } from '@/utils';

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
  components: { CzForm, CzNotifications },
  name: 'App',
})
class App extends Vue {
  // Add prop for resourceId
  resourceId!: string;

  @Ref('form') form!: InstanceType<typeof CzForm>;
  @Ref('fileInput') fileInput!: HTMLInputElement;
  @Ref('folderInput') folderInput!: HTMLInputElement;

  isValid: boolean = false;
  errors: FormError[] = [];
  data: Record<string, any> = {};
  stringify = stringify;

  selectedSchema: number = -1;
  schemaCollection: SchemaCollectionItem[] = [];

  accessKey = localStorage.getItem('s3AccessKey') || '';
  secretKey = localStorage.getItem('s3SecretKey') || '';

  fileList: FileItem[] = [];
  isLoadingFiles: boolean = false;
  currentPath: string = '';
  

  fileHeaders = [
    { title: 'Name', key: 'name' },
    { title: 'Size', key: 'size' },
    { title: 'Last Modified', key: 'lastModified' },
    { title: 'Actions', key: 'actions', sortable: false },
  ];

  config: Config = {
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
        density: 'compact',
        variant: 'outlined',
        'persistent-hint': true,
        'hide-details': false,
      },
    },
    isViewMode: false,
    isReadOnly: false,
    isDisabled: false,
  };



  formatSize(size: number): string {
    if (!size) return '-';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  formatDate(date: Date): string {
    return date ? date.toLocaleString() : '-';
  }

  async created() {
    // Get resourceId from route params if not passed as prop
    if (!this.resourceId && this.$route && this.$route.params && this.$route.params.resourceId) {
      this.resourceId = this.$route.params.resourceId;
    }

    // notify if the resourceId is not set
    if (!this.resourceId) {
      alert("No resourceId provided. Using example resourceId: d7b526e24f7e449098b428ae9363f514.");
      this.resourceId = 'd7b526e24f7e449098b428ae9363f514';
    }

    // https://cuahsi.atlassian.net/browse/CAM-769
    // TODO: for now we store access and secret keys in localStorage
    // Replace when we update to Pinia

    if (!this.accessKey || !this.secretKey) {
      this.accessKey = prompt('Enter your S3 Access Key:') || '';
      this.secretKey = prompt('Enter your S3 Secret Key:') || '';

      if (this.accessKey && this.secretKey) {
        localStorage.setItem('s3AccessKey', this.accessKey);
        localStorage.setItem('s3SecretKey', this.secretKey);
      } else {
        alert('Access key and secret key are required to proceed.');
        return;
      }
    }

    const schema: SchemaDefinition = await import(
      /* @vite-ignore */
      `@/schemas/hydroshare/schema.json`
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
      name: 'EditableScientificDataset',
      schema,
      uischema,
      defaults,
    });

    this.selectedSchema = 0;
    this.updateData();

    try {
      const s3 = new S3Client({
        region: 'us-central-2',
        endpoint: 'https://s3.beta.hydroshare.org',
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
        },
      });

      // Use resourceId from prop or fallback to example
      const resourceId = this.resourceId;
      const response = await fetch(`https://beta.hydroshare.org/hsapi/resource/s3/${resourceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const s3Info = await response.json();

      const bucket = s3Info.bucket;
      const prefix = s3Info.prefix;

      const key = `${prefix}hs_user_meta.json`;

      console.log(`Fetching metadata from S3: ${bucket}/${key}`);
      const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bodyContents = await result.Body?.transformToString();

      try {
        const parsed = JSON.parse(bodyContents || '');
        this.data = parsed;
        console.log(`Form data loaded from ${bucket}/${key}`);
      } catch (error) {
        console.warn('JSON parse failed, loading defaults:', error);
        this.data = { ...this.defaults };
      }

      await this.loadFileList(bucket, `${resourceId}/data/contents/`);
    } catch (error) {
      console.error('S3 fetch failed:', error);
      this.data = { ...this.defaults };
      Notifications.toast({
        title: 'Error',
        message: 'Failed to load metadata from S3.',
        type: 'error',
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

  @Watch('errors')
  onErrorsChange(newErrors: FormError[]) {
    console.log('Errors changed:', newErrors);
    if (newErrors.length === 0) {
      this.isValid = true;
    }
  }

  onUpdateErrors(errors: FormError[]) {
    this.errors = errors;
    console.log('onUpdateErrors called with:', errors);
  }

  sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };
    if (sanitized.name) {
      sanitized.name = sanitized.name.replace(/\t/g, ' ').trim();
    }
    if (sanitized.description) {
      sanitized.description = sanitized.description.replace(/\t/g, ' ').trim();
    }
    return sanitized;
  }

  async submit() {
    console.log('Submitting data:', this.data, 'isValid:', this.isValid);
    try {
      const s3 = new S3Client({
        region: 'us-central-2',
        endpoint: 'https://s3.beta.hydroshare.org',
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
        },
      });

      // Use resourceId from prop or fallback to example
      const resourceId = this.resourceId;
      const bucket = 'sblack';
      const key = `${resourceId}/data/contents/hs_user_meta.json`;

      const content = JSON.stringify({ name: this.data.name, description: this.data.description }, null, 2);
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: 'application/json',
      });
      await s3.send(command);

      Notifications.toast({
        title: 'Success',
        message: 'Metadata uploaded to S3 successfully!',
        type: 'success',
      });
    } catch (error) {
      console.error('Error uploading to S3:', error);
      Notifications.toast({
        title: 'Error',
        message: `Failed to upload metadata to S3. Details: ${error.message}`,
        type: 'error',
      });
    }
  }

  async loadFileList(bucket: string, prefix: string) {
    this.isLoadingFiles = true;
    this.fileList = [];
    try {
      // Fetch from backend API
      const apiResponse = await fetch(`https://beta.hydroshare.org/hsapi/resource/s3/${this.resourceId}?prefix=${encodeURIComponent(prefix)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const s3Info = await apiResponse.json();
      console.log('Backend API response:', s3Info);

      const files: FileItem[] = [];

      if (s3Info.files) {
        s3Info.files.forEach((file: { name: string, size: number, lastModified: string }, index: number) => {
          files.push({
            key: `${prefix}${file.name}`,
            name: file.name,
            size: s3Info.file_sizes ? s3Info.file_sizes[index] : file.size,
            lastModified: new Date(file.lastModified || Date.now()),
            isFolder: false,
          });
        });
      }

      // Fallback to direct S3 listing if API response is incomplete
      if (!s3Info.directories && !s3Info.files) {
        console.warn('API response incomplete, falling back to S3 ListObjectsV2');
        const s3 = new S3Client({
          region: 'us-central-2',
          endpoint: 'https://s3.beta.hydroshare.org',
          forcePathStyle: true,
          credentials: {
            accessKeyId: this.accessKey,
            secretAccessKey: this.secretKey,
          },
        });

        const command = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: '/',
        });
        const s3Response = await s3.send(command);

        if (s3Response.CommonPrefixes) {
          for (const prefixItem of s3Response.CommonPrefixes) {
            const folderKey = prefixItem.Prefix;
            if (!folderKey) continue;

            try {
              const checkCommand = new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: folderKey,
              });
              const checkResult = await s3.send(checkCommand);

              const hasFiles =
                (checkResult.Contents && checkResult.Contents.length > 0) ||
                (checkResult.CommonPrefixes && checkResult.CommonPrefixes.length > 0);

              if (!hasFiles) {
                console.log(`Skipping empty folder from listing: ${folderKey}`);
                continue;
              }

              const name = folderKey.replace(prefix, '').replace(/\/$/, '');
              files.push({
                key: folderKey,
                name,
                size: 0,
                lastModified: new Date(),
                isFolder: true,
              });
            } catch (err) {
              console.warn(`Failed to verify folder contents for ${folderKey}:`, err);
            }
          }
        }


        if (s3Response.Contents) {
          s3Response.Contents.forEach((item) => {
            if (item.Key && item.Key !== prefix && !item.Key.endsWith('/')) {
              files.push({
                key: item.Key,
                name: item.Key.replace(prefix, ''),
                size: item.Size || 0,
                lastModified: item.LastModified || new Date(),
                isFolder: false,
              });
            }
          });
        }
      }

      this.fileList = files;
      console.log('Loaded file list:', files.map(item => ({ name: item.name, key: item.key, isFolder: item.isFolder })));
      Notifications.toast({
        title: 'Success',
        message: 'File list loaded successfully!',
        type: 'success',
      });
    } catch (error) {
      console.error('Error listing files:', error);
      Notifications.toast({
        title: 'Error',
        message: `Failed to load file list: ${error.message}`,
        type: 'error',
      });
    } finally {
      this.isLoadingFiles = false;
    }
  }

  async handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const bucket = 'sblack';
    const basePrefix = `${this.resourceId}/data/contents/${this.currentPath}`;

    try {
      const s3 = new S3Client({
        region: 'us-central-2',
        endpoint: 'https://s3.beta.hydroshare.org',
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
        },
      });

      const folderPaths = new Set<string>();

      if (input === this.folderInput) {
        if (!input.files || input.files.length === 0) {
          const folderName = prompt('Enter folder name to create (e.g., "NewFolder"):');
          if (folderName) {
            const sanitizedFolderName = folderName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
            if (sanitizedFolderName) {
              const folderPath = `${basePrefix}${sanitizedFolderName}/`;
              folderPaths.add(folderPath);
              console.log(`Added empty folder path for upload: ${folderPath}`);
            } else {
              throw new Error('Invalid folder name: must contain valid characters');
            }
          } else {
            console.log('Folder upload canceled by user');
            return;
          }
        } else {
          console.log('Files selected for folder upload:', Array.from(input.files).map(f => ({ name: f.name, webkitRelativePath: f.webkitRelativePath })));
          for (const file of Array.from(input.files)) {
            const relativePath = file.webkitRelativePath || file.name;
            const pathParts = relativePath.split('/').slice(0, -1);
            let currentPath = '';
            for (const part of pathParts) {
              currentPath = currentPath ? `${currentPath}/${part}` : part;
              folderPaths.add(`${basePrefix}${currentPath}/`);
            }
          }
        }
      }

      for (const folderPath of folderPaths) {
        try {
          await s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: folderPath,
            Body: '',
            ContentType: 'application/x-directory',
          }));
          console.log(`Created empty folder ${folderPath}`);
        } catch (error) {
          console.error(`Failed to create folder marker ${folderPath}:`, error);
          throw new Error(`Failed to create folder ${folderPath}: ${error.message}`);
        }
      }

      if (input.files && input.files.length > 0) {
        for (const file of Array.from(input.files)) {
          const relativePath = file.webkitRelativePath || file.name;
          const key = `${basePrefix}${relativePath}`;
          const arrayBuffer = await file.arrayBuffer();
          try {
            await s3.send(new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: arrayBuffer,
              ContentType: file.type || 'application/octet-stream',
            }));
            console.log(`Uploaded ${file.name} to ${bucket}/${key}`);
          } catch (error) {
            console.error(`Failed to upload file ${file.name}:`, error);
            throw new Error(`Failed to upload file ${file.name}: ${error.message}`);
          }
        }
      }

      Notifications.toast({
        title: 'Success',
        message: 'Files and folders uploaded successfully!',
        type: 'success',
      });
      await this.loadFileList(bucket, `${this.resourceId}/data/contents/${this.currentPath}`);
    } catch (error) {
      console.error('Error uploading files or folders:', error);
      Notifications.toast({
        title: 'Error',
        message: `Failed to upload files or folders: ${error.message}`,
        type: 'error',
      });
    } finally {
      input.value = '';
    }
  }

  async downloadFile(key: string) {
    const bucket = 'sblack';
    try {
      const s3 = new S3Client({
        region: 'us-central-2',
        endpoint: 'https://s3.beta.hydroshare.org',
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
        },
      });

      const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const blob = await result.Body?.transformToByteArray();
      if (blob) {
        const url = window.URL.createObjectURL(new Blob([blob]));
        const a = document.createElement('a');
        a.href = url;
        a.download = key.split('/').pop() || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        Notifications.toast({
          title: 'Success',
          message: 'File downloaded successfully!',
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      Notifications.toast({
        title: 'Error',
        message: `Failed to download file: ${error.message}`,
        type: 'error',
      });
    }
  }

  async deleteItem(item: FileItem) {
    const bucket = 'sblack';
    try {
      const s3 = new S3Client({
        region: 'us-central-2',
        endpoint: 'https://s3.beta.hydroshare.org',
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
        },
      });

      if (item.isFolder) {
        let continuationToken: string | undefined;
        const objectsToDelete: { Key: string }[] = [];

        do {
          const listCommand = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: item.key,
            ContinuationToken: continuationToken,
          });
          const listResponse = await s3.send(listCommand);

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

        if (!objectsToDelete.some((obj) => obj.Key === item.key)) {
          objectsToDelete.push({ Key: item.key });
          console.log(`Added top-level folder marker: ${item.key}`);
        }

        const batchSize = 1000;
        if (objectsToDelete.length === 0) {
          console.log(`No objects found to delete for folder: ${item.key}`);
        } else {
          for (let i = 0; i < objectsToDelete.length; i += batchSize) {
            const batch = objectsToDelete.slice(i, i + batchSize);
            await s3.send(new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: batch },
            }));
            console.log(`Deleted batch of ${batch.length} objects:`, batch.map((obj) => obj.Key));
          }
        }

        

        const verifyCommand = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: item.key,
        });
        const verifyResponse = await s3.send(verifyCommand);
        if (verifyResponse.Contents && verifyResponse.Contents.length > 0) {
          console.warn(`Objects still exist after deletion for ${item.key}:`, verifyResponse.Contents.map((obj) => obj.Key));
        } else {
          console.log(`Verified: No objects remain under ${item.key}`);
        }

        const listParentCommand = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `${this.resourceId}/data/contents/${this.currentPath}`,
          Delimiter: '/',
        });
        const parentResponse = await s3.send(listParentCommand);
        if (parentResponse.CommonPrefixes && parentResponse.CommonPrefixes.some(p => p.Prefix === item.key)) {
          console.warn(`Folder ${item.key} still appears in CommonPrefixes after deletion`);
        } else {
          console.log(`Verified: ${item.key} no longer in CommonPrefixes`);
        }
      } else {
        await s3.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: [{ Key: item.key }] },
        }));
        console.log(`Deleted file: ${item.key}`);
      }

      Notifications.toast({
        title: 'Success',
        message: `${item.isFolder ? 'Folder' : 'File'} deleted successfully!`,
        type: 'success',
      });

      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.loadFileList(bucket, `${this.resourceId}/data/contents/${this.currentPath}`);
    } catch (error) {
      console.error(`Error deleting ${item.isFolder ? 'folder' : 'file'}:`, error);
      Notifications.toast({
        title: 'Error',
        message: `Failed to delete ${item.isFolder ? 'folder' : 'file'}: ${error.message}`,
        type: 'error',
      });
    }
  }

  navigateFolder(key: string) {
    const basePrefix = `${this.resourceId}/data/contents/`;
    this.currentPath = key.replace(basePrefix, '');
    this.loadFileList('sblack', key);
  }

  navigateUp() {
    const parts = this.currentPath.split('/').filter(Boolean);
    parts.pop();
    this.currentPath = parts.join('/') + (parts.length ? '/' : '');
    this.loadFileList('sblack', `${this.resourceId}/data/contents/${this.currentPath}`);
  }
}

App.__decorators__ = [
  (options: any) => {
    options.props = options.props || {};
    options.props.resourceId = {
      type: String,
      required: false,
    };
  }
];

export default toNative(App);
</script>

<style lang="scss" scoped>
pre {
  white-space: pre-wrap;
}
</style>