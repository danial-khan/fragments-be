const { config } = require("../config");
const OpenAI = require("openai");
const { getFragmentsModerationPrompt } = require("../prompts/fragments");
const { getReplyModerationPrompt } = require("../prompts/reply");

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

async function analyzeContentWithAI(text, type = "fragments") {
  if (!["fragments", "reply"].includes(type)) {
    throw new Error("Invalid type. Must be 'fragments' or 'reply'");
  }

  const prompt =
    type === "fragments"
      ? getFragmentsModerationPrompt(text)
      : getReplyModerationPrompt(text);

  const chatRes = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: prompt,
    temperature: 0,
  });

  const raw = chatRes.choices[0].message.content.trim();

  let feedback;
  let summary = "";

  try {
    feedback = JSON.parse(raw);
    summary = feedback.summary || "";
    delete feedback.summary; // remove summary from main object
  } catch (err) {
    console.error("❌ Failed to parse AI feedback:", err);
    feedback =
      type === "fragments"
        ? {
            abusive: { flagged: false, examples: [] },
            plagiarism: { similarityScore: 0, matches: [] },
            misinformation: { flagged: false, notes: "" },
            unethical: { flagged: false, examples: [] },
          }
        : {
            abusive: { flagged: false, examples: [] },
            harshTone: { flagged: false, phrases: [] },
            misinformation: { flagged: false, notes: "" },
            spam: { flagged: false, reason: "" },
            unethical: { flagged: false, examples: [] },
          };
    summary = "";
  }

  feedback.timestamp = new Date().toISOString();

  let status = "approved";

  if (type === "fragments") {
    if (feedback.abusive.flagged || feedback.unethical.flagged) {
      status = "rejected";
    } else if (
      feedback.plagiarism.similarityScore > 0.6 ||
      feedback.misinformation.flagged
    ) {
      status = "requires_human_review";
    }
  } else {
    if (
      feedback.abusive.flagged ||
      feedback.harshTone.flagged ||
      feedback.spam.flagged ||
      feedback.unethical.flagged
    ) {
      status = "rejected";
    } else if (feedback.misinformation.flagged) {
      status = "requires_human_review";
    }
  }

  return { status, feedback, summary };
}

module.exports = { analyzeContentWithAI };
