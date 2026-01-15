
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getCurrencyInsights(from: string, to: string, amount: number) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Explain the current currency market context for ${from} to ${to}. The user is converting ${amount} ${from}. Give a brief fun lesson about this pair, one insight about why rates might change, and 3 travel spending tips.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING, description: "A friendly explanation of the exchange." },
            tips: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3 travel or spending tips."
            },
            sentiment: { 
              type: Type.STRING, 
              enum: ["positive", "negative", "neutral"],
              description: "Overall sentiment of the exchange rate trend."
            }
          },
          required: ["analysis", "tips", "sentiment"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error fetching Gemini insights:", error);
    return null;
  }
}

export async function translateInsight(insight: any, targetLang: string = "Spanish") {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Translate the following JSON object to ${targetLang}. Keep the exact same structure.
      Object: ${JSON.stringify(insight)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } },
            sentiment: { type: Type.STRING }
          },
          required: ["analysis", "tips", "sentiment"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error translating insight:", error);
    return null;
  }
}
