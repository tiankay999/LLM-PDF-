const express = require("express");
const cors = require("cors");
const pdfParseLib = require("pdf-parse"); // The local PDF parser
const multer = require("multer");
const dotenv = require("dotenv");
const OpenAI = require("openai");

dotenv.config();

const app = express();

// allow the frontend to access the backend
app.use(cors({ origin: "*" }));
app.use(express.json());

// file upload in memory
const upload = multer({ storage: multer.memoryStorage() });

// OpenAI v4 client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

//  telling the LLM to check our rule
async function checkRuleWithLLM(rule, documentText) {
    // Truncate to a generous limit to avoid exceeding token limit
    const MAX_CHARS = 50000; 
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

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Fixed model
            response_format: { type: "json_object" },
            temperature: 0.1,
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
            // Handle LLM JSON failure
            return {
                rule,
                status: "fail",
                evidence: "LLM Error",
                reasoning: "LLM output was not valid JSON.",
                confidence: 0,
            };
        }
        
        // Return parsed result
        return {
            rule,
            status: parsed.status || "fail",
            evidence: parsed.evidence || "No evidence found.",
            reasoning: parsed.reasoning || "Failed to process LLM response.",
            confidence:
                typeof parsed.confidence === "number" ? parsed.confidence : 0,
        };
    } catch (llmError) {
        console.error("OpenAI API call failed:", llmError);
        // Handle LLM API call failure 
        return {
            rule,
            status: "fail",
            evidence: "API Error",
            reasoning: "Failed to communicate with the LLM API. Check OPENAI_API_KEY and billing status.",
            confidence: 0,
        };
    }
}

// main endpoint: /check-pdf
app.post("/check-pdf", upload.single("pdf"), async (req, res) => {
    try {
        const file = req.file;
        const rulesRaw = req.body.rules || "[]";

        let rules;
        try {
            rules = JSON.parse(rulesRaw);
        } catch {
            return res.status(400).json({ error: "Rules data is malformed." });
        }

        if (!file) {
            return res.status(400).json({ error: "PDF file is required" });
        }
        
        if (file.mimetype !== 'application/pdf') {
             return res.status(400).json({ error: "Only PDF files are supported." });
        }

        if (!Array.isArray(rules) || rules.length === 0) {
            return res
                .status(400)
                .json({ error: "At least one rule is required" });
        }

        // --- PDF PARSING FIXES (Handling the class/function constructor issue) ---
        let parser;
        
        // FIX: Look for the class constructor named 'PDFParse' first
        if (pdfParseLib.PDFParse && typeof pdfParseLib.PDFParse === 'function') {
            parser = pdfParseLib.PDFParse;
        } else if (typeof pdfParseLib === 'function') {
            parser = pdfParseLib;
        } else if (pdfParseLib.default && typeof pdfParseLib.default === 'function') {
            parser = pdfParseLib.default;
        }

        if (!parser) {
            console.error("CRITICAL: Could not find pdf-parse function!");
            return res.status(500).json({ error: "Server misconfiguration: PDF parser not found." });
        }

        // extract text from PDF
        let pdfData;
        try {
            // FIX: Use 'new' keyword if the parser is the class constructor (Prevents: 'cannot be invoked without new')
            if (parser === pdfParseLib.PDFParse) {
                 pdfData = await new parser(file.buffer); 
            } else {
                 pdfData = await parser(file.buffer); 
            }
        } catch (parseErr) {
             console.error("PDF Parsing failed:", parseErr);
             return res.status(500).json({ error: "Failed to read PDF content." });
        }
        
        const documentText = pdfData.text || "";
        console.log(`PDF Text Extracted. Length: ${documentText.length}`);

        if (documentText.length < 50) {
            console.warn("Extracted text is very short or empty. This will likely cause the LLM to fail.");
            return res.status(400).json({ error: "Extracted PDF text is too short or empty. Please check the PDF content." });
        }
        // --- END PDF PARSING FIXES ---


        // check each rule with LLM
        const results = [];
        // Concurrently process rules for speed//
        const ruleChecks = rules.filter((r) => r && r.trim()).map(async (rule) => {
            return checkRuleWithLLM(rule.trim(), documentText);
        });

        results.push(...(await Promise.all(ruleChecks)));

        return res.json({ results });
    } catch (err) {
        console.error("Server error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

// start server
const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});