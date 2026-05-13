const { config } = require("../config");
const UserModel = require("../database/models/user");
const { errorResponse, serverError } = require("../utils/response");

const stripe = require("stripe")(process.env.STRIPE_SECRET);

const createCheckoutSession = async (req, res) => {
  try {
    const user = req.user;
    const lookupKey = req.body.plan;

    if (!lookupKey) {
      return errorResponse(res, 400, "A subscription plan is required.", "VALIDATION_ERROR");
    }

    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      expand: ["data.product"],
    });

    if (!prices.data.length) {
      return errorResponse(res, 404, "The selected plan does not exist.", "NOT_FOUND");
    }

    const price = prices.data[0];

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: price.id, quantity: 1 }],
      mode: price.type === "recurring" ? "subscription" : "payment",
      success_url: `${config.STRIPE_SUCCESS_CALLBACK_URL}/{CHECKOUT_SESSION_ID}?userId=${user._id}&plan=${req.body.plan}`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return serverError(res);
  }
};

const PLAN_CONFIG = {
  basic_learner:   { hasAds: true,  newsletter: false },
  pro_learner:     { hasAds: false, newsletter: true  },
  basic_educator:  { hasAds: true,  newsletter: false },
  pro_educator:    { hasAds: false, newsletter: true  },
};

const paymentSuccess = async (req, res) => {
  try {
    const sessionId = req.params.session_id;
    const { plan, userId } = req.query;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return errorResponse(res, 404, "Payment session not found.", "NOT_FOUND");
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return errorResponse(res, 404, "User not found.", "USER_NOT_FOUND");
    }

    const planConfig = PLAN_CONFIG[plan];
    if (!planConfig) {
      return errorResponse(res, 400, "Invalid subscription plan.", "VALIDATION_ERROR");
    }

    user.subscription.id = session.subscription;
    user.subscription.plan = plan;
    user.subscription.subscriptionDate = new Date();
    user.subscription.hasAds = planConfig.hasAds;
    user.subscription.newsletter = planConfig.newsletter;
    await user.save();

    return res.redirect(`${config.UI_BASE_URL}/dashboard`);
  } catch (err) {
    console.error("Payment success error:", err);
    return serverError(res);
  }
};

const subscriptionController = {
  createCheckoutSession,
  paymentSuccess,
};

module.exports = subscriptionController;
