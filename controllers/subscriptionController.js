const { config } = require("../config");
const UserModel = require("../database/models/user");

const stripe = require("stripe")(process.env.STRIPE_SECRET);

const createCheckoutSession = async (req, res) => {
  try {
    const user = req.user;
    const lookupKey = req.body.plan;

    if (!lookupKey) {
      return res.status(400).json({ error: "Missing plan (lookup_key)" });
    }

    // Get the price object using the lookup key
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      expand: ["data.product"],
    });

    if (!prices.data.length) {
      return res
        .status(404)
        .json({ error: "Price not found for the given lookup key" });
    }

    const price = prices.data[0];

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: price.type === "recurring" ? "subscription" : "payment",
      success_url: `${config.STRIPE_SUCCESS_CALLBACK_URL}/{CHECKOUT_SESSION_ID}?userId=${user._id}&plan=${req.body.plan}`,
    });

    // Send back session URL to redirect user
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message });
  }
};

const paymentSuccess = async (req, res) => {
  try {
    const sessionId = req.params.session_id;
    const { plan, userId } = req.query;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res
        .status(404)
        .json({ error: "There was a problem processing the payment" });
    }

    // Update user subscription details in the database
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.subscription.id = session.subscription;
    user.subscription.plan = plan;
    user.subscription.subscriptionDate = new Date();
    await user.save();

    return res.redirect(`${config.UI_BASE_URL}/dashboard`);
  } catch (err) {
    console.error("Payment success error:", err);
    res.status(500).json({ error: err.message });
  }
};

const subscriptionController = {
  createCheckoutSession,
  paymentSuccess,
};

module.exports = subscriptionController;
