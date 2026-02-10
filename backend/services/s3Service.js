import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'ap-southeast-1',
});

const BUCKET_NAME = 'swifty-kyc-uploads';

/**
 * Generate a signed URL for uploading an object to S3.
 * @param {string} key - S3 object key (e.g., 'user123/front.jpg')
 * @param {string} contentType - MIME type (e.g., 'image/jpeg')
 * @param {number} expiresIn - URL expiry in seconds (default: 15 min)
 * @returns {Promise<string>} Signed upload URL
 */
export async function generateUploadUrl(key, contentType, expiresIn = 900) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    // ContentType removed to avoid signed header mismatch
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a signed URL for downloading an object from S3.
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiry in seconds (default: 15 min)
 * @returns {Promise<string>} Signed download URL
 */
export async function generateDownloadUrl(key, expiresIn = 900) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}