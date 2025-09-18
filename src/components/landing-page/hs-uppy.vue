<template>
  <div id="uppy"></div>
  <v-btn id="uppy-button">Upload files</v-btn>
</template>

<script lang="ts">
import { Component, Vue, toNative } from "vue-facing-decorator";
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import AwsS3, { type AwsBody } from '@uppy/aws-s3';
// import User from "@/models/user.model";

import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

@Component({
  name: "hs-uppy",
  components: {},
})
class HsUppy extends Vue {
  mounted() {
    const uppy = new Uppy({
      id: "uppy",
      // https://uppy.io/docs/uppy/#autoproceed
      autoProceed: true,
      // debug: true,
      // https://uppy.io/docs/dashboard/#locale
      onBeforeUpload: (files) => {
        Object.keys(files).forEach((fileId) => {
          // add metadata to the file
          // TODO: get the bucket name from the resource
          console.log("adding metadata for", files[fileId]);
          files[fileId].meta.bucket_name = "asdf2";
          files[fileId].meta.dynamic_key = `d7b526e24f7e449098b428ae9363f514/data/contents/${files[fileId].name}`;
        });
        return files;
      },
    })
    .use(Dashboard, {
      inline: false,
      fileManagerSelectionType: "both", // files and folders
      target: "#uppy",
      showProgressDetails: true,
      trigger: "#uppy-button",
      // showProgressDetails: true,
      note: "TODO: quota note?",
      // https://uppy.io/docs/dashboard/#locale
    })

    .use(AwsS3, {
      endpoint: 'https://localhost/companion',
      allowedMetaFields: true,
      // signPart: async (file, partData) => {
      //   alert("signPart called");
      //   // https://uppy.io/docs/aws-s3/#signpartfile-partdata
      //   console.log("signPart called for file:", file, "part:", partData);
      //   const result = await User.createS3Credentials();
      //   console.log("createS3Credentials result:", result);

      //   const headers: Record<string, string> = {
      //     'x-amz-security-token': result.session_token || '',
      //     'x-amz-access-key': result.access_key,
      //   };
      //   const BUCKET = "asdf2";
      //   const url = `htts://localhost:9000/${BUCKET}/${file.meta.dynamic_key}?partNumber=${partData.partNumber}&uploadId=${partData.uploadId}`;
      //   return { url, headers };
      // },
      // async getTemporarySecurityCredentials({ signal }) {
      //   // https://uppy.io/docs/aws-s3/#gettemporarysecuritycredentialsoptions
      //   const result = await User.createS3Credentials();
      //   console.log("getTemporarySecurityCredentials result:", result);
      //   const credentials: AwsBody = {
      //     accessKeyId: result.access_key,
      //     secretAccessKey: result.secret_key,
      //     sessionToken: null,
      //     expiration: null,
      //   };
      //   return { credentials, bucket: "asdf2", region: null };
      // },
      // shouldUseMultipart: (file) => file.size > 100 * 2 ** 20,
    })

    //   uppy.use(GoogleDrivePicker, {
    //     // https://uppy.io/docs/google-drive-picker/
    //     target: Dashboard,
    //     companionUrl: COMPANION_URL,
    //     clientId: GOOGLE_PICKER_CLIENT_ID,
    //     apiKey: GOOGLE_PICKER_API_KEY,
    //     appId: GOOGLE_PICKER_APP_ID,
    //   });
    // }

    // uppy.use(GoldenRetriever)
    // on page load, check the uppy state to see if there were pending uploads
    // https://uppy.io/docs/uppy/#getstate
      
    .on("error", (errorMessage) => {
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
  }
}
export default toNative(HsUppy);
</script>
