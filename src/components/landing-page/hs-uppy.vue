<template>
  <div id="uppy"></div>
  <v-btn id="uppy-button">Upload files with Uppy</v-btn>
</template>

<script lang="ts">
import { Component, Vue, toNative, Prop, Watch } from "vue-facing-decorator";
import Uppy from '@uppy/core';
import GoldenRetriever from '@uppy/golden-retriever';
import GoogleDrivePicker from '@uppy/google-drive-picker';
import Dashboard from '@uppy/dashboard';
import AwsS3 from '@uppy/aws-s3';
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { COMPANION_URL, GOOGLE_PICKER_CLIENT_ID, GOOGLE_PICKER_API_KEY, GOOGLE_PICKER_APP_ID } from "@/constants";

import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

let uppyInstance = {} as Uppy | null;

@Component({
  name: "hs-uppy",
  components: {},
  expose: ["getUppyInstance", "addFile", "upload"],
})
class HsUppy extends Vue {
  @Prop({required: false, default: () => ({
    "prefix": "d7b526e24f7e449098b428ae9363f514/data/contents/",
    "bucket": "asdf",
  }) })
  s3Info!: { prefix: string; bucket: string };

  @Prop({ type: String, required: false, default: "http://localhost:9000" })
  s3Host!: string;

  @Prop({ type: String, required: false, default: "minioadmin" })
  accessKey!: string;

  @Prop({ type: String, required: false, default: "minioadmin" })
  secretKey!: string;

  @Prop({ type: String, required: false, default: "" })
  sessionToken!: string;

  private signatureV4: SignatureV4 | null = null;

  // Method to expose the Uppy instance
  getUppyInstance(): Uppy | null {
    return uppyInstance;
  }

  // Add files through the component
  addFile(fileData: any): string | null {
    if (uppyInstance) {
      try {
        return uppyInstance.addFile(fileData);
      } catch (error) {
        console.error("Error adding file to Uppy:", error);
        return null;
      }
    }
    return null;
  }

  upload(): Promise<void> {
    if (uppyInstance) {
      return uppyInstance.upload();
    }
    return Promise.reject(new Error("Uppy instance not available"));
  }

  // Watch for credential changes and recreate Uppy instance
  @Watch('accessKey')
  @Watch('secretKey')
  @Watch('sessionToken')
  onCredentialsChange() {
    console.log('Credentials changed, recreating Uppy instance');
    this.initializeUppy();
  }

  mounted() {
    this.initializeUppy();
  }

  // Method to get or create the SignatureV4 instance
  getSigner(): SignatureV4 {
    if (!this.signatureV4) {
      this.signatureV4 = new SignatureV4({
        service: 's3',
        region: 'us-east-1',
        credentials: {
          accessKeyId: this.accessKey,
          secretAccessKey: this.secretKey,
          sessionToken: this.sessionToken || undefined,
        },
        sha256: Sha256,
      });
    }
    return this.signatureV4;
  }
  initializeUppy() {
    if (uppyInstance) {
      try {
        uppyInstance.destroy();
        uppyInstance = null;
        
      } catch (error) {
        console.error("Error destroying current Uppy instance:", error);
      }
      
    }
    const uppyComponent = this;
    const headers = {
      "s3-key": this.accessKey,
      "s3-secret": this.secretKey
    };
    console.log("Initializing Uppy");
    console.log("With credentials:", this.accessKey, this.secretKey, this.sessionToken);
    uppyInstance = new Uppy({
      id: "uppy",
      autoProceed: true,
      onBeforeUpload: (files) => {
        Object.keys(files).forEach((fileId) => {
          const file = files[fileId]
          console.log("adding metadata for", file.name);
          console.log("s3Info:", uppyComponent.s3Info);
          file.meta.bucket_name = uppyComponent.s3Info.bucket;
          file.meta.dynamic_key = `${uppyComponent.s3Info.prefix}${file.name}`;
        });
        return files;
      },
    })
    .use(Dashboard, {
      inline: false,
      fileManagerSelectionType: "both",
      target: "#uppy",
      showProgressDetails: true,
      trigger: "#uppy-button",
      note: `TODO: quota?`,
    })

    uppyInstance.use(AwsS3, {
      headers: headers,
      allowedMetaFields: true,
      endpoint: "https://localhost/companion",
      // endpoint: COMPANION_URL,
    })
    .on("error", (errorMessage) => {
      console.error("Uppy error:", errorMessage);
      let errorMsg = "";
      if (typeof errorMessage === "object") {
        for (const [key, value] of Object.entries(errorMessage)) {
          errorMsg += `${key}: ${value}`;
        }
      } else {
        errorMsg = JSON.stringify(errorMessage);
      }
      try {
        let errorMessageJSON = JSON.parse(errorMessage.message);
        if (errorMessageJSON.hasOwnProperty("validation_error")) {
          errorMsg = errorMessageJSON.validation_error;
        } else if (errorMessageJSON.hasOwnProperty("file_size_error")) {
          errorMsg = errorMessageJSON.file_size_error;
        }
      } catch (e) {}
    })
    .use(GoldenRetriever)
    .use(GoogleDrivePicker, {
      target: Dashboard,
      companionUrl: COMPANION_URL,
      clientId: GOOGLE_PICKER_CLIENT_ID,
      apiKey: GOOGLE_PICKER_API_KEY,
      appId: GOOGLE_PICKER_APP_ID,
      companionHeaders: headers,
    });
  }
}
export default toNative(HsUppy);
</script>