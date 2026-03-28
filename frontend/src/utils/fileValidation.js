/**
 * Shared file-upload validation for Swifty frontend.
 * Checks MIME type + file size, returns { valid, message }.
 */

const FILE_RULES = {
  kyc: {
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
    allowedExts: ['JPEG', 'JPG', 'PNG', 'PDF'],
    maxSizeMB: 5,
  },
  carImage: {
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    allowedExts: ['JPEG', 'JPG', 'PNG', 'WEBP'],
    maxSizeMB: 5,
  },
  profilePic: {
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    allowedExts: ['JPEG', 'JPG', 'PNG', 'WEBP'],
    maxSizeMB: 5,
  },
};

export function validateFile(file, ruleKey) {
  const rules = FILE_RULES[ruleKey];
  if (!rules) return { valid: true };

  if (!rules.allowedTypes.includes(file.type)) {
    return {
      valid: false,
      message: `⚠️ Incompatible file type "${file.type || 'unknown'}". Allowed types: ${rules.allowedExts.join(', ')}. Maximum size: ${rules.maxSizeMB}MB.`,
    };
  }

  if (file.size > rules.maxSizeMB * 1024 * 1024) {
    return {
      valid: false,
      message: `⚠️ File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size: ${rules.maxSizeMB}MB. Allowed types: ${rules.allowedExts.join(', ')}.`,
    };
  }

  return { valid: true };
}