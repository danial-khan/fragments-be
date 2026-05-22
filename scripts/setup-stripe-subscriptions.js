/**
 * Create Stripe subscription products + prices (lookup keys used by checkout).
 *
 * Usage:
 *   node scripts/setup-stripe-subscriptions.js --env sandbox
 *   node scripts/setup-stripe-subscriptions.js --env live --confirm
 *   node scripts/setup-stripe-subscriptions.js --list --env live
 *   node scripts/setup-stripe-subscriptions.js --archive-old --env sandbox
 *
 * Env files (first match wins):
 *   --env sandbox  →  .env.sandbox, then .env
 *   --env live     →  .env.live, then .env
 *
 * Or pass the key inline:
 *   STRIPE_SECRET=sk_live_xxx node scripts/setup-stripe-subscriptions.js --env live --confirm
 */

const fs = require("fs");
const path = require("path");
const { configDotenv } = require("dotenv");

const ROOT = path.join(__dirname, "..");

const PLANS = {
  basic_learner: {
    name: "Basic Learner",
    description: "Perfect for curious minds starting their learning journey",
    price: 500,
    features: [
      "Access to all fragments",
      "Join fragment trails",
      "Basic discussion participation",
      "Contains advertisements",
    ],
    lookup_key: "basic_learner",
    has_ads: true,
    newsletter: false,
  },
  pro_learner: {
    name: "Pro Learner",
    description: "For dedicated learners who want an ad-free experience",
    price: 1500,
    features: [
      "All Basic Learner features",
      "Ad-free experience",
      "Weekly curated newsletter",
      "Priority support",
    ],
    lookup_key: "pro_learner",
    has_ads: false,
    newsletter: true,
  },
  basic_educator: {
    name: "Basic Educator",
    description: "For educators who want to share knowledge",
    price: 2000,
    features: [
      "Create fragments",
      "Create fragment trails",
      "Advanced analytics",
      "Contains advertisements",
    ],
    lookup_key: "basic_educator",
    has_ads: true,
    newsletter: false,
  },
  pro_educator: {
    name: "Pro Educator",
    description: "Premium features for professional educators",
    price: 3000,
    features: [
      "All Basic Educator features",
      "Ad-free experience",
      "Weekly curated newsletter",
      "Verified educator badge",
      "Priority support",
    ],
    lookup_key: "pro_educator",
    has_ads: false,
    newsletter: true,
  },
};

function parseArgs(argv) {
  const args = new Set(argv);
  const envFlag = argv.find((a) => a.startsWith("--env="));
  const envValue = envFlag
    ? envFlag.split("=")[1]
    : argv.includes("--env")
      ? argv[argv.indexOf("--env") + 1]
      : null;

  return {
    list: args.has("--list"),
    archiveOld: args.has("--archive-old"),
    confirm: args.has("--confirm"),
    force: args.has("--force"),
    env: envValue === "live" || envValue === "sandbox" ? envValue : null,
  };
}

function loadEnv(targetEnv) {
  const candidates =
    targetEnv === "live"
      ? [".env.live", ".env"]
      : targetEnv === "sandbox"
        ? [".env.sandbox", ".env"]
        : [".env"];

  for (const file of candidates) {
    const fullPath = path.join(ROOT, file);
    if (fs.existsSync(fullPath)) {
      configDotenv({ path: fullPath });
      return file;
    }
  }
  configDotenv();
  return ".env (default)";
}

function stripeMode(secret) {
  if (!secret) return "missing";
  if (secret.startsWith("sk_live")) return "live";
  if (secret.startsWith("sk_test")) return "sandbox";
  return "unknown";
}

function getStripe() {
  const secret = process.env.STRIPE_SECRET;
  if (!secret) {
    console.error(
      "STRIPE_SECRET is not set. Add it to .env.live (live) or .env (sandbox), or pass STRIPE_SECRET=sk_... on the command line."
    );
    process.exit(1);
  }
  return require("stripe")(secret);
}

function assertEnvConsistency(requestedEnv, loadedFile) {
  const mode = stripeMode(process.env.STRIPE_SECRET);
  if (requestedEnv && mode !== "missing" && mode !== requestedEnv) {
    console.error(
      `Requested --env ${requestedEnv} but STRIPE_SECRET is a ${mode} key (loaded from ${loadedFile}).`
    );
    console.error(
      "Use the matching key, e.g. create .env.live with sk_live_... or pass STRIPE_SECRET inline."
    );
    process.exit(1);
  }
  return mode;
}

async function priceExists(stripe, lookupKey) {
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  return prices.data[0] ?? null;
}

async function setupStripeSubscriptions(stripe, { force }) {
  console.log("Starting Stripe subscription setup\n");

  let created = 0;
  let skipped = 0;

  for (const [key, plan] of Object.entries(PLANS)) {
    const existing = await priceExists(stripe, plan.lookup_key);
    if (existing && !force) {
      console.log(`Skip ${plan.name}: lookup_key "${plan.lookup_key}" already exists (${existing.id})`);
      skipped++;
      continue;
    }

    if (existing && force) {
      console.log(`Force: creating new price for ${plan.lookup_key} (existing ${existing.id} stays active until archived)`);
    }

    console.log(`Creating product: ${plan.name}...`);

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: {
        has_ads: plan.has_ads.toString(),
        newsletter: plan.newsletter.toString(),
        features: JSON.stringify(plan.features),
      },
    });

    console.log(`   Product created: ${product.id}`);

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price,
      currency: "usd",
      recurring: { interval: "month" },
      lookup_key: plan.lookup_key,
      transfer_lookup_key: true,
      metadata: { plan_type: key },
    });

    console.log(`   Price created: ${price.id}`);
    console.log(`   Amount: $${(plan.price / 100).toFixed(2)}/month`);
    console.log(`   Lookup Key: ${plan.lookup_key}\n`);
    created++;
  }

  console.log(`Done. Created: ${created}, skipped (already present): ${skipped}`);
  if (skipped && !force) {
    console.log("Use --force to create duplicate prices (old ones should be archived manually in Stripe).");
  }
}

async function listExistingPrices(stripe) {
  console.log("\nListing active prices with lookup keys...\n");
  const prices = await stripe.prices.list({ limit: 100, active: true });

  const withLookup = prices.data.filter((p) => p.lookup_key);
  if (!withLookup.length) {
    console.log("No active prices with lookup_key found.");
    return;
  }

  for (const price of withLookup) {
    const product = await stripe.products.retrieve(price.product);
    console.log(`Product: ${product.name}`);
    console.log(`  Price ID: ${price.id}`);
    console.log(`  Lookup Key: ${price.lookup_key}`);
    console.log(`  Amount: $${(price.unit_amount / 100).toFixed(2)}/${price.recurring?.interval || "one-time"}`);
    console.log(`  Active: ${price.active}\n`);
  }
}

async function archiveOldPrices(stripe, lookupKeys) {
  console.log("\nArchiving old prices...\n");

  for (const lookupKey of lookupKeys) {
    try {
      const prices = await stripe.prices.list({ lookup_keys: [lookupKey] });

      for (const price of prices.data) {
        if (price.active) {
          await stripe.prices.update(price.id, { active: false });
          console.log(`   Archived price: ${price.id} (${lookupKey})`);
        }
      }
    } catch {
      console.log(`   No price found for lookup key: ${lookupKey}`);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const loadedFile = loadEnv(opts.env);
  const mode = assertEnvConsistency(opts.env, loadedFile);
  const stripe = getStripe();

  console.log(`Env file: ${loadedFile}`);
  console.log(`Stripe mode: ${mode}\n`);

  if (opts.env === "live" && !opts.list && !opts.archiveOld && !opts.confirm) {
    console.error(
      "Refusing to create live products without --confirm.\n" +
        "Run: node scripts/setup-stripe-subscriptions.js --env live --confirm"
    );
    process.exit(1);
  }

  if (opts.list) {
    await listExistingPrices(stripe);
  } else if (opts.archiveOld) {
    await archiveOldPrices(stripe, ["basic_scholor", "pro_scholor", "expert_scholor"]);
  } else {
    await setupStripeSubscriptions(stripe, { force: opts.force });
    console.log("\nNext steps:");
    console.log("   1. Verify products in Stripe Dashboard (toggle Test/Live mode)");
    console.log(`   2. node scripts/setup-stripe-subscriptions.js --list --env ${opts.env || mode}`);
    console.log("   3. Ensure production API uses sk_live_... and live webhook endpoint");
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  if (error.raw) console.error("Raw:", error.raw);
  process.exit(1);
});
