const crypto = require("crypto");
const UserModel = require("../database/models/user");

/**
 * Creates default admin user if none exists
 * This function runs on server startup
 */
const createDefaultAdminUser = async () => {
  try {
    // Check if any admin user exists
    const adminExists = await UserModel.findOne({ 
      type: "admin",
      isDeleted: false 
    });

    if (adminExists) {
      console.log("✅ Admin user already exists");
      return;
    }

    console.log("🔍 No admin user found. Creating default admin...");

    // Default admin credentials
    const adminEmail = "admin@fragments.com";
    const adminPassword = "demo123$";
    const adminUsername = "admin";

    // Check if user with this email already exists
    const existingUser = await UserModel.findOne({ 
      email: adminEmail 
    });

    if (existingUser) {
      // Update existing user to admin
      existingUser.type = "admin";
      existingUser.active = true;
      existingUser.isDeleted = false;
      await existingUser.save();
      console.log("✅ Existing user promoted to admin:", adminEmail);
      return;
    }

    // Hash the password using SHA-256 (same as authController)
    const hashedPassword = crypto
      .createHash("sha256")
      .update(adminPassword)
      .digest("hex");

    // Create admin user
    const adminUser = new UserModel({
      name: "Admin User",
      email: adminEmail,
      username: adminUsername,
      password: hashedPassword,
      type: "admin",
      active: true,
      provider: "app",
      subscription: {
        plan: null,
        subscriptionDate: null,
        hasAds: false,
        newsletter: false,
      },
    });

    await adminUser.save();
    
    console.log("✅ Default admin user created successfully!");
    console.log("   📧 Email:", adminEmail);
    console.log("   🔑 Password:", adminPassword);
    console.log("   ⚠️  Please change the password after first login!");
    
  } catch (error) {
    console.error("❌ Error creating default admin user:", error.message);
  }
};

module.exports = { createDefaultAdminUser };

