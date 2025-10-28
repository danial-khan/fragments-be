/**
 * Subscription-based middleware for access control
 */

const EDUCATOR_PLANS = ['basic_educator', 'pro_educator'];
const LEARNER_PLANS = ['basic_learner', 'pro_learner'];
const PRO_PLANS = ['pro_learner', 'pro_educator'];

/**
 * Middleware to check if user is an educator
 * Educators can create fragments and trails
 */
const isEducatorMiddleware = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }

  // Check if user has a subscription
  if (!user.subscription || !user.subscription.plan) {
    return res.status(403).json({ 
      error: 'Active subscription required',
      message: 'Please subscribe to an Educator plan to create fragments.',
      requiresEducator: true
    });
  }

  // Check if user has educator plan
  if (!EDUCATOR_PLANS.includes(user.subscription.plan)) {
    return res.status(403).json({ 
      error: 'Educator subscription required',
      message: 'Only educators can create fragments. Please upgrade to a Basic Educator or Pro Educator plan.',
      currentPlan: user.subscription.plan,
      requiresEducator: true
    });
  }

  // User is an educator, allow access
  next();
};

/**
 * Middleware to check if user has pro subscription
 * Pro users get newsletter and ad-free experience
 */
const isProUserMiddleware = (req, res, next) => {
  const user = req.user;

  if (!user || !user.subscription || !user.subscription.plan) {
    return res.status(403).json({ 
      error: 'Pro subscription required',
      message: 'This feature is only available for Pro subscribers.'
    });
  }

  if (!PRO_PLANS.includes(user.subscription.plan)) {
    return res.status(403).json({ 
      error: 'Pro subscription required',
      message: 'Upgrade to a Pro plan to access this feature.',
      currentPlan: user.subscription.plan
    });
  }

  next();
};

/**
 * Helper function to check if user is educator (for use in controllers)
 */
const isEducator = (user) => {
  return user && 
         user.subscription && 
         user.subscription.plan && 
         EDUCATOR_PLANS.includes(user.subscription.plan);
};

/**
 * Helper function to check if user is learner (for use in controllers)
 */
const isLearner = (user) => {
  return user && 
         user.subscription && 
         user.subscription.plan && 
         LEARNER_PLANS.includes(user.subscription.plan);
};

/**
 * Helper function to check if user is pro (for use in controllers)
 */
const isProUser = (user) => {
  return user && 
         user.subscription && 
         user.subscription.plan && 
         PRO_PLANS.includes(user.subscription.plan);
};

module.exports = {
  isEducatorMiddleware,
  isProUserMiddleware,
  isEducator,
  isLearner,
  isProUser,
  EDUCATOR_PLANS,
  LEARNER_PLANS,
  PRO_PLANS
};

