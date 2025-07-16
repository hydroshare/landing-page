<script lang="ts">
import { Component, Vue, toNative, Ref } from 'vue-facing-decorator';
import { CzNotifications, Notifications, CzForm } from "@cznethub/cznet-vue-core";
import { Config, IFolder, IFile } from '@/types';
import { S3Client } from "@aws-sdk/client-s3"
import { GetObjectCommand } from "@aws-sdk/client-s3"

const schemaPaths = [
  { name: 'HydroShare', path: '../../schemas/hydroshare' },
];

@Component({
  components: { CzNotifications, CzForm },
  name: 'App',
})
class CdLandingPage extends Vue {
  @Ref('form') form!: InstanceType<typeof CzForm>;

  isValid = false;
  errors: { title: string; message: string }[] = [];
  data = {};
  selectedMetadata: any = false;
  validItems = [];
  schemaCollection: any = [];
  selectedSchema: number = -1;

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
      alert(`File contents read from ${bucket}/${key}:\n\n${bodyContents}`);
    } catch (error) {
      alert(`Error fetching file: ${error}`);
    }

    for (let i = 0; i < schemaPaths.length; i++) {
      const path = schemaPaths[i].path;
      const name = schemaPaths[i].name;
      const { default: schema } = await import(
        /* @vite-ignore */ `${path}/schema.json`
      );
      const { default: uischema } = await import(
        /* @vite-ignore */
        `${path}/uischema.json`
      );
      const { default: defaults } = await import(
        /* @vite-ignore */
        `${path}/defaults.json`
      );

      this.schemaCollection.push({
        index: i,
        name,
        schema,
        uischema,
        defaults,
      });
    }
    this.selectedSchema = 0;
    this.data = { ...this.data, ...this.defaults };
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

  async uploadMock(_items: (IFile | IFolder)[]) {
    return new Promise((_resolve, _reject) => {
      setTimeout(() => {
        _resolve(_items.map(_i => true));
      }, 500);
    });
  }

  async deleteFileOrFolderMock(_item: IFile | IFolder) {
    return new Promise((_resolve, _reject) => {
      setTimeout(() => {
        _resolve(true);
      }, 500);
    });
  }

  async renameFileOrFolderMock(_item: IFile | IFolder) {
    return new Promise((_resolve, _reject) => {
      setTimeout(() => {
        _resolve(true);
      }, 500);
    });
  }
}

export default toNative(CdLandingPage);
</script>