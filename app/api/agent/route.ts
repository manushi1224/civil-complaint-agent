import { NextRequest, NextResponse } from "next/server";
import { type Content, type Part } from "@google/genai";
import { ai, GEMINI_MODEL } from "@/lib/gemini";
import { civicTools, executeToolCall } from "@/lib/tools";

const SYSTEM_INSTRUCTION = `You are the City Civic Complaint Agent. Your mission is to help citizens report civic issues (potholes, garbage dumps, broken streetlights, waterlogging) quickly and track their grievances.
When provided an image:
- Carefully inspect visual evidence to diagnose the exact issue, hazard level, and assign the proper department (Roads & Infrastructure, Solid Waste Management, Electricity & Streetlights, or Stormwater & Drainage).
- If the user did not specify a ward or landmark, infer a realistic ward/locality or pick 'Ward 150 (Central Ward)' as default.
- You MUST call \`file_civic_complaint\` to register the issue.
When asked about existing tickets (e.g. 'CIVIC-XXXX'):
- You MUST call \`check_complaint_status\`.
After receiving tool results, provide a clear, concise, and helpful response summarizing the action taken, the generated Ticket ID, assigned department, and expected resolution time.`;

interface ChatHistoryTurn {
  role: "user" | "model";
  text: string;
}

interface AgentRequestBody {
  message?: string;
  image?: {
    data: string;
    mimeType?: string;
  };
  history?: ChatHistoryTurn[];
}

/**
 * Normalizes base64 string and extracts MIME type if encoded as a Data URI.
 */
function cleanBase64Data(raw: string, fallbackMime = "image/jpeg"): { data: string; mimeType: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (match) {
    return {
      mimeType: match[1] || fallbackMime,
      data: match[2].trim(),
    };
  }
  return {
    mimeType: fallbackMime,
    data: trimmed,
  };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Gemini API key presence
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "") {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured on the server. Please verify your environment variables.",
        },
        { status: 500 }
      );
    }

    // 2. Parse and validate JSON payload
    let body: AgentRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload in request body." },
        { status: 400 }
      );
    }

    const { message, image, history } = body;

    if (!message?.trim() && !image?.data) {
      return NextResponse.json(
        {
          error:
            "Invalid request: Please provide either a message or an image of the civic issue.",
        },
        { status: 400 }
      );
    }

    // 3. Assemble contents with conversational history and current turn
    const contents: Content[] = [];

    // Append prior conversational turns if provided
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (
          turn &&
          (turn.role === "user" || turn.role === "model") &&
          typeof turn.text === "string" &&
          turn.text.trim()
        ) {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text.trim() }],
          });
        }
      }
    }

    // Build current user turn parts
    const currentParts: Part[] = [];

    let cleanImageBase64: string | undefined;
    if (image?.data) {
      const { data, mimeType } = cleanBase64Data(
        image.data,
        image.mimeType || "image/jpeg"
      );
      cleanImageBase64 = data;
      currentParts.push({
        inlineData: {
          data,
          mimeType,
        },
      });
    }

    const promptText =
      message?.trim() ||
      "Please inspect this civic hazard and file an official complaint.";
    currentParts.push({ text: promptText });

    contents.push({
      role: "user",
      parts: currentParts,
    });

    // 4. Initial call to Gemini model with civic tools configuration
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: civicTools,
      },
    });

    // 5. Inspect if the model requested any function calls
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const toolCall = functionCalls[0];
      const toolName = toolCall.name;
      const toolArgs = ((toolCall.args as Record<string, any>) || {});

      if (!toolName) {
        return NextResponse.json(
          { error: "Model invoked an undefined tool name." },
          { status: 500 }
        );
      }

      // If filing a complaint and citizen uploaded an image, attach it to args if omitted
      if (
        toolName === "file_civic_complaint" &&
        !toolArgs.image_data &&
        cleanImageBase64
      ) {
        toolArgs.image_data = cleanImageBase64;
      }

      // Execute the requested tool
      const toolResult = await executeToolCall(toolName, toolArgs);

      // Model candidate content reflecting the tool call turn
      const modelTurnContent: Content =
        response.candidates?.[0]?.content || {
          role: "model",
          parts: [
            {
              functionCall: {
                name: toolName,
                args: toolArgs,
                ...(toolCall.id ? { id: toolCall.id } : {}),
              },
            },
          ],
        };

      // Construct tool response turn
      const toolResponsePart: Part = {
        functionResponse: {
          name: toolName,
          ...(toolCall.id ? { id: toolCall.id } : {}),
          response: {
            result: toolResult,
            output: toolResult,
          },
        },
      };

      const followUpContents: Content[] = [
        ...contents,
        modelTurnContent,
        {
          role: "user",
          parts: [toolResponsePart],
        },
      ];

      // Second turn: send function response back to Gemini to synthesize natural response
      const followUpResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: followUpContents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: civicTools,
        },
      });

      const finalAiText =
        followUpResponse.text ||
        "The civic action was processed successfully. Please review the ticket details.";

      return NextResponse.json({
        reply: finalAiText,
        toolExecuted: {
          name: toolName,
          args: toolArgs,
          result: toolResult,
        },
      });
    }

    // 6. Direct conversational reply without tool calls
    return NextResponse.json({
      reply:
        response.text ||
        "I have received your request. How else can I assist you with city services?",
    });
  } catch (error: any) {
    console.error("Agent Route Error:", error);
    const errorMessage =
      error?.message ||
      "An unexpected error occurred while processing the civic complaint request.";

    return NextResponse.json(
      { error: errorMessage },
      { status: error?.status || 500 }
    );
  }
}
