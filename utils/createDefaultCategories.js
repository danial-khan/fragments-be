const CategoryModel = require("../database/models/category");

// Available colors for categories
const colors = [
  "green", "purple", "red", "amber", "orange", "yellow", "lime", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet",
  "fuchsia", "pink", "rose", "slate", "gray", "zinc", "neutral", "stone"
];

// Default categories to create
const defaultCategories = [
  "History",
  "Geography",
  "Economics",
  "Chemistry",
  "Biology",
  "Physics",
  "Mathematics",
  "English Literature",
  "Other Literature",
  "Modern Languages",
  "Religious Studies"
];

/**
 * Creates default categories if none exist
 * This function runs on server startup
 */
const createDefaultCategories = async () => {
  try {
    // Check if any categories exist
    const categoriesCount = await CategoryModel.countDocuments({
      isDeleted: false
    });

    if (categoriesCount > 0) {
      console.log(`✅ Categories already exist (${categoriesCount} found)`);
      return;
    }

    console.log("🔍 No categories found. Creating default categories...");

    let createdCount = 0;

    // Create each default category
    for (let i = 0; i < defaultCategories.length; i++) {
      const categoryName = defaultCategories[i];
      
      // Generate slug from name
      const slug = categoryName
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "");

      // Assign color from colors array (cycle through if needed)
      const color = colors[i % colors.length];

      try {
        // Check if this specific category already exists
        const existingCategory = await CategoryModel.findOne({
          $or: [{ name: categoryName }, { slug }]
        });

        if (existingCategory) {
          if (existingCategory.isDeleted) {
            // Reactivate deleted category
            existingCategory.isDeleted = false;
            existingCategory.active = true;
            existingCategory.color = color;
            await existingCategory.save();
            console.log(`   ♻️  Reactivated: ${categoryName} (${color})`);
            createdCount++;
          } else {
            console.log(`   ⏭️  Skipped: ${categoryName} (already exists)`);
          }
        } else {
          // Create new category
          await CategoryModel.create({
            name: categoryName,
            slug: slug,
            color: color,
            active: true,
            isDeleted: false,
            featured: false,
            description: `Explore ${categoryName} content`
          });
          console.log(`   ✅ Created: ${categoryName} (${color})`);
          createdCount++;
        }
      } catch (err) {
        console.error(`   ❌ Error creating ${categoryName}:`, err.message);
      }
    }

    console.log(`\n✅ Default categories setup complete! (${createdCount} categories)`);
    
  } catch (error) {
    console.error("❌ Error creating default categories:", error.message);
  }
};

module.exports = { createDefaultCategories };

