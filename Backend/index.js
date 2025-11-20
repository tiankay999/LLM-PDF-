const express = require('express');
const app = express();
const cors = require('cors');

const pdfparse = require('pdf-parse');
const multer = require('multer');
const dotenv = require('dotenv');
const OpenAI = require('openai');

//allow the frontend to access the backend//
app.use(cors());
app.use(express.json());


//environment variables  configuration//
dotenv.config();


const upload=multer({storage:multer.memoryStorage()});

//openai configuration//
const openai = new OpenAI({
    apiKey:process.env.OPENAI_API_KEY,
});





// asling the LLM to check our rule at hand //
async function checkRuleWithLLM(rule, documentText) {
//truncated it to avoid exceeding  token limit //
  const MAX_CHARS = 12000;
  const truncatedText =
    documentText.length > MAX_CHARS
      ? documentText.slice(0, MAX_CHARS)
      : documentText;

  const systemPrompt = `
You are an AI that checks whether a PDF document satisfies simple natural-language rules.

You will receive:
- "rule": a requirement written by the user
- "documentText": the plain text extracted from the PDF

Your job:
1. Decide if the document satisfies the rule: "pass" or "fail".
2. Provide ONE short evidence sentence from the document (or a very close paraphrase).
3. Provide 1–2 sentences of reasoning.
4. Give an integer confidence score from 0 to 100.

Return STRICT JSON with this shape:

{
  "rule": string,
  "status": "pass" | "fail",
  "evidence": string,
  "reasoning": string,
  "confidence": number
}

Do NOT include any extra keys or text outside of JSON.
If the rule doesn't make sense for the document at all, return "fail" with low confidence.
  `.trim();

  const userContent = JSON.stringify({
    rule,
    documentText: truncatedText,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini", // this is the model I want to use //
    response_format: { type: "json_object" },
    temperature: 0.1, // is is  deterministic
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const message = response.choices[0]?.message?.content || "{}";

  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch (err) {
    console.error("Failed to parse LLM JSON:", message);
    parsed = {
      rule,
      status: "fail",
      evidence: "",
      reasoning: "LLM output was not valid JSON.",
      confidence: 0,
    };
  }

  // make sure everything exists /
  return {
    rule,
    status: parsed.status || "fail",
    evidence: parsed.evidence || "",
    reasoning: parsed.reasoning || "",
    confidence:
      typeof parsed.confidence === "number" ? parsed.confidence : 0,
  };
}






























































































const PORT =process.env.PORT || 5004;
app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`);
});
