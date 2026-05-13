const mongoose = require("mongoose");
const OpenAI = require("openai");
const { config } = require("../config");
const { connectDatabase } = require("../database");
const FragmentModel = require("../database/models/fragment");
const CategoryModel = require("../database/models/category");
const UserModel = require("../database/models/user");
const { analyzeContentWithAI } = require("../utils/aiReview");

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

/**
 * Generate fragment content using AI
 */
const generateFragmentContent = async (categoryName, fragmentNumber, totalFragments) => {
  try {
    const prompt = `You are an expert educational content creator. Generate a high-quality educational fragment for the category "${categoryName}".

Fragment ${fragmentNumber} of ${totalFragments} for this category.

Requirements:
1. Title: Create an engaging, specific title (50-80 characters)
2. Description: Write a compelling summary (100-150 characters)
3. Content: Write detailed educational content (300-600 words) that is:
   - Accurate and factually correct
   - Educational and informative
   - Well-structured and formatted in HTML
   - Use proper HTML tags: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>
   - Include at least 2-3 sections with headings
   - Use bold and italic for emphasis where appropriate
   - Include lists (ordered or unordered) where relevant
   - Engaging and easy to understand
   - Appropriate for learners
4. Tags: Provide 3-5 relevant tags (single words or short phrases)

Make each fragment unique and cover different aspects/topics within the ${categoryName} category.

IMPORTANT: The content field MUST contain valid HTML markup with proper tags and structure.

Return ONLY a valid JSON object with this exact structure:
{
  "title": "Fragment title here",
  "description": "Brief description here",
  "content": "<h2>Main Heading</h2><p>Introduction paragraph...</p><h3>Subheading</h3><p>Content with <strong>bold text</strong> and <em>italic text</em>...</p><ul><li>List item 1</li><li>List item 2</li></ul>",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert educational content creator. Always respond with valid JSON only, no additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 1500,
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Try to extract JSON if there's extra text
    let jsonText = responseText;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    const fragmentData = JSON.parse(jsonText);
    
    // Validate required fields
    if (!fragmentData.title || !fragmentData.description || !fragmentData.content) {
      throw new Error("Missing required fields in generated content");
    }
    
    return fragmentData;
  } catch (error) {
    console.error(`   Error generating content: ${error.message}`);
    throw error;
  }
};

/**
 * Create a fragment using the same logic as the controller
 */
const createFragment = async (fragmentData, categoryId, authorId) => {
  try {
    const { title, description, content, tags } = fragmentData;

    // Validate category exists
    const categoryExists = await CategoryModel.findById(categoryId);
    if (!categoryExists) {
      throw new Error("Invalid category");
    }

    // AI moderation (same as controller)
    const textToModerate = `${title}\n${description}\n${content}`;
    const {
      status: aiReviewStatus,
      feedback: aiReviewFeedback,
      summary: aiReviewSummary,
    } = await analyzeContentWithAI(textToModerate, "fragments");

    // Determine final status
    let finalStatus = "published";
    if (aiReviewStatus === "rejected") {
      finalStatus = "blocked";
    }

    // Create fragment
    const newFragment = new FragmentModel({
      title,
      category: categoryId,
      description,
      content,
      author: authorId,
      tags: tags || [],
      status: finalStatus,
      subscribers: [authorId],
      aiReviewStatus,
      aiReviewFeedback,
      aiReviewSummary,
    });

    const savedFragment = await newFragment.save();
    
    return {
      success: true,
      fragment: savedFragment,
      blocked: finalStatus === "blocked",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Main script execution
 */
const generateFragments = async () => {
  try {
    console.log("Starting Fragment Generation Script\n");

    // Get user ID from command line arguments
    const userId = process.argv[2];
    
    if (!userId) {
      console.error("Error: User ID is required");
      console.log("\nUsage:");
      console.log("  node scripts/generateFragments.js <userId>\n");
      console.log("Example:");
      console.log("  node scripts/generateFragments.js 507f1f77bcf86cd799439011\n");
      process.exit(1);
    }

    // Connect to database
    console.log("Connecting to database...");
    await connectDatabase();
    console.log("Database connected\n");

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error("Error: Invalid user ID format");
      console.log("Please provide a valid MongoDB ObjectId\n");
      process.exit(1);
    }

    // Get specified user as author
    console.log(`Finding user with ID: ${userId}...`);
    const user = await UserModel.findById(userId);

    if (!user) {
      console.error("User not found");
      console.log("Please check the user ID and try again.\n");
      process.exit(1);
    }
    
    if (user.isDeleted) {
      console.error("This user account is deleted");
      process.exit(1);
    }
    
    console.log(`Using user: ${user.email} (${user.name})`);
    console.log(`   Type: ${user.type}`);
    console.log();

    // Get all active categories
    console.log("Fetching categories...");
    const categories = await CategoryModel.find({
      isDeleted: false,
      active: true
    }).sort({ name: 1 });

    if (categories.length === 0) {
      console.error("No categories found. Please create categories first.");
      process.exit(1);
    }
    console.log(`Found ${categories.length} categories\n`);

    // Statistics
    let totalGenerated = 0;
    let totalSuccess = 0;
    let totalBlocked = 0;
    let totalFailed = 0;

    const fragmentsPerCategory = 3; // Generate 3 fragments per category

    // Generate fragments for each category
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Category ${i + 1}/${categories.length}: ${category.name} (${category.color})`);
      console.log(`${"=".repeat(60)}\n`);

      let categorySuccess = 0;
      let categoryBlocked = 0;
      let categoryFailed = 0;

      for (let j = 1; j <= fragmentsPerCategory; j++) {
        try {
          process.stdout.write(`   [${j}/${fragmentsPerCategory}] Generating content... `);

          // Generate content using AI
          const fragmentData = await generateFragmentContent(
            category.name,
            j,
            fragmentsPerCategory
          );

          process.stdout.write("Creating fragment... ");

          // Create fragment using controller logic
          const result = await createFragment(
            fragmentData,
            category._id,
            user._id
          );

          if (result.success) {
            if (result.blocked) {
              console.log("BLOCKED");
              categoryBlocked++;
              totalBlocked++;
            } else {
              console.log("SUCCESS");
              categorySuccess++;
              totalSuccess++;
            }
          } else {
            console.log(`FAILED: ${result.error}`);
            categoryFailed++;
            totalFailed++;
          }

          totalGenerated++;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.log(`ERROR: ${error.message}`);
          categoryFailed++;
          totalFailed++;
          totalGenerated++;
        }
      }

      // Category summary
      console.log(`\n   Category Summary:`);
      console.log(`      Success: ${categorySuccess}`);
      console.log(`      Blocked: ${categoryBlocked}`);
      console.log(`      Failed: ${categoryFailed}`);
    }

    // Final summary
    console.log(`\n${"=".repeat(60)}`);
    console.log("FRAGMENT GENERATION COMPLETE");
    console.log(`${"=".repeat(60)}\n`);
    console.log(`Final Statistics:`);
    console.log(`   Total Processed: ${totalGenerated}`);
    console.log(`   Successfully Created: ${totalSuccess}`);
    console.log(`   Blocked by AI: ${totalBlocked}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log(`\n   User: ${user.email}`);
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Fragments per Category: ${fragmentsPerCategory}`);
    console.log(`   Success Rate: ${((totalSuccess / totalGenerated) * 100).toFixed(1)}%`);
    console.log();

  } catch (error) {
    console.error("\nScript Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    console.log("Closing database connection...");
    await mongoose.connection.close();
    console.log("Done.\n");
    process.exit(0);
  }
};

// Run the script
generateFragments();

