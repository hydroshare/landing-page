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
import { S3Client, ListMultipartUploadsCommand, ListPartsCommand, AbortMultipartUploadCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

// TODO: get the bucket dynamically
const MINIO_URL = 'http://localhost:9000';
const BUCKET = "asdf2";

const getS3Client = async () => {
  const s3credentials = await User.getOrCreateS3Credentials();

  if (!s3credentials) {
    throw new Error("Failed to get S3 credentials");
  }
  
  return new S3Client({
    endpoint: MINIO_URL,
    region: "us-central-2",
    forcePathStyle: true,
    credentials: {
      accessKeyId: s3credentials?.access_key || '',
      secretAccessKey: s3credentials?.secret_key || '',
    },
  });
};

const findExistingMultipartUpload = async (file) => {
  console.log("Checking for existing MultipartUpload for file:", file.name);
  
  try {
    const s3Client = await getS3Client();
    const command = new ListMultipartUploadsCommand({
      Bucket: BUCKET,
    });
    
    const response = await s3Client.send(command);
    
    if (response.Uploads) {
      const existingUpload = response.Uploads.find(upload => 
        upload.Key === file.meta.dynamic_key
      );
      
      if (existingUpload) {
        console.log("Existing MultipartUpload found for file:", file.name, "UploadId:", existingUpload.UploadId);
        return { 
          uploadId: existingUpload.UploadId, 
          key: existingUpload.Key 
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error listing multipart uploads:", error);
    throw error;
  }
};

@Component({
  name: "hs-uppy",
  components: {},
})
class HsUppy extends Vue {
  mounted() {
    const uppy = new Uppy({
      id: "uppy",
      autoProceed: true,
      onBeforeUpload: (files) => {
        Object.keys(files).forEach((fileId) => {
          console.log("adding metadata for", files[fileId].name);
          files[fileId].meta.bucket_name = BUCKET;
          files[fileId].meta.dynamic_key = `d7b526e24f7e449098b428ae9363f514/data/contents/${files[fileId].name}`;
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
      note: "TODO: quota note?",
    })
    .use(AwsS3, {
      allowedMetaFields: true,
      createMultipartUpload: async (file) => {
        const existingUpload = await findExistingMultipartUpload(file);
        if (existingUpload) {
          console.log("Found existing MultipartUpload for file:", file.name);
          return existingUpload;
        }

        console.log("creating MultipartUpload for file:", file.name);
        
        try {
          const s3Client = await getS3Client();
          const command = new CreateMultipartUploadCommand({
            Bucket: BUCKET,
            Key: file.meta.dynamic_key,
          });
          
          const response = await s3Client.send(command);
          return { 
            uploadId: response.UploadId, 
            key: file.meta.dynamic_key 
          };
        } catch (error) {
          console.error("Error creating multipart upload:", error);
          throw error;
        }
      },
      listParts: async (file, { uploadId, key }) => {
        console.log("listing parts for file:", file.name);
        
        try {
          const s3Client = await getS3Client();
          const command = new ListPartsCommand({
            Bucket: BUCKET,
            Key: key,
            UploadId: uploadId,
          });
          
          const response = await s3Client.send(command);
          const parts = response.Parts?.map(part => ({
            PartNumber: part.PartNumber,
            ETag: part.ETag,
            Size: part.Size,
          })) || [];
          
          console.log("Found parts for file:", file.name, parts);
          return { parts };
        } catch (error) {
          console.error("Error listing parts:", error);
          throw error;
        }
      },
      signPart: async (file, partData) => {
        console.log("signPart called for file:", file.name, "part:", partData.partNumber);
        const url = `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}?partNumber=${partData.partNumber}&uploadId=${partData.uploadId}`;
        
        const s3credentials = await User.getOrCreateS3Credentials();
        return { 
          url, 
          headers: {
            'x-amz-security-token': s3credentials?.session_token || '',
            'x-amz-access-key': s3credentials?.access_key,
          }
        };
      },
      abortMultipartUpload: async (file, { uploadId, key }) => {
        console.log("aborting MultipartUpload for file:", file.name);
        
        try {
          const s3Client = await getS3Client();
          const command = new AbortMultipartUploadCommand({
            Bucket: BUCKET,
            Key: key,
            UploadId: uploadId,
          });
          
          await s3Client.send(command);
          console.log("Multipart upload aborted successfully for file:", file.name);
        } catch (error) {
          console.error("Error aborting multipart upload:", error);
          throw error;
        }
      },
      completeMultipartUpload: async (file, { uploadId, key, parts }) => {
        console.log("completing MultipartUpload for file:", file.name);
        
        try {
          const s3Client = await getS3Client();
          const command = new CompleteMultipartUploadCommand({
            Bucket: BUCKET,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: parts.map(part => ({
                PartNumber: part.PartNumber,
                ETag: part.ETag,
              })),
            },
          });
          
          const response = await s3Client.send(command);
          console.log("Multipart upload completed successfully for file:", file.name);
          
          return `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}`;
        } catch (error) {
          console.error("Error completing multipart upload:", error);
          throw error;
        }
      },
      shouldUseMultipart: (file) => {
        if (!file) return false;
        const useMultipart = file?.size > 5 * 1024 * 1024;
        console.log(`shouldUseMultipart for file ${file.name} (${file.size} bytes):`, useMultipart);
        return useMultipart;
      },
      getUploadParameters: (file, options) => {
        console.log("getUploadParameters called for file:", file);
        return {
          method: 'PUT',
          url: `${MINIO_URL}/${BUCKET}/${file.meta.dynamic_key}`,
          headers: {},
          fields: {},
        };
      },
    })
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