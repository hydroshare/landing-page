<template>
  <div id="uppy"></div>
  <v-btn id="uppy-button">Upload files with Uppy</v-btn>
</template>

<script lang="ts">
import { Component, Vue, toNative, Prop } from "vue-facing-decorator";
import Uppy from '@uppy/core';
import GoldenRetriever from '@uppy/golden-retriever';
import Dashboard from '@uppy/dashboard';
import AwsS3 from '@uppy/aws-s3';
import { S3Client, ListMultipartUploadsCommand, CreateMultipartUploadCommand, ListPartsCommand, AbortMultipartUploadCommand, CompleteMultipartUploadCommand, GetBucketAclCommand, GetObjectAclCommand } from "@aws-sdk/client-s3";

import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

@Component({
  name: "hs-uppy",
  components: {},
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

  mounted() {
    const uppyComponent = this;
    const uppy = new Uppy({
      id: "uppy",
      autoProceed: true,
      onBeforeUpload: (files) => {
        Object.keys(files).forEach((fileId) => {
          const file = files[fileId]
          console.log("adding metadata for", file.name);
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
    .use(AwsS3, {
      allowedMetaFields: true,
      createMultipartUpload: async (file) => {
        console.log("createMultipartUpload called for file:", file.name);
        
        // First try to find existing upload with SDK
        try {
          const existingUpload = await uppyComponent.findExistingMultipartUpload(file);
          if (existingUpload) {
            console.log("Found existing MultipartUpload for file:", file.name);
            return existingUpload;
          }
        } catch (error) {
          console.warn("Error checking for existing upload, proceeding with new upload:", error);
        }

        // If no existing upload found or error occurred, create new one
        console.log("creating new MultipartUpload for file:", file.name);
        
        try {
          const s3Client = await uppyComponent.getS3Client();
          const command = new CreateMultipartUploadCommand({
            Bucket: uppyComponent.s3Info.bucket,
            Key: file.meta.dynamic_key,
          });
          
          const response = await s3Client.send(command);
          return { 
            uploadId: response.UploadId, 
            key: file.meta.dynamic_key 
          };
        } catch (sdkError) {
          console.error("SDK CreateMultipartUpload failed, falling back to HTTP:", sdkError);
          
          // Fallback to HTTP
          try {
            const url = `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}?uploads`;
            const response = await fetch(url, {
              method: 'POST',
              headers: await uppyComponent.get_s3_http_headers(),
            });
            
            const data = await response.text();
            if (response.status < 200 || response.status >= 300) {
              throw new Error(`HTTP fallback error: ${response.status} ${data}`);
            }
            
            const uploadIdMatch = data.match(/<UploadId>(.+?)<\/UploadId>/);
            const uploadId = uploadIdMatch ? uploadIdMatch[1] : null;
            if (!uploadId) {
              throw new Error("No UploadId found in HTTP response");
            }
            
            return { uploadId, key: file.meta.dynamic_key };
          } catch (httpError) {
            console.error("HTTP fallback also failed:", httpError);
            throw sdkError; // Re-throw the original SDK error
          }
        }
      },
      listParts: async (file, { uploadId, key }) => {
        try {
          const s3Client = await uppyComponent.getS3Client();
          const listPartsOptions = {
            Bucket: uppyComponent.s3Info.bucket,
            Key: key,
            UploadId: uploadId,
          };
          const command = new ListPartsCommand(listPartsOptions);

          const response = await s3Client.send(command);
          const parts = response.Parts?.map(part => ({
            PartNumber: part.PartNumber,
            ETag: part.ETag,
            Size: part.Size,
          })) || [];
          
          console.log("Found parts for file:", file.name, parts);
          return parts;
        } catch (error) {
          await uppyComponent.checkS3Credentials(key);
          console.error("Error listing parts with SDK, falling back to HTTP:", error);
          
          // Fallback to HTTP
          try {
            const url = `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}?uploadId=${uploadId}`;
            const response = await fetch(url, {
              method: 'GET',
              headers: await uppyComponent.get_s3_http_headers(),
            });
            
            if (response.status < 200 || response.status >= 300) {
              const errorText = await response.text();
              throw new Error(`HTTP fallback error: ${response.status} ${errorText}`);
            }
            
            const data = await response.text();
            const partMatches = [...data.matchAll(/<Part>\s*<PartNumber>(\d+)<\/PartNumber>\s*<LastModified>[^<]+<\/LastModified>\s*<ETag>&#34;([^<]+)&#34;<\/ETag>\s*<Size>(\d+)<\/Size>\s*<\/Part>/g)];
            const parts = partMatches.map(match => ({
              PartNumber: parseInt(match[1], 10),
              ETag: match[2],
              Size: parseInt(match[3], 10),
            }));
            
            console.log("Found parts via HTTP fallback for file:", file.name, parts);
            return parts;
          } catch (httpError) {
            console.error("HTTP fallback also failed:", httpError);
            throw error;
          }
        }
      },
      signPart: async (file, partData) => {
        const url = `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}?partNumber=${partData.partNumber}&uploadId=${partData.uploadId}`;
        return { 
          url, 
          headers: {
            'x-amz-security-token': uppyComponent.secretKey || '',
            'x-amz-access-key': uppyComponent.accessKey || '',
          }
        };
      },
      abortMultipartUpload: async (file, { uploadId, key }) => {
        console.log("aborting MultipartUpload for file:", file.name);
        
        try {
          const s3Client = await uppyComponent.getS3Client();
          const command = new AbortMultipartUploadCommand({
            Bucket: uppyComponent.s3Info.bucket,
            Key: key,
            UploadId: uploadId,
          });
          
          await s3Client.send(command);
          console.log("Multipart upload aborted successfully for file:", file.name);
        } catch (error) {
          console.error("Error aborting multipart upload with SDK, falling back to HTTP:", error);
          
          // Fallback to HTTP
          try {
            const url = `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}?uploadId=${uploadId}`;
            const response = await fetch(url, {
              method: 'DELETE',
              headers: await uppyComponent.get_s3_http_headers(),
            });
            
            const data = await response.text();
            if (response.status < 200 || response.status >= 300) {
              throw new Error(`HTTP fallback error: ${response.status} ${data}`);
            }
            
            console.log("Multipart upload aborted successfully via HTTP fallback for file:", file.name);
          } catch (httpError) {
            console.error("HTTP fallback also failed:", httpError);
            throw error;
          }
        }
      },
      completeMultipartUpload: async (file, { uploadId, key, parts }) => {
        console.log("completing MultipartUpload for file:", file.name);
        
        try {
          const s3Client = await uppyComponent.getS3Client();
          const command = new CompleteMultipartUploadCommand({
            Bucket: uppyComponent.s3Info.bucket,
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
          
          return `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}`;
        } catch (error) {
          console.error("Error completing multipart upload with SDK, falling back to HTTP:", error);
          
          // Fallback to HTTP
          try {
            const headers = {
              ...await uppyComponent.get_s3_http_headers(),
              'Content-Type': 'application/xml',
            };
            const url = `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}?uploadId=${uploadId}`;

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
              throw new Error(`HTTP fallback error: ${response.status} ${data}`);
            }
            
            console.log("Multipart upload completed successfully via HTTP fallback for file:", file.name);
            return `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}`;
          } catch (httpError) {
            console.error("HTTP fallback also failed:", httpError);
            throw error;
          }
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
          url: `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}`,
          headers: {},
          fields: {},
        };
      },
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
    .use(GoldenRetriever);
  }
  async getS3Client() {
    const options = {
        endpoint: this.s3Host,
        region: 'us-east-1',
        credentials: {
          accessKeyId: this.accessKey || '',
          secretAccessKey: this.secretKey || '',
          sessionToken: this.sessionToken || '',
        },
        forcePathStyle: true,
      };
    console.log(`Creating S3 client with options: ${JSON.stringify(options)}`);
    try {
      return new S3Client(options);
    } catch (error) {
      console.error("Error getting S3 client:", error);
      throw error;
    }
  };
  async checkS3Credentials(key) {
    console.log(`Checking S3 credentials:`, { accessKey: this.accessKey, secretKey: this.secretKey });
    const s3Client = await this.getS3Client();
    try {
      const command = new GetBucketAclCommand({ Bucket: this.s3Info.bucket });
      console.log(`Checking bucket ACLs on ${this.s3Info.bucket}...`);
      const response = await s3Client.send(command);
      console.log("GetBucketAclCommand response:", response);
    } catch (error) {
      console.error("S3 credentials are invalid or error occurred:", error);
      return false;
    }
    if (key) {
      try {
        const command = new GetObjectAclCommand({ Bucket: this.s3Info.bucket, Key: key });
        console.log(`Checking object ACLs on ${key}...`);
        const objResponse = await s3Client.send(command);
        console.log(`GetObjectAclCommand response for ${key}:`, objResponse);
      } catch (error) {
        console.error("S3 object access error occurred:", error);
        return false;
      }
    }
  }
  async findExistingMultipartUpload(file) {
    console.log(`Checking for existing MultipartUpload for ${this.s3Host}/${this.s3Info.bucket}/${this.s3Info.prefix}/${file.name}...`);
    try {
      const s3Client = await this.getS3Client();
      const command = new ListMultipartUploadsCommand({
        Bucket: this.s3Info.bucket,
      });
      
      console.log("Sending ListMultipartUploadsCommand...");
      const response = await s3Client.send(command);
      console.log("ListMultipartUploads response:", response);
      
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
      
      console.log("No existing multipart upload found for file:", file.name);
      return null;
    } catch (error) {
      console.error("Error listing multipart uploads:", error);
      
      // Fallback to direct HTTP request for debugging
      console.log("Falling back to HTTP request for debugging...");
      try {
        const url = `${this.s3Host}/${this.s3Info.bucket}?uploads`;
        const response = await fetch(url, {
          method: 'GET',
          headers: await this.get_s3_http_headers(),
        });
        
        if (response.status < 200 || response.status >= 300) {
          const errorText = await response.text();
          console.error("HTTP fallback error:", response.status, errorText);
          throw new Error(`HTTP fallback: ${response.status} ${errorText}`);
        }
        
        const data = await response.text();
        console.log("HTTP fallback response:", data);
        
        // Manual parsing as fallback
        const uploadMatches = [...data.matchAll(/<Upload><Key>(.+?)<\/Key><UploadId>(.+?)<\/UploadId>/g)];
        for (const match of uploadMatches) {
          const key = match[1];
          const uploadId = match[2];
          if (key === file.meta.dynamic_key) {
            console.log("Existing MultipartUpload found via HTTP fallback:", file.name, "UploadId:", uploadId);
            return { uploadId, key };
          }
        }
        
        return null;
      } catch (fallbackError) {
        console.error("HTTP fallback also failed:", fallbackError);
        throw error; // Re-throw the original SDK error
      }
    }
  }
  async get_s3_http_headers() {
    console.log("Using S3 headers with credentials:", {
      accessKey: this.accessKey ? "present" : "missing",
      sessionToken: this.sessionToken ? "present" : "missing"
    });
    return {
      'x-amz-security-token': this.sessionToken || '',
      'x-amz-access-key': this.accessKey || '',
    };
  };
}
export default toNative(HsUppy);
</script>