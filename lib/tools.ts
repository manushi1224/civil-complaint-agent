import { Type, type FunctionDeclaration, type Tool } from "@google/genai";
import {
  fileCivicComplaint,
  checkComplaintStatus,
  type CivicComplaint,
  type CivicDepartment,
  type CivicSeverity,
} from "./complaints";

/**
 * Gemini Tool Declaration for filing a citizen civic complaint.
 */
export const fileCivicComplaintDeclaration: FunctionDeclaration = {
  name: "file_civic_complaint",
  description:
    "Registers a citizen civic complaint into the municipal database after visually identifying the civic issue, ward, and department.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      department: {
        type: Type.STRING,
        description:
          "The municipal department responsible for addressing the issue.",
        enum: [
          "Roads & Infrastructure",
          "Solid Waste Management",
          "Electricity & Streetlights",
          "Stormwater & Drainage",
        ],
      },
      issue_title: {
        type: Type.STRING,
        description:
          "A concise, descriptive summary of the civic problem (e.g., 'Large pothole on 27th Main Rd').",
      },
      description: {
        type: Type.STRING,
        description:
          "Detailed description of the issue, severity indicators, and contextual observations.",
      },
      severity: {
        type: Type.STRING,
        description:
          "Severity level of the civic issue based on risk to safety or public health.",
        enum: ["Low", "Medium", "High", "Critical"],
      },
      ward: {
        type: Type.STRING,
        description:
          "The municipal ward number and name (e.g., 'Ward 174 (HSR Layout)' or citizen provided location).",
      },
      landmark: {
        type: Type.STRING,
        description:
          "Nearby prominent landmark, cross-street, or physical reference point.",
      },
    },
    required: [
      "department",
      "issue_title",
      "description",
      "severity",
      "ward",
      "landmark",
    ],
  },
};

/**
 * Gemini Tool Declaration for tracking an existing civic complaint.
 */
export const checkComplaintStatusDeclaration: FunctionDeclaration = {
  name: "check_complaint_status",
  description:
    "Retrieves the live status, assigned officer, and resolution timeline of an existing complaint by its ticket ID.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ticket_id: {
        type: Type.STRING,
        description:
          "The unique alphanumeric ticket ID of the complaint (e.g., 'CIVIC-4821').",
      },
    },
    required: ["ticket_id"],
  },
};

/**
 * Array of individual function declarations.
 */
export const civicFunctionDeclarations: FunctionDeclaration[] = [
  fileCivicComplaintDeclaration,
  checkComplaintStatusDeclaration,
];

/**
 * Tool configuration compatible with @google/genai `generateContent` config.tools.
 * Usage:
 *   await ai.models.generateContent({
 *     model: GEMINI_MODEL,
 *     contents: [...],
 *     config: { tools: civicTools }
 *   });
 */
export const civicTools: Tool[] = [
  {
    functionDeclarations: [
      fileCivicComplaintDeclaration,
      checkComplaintStatusDeclaration,
    ],
  },
];

export interface ToolExecutionSuccess<T = unknown> {
  success: true;
  name: string;
  data: T;
  message: string;
}

export interface ToolExecutionError {
  success: false;
  name: string;
  error: string;
  notFound?: boolean;
}

export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionError;

/**
 * Dispatches and executes tool calls requested by the Gemini model.
 *
 * @param name - The name of the function called ('file_civic_complaint' | 'check_complaint_status')
 * @param args - The arguments provided by the model
 * @returns Structured execution result containing success status, payload, and descriptive message.
 */
export async function executeToolCall(
  name: string,
  args: Record<string, any>
): Promise<ToolExecutionResult> {
  try {
    switch (name) {
      case "file_civic_complaint": {
        const {
          department,
          issue_title,
          description,
          severity,
          ward,
          landmark,
          image_data,
        } = args || {};

        if (
          !department ||
          !issue_title ||
          !description ||
          !severity ||
          !ward ||
          !landmark
        ) {
          return {
            success: false,
            name,
            error:
              "Missing required parameters for file_civic_complaint. Required fields: department, issue_title, description, severity, ward, landmark.",
          };
        }

        const complaint = await fileCivicComplaint({
          department: department as CivicDepartment,
          issue_title,
          description,
          severity: severity as CivicSeverity,
          ward,
          landmark,
          image_data,
        });

        return {
          success: true,
          name,
          data: complaint,
          message: `Civic complaint successfully registered with Ticket ID ${complaint.ticket_id}. Assigned to ${complaint.assigned_officer} (Resolution ETA: ${complaint.resolution_eta}).`,
        };
      }

      case "check_complaint_status": {
        const ticket_id = args?.ticket_id;
        if (!ticket_id || typeof ticket_id !== "string") {
          return {
            success: false,
            name,
            error:
              "Missing required parameter 'ticket_id' for check_complaint_status.",
          };
        }

        const cleanTicketId = ticket_id.toUpperCase().trim();
        const complaint = await checkComplaintStatus(cleanTicketId);

        if (!complaint) {
          return {
            success: false,
            name,
            notFound: true,
            error: `Complaint with Ticket ID "${cleanTicketId}" was not found in municipal records. Please verify the ticket ID.`,
          };
        }

        return {
          success: true,
          name,
          data: complaint,
          message: `Complaint ${complaint.ticket_id} is currently '${complaint.status}'. Assigned to: ${complaint.assigned_officer}. Estimated resolution: ${complaint.resolution_eta}.`,
        };
      }

      default:
        return {
          success: false,
          name,
          error: `Unrecognized tool call: "${name}". Valid tools: "file_civic_complaint", "check_complaint_status".`,
        };
    }
  } catch (error: any) {
    return {
      success: false,
      name,
      error:
        error?.message ||
        "An unexpected error occurred while executing the tool call.",
    };
  }
}
