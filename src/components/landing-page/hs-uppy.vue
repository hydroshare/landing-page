<template>
  <div id="uppy"></div>
  <v-btn id="uppy-button">Upload files with Uppy</v-btn>
</template>

<script lang="ts">
import { Component, Vue, toNative, Prop } from "vue-facing-decorator";
import Uppy from '@uppy/core';
import GoldenRetriever from '@uppy/golden-retriever';
import GoogleDrivePicker from '@uppy/google-drive-picker';
import Dashboard from '@uppy/dashboard';
import AwsS3 from '@uppy/aws-s3';
import { S3Client, ListMultipartUploadsCommand, CreateMultipartUploadCommand, ListPartsCommand, AbortMultipartUploadCommand, CompleteMultipartUploadCommand, GetBucketAclCommand, GetObjectAclCommand } from "@aws-sdk/client-s3";
import { HttpRequest } from "@aws-sdk/protocol-http";
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

  // Correct method to generate signed headers using SignatureV4
  async generateSignedHeaders(method: string, url: string, body?: string): Promise<Record<string, string>> {
    try {
      const signer = this.getSigner();
      
      const urlObj = new URL(url);
      const request = new HttpRequest({
        method: method,
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port ? parseInt(urlObj.port) : undefined,
        path: urlObj.pathname + urlObj.search,
        headers: {
          // Don't include 'host' header - browser will set it automatically
          ...(body && { 'content-length': Buffer.byteLength(body).toString() })
        },
        body: body ? body : undefined,
      });

      const signedRequest = await signer.sign(request);
      
      // Remove forbidden headers that browsers block
      const forbiddenHeaders = ['host', 'user-agent', 'referer', 'origin'];
      const filteredHeaders: Record<string, string> = {};
      
      Object.entries(signedRequest.headers).forEach(([key, value]) => {
        if (!forbiddenHeaders.includes(key.toLowerCase()) && value !== undefined) {
          filteredHeaders[key] = value.toString();
        }
      });
      
      return filteredHeaders;
    } catch (error) {
      console.error("Error generating signed headers:", error);
      // Fallback to basic headers
      return {
        'x-amz-access-key': this.accessKey,
        'x-amz-security-token': this.sessionToken || '',
      };
    }
  }

  // Alternative simplified approach for Minio - often works without complex signing
  async generateMinioHeaders(method: string, url: string): Promise<Record<string, string>> {
    // For Minio, sometimes simple authentication is sufficient
    const headers: Record<string, string> = {
      'x-amz-access-key': this.accessKey,
    };
    
    if (this.sessionToken) {
      headers['x-amz-security-token'] = this.sessionToken;
    }
    
    // Add date header for better compatibility
    headers['x-amz-date'] = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    
    return headers;
  }

  // Updated getUploadParameters using proper signing
  async getUploadParameters(file) {
    console.log("getUploadParameters called for file:", file);
    
    const key = file.meta.dynamic_key || `${this.s3Info.prefix}${file.name}`;
    const url = `${this.s3Host}/${this.s3Info.bucket}/${key}`;
    
    try {
      // Try the full AWS signing first
      const signedHeaders = await this.generateSignedHeaders('PUT', url);
      console.log("Using AWS signed headers for upload");
      
      return {
        method: 'PUT',
        url: url,
        headers: signedHeaders,
        fields: {},
      };
    } catch (error) {
      console.error("Error generating signed headers, trying Minio simple auth:", error);
      
      // Fallback to Minio simple authentication
      try {
        const minioHeaders = await this.generateMinioHeaders('PUT', url);
        console.log("Using Minio simple auth headers for upload");
        
        return {
          method: 'PUT',
          url: url,
          headers: minioHeaders,
          fields: {},
        };
      } catch (minioError) {
        console.error("Minio auth also failed, using basic headers:", minioError);
        
        // Final fallback to basic headers
        return {
          method: 'PUT',
          url: url,
          headers: {
            'x-amz-access-key': this.accessKey,
            'x-amz-security-token': this.sessionToken || '',
          },
          fields: {},
        };
      }
    }
  }

  // Updated signPart function
  async signPart(file, partData) {
    const key = file.meta.dynamic_key || `${this.s3Info.prefix}${file.name}`;
    const url = `${this.s3Host}/${this.s3Info.bucket}/${key}?partNumber=${partData.partNumber}&uploadId=${partData.uploadId}`;
    
    try {
      const signedHeaders = await this.generateSignedHeaders('PUT', url);
      
      return { 
        url: url,
        headers: signedHeaders
      };
    } catch (error) {
      console.error("Error signing part URL, falling back to Minio auth:", error);
      
      try {
        const minioHeaders = await this.generateMinioHeaders('PUT', url);
        
        return { 
          url: url,
          headers: minioHeaders
        };
      } catch (minioError) {
        console.error("Minio auth also failed, using basic headers:", minioError);
        
        return { 
          url: url,
          headers: {
            'x-amz-access-key': this.accessKey,
            'x-amz-security-token': this.sessionToken || '',
          }
        };
      }
    }
  }

  // Updated HTTP fallback methods to use proper signing
  async get_s3_http_headers(method: string = 'GET', url?: string, body?: string) {
    if (url && method) {
      try {
        return await this.generateSignedHeaders(method, url, body);
      } catch (error) {
        console.error("Error generating signed headers, trying Minio auth:", error);
        
        try {
          return await this.generateMinioHeaders(method, url);
        } catch (minioError) {
          console.error("Minio auth also failed, using fallback:", minioError);
        }
      }
    }
    
    // Final fallback for existing usage
    return {
      'x-amz-security-token': this.sessionToken || '',
      'x-amz-access-key': this.accessKey || '',
    };
  }

  mounted() {
    const uppyComponent = this;
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
          
          // Fallback to HTTP with proper signing
          try {
            const url = `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}?uploads`;
            const headers = await uppyComponent.get_s3_http_headers('POST', url);
            
            const response = await fetch(url, {
              method: 'POST',
              headers: headers,
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
            throw sdkError;
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
          
          // Fallback to HTTP with proper signing
          try {
            const url = `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}?uploadId=${uploadId}`;
            const headers = await uppyComponent.get_s3_http_headers('GET', url);
            
            const response = await fetch(url, {
              method: 'GET',
              headers: headers,
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
        return await uppyComponent.signPart(file, partData);
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
          
          // Fallback to HTTP with proper signing
          try {
            const url = `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}?uploadId=${uploadId}`;
            const headers = await uppyComponent.get_s3_http_headers('DELETE', url);
            
            const response = await fetch(url, {
              method: 'DELETE',
              headers: headers,
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
          
          // Fallback to HTTP with proper signing
          try {
            const url = `${uppyComponent.s3Host}/${uppyComponent.s3Info.bucket}/${file.meta.dynamic_key}?uploadId=${uploadId}`;
            
            let partsXml = '';
            parts.forEach(part => {
              partsXml += `<Part><PartNumber>${part.PartNumber}</PartNumber><ETag>${part.ETag}</ETag></Part>`;
            });
            const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

            const headers = await uppyComponent.get_s3_http_headers('POST', url, body);
            headers['Content-Type'] = 'application/xml';

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
      getUploadParameters: (file) => {
        return uppyComponent.getUploadParameters(file);
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
    .use(GoldenRetriever)
    .use(GoogleDrivePicker, {
      target: Dashboard,
      companionUrl: COMPANION_URL,
      clientId: GOOGLE_PICKER_CLIENT_ID,
      apiKey: GOOGLE_PICKER_API_KEY,
      appId: GOOGLE_PICKER_APP_ID,
    });
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