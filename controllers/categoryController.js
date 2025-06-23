const CategoryModel = require("../database/models/category");

const colors = [
  "green", "purple", "red", "amber", "orange", "yellow", "lime",  "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", 
  "fuchsia", "pink", "rose", "slate", "gray", "zinc", "neutral", "stone"
];

const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const slug = name
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^\w-]+/g, "");
    if (!slug) {
      return res.status(400).json({ error: "Slug is required" });
    }

    const existingCategoriesLength = await CategoryModel.countDocuments({
      isDeleted: false,
    });
    const color = colors[existingCategoriesLength + 1] || colors[0];

    // Check if a category (deleted or not) with same slug or name already exists
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
        return res.status(400).json({
          error: "Category with this name or slug already exists",
        });
      }
    }

    const newCategory = await CategoryModel.create({ name, slug, color });
    res.status(201).json(newCategory);
  } catch (err) {
    console.error("Create category error:", err);
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCategory = await CategoryModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!deletedCategory) {
      return res.status(404).json({ error: "Category not found" });
    }

    deletedCategory.isDeleted = true;
    deletedCategory.active = false;
    await deletedCategory.save();

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Delete category error:", err);
    res.status(500).json({ error: err.message });
  }
};

const categoryController = {
  createCategory,
  getCategories,
  deleteCategory,
};

module.exports = categoryController;