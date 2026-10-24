import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type CivicDepartment =
  | "Roads & Infrastructure"
  | "Solid Waste Management"
  | "Electricity & Streetlights"
  | "Stormwater & Drainage";

export type CivicSeverity = "Low" | "Medium" | "High" | "Critical";

export type CivicStatus = "Filed" | "Assigned" | "In Progress" | "Resolved";

export interface CivicComplaint {
  ticket_id: string;
  created_at: string;
  department: CivicDepartment;
  issue_title: string;
  description: string;
  severity: CivicSeverity;
  ward: string;
  landmark: string;
  status: CivicStatus;
  assigned_officer: string;
  resolution_eta: string;
  image_data?: string;
}

export const CIVIC_DEPARTMENTS: readonly CivicDepartment[] = [
  "Roads & Infrastructure",
  "Solid Waste Management",
  "Electricity & Streetlights",
  "Stormwater & Drainage",
] as const;

export const CIVIC_SEVERITIES: readonly CivicSeverity[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
] as const;

export const CIVIC_STATUSES: readonly CivicStatus[] = [
  "Filed",
  "Assigned",
  "In Progress",
  "Resolved",
] as const;

interface OfficerEtaAssignment {
  officer: string;
  eta: string;
}

const DEPARTMENT_OFFICERS: Record<CivicDepartment, OfficerEtaAssignment> = {
  "Roads & Infrastructure": {
    officer: "K. Ramesh (Asst. Executive Engineer)",
    eta: "Within 48-72 hours",
  },
  "Solid Waste Management": {
    officer: "S. Anitha (Health Inspector)",
    eta: "Within 24 hours",
  },
  "Electricity & Streetlights": {
    officer: "P. Venkatesh (Junior Engineer)",
    eta: "Within 12-24 hours",
  },
  "Stormwater & Drainage": {
    officer: "R. Manjunath (Executive Drainage Engineer)",
    eta: "Within 24-48 hours",
  },
};

const DEFAULT_ASSIGNMENT: OfficerEtaAssignment = {
  officer: "A. Kumar (Zonal Municipal Officer)",
  eta: "Within 24-48 hours",
};

/**
 * Generates a unique civic complaint ticket ID formatted as `CIVIC-` + 4 random digits (e.g. CIVIC-4821).
 */
export function generateTicketId(): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `CIVIC-${randomDigits}`;
}

export type NewCivicComplaintInput = Omit<
  CivicComplaint,
  "ticket_id" | "created_at" | "status" | "assigned_officer" | "resolution_eta"
>;

/**
 * Files a new civic complaint into the Firestore municipal database.
 * Generates ticket_id, sets created_at ISO timestamp, assigns an officer + ETA, and sets status to 'Assigned'.
 */
export async function fileCivicComplaint(
  data: NewCivicComplaintInput
): Promise<CivicComplaint> {
  const ticket_id = generateTicketId();
  const created_at = new Date().toISOString();
  const assignment = DEPARTMENT_OFFICERS[data.department] || DEFAULT_ASSIGNMENT;
  const status: CivicStatus = "Assigned";

  const complaint: CivicComplaint = {
    ticket_id,
    created_at,
    department: data.department,
    issue_title: data.issue_title,
    description: data.description,
    severity: data.severity,
    ward: data.ward,
    landmark: data.landmark,
    status,
    assigned_officer: assignment.officer,
    resolution_eta: assignment.eta,
    ...(data.image_data ? { image_data: data.image_data } : {}),
  };

  // Persist record to Firestore "complaints" collection using ticket_id as document ID
  const docRef = doc(db, "complaints", ticket_id);
  await setDoc(docRef, complaint);

  return complaint;
}

/**
 * Retrieves the live status and details of an existing complaint by its ticket ID.
 * Returns the complaint object if found, or null if it does not exist.
 */
export async function checkComplaintStatus(
  ticket_id: string
): Promise<CivicComplaint | null> {
  if (!ticket_id || typeof ticket_id !== "string") {
    return null;
  }

  const cleanTicketId = ticket_id.toUpperCase().trim();
  const docRef = doc(db, "complaints", cleanTicketId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return docSnap.data() as CivicComplaint;
}
