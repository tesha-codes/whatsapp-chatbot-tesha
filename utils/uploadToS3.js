const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const axios = require("axios");
const path = require("path");
const slugify = require("slugify");
require("dotenv").config();

// Configure AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadToS3 = async (bucket, fileUrl) => {
  try {
    // Download file from URL
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const fileBuffer = Buffer.from(response.data, "binary");

    // Extract file metadata
    const fileName = path.basename(new URL(fileUrl).pathname);
    const fileMimeType = response.headers["content-type"];

    // Generate a unique filename for the S3 object and trim spaces
    const s3Key = `${Date.now()}-${slugify(fileName, { lower: true })}`;

    // Configure the S3 upload command
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: fileMimeType,
    });

    // Upload file to AWS S3
    const s3UploadResponse = await s3Client.send(command);

    if (s3UploadResponse.$metadata.httpStatusCode === 200) {
      const fileUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
      console.log("File uploaded new link->:", fileUrl);
      return fileUrl;
    } else {
      throw new Error("File upload failed");
    }
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

module.exports = { uploadToS3 };
