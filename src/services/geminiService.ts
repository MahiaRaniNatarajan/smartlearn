import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateQuiz(topic: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a 5-question multiple choice quiz about ${topic}. Return only JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            correctAnswer: { type: Type.STRING }
          },
          required: ["question", "options", "correctAnswer"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
}

export async function getStudyRecommendations(subject: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide 3 study resource recommendations for ${subject}. Include a title and a brief description for each.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
}

export async function chatWithAssistant(message: string, context: string = "") {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: message,
    config: {
      systemInstruction: `You are a helpful study assistant. Provide clear, concise answers. Avoid excessive markdown formatting like bolding unless it's essential for clarity. Context: ${context}`
    }
  });
  return response.text;
}

export async function generateStudyPlan(subjects: string, freeTime: string, duration: 'weekly' | 'monthly') {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a ${duration} study plan for the following subjects: ${subjects}. The student has the following free time: ${freeTime}. 
    Format the response as a JSON array of timeline items. Each item should have 'day', 'time', 'subject', and 'activity'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING },
            time: { type: Type.STRING },
            subject: { type: Type.STRING },
            activity: { type: Type.STRING }
          },
          required: ["day", "time", "subject", "activity"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
}
