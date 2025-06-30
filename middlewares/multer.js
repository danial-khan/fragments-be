const multer = require("multer");

const multerUpload = multer({
  limits: {
    fileSize: 1024 * 1024 * 5,
  },
});

const uploadProfileMedia = multerUpload.fields([
  { name: "avatar", maxCount: 1 },
  { name: "cover", maxCount: 1 },
]);

module.exports = { uploadProfileMedia };
