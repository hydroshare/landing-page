<script lang="ts">
import { Component, Vue, toNative, Ref } from 'vue-facing-decorator';
import { CzNotifications, Notifications, CzForm } from "@cznethub/cznet-vue-core";
import { Config, IFolder, IFile } from '@/types';

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