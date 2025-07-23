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
    </v-container>
    <cz-notifications />
  </v-app>
</template>

<script lang="ts">
import { Component, Vue, toNative, Ref, Watch } from 'vue-facing-decorator';
import { CzForm, CzNotifications, Notifications } from '@cznethub/cznet-vue-core';
import { Config } from '@/types';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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

@Component({
  components: { CzForm, CzNotifications },
  name: 'App',
})
class App extends Vue {
  // Add prop for resourceId
  resourceId!: string;

  @Ref('form') form!: InstanceType<typeof CzForm>;

  isValid: boolean = false;
  errors: FormError[] = [];
  data: Record<string, any> = {};
  stringify = stringify;

  selectedSchema: number = -1;
  schemaCollection: SchemaCollectionItem[] = [];

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

  async created() {
    // Get resourceId from route params if not passed as prop
    if (!this.resourceId && this.$route && this.$route.params && this.$route.params.resourceId) {
      this.resourceId = this.$route.params.resourceId;
    }

    // notify if the resourceId is not set
    if (!this.resourceId) {
      alert("No resourceId provided. Using example resourceId: d7b526e24f7e449098b428ae9363f514.");
      this.resourceId = 'd7b526e24f7e449098b428ae9363f514'; // Fallback example resourceId
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
      description: null
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
          accessKeyId: 'GET_ACCESS_KEY',
          secretAccessKey: 'GET_SECRET_KEY',
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
          accessKeyId: 'GET_ACCESS_KEY',
          secretAccessKey: 'GET_SECRET_KEY',
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
}

// Add prop decorator for resourceId
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