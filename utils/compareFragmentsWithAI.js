const { config } = require("../config");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

async function compareFragmentsWithAI(fragmentA, fragmentB) {
  if (!fragmentA || !fragmentB) {
    throw new Error("Both fragments must be non-empty strings.");
  }

  const prompt = [
    {
      role: "system",
      content: `
You are a content comparison assistant.

Your job is to compare two user-submitted content fragments and estimate how similar they are in meaning, tone, and structure. 

Respond only in the following JSON format:
{
  "similarityScore": number (0 to 1, where 1 is extremely similar),
  "summary": string (one-paragraph explanation of your reasoning)
}
`,
    },
    {
      role: "user",
      content: `Compare the following two fragments:\n\nFragment A:\n${fragmentA}\n\nFragment B:\n${fragmentB}`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: prompt,
    temperature: 0,
  });

  const raw = response.choices[0].message.content.trim();

  try {
    const result = JSON.parse(raw);
    const similarityScore = result.similarityScore || 0;
    const summary = result.summary || "No summary provided.";

    let status = "different";
    if (similarityScore >= 0.85) status = "matched";
    else if (similarityScore >= 0.6) status = "partial_match";

    return { similarityScore, summary, status };
  } catch (err) {
    console.error("❌ Failed to parse comparison result:", err);
    return {
      similarityScore: 0,
      summary: "Unable to determine similarity due to response format error.",
      status: "error",
    };
  }
}

module.exports = { compareFragmentsWithAI };
