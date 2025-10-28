# Backend Scripts

This directory contains utility scripts for the Fragments platform.

## Available Scripts

### 1. setup-stripe-subscriptions.js
Creates the new subscription products and prices in your Stripe account.

### 2. generateFragments.js
Generates HTML-formatted educational fragments using AI for a specific user across all categories.

---

## Script Details

## setup-stripe-subscriptions.js

### Overview
This script creates the new subscription products and prices in your Stripe account.

## Prerequisites
- Node.js installed
- Stripe account
- Stripe secret key set in your `.env` file

## Environment Setup

Make sure your `.env` file in the `fragments-be` directory contains:

```env
STRIPE_SECRET=sk_test_xxxxx  # Use sk_live_xxxxx for production
```

## Usage

### 1. Create New Subscription Plans

Run this command to create all 4 new subscription plans in Stripe:

```bash
cd fragments-be
node scripts/setup-stripe-subscriptions.js
```

This will create:
- **Basic Learner** ($5/month) - with ads
- **Pro Learner** ($15/month) - no ads + newsletter
- **Basic Educator** ($20/month) - with ads
- **Pro Educator** ($30/month) - no ads + newsletter

Output will show:
```
🚀 Starting Stripe subscription setup...

📦 Creating product: Basic Learner...
   ✅ Product created: prod_xxxxx
   ✅ Price created: price_xxxxx
   💰 Price: $5.00/month
   🔑 Lookup Key: basic_learner

... (repeated for each plan)

✨ All subscription plans created successfully!
```

### 2. List Existing Prices (Optional)

To see all current prices in your Stripe account:

```bash
node scripts/setup-stripe-subscriptions.js --list
```

### 3. Archive Old Plans (Optional)

After verifying the new plans work, archive the old subscription plans:

```bash
node scripts/setup-stripe-subscriptions.js --archive-old
```

This will deactivate the old lookup keys:
- `basic_scholor`
- `pro_scholor`
- `expert_scholor`

**Note:** This will prevent new subscriptions to old plans but won't affect existing subscribers.

## Manual Stripe API Commands (Alternative)

If you prefer to use curl commands directly, here are the equivalent API calls:

### Create Basic Learner Product

```bash
curl https://api.stripe.com/v1/products \
  -u "YOUR_STRIPE_SECRET_KEY:" \
  -d name="Basic Learner" \
  -d description="Perfect for curious minds starting their learning journey" \
  -d "metadata[has_ads]"=true \
  -d "metadata[newsletter]"=false
```

Save the `id` from the response (e.g., `prod_xxxxx`), then create the price:

```bash
curl https://api.stripe.com/v1/prices \
  -u "YOUR_STRIPE_SECRET_KEY:" \
  -d product="prod_xxxxx" \
  -d unit_amount=500 \
  -d currency=usd \
  -d "recurring[interval]"=month \
  -d lookup_key="basic_learner"
```

### Create Pro Learner Product

```bash
curl https://api.stripe.com/v1/products \
  -u "YOUR_STRIPE_SECRET_KEY:" \
  -d name="Pro Learner" \
  -d description="For dedicated learners who want an ad-free experience" \
  -d "metadata[has_ads]"=false \
  -d "metadata[newsletter]"=true
```

Then create the price:

```bash
curl https://api.stripe.com/v1/prices \
  -u "YOUR_STRIPE_SECRET_KEY:" \
  -d product="PRODUCT_ID_FROM_ABOVE" \
  -d unit_amount=1500 \
  -d currency=usd \
  -d "recurring[interval]"=month \
  -d lookup_key="pro_learner"
```

### Create Basic Educator Product

```bash
curl https://api.stripe.com/v1/products \
  -u "YOUR_STRIPE_SECRET_KEY:" \
  -d name="Basic Educator" \
  -d description="For educators who want to share knowledge" \
  -d "metadata[has_ads]"=true \
  -d "metadata[newsletter]"=false
```

Then create the price:

```bash
curl https://api.stripe.com/v1/prices \
  -u "YOUR_STRIPE_SECRET_KEY:" \
  -d product="PRODUCT_ID_FROM_ABOVE" \
  -d unit_amount=2000 \
  -d currency=usd \
  -d "recurring[interval]"=month \
  -d lookup_key="basic_educator"
```

### Create Pro Educator Product

```bash
curl https://api.stripe.com/v1/products \
  -u "YOUR_STRIPE_SECRET_KEY:" \
  -d name="Pro Educator" \
  -d description="Premium features for professional educators" \
  -d "metadata[has_ads]"=false \
  -d "metadata[newsletter]"=true
```

Then create the price:

```bash
curl https://api.stripe.com/v1/prices \
  -u "YOUR_STRIPE_SECRET_KEY:" \
  -d product="PRODUCT_ID_FROM_ABOVE" \
  -d unit_amount=3000 \
  -d currency=usd \
  -d "recurring[interval]"=month \
  -d lookup_key="pro_educator"
```

## Verification

After running the script, verify in your Stripe Dashboard:

1. Go to https://dashboard.stripe.com/products
2. You should see 4 new products:
   - Basic Learner ($5.00/month)
   - Pro Learner ($15.00/month)
   - Basic Educator ($20.00/month)
   - Pro Educator ($30.00/month)

3. Each product should have:
   - A monthly recurring price
   - A lookup key
   - Metadata with `has_ads` and `newsletter` flags

## Testing

### Test Mode
Use test API keys (starting with `sk_test_`) to test the setup without creating real products.

### Live Mode
When ready for production, switch to live API keys (starting with `sk_live_`) and run the script again.

## Troubleshooting

### Error: "No such lookup_key"
- The lookup key doesn't exist yet
- Run the setup script to create the products and prices

### Error: "Invalid API Key"
- Check your `.env` file
- Ensure `STRIPE_SECRET` is set correctly
- Verify you're using the correct key for your environment (test/live)

### Error: "A resource with that lookup_key already exists"
- The lookup key is already in use
- Either use a different lookup key or update the existing price
- Use `--list` to see existing prices

### Products created but checkout fails
- Verify lookup keys match exactly in your code
- Check that prices are active in Stripe Dashboard
- Ensure your webhook endpoints are configured (if using webhooks)

## Important Notes

1. **Lookup Keys**: These are case-sensitive and must match exactly in your code
2. **Currency**: All prices are in USD (can be modified in the script)
3. **Billing Interval**: All plans are monthly recurring (can be modified)
4. **Existing Subscriptions**: Existing customers won't be automatically migrated
5. **Webhooks**: Configure Stripe webhooks to handle subscription events

## Next Steps

After running this script:

1. ✅ Verify products in Stripe Dashboard
2. ✅ Test checkout flow with test cards
3. ✅ Configure webhooks for subscription events (if needed)
4. ✅ Deploy backend and frontend changes
5. ✅ Communicate changes to existing users
6. ✅ Monitor subscription analytics in Stripe

## Support

For issues:
- Check Stripe Dashboard logs
- Review Stripe API documentation: https://stripe.com/docs/api
- Contact Stripe support for payment-related issues

---

## generateFragments.js

### Overview
Generates HTML-formatted educational fragments using AI (OpenAI GPT-4o-mini) for a specific user across all categories in your database. Content is properly structured with headings, lists, and rich text formatting.

### Prerequisites
- Node.js installed
- MongoDB connection configured
- OpenAI API key set in your `.env` file
- User ID to generate fragments for
- Categories exist (created automatically on server startup)

### Environment Setup

Make sure your `.env` file contains:

```env
OPENAI_API_KEY=sk-xxxxx
```

### Usage

**Get a user ID first:**

```bash
# Find user ID in database
mongosh your_database
db.users.findOne({ type: "admin" }, { _id: 1, email: 1 })
# Or find by email
db.users.findOne({ email: "user@example.com" }, { _id: 1 })
```

**Generate fragments for a specific user:**

```bash
cd fragments-be
node scripts/generateFragments.js <USER_ID>

# Example:
node scripts/generateFragments.js 507f1f77bcf86cd799439011
```

This will:
1. Connect to your database
2. Validate and find the specified user
3. Fetch all active categories
4. Generate 3 unique HTML-formatted fragments per category
5. Apply AI content moderation
6. Save to database with user as author

### Output Example

```
🚀 Starting Fragment Generation Script

📦 Connecting to database...
✅ Database connected

👤 Finding user with ID: 507f1f77bcf86cd799439011...
✅ Using user: teacher@example.com (John Teacher)
   Type: author

📚 Fetching categories...
✅ Found 11 categories

============================================================
📖 Category 1/11: History (green)
============================================================

   [1/3] Generating content... Creating fragment... ✅ SUCCESS
   [2/3] Generating content... Creating fragment... ✅ SUCCESS
   [3/3] Generating content... Creating fragment... ✅ SUCCESS

   📊 Category Summary:
      ✅ Success: 3
      ⚠️  Blocked: 0
      ❌ Failed: 0

...

============================================================
🎉 FRAGMENT GENERATION COMPLETE
============================================================

📊 Final Statistics:
   Total Processed: 33
   ✅ Successfully Created: 33
   ⚠️  Blocked by AI: 0
   ❌ Failed: 0

   User: teacher@example.com
   Categories: 11
   Fragments per Category: 3
   Success Rate: 100%
```

### Customization

**Change fragments per category:**

```javascript
// In generateFragments.js
const fragmentsPerCategory = 3; // Change this number
```

**Generate for multiple users:**

```bash
# Create a bash script
for user_id in "507f1..." "507f2..." "507f3..."; do
  node scripts/generateFragments.js "$user_id"
done
```

**Use different AI model:**

```javascript
// In generateFragmentContent function
model: "gpt-4o", // or "gpt-4-turbo"
```

### Cost Estimate

Using GPT-4o-mini:
- ~$0.012 per fragment (includes HTML formatting)
- ~$0.40 per run (33 fragments = 11 categories × 3)
- ~$4.00 for 10 users
- HTML content has slightly higher token usage

### Performance

- ~3-5 seconds per fragment
- ~2-3 minutes for 33 fragments
- Rate limited to 1000ms (1 second) between requests
- HTML generation adds minimal overhead

### Troubleshooting

**Error: User ID is required**
```bash
# Provide user ID as argument
node scripts/generateFragments.js <USER_ID>
```

**Error: Invalid user ID format**
- Ensure ID is a valid MongoDB ObjectId (24 hex characters)
- Get correct ID from database using mongosh

**Error: User not found**
```bash
# Verify user exists
mongosh your_database
db.users.findOne({ _id: ObjectId("YOUR_USER_ID") })
```

**Error: No categories found**
```bash
# Start server once to create default categories
npm start
```

**Error: OpenAI API error**
- Verify `OPENAI_API_KEY` is set in `.env`
- Check API key has sufficient credits
- Ensure not hitting rate limits

### Content Features

✅ **HTML Rich Text Formatting:**
- Headings: `<h2>`, `<h3>`
- Paragraphs: `<p>`
- Emphasis: `<strong>`, `<em>`
- Lists: `<ul>`, `<ol>`, `<li>`
- Well-structured educational content

For complete documentation, see `FRAGMENT_GENERATION.md` in the project root.

