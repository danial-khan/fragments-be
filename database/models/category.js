const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      maxlength: [50, "Category name cannot exceed 50 characters"]
    },
    slug: {
      type: String,
      required: [true, "Category slug is required"],
      trim: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return /^[a-z0-9-]+$/.test(v);
        },
        message: "Slug can only contain lowercase letters, numbers and hyphens"
      }
    },
    color: {
      type: String,
    },
    active: {
      type: Boolean,
      default: true
    },
    featured: {
      type: Boolean,
      default: false
    },
    image: {
      type: String,
      default: null
    },
    description: {
      type: String,
      default: "",
      maxlength: [500, "Description cannot exceed 500 characters"]
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
categorySchema.index({ name: 1 });
categorySchema.index({ slug: 1 }, { unique: true });

// Virtual for formatted createdAt date
categorySchema.virtual('createdAtFormatted').get(function() {
  return this.createdAt?.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

const CategoryModel = mongoose.model("Category", categorySchema);

module.exports = CategoryModel;