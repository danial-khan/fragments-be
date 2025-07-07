const { compareFragmentsWithAI } = require("./utils/compareFragmentsWithAI");

const fragment1 = {
  title: "Introduction to Forex Trading",
  description: "A beginner's overview of how forex markets work.",
  content: `<p>Forex trading involves buying and selling currency pairs to profit from fluctuations in exchange rates. 
  Beginners should study the basics and practice using demo accounts.</p>`,
};

const fragment2 = {
  title: "Understanding Currency Trading",
  description: "Learn how to start trading forex safely.",
  content: `<p>Trading in foreign exchange markets means exchanging one currency for another. 
  It’s important to use demo accounts, manage risk, and stay informed about economic events.</p>`,
};

function extractTextFromFragment(fragment) {
  return `Title: ${fragment.title}\nDescription: ${
    fragment.description
  }\nContent: ${stripHTML(fragment.content)}`;
}

function stripHTML(html) {
  return html.replace(/<[^>]*>/g, "").trim();
}

(async () => {
  const textA = extractTextFromFragment(fragment1);
  const textB = extractTextFromFragment(fragment2);

  console.log("🔍 Comparing the following fragments:\n");
  console.log("📘 Fragment A:\n", textA);
  console.log("\n📙 Fragment B:\n", textB);
  console.log("\n----------------------------------\n");

  const result = await compareFragmentsWithAI(textA, textB);

  console.log("📊 Similarity Result:\n");
  console.dir(result, { depth: null });
})();
