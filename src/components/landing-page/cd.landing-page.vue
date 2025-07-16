<template>
  <v-app class="bg-grey-lighten-4">
    <v-container>
      <div class="text-h5 text-center">HS Landing Page</div>

      <v-card class="my-5">
        <v-card-title class="d-flex justify-space-between align-center flex-column flex-md-row">
          <span>CzForm</span>

          <v-select v-if="selectedSchema >= 0" class="my-2" label="Schema" :items="schemaCollection"
            v-model="selectedSchema" @update:model-value="data = defaults" item-value="index" item-title="name"
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
                <pre>{{ data }}</pre>
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
                  <v-btn color="primary" depressed @click="submit" :disabled="config.isReadOnly || config.isViewMode || !isValid
                    ">
                    Submit
                  </v-btn>
                </v-badge>
              </div>
            </template>

            <v-card>
              <v-card-text>
                <ul class="text-subtitle-1 ml-4">
                  <li v-for="(error, index) of errors" :key="index">
                    <b>{{ error.title }}</b>
                    {{ error.message }}.
                  </li>
                </ul>
              </v-card-text>
            </v-card>
          </v-menu>
        </v-card-actions>
      </v-card>
    </v-container>
    <cz-notifications />
  </v-app>
  <link href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900" rel="stylesheet" />
</template>

<script lang="ts">
import { Component, Vue, toNative, Ref } from 'vue-facing-decorator';
import { CzNotifications, Notifications, CzForm, CzFileExplorer } from "@cznethub/cznet-vue-core";
import { Config, IFolder, IFile } from '@/types';
import { S3Client } from "@aws-sdk/client-s3"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { stringify } from '@/utils';

const schemaPaths = [
  { name: 'HydroShare' },
];

@Component({
  components: { CzNotifications, CzFileExplorer, CzForm },
  name: 'App',
})
class App extends Vue {
  @Ref('form') form!: InstanceType<typeof CzForm>;

  isValid = false;
  errors: { title: string; message: string }[] = [];
  data = {};
  stringify = stringify;
  selectedMetadata: any = false;
  validItems = [];
  schemaCollection: any = [];
  selectedSchema: number = -1;
  fileNameRegex = /^[^\\/:*?"<>|]+$/;
  folderNameRegex = /^[^\\/:*?"<>|]+$/;

  config: Config = {
    restrict: true,
    trim: false,
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

  fileExplorerConfig = {
    isReadOnly: false,
    hasFolders: true,
  };

  async created() {
    for (let i = 0; i < schemaPaths.length; i++) {
      const path = schemaPaths[i].path;
      const name = schemaPaths[i].name;
      const { default: schema } = await import(
        /* @vite-ignore */ `@/schemas/hydroshare/schema.json`
      );
      const { default: uischema } = await import(
        /* @vite-ignore */
        `@/schemas/hydroshare/uischema.json`
      );
      const { default: defaults } = await import(
        /* @vite-ignore */
        `@/schemas/hydroshare/defaults.json`
      );

      this.schemaCollection.push({
        index: i,
        name,
        schema,
        uischema,
        defaults,
      });
    }
    this.selectedSchema = 0; // Initial repository schema to render
    this.data = { ...this.data, ...this.defaults };

    // Here is an example of how to use the AWS S3 SDK to fetch a file.
    try {
      const bareBonesS3 = new S3Client({
        region: 'us-central-2',
        // TODO: we will have to target HS beta for this due to pending issue with micro-auth
        endpoint: 'https://s3.hydroshare.org',
        forcePathStyle: true, // needed with minio...
        credentials: {
          // Client will get this with a POST request to https://www.hydroshare.org/hsapi/user/service/accounts/s3/
          // TODO: https://cuahsi.atlassian.net/browse/CAM-769 build a simple component to get this info from the client
          accessKeyId: 'GET_THIS_FROM_HS',
          secretAccessKey: 'GET_THIS_FROM_HS',
        },
      });
      const bucket = 'sblack'; // This is the bucket name, you can change it as needed.
      const key = 'd7b526e24f7e449098b428ae9363f514/data/contents/readme.txt'; // This is the key for the file you want to fetch.
      const result = await bareBonesS3.send(new GetObjectCommand({
        // for a given ID, you can get this using a GET request to https://www.hydroshare.org/hsapi/resource/{ID}/s3
        // it will give you the bucket and key to use here.
        Bucket: bucket,
        // hs_user_meta.json is written to /data/contents, so this will not be impacted...
        // Key: 'd7b526e24f7e449098b428ae9363f514/data/contents/user_metadata.json',
        Key: key,
      }));

      const bodyContents = await result.Body?.transformToString();
      alert(`Example file contents read from ${bucket}/${key}:\n\n${bodyContents}`);
    } catch (error) {
      alert(`Error fetching example s3 file: ${error}`);
    }
  }

  get schema() {
    return this.schemaCollection[this.selectedSchema]?.schema;
  }

  get uischema() {
    return this.schemaCollection[this.selectedSchema]?.uischema;
  }

  get defaults() {
    return this.schemaCollection[this.selectedSchema]?.defaults;
  }

  openDialog() {
    Notifications.openDialog({
      title: `Dialog Title`,
      content: 'Some message for the dialog',
      onConfirm: () => { },
    });
  }

  onShowMetadata(item: any) {
    this.selectedMetadata = item;
  }

  toast() {
    Notifications.toast({
      title: 'Important Note: drink water.',
      message: `Stay hydrated.`,
      type: 'info',
      location: 'top center',
      isInfinite: true,
      hasDoNotShowAgain: true,
      onDismissed: (doNotShowAgain: boolean) => {
        // Use in your app to not show the notification again
        console.log(doNotShowAgain);
      },
    });
  }

  submit() {
    console.log(this.data);
  }

  onUpdateErrors(errors: { title: string; message: string }[]) {
    this.errors = errors;
  }

  // =======================
  // MOCK FUNCTIONS
  // =======================

  async uploadMock(_items: (IFile | IFolder)[]) {
    return new Promise((_resolve, _reject) => {
      setTimeout(() => {
        _resolve(_items.map(_i => true));
        // _reject(_items.map(_i => false));
      }, 500);
    });
  }

  async deleteFileOrFolderMock(_item: IFile | IFolder) {
    return new Promise((_resolve, _reject) => {
      setTimeout(() => {
        _resolve(true);
        // _reject(false);
      }, 500);
    });
  }

  async renameFileOrFolderMock(_item: IFile | IFolder) {
    return new Promise((_resolve, _reject) => {
      setTimeout(() => {
        _resolve(true);
        // _reject(false);
      }, 500);
    });
  }
}

export default toNative(App);
</script>

<style lang="scss" scoped>
pre {
  white-space: pre-wrap;
}
</style>