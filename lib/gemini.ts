import { GoogleGenAI } from "@google/genai";

// Initialize Google Gen AI SDK singleton instance
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const GEMINI_MODEL = "gemini-2.5-flash";
