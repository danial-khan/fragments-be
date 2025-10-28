/**
 * Script to set up new Stripe subscription plans
 * Run this script once to create the new products and prices in Stripe
 * 
 * Usage: node scripts/setup-stripe-subscriptions.js
 */

const { configDotenv } = require("dotenv");
configDotenv();

const stripe = require("stripe")(process.env.STRIPE_SECRET);

const PLANS = {
  basic_learner: {
    name: "Basic Learner",
    description: "Perfect for curious minds starting their learning journey",
    price: 500, // $5.00 in cents
    features: ["Access to all fragments", "Join fragment trails", "Basic discussion participation", "Contains advertisements"],
    lookup_key: "basic_learner",
    has_ads: true,
    newsletter: false
  },
  pro_learner: {
    name: "Pro Learner",
    description: "For dedicated learners who want an ad-free experience",
    price: 1500, // $15.00 in cents
    features: ["All Basic Learner features", "Ad-free experience", "Weekly curated newsletter", "Priority support"],
    lookup_key: "pro_learner",
    has_ads: false,
    newsletter: true
  },
  basic_educator: {
    name: "Basic Educator",
    description: "For educators who want to share knowledge",
    price: 2000, // $20.00 in cents
    features: ["Create fragments", "Create fragment trails", "Advanced analytics", "Contains advertisements"],
    lookup_key: "basic_educator",
    has_ads: true,
    newsletter: false
  },
  pro_educator: {
    name: "Pro Educator",
    description: "Premium features for professional educators",
    price: 3000, // $30.00 in cents
    features: ["All Basic Educator features", "Ad-free experience", "Weekly curated newsletter", "Verified educator badge", "Priority support"],
    lookup_key: "pro_educator",
    has_ads: false,
    newsletter: true
  }
};

async function setupStripeSubscriptions() {
  try {
    console.log("🚀 Starting Stripe subscription setup...\n");

    // Create products and prices for each plan
    for (const [key, plan] of Object.entries(PLANS)) {
      console.log(`📦 Creating product: ${plan.name}...`);

      // Create product
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: {
          has_ads: plan.has_ads.toString(),
          newsletter: plan.newsletter.toString(),
          features: JSON.stringify(plan.features)
        }
      });

      console.log(`   ✅ Product created: ${product.id}`);

      // Create price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price,
        currency: "usd",
        recurring: {
          interval: "month"
        },
        lookup_key: plan.lookup_key,
        metadata: {
          plan_type: key
        }
      });

      console.log(`   ✅ Price created: ${price.id}`);
      console.log(`   💰 Price: $${(plan.price / 100).toFixed(2)}/month`);
      console.log(`   🔑 Lookup Key: ${plan.lookup_key}\n`);
    }

    console.log("✨ All subscription plans created successfully!");
    console.log("\n📋 Summary:");
    console.log("   - Basic Learner: $5/month (with ads)");
    console.log("   - Pro Learner: $15/month (no ads + newsletter)");
    console.log("   - Basic Educator: $20/month (with ads)");
    console.log("   - Pro Educator: $30/month (no ads + newsletter)");
    console.log("\n⚠️  Note: Update your .env file if needed");

  } catch (error) {
    console.error("❌ Error setting up Stripe subscriptions:", error.message);
    if (error.raw) {
      console.error("Raw error:", error.raw);
    }
    process.exit(1);
  }
}

// Optional: Function to list existing prices (for cleanup)
async function listExistingPrices() {
  console.log("\n📋 Listing existing prices...\n");
  const prices = await stripe.prices.list({ limit: 100 });
  
  for (const price of prices.data) {
    const product = await stripe.products.retrieve(price.product);
    console.log(`Product: ${product.name}`);
    console.log(`  Price ID: ${price.id}`);
    console.log(`  Lookup Key: ${price.lookup_key || "N/A"}`);
    console.log(`  Amount: $${(price.unit_amount / 100).toFixed(2)}/${price.recurring?.interval || "one-time"}`);
    console.log(`  Active: ${price.active}\n`);
  }
}

// Optional: Function to archive old prices
async function archiveOldPrices(lookupKeys) {
  console.log("\n🗑️  Archiving old prices...\n");
  
  for (const lookupKey of lookupKeys) {
    try {
      const prices = await stripe.prices.list({
        lookup_keys: [lookupKey],
      });

      for (const price of prices.data) {
        if (price.active) {
          await stripe.prices.update(price.id, { active: false });
          console.log(`   ✅ Archived price: ${price.id} (${lookupKey})`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  No price found for lookup key: ${lookupKey}`);
    }
  }
}

// Main execution
(async () => {
  const args = process.argv.slice(2);
  
  if (args.includes("--list")) {
    await listExistingPrices();
  } else if (args.includes("--archive-old")) {
    // Archive the old subscription plans
    await archiveOldPrices(["basic_scholor", "pro_scholor", "expert_scholor"]);
  } else {
    await setupStripeSubscriptions();
    
    console.log("\n💡 Next steps:");
    console.log("   1. Verify products in Stripe Dashboard");
    console.log("   2. Run: node scripts/setup-stripe-subscriptions.js --list (to verify)");
    console.log("   3. Run: node scripts/setup-stripe-subscriptions.js --archive-old (to disable old plans)");
  }
})();

