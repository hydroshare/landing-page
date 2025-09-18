<template>
  <div id="uppy"></div>
  <v-btn id="uppy-button">Upload files with Uppy</v-btn>
</template>

<script lang="ts">
import { Component, Vue, toNative } from "vue-facing-decorator";
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import AwsS3 from '@uppy/aws-s3';
import User from "@/models/user.model";

import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

// TODO: get the bucket dynamically
const MINIO_URL = 'http://localhost:9000';
const BUCKET = "asdf2";

const get_s3_headers = async () => {
  const s3credentials = await User.getOrCreateS3Credentials();
  return {
    'x-amz-security-token': s3credentials?.session_token || '',
    'x-amz-access-key': s3credentials?.access_key,
  };
};

const findExistingMultipartUpload = async (file) => {
  // List existing multipart uploads and check if one exists for the given file
  console.log("Checking for existing MultipartUpload for file:", file.name);
  const url = `${MINIO_URL}/${BUCKET}?uploads`;
  const response = await fetch(url, {
    method: 'GET',
    headers: await get_s3_headers(),
  });
  const data = await response.text();
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Error listing multipart uploads: ${response.status} ${data}`);
  }
  // Parse the XML response to find an existing upload for the file
  const uploadMatches = [...data.matchAll(/<Upload><Key>(.+?)<\/Key><UploadId>(.+?)<\/UploadId><Initiator>.+?<\/Initiator><Owner>.+?<\/Owner><StorageClass>.+?<\/StorageClass><Initiated>(.+?)<\/Initiated><\/Upload>/g)];
  for (const match of uploadMatches) {
    const key = match[1];
    const uploadId = match[2];
    if (key === file.meta.dynamic_key) {
      console.log("Existing MultipartUpload found for file:", file.name, "UploadId:", uploadId);
      return { uploadId, key };
    }
  }
  return null;
};

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
          console.log("adding metadata for", files[fileId].name);
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
    })
    .use(AwsS3, {
      allowedMetaFields: true,
      createMultipartUpload: async (file) => {
        // https://uppy.io/docs/aws-s3/#createmultipartuploadfile

        // check if the mulitpart upload already exists for this file
        // if it does, return the existing uploadId and key
        // if not, create a new multipart upload
        const existingUpload = await findExistingMultipartUpload(file);
        if (existingUpload) {
          console.log("Found existing MultipartUpload for file:", file.name);
          return existingUpload;
        }

        console.log("creating MultipartUpload for file:", file.name);
        const url = `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}`;

        // now call the S3 API to create the multipart upload
        const response = await fetch(url + "?uploads", {
          method: 'POST',
          headers: await get_s3_headers(),
        });
        const data = await response.text();
        // if the response is not 200, throw an error
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Error creating multipart upload: ${response.status} ${data}`);
        }
        const uploadIdMatch = data.match(/<UploadId>(.+?)<\/UploadId>/);
        const uploadId = uploadIdMatch ? uploadIdMatch[1] : null;
        return { uploadId, key: file.meta.dynamic_key };
      },
      listParts: async (file, {uploadId, key}) => {
        // https://uppy.io/docs/aws-s3/#listpartsfile-uploadid-key
        console.log("listing parts for file:", file.name);
        const url = `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}?uploadId=${uploadId}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: await get_s3_headers(),
        });
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Error listing parts: ${response.status} ${data}`);
        }
        const data = await response.text();
        console.log("listParts response data:", data);
        // parse the XML response to get the parts
        // Return a Promise for an array of S3 Part objects, as returned by the S3 Multipart API. Each object has keys:
        // PartNumber - The index in the file of the uploaded part.
        // Size - The size of the part in bytes.
        // ETag - The ETag of the part, used to identify it when completing the multipart upload and combining all parts into a single file.
        const partMatches = [...data.matchAll(/<Part>\s*<PartNumber>(\d+)<\/PartNumber>\s*<LastModified>[^<]+<\/LastModified>\s*<ETag>&#34;([^<]+)&#34;<\/ETag>\s*<Size>(\d+)<\/Size>\s*<\/Part>/g)];
        const parts = partMatches.map(match => ({
          PartNumber: parseInt(match[1], 10),
          ETag: match[2],
          Size: parseInt(match[3], 10),
        }));
        console.log("Found parts for file:", file.name, parts);
        return { parts };
      },
      signPart: async (file, partData) => {
        // https://uppy.io/docs/aws-s3/#signpartfile-partdata
        // A function that generates a signed URL for the specified part number. The partData argument is an object with the keys:
        // uploadId - The UploadID of this Multipart upload.
        // key - The object key in the S3 bucket.
        // partNumber - can’t be zero.
        // body – The data that will be signed.
        // signal – An AbortSignal that may be used to abort an ongoing request.

        console.log("signPart called for file:", file.name, "part:", partData.partNumber);
        const url = `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}?partNumber=${partData.partNumber}&uploadId=${partData.uploadId}`;
        return { url, headers: await get_s3_headers() };
      },
      abortMultipartUpload: async (file, { uploadId, key}) => {
        // https://uppy.io/docs/aws-s3/#abortmultipartuploadfile-uploadid-key
        console.log("aborting MultipartUpload for file:", file.name);
        const url = `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}?uploadId=${uploadId}`;
        const response = await fetch(url, {
          method: 'DELETE',
          headers: await get_s3_headers(),
        });
        const data = await response.text();
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Error aborting multipart upload: ${response.status} ${data}`);
        }
        console.log("Multipart upload aborted successfully for file:", file.name);
      },
      completeMultipartUpload: async (file, { uploadId, key, parts }) => {
        // https://uppy.io/docs/aws-s3/#completemultipartuploadfile--uploadid-key-parts-
        console.log("completing MultipartUpload for file:", file.name);

        const headers: Record<string, string> = {
          ...await get_s3_headers(),
          'Content-Type': 'application/xml',
        };
        const url = `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}?uploadId=${uploadId}`;

        // construct the XML body for completing the multipart upload
        let partsXml = '';
        parts.forEach(part => {
          partsXml += `<Part><PartNumber>${part.PartNumber}</PartNumber><ETag>${part.ETag}</ETag></Part>`;
        });
        const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body,
        });
        const data = await response.text();
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Error completing multipart upload: ${response.status} ${data}`);
        }
        console.log("Multipart upload completed successfully for file:", file.name);
        // return A publicly accessible URL to the object in the S3 bucket.
        return `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}`;
      },
      shouldUseMultipart: (file) => {
        // https://uppy.io/docs/aws-s3/#shouldusemultipartfile
        // use multipart for files larger than 5MB
        if (!file) return false;
        const useMultipart = file?.size > 5 * 1024 * 1024;
        console.log(`shouldUseMultipart for file ${file.name} (${file.size} bytes):`, useMultipart);
        return useMultipart;
      },
      getUploadParameters: (file, options) => {
        // https://uppy.io/docs/aws-s3/#getuploadparametersfile-options
        // This will be called for non multipart uploads
        console.log("getUploadParameters called for file:", file);
        // return the parameters for a simple upload
        return {
          method: 'PUT',
          url: `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}`,
          headers: {},
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
