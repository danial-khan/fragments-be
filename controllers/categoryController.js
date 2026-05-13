const CategoryModel = require("../database/models/category");
const { errorResponse, serverError } = require("../utils/response");

const colors = [
  "green", "purple", "red", "amber", "orange", "yellow", "lime", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet",
  "fuchsia", "pink", "rose", "slate", "gray", "zinc", "neutral", "stone",
];

const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return errorResponse(res, 400, "Category name is required.", "VALIDATION_ERROR");
    }

    const slug = name
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^\w-]+/g, "");

    if (!slug) {
      return errorResponse(res, 400, "Category name produced an invalid slug.", "VALIDATION_ERROR");
    }

    const existingCategoriesLength = await CategoryModel.countDocuments({ isDeleted: false });
    const color = colors[existingCategoriesLength + 1] || colors[0];

    const existingCategory = await CategoryModel.findOne({
      $or: [{ name }, { slug }],
    });

    if (existingCategory) {
      if (existingCategory.isDeleted) {
        existingCategory.isDeleted = false;
        existingCategory.active = true;
        existingCategory.name = name;
        existingCategory.slug = slug;
        existingCategory.color = color;
        await existingCategory.save();

        return res.status(200).json({
          message: "Category reactivated successfully",
          category: existingCategory,
        });
      } else {
        return errorResponse(
          res,
          409,
          "A category with this name or slug already exists.",
          "CONFLICT"
        );
      }
    }

    const newCategory = await CategoryModel.create({ name, slug, color });
    res.status(201).json(newCategory);
  } catch (err) {
    console.error("Create category error:", err);
    return serverError(res);
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await CategoryModel.find({
      isDeleted: false,
      active: true,
    }).sort({ createdAt: -1 });
    res.status(200).json(categories);
  } catch (err) {
    console.error("Get categories error:", err);
    return serverError(res);
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await CategoryModel.findOne({ _id: id, isDeleted: false });

    if (!category) {
      return errorResponse(res, 404, "Category not found.", "NOT_FOUND");
    }

    category.isDeleted = true;
    category.active = false;
    await category.save();

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Delete category error:", err);
    return serverError(res);
  }
};

const categoryController = {
  createCategory,
  getCategories,
  deleteCategory,
};

module.exports = categoryController;
