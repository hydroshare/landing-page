<template>
  <div id="uppy"></div>
  <v-btn id="uppy-button">Upload files</v-btn>
</template>

<script lang="ts">
import { Component, Vue, toNative } from "vue-facing-decorator";
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import AwsS3 from '@uppy/aws-s3';
import User from "@/models/user.model";

import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

const MINIO_URL = 'http://localhost:9000';
const BUCKET = "asdf2";

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
          files[fileId].meta.bucket_name = BUCKET;
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
      allowedMetaFields: true,
      createMultipartUpload: async (file) => {
        // https://uppy.io/docs/aws-s3/#createmultipartuploadfile
        console.log("createMultipartUpload called for file:", file);
        const result = await User.createS3Credentials();
        console.log("createS3Credentials result:", result);

        const headers: Record<string, string> = {
          'x-amz-security-token': result?.session_token || '',
          'x-amz-access-key': result?.access_key,
        };
        const url = `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}`;

        // now call the S3 API to create the multipart upload
        const response = await fetch(url + "?uploads", {
          method: 'POST',
          headers,
        });
        const data = await response.text();
        console.log("S3 create multipart upload response:", data);
        const uploadIdMatch = data.match(/<UploadId>(.+?)<\/UploadId>/);
        const uploadId = uploadIdMatch ? uploadIdMatch[1] : null;
        console.log("Extracted uploadId:", uploadId);
        return { uploadId, key: file.meta.dynamic_key };
      },
      signPart: async (file, partData) => {
        // https://uppy.io/docs/aws-s3/#signpartfile-partdata
        console.log("signPart called for file:", file, "part:", partData);
        const result = await User.createS3Credentials();
        console.log("createS3Credentials result:", result);

        const headers: Record<string, string> = {
          'x-amz-security-token': result.session_token || '',
          'x-amz-access-key': result.access_key,
        };
        const url = `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}?partNumber=${partData.partNumber}&uploadId=${partData.uploadId}`;
        console.log("signPart URL:", url);
        return { url, headers };
      },
      completeMultipartUpload: async (file, uploadData) => {
        // https://uppy.io/docs/aws-s3/#completemultipartuploadfile--uploadid-key-parts-
        console.log("completeMultipartUpload called for file:", file, "uploadData:", uploadData);
        const result = await User.createS3Credentials();
        console.log("createS3Credentials result:", result);

        const headers: Record<string, string> = {
          'x-amz-security-token': result.session_token || '',
          'x-amz-access-key': result.access_key,
          'Content-Type': 'application/xml',
        };
        const url = `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}?uploadId=${uploadData.uploadId}`;

        // construct the XML body for completing the multipart upload
        let partsXml = '';
        uploadData.parts.forEach(part => {
          partsXml += `<Part><PartNumber>${part.PartNumber}</PartNumber><ETag>${part.ETag}</ETag></Part>`;
        });
        const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
        console.log("completeMultipartUpload body:", body);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body,
        });
        const data = await response.text();
        console.log("S3 complete multipart upload response:", data);
        // return A publicly accessible URL to the object in the S3 bucket.
        return `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}`;
      },
      shouldUseMultipart: (file) => {
        // https://uppy.io/docs/aws-s3/#shouldusemultipartfile
        // use multipart for files larger than 5MB
        return file?.size > 5 * 1024 * 1024;
      },
      getUploadParameters: (file, options) => {
        // https://uppy.io/docs/aws-s3/#getuploadparametersfile-options
        // This will be called for non multipart uploads
        console.log("getUploadParameters called for file:", file);
        // return the parameters for a simple upload
        return {
          method: 'PUT',
          url: `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}`,
          headers: {
            // 'x-amz-acl': 'public-read', // TODO: make configurable?
            // 'Content-Type': file.type,
          },
          fields: {},
        };
      },
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
