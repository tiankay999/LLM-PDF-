"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";

type RuleResult = {
    rule: string;
    status: "pass" | "fail" | string;
    evidence: string;
    reasoning: string;
    confidence: number;
};

export default function HomePage() {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [rules, setRules] = useState<string[]>(["", "", ""]);
    const [results, setResults] = useState<RuleResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file && file.type !== "application/pdf") {
            setError("Please upload a PDF file.");
            setPdfFile(null);
            return;
        }

        setError("");
        setPdfFile(file || null);
    };

    const handleRuleChange = (index: number, value: string) => {
        const next = [...rules];
        next[index] = value;
        setRules(next);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setResults([]);

        if (!pdfFile) {
            setError("Please upload a PDF first.");
            return;
        }

        const nonEmptyRules = rules.filter((r) => r.trim() !== "");
        if (nonEmptyRules.length === 0) {
            setError("Please enter at least one rule.");
            return;
        }

        setLoading(true);
        
        // FIX: API IS IN THE .ENV LOCAL VARIABLE//
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5004";

        try {
            const formData = new FormData();
            formData.append("pdf", pdfFile);
            formData.append("rules", JSON.stringify(nonEmptyRules));

            const res = await fetch(`${apiUrl}/check-pdf`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                // Provide a clearer error message to the user
                throw new Error(data.error || `Server error: ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            setResults(data.results || []);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Something went wrong during the check.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl backdrop-blur-sm p-6 md:p-8">
                {/* Header */}
                <header className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                        PDF Rule Checker <span className="text-emerald-400">(LLM)</span>
                    </h1>
                    <p className="mt-2 text-sm md:text-base text-slate-400 max-w-2xl">
                        Upload a PDF, define up to three natural-language rules, and let the
                        LLM decide whether the document <span className="font-medium">passes</span> or{" "}
                        <span className="font-medium">fails</span> each rule with evidence,
                        reasoning, and a confidence score.
                    </p>
                </header>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6 mb-4">
                    {/* PDF Upload */}
                    <section className="space-y-2">
                        <label className="block text-sm font-medium text-slate-200">
                            1. Upload PDF
                        </label>
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                            className="block w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-900 hover:file:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        />
                        {pdfFile && (
                            <p className="text-xs text-slate-400">
                                Selected: <span className="text-slate-100">{pdfFile.name}</span>
                            </p>
                        )}
                    </section>

                    {/* Rules */}
                    <section className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                            <label className="block text-sm font-medium text-slate-200">
                                2. Enter up to 3 rules
                            </label>
                            <span className="text-[11px] uppercase tracking-wide text-slate-500">
                                Natural language, not code
                            </span>
                        </div>
                        <p className="text-xs text-slate-400">
                            Examples: &quot;Document must mention a date.&quot;, &quot;Document must
                            list requirements.&quot;
                        </p>

                        <div className="mt-3 space-y-2">
                            {rules.map((rule, index) => (
                                <input
                                    key={index}
                                    type="text"
                                    placeholder={`Rule ${index + 1}`}
                                    value={rule}
                                    onChange={(e) => handleRuleChange(index, e.target.value)}
                                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                                />
                            ))}
                        </div>
                    </section>

                    {/* Submit + Error */}
                    <div className="space-y-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-600 disabled:shadow-none"
                        >
                            {loading ? "Checking document..." : "Check document"}
                        </button>

                        {error && (
                            <div className="rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-100">
                                {error}
                            </div>
                        )}
                    </div>
                </form>

                {/* Results */}
                {results.length > 0 && (
                    <section className="mt-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-lg font-medium text-slate-100">
                                3. Results
                            </h2>
                            <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
                                {results.length} rule{results.length > 1 ? "s" : ""} evaluated
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                            <table className="min-w-full divide-y divide-slate-800 text-sm">
                                <thead className="bg-slate-900/80">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium text-slate-300">
                                            Rule
                                        </th>
                                        <th className="px-3 py-2 text-left font-medium text-slate-300">
                                            Status
                                        </th>
                                        <th className="px-3 py-2 text-left font-medium text-slate-300">
                                            Evidence
                                        </th>
                                        <th className="px-3 py-2 text-left font-medium text-slate-300">
                                            Reasoning
                                        </th>
                                        <th className="px-3 py-2 text-left font-medium text-slate-300">
                                            Confidence
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                                    {results.map((r, idx) => (
                                        <tr key={idx} className="hover:bg-slate-900/60">
                                            <td className="px-3 py-2 align-top text-slate-100 max-w-xs">
                                                {r.rule}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                                                        r.status === "pass"
                                                            ? "bg-emerald-900/50 text-emerald-200 border border-emerald-700/60"
                                                            : "bg-red-900/50 text-red-200 border border-red-700/60"
                                                    }`}
                                                >
                                                    {r.status || "unknown"}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 align-top text-slate-200 max-w-sm">
                                                {r.evidence}
                                            </td>
                                            <td className="px-3 py-2 align-top text-slate-300 max-w-sm">
                                                {r.reasoning}
                                            </td>
                                            <td className="px-3 py-2 align-top text-slate-100">
                                                {r.confidence}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}