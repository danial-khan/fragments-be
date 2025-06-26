const cloudinary = require("cloudinary").v2;
const { v4: uuid } = require("uuid");
const { config } = require("../config");

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

const getBase64 = (file) =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

const uploadToCloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      getBase64(file),
      {
        resource_type: "image",
        public_id: uuid(),
        transformation: [
        { width: 256, height: 256, crop: "fill", gravity: "face" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          public_id: result.public_id,
          url: result.url,
        });
      }
    );
  });
};

const deleteFromCloudinary = async (public_id) => {
  if (!public_id) return;
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    throw new Error("Failed to delete from Cloudinary");
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};
