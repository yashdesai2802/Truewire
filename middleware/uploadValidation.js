const multer = require('multer');
const { validateImageMagicBytes } = require('../utils/validation');

// Store uploaded image in memory buffer for immediate processing and security
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are supported.'));
    }
    cb(null, true);
  }
});

/**
 * Middleware that wraps multer and performs strict magic bytes validation.
 */
function handleImageUpload(req, res, next) {
  const singleUpload = upload.single('image');

  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Image file too large. Maximum allowed size is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded. Please select a PNG, JPG, or WebP image.'
      });
    }

    // Inspect actual file magic bytes
    const signatureCheck = validateImageMagicBytes(req.file.buffer);
    if (!signatureCheck.valid) {
      return res.status(400).json({
        success: false,
        error: signatureCheck.error || 'Invalid image file signature.'
      });
    }

    // Attach validated verified mime type
    req.file.verifiedMimeType = signatureCheck.mimeType;
    next();
  });
}

module.exports = {
  handleImageUpload
};
