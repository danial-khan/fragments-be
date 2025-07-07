const { analyzeContentWithAI } = require("./utils/aiReview");

const safeFragment = `
Forex (foreign exchange) trading involves buying and selling currencies to profit from exchange rate fluctuations.
It is important to learn and practice using demo accounts, understand technical analysis, and follow global news events.
Always trade responsibly and never invest money you can't afford to lose.
`;

const unsafeFragment = `
Forex is a guaranteed way to become rich overnight. Just borrow money or use your credit card and go all in.
There are secret strategies banks don’t want you to know, but if you take big risks, you will win big.
Ignore regulations and just follow aggressive trading moves like I do.
`;

const safeReply = `Thanks for explaining! I’ll definitely research more before investing.`;

const unsafeReply = `Only idiots think regulations matter. Just scam your way to the top.`;

(async () => {
  console.log("🔍 Testing Safe Fragment:\n");
  const fragRes1 = await analyzeContentWithAI(safeFragment, "fragments");
  console.dir(fragRes1, { depth: null });

  console.log("\n-----------------------------\n");

  console.log("⚠️ Testing Unsafe Fragment:\n");
  const fragRes2 = await analyzeContentWithAI(unsafeFragment, "fragments");
  console.dir(fragRes2, { depth: null });

  console.log("\n=============================\n");

  console.log("💬 Testing Safe Reply:\n");
  const replyRes1 = await analyzeContentWithAI(safeReply, "reply");
  console.dir(replyRes1, { depth: null });

  console.log("\n-----------------------------\n");

  console.log("🚫 Testing Unsafe Reply:\n");
  const replyRes2 = await analyzeContentWithAI(unsafeReply, "reply");
  console.dir(replyRes2, { depth: null });
})();
