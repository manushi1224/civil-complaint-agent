/**
 * Dynamic canvas generator for lightweight, zero-external-dependency civic hazard test samples.
 * Generates realistic JPEG data URLs and raw base64 payloads recognized by Gemini vision models.
 */

export interface SampleHazard {
  id: "pothole" | "garbage" | "streetlight";
  label: string;
  iconName: string;
  department: string;
  severity: "Critical" | "High" | "Medium";
  defaultPrompt: string;
}

export const SAMPLE_HAZARDS: readonly SampleHazard[] = [
  {
    id: "pothole",
    label: "Sample Pothole",
    iconName: "AlertTriangle",
    department: "Roads & Infrastructure",
    severity: "Critical",
    defaultPrompt:
      "I spotted a dangerous asphalt crater on 27th Main Road near HSR Layout causing traffic hazard. Please inspect this photo and file a road repair ticket.",
  },
  {
    id: "garbage",
    label: "Sample Garbage Dump",
    iconName: "Trash2",
    department: "Solid Waste Management",
    severity: "High",
    defaultPrompt:
      "There is an illegal overflowing garbage dump spilling onto the pedestrian sidewalk near Market Cross. Please file an urgent civic cleanup request.",
  },
  {
    id: "streetlight",
    label: "Sample Streetlight",
    iconName: "Zap",
    department: "Electricity & Streetlights",
    severity: "Critical",
    defaultPrompt:
      "A streetlight luminaire on 4th Avenue near Metro Pillar 42 is broken and high-voltage electrical wires are dangling. Please file an emergency repair complaint.",
  },
] as const;

/**
 * Renders a crisp civic hazard test image on an in-memory HTML5 Canvas
 * and exports it as an `image/jpeg` Data URL and raw base64 payload.
 */
export function generateSampleImageData(type: "pothole" | "garbage" | "streetlight"): {
  dataUrl: string;
  base64: string;
  mimeType: string;
} {
  if (typeof window === "undefined" || !document?.createElement) {
    return {
      dataUrl: "",
      base64: "",
      mimeType: "image/jpeg",
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return {
      dataUrl: "",
      base64: "",
      mimeType: "image/jpeg",
    };
  }

  // Common background styling
  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (type === "pothole") {
    // 1. Asphalt Road Texture
    const roadGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    roadGradient.addColorStop(0, "#27272a");
    roadGradient.addColorStop(1, "#18181b");
    ctx.fillStyle = roadGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Asphalt noise specks
    ctx.fillStyle = "#3f3f46";
    for (let i = 0; i < 350; i++) {
      const rx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const ry = (Math.cos(i * 78.233) * 43758.5453) % 1;
      const x = Math.abs(rx) * canvas.width;
      const y = Math.abs(ry) * canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }

    // Yellow Broken Road Lane Divider
    ctx.fillStyle = "#eab308";
    ctx.fillRect(40, 190, 80, 14);
    ctx.fillRect(520, 190, 80, 14);

    // Outer Pothole Rim (Cracked Asphalt)
    ctx.beginPath();
    ctx.ellipse(320, 220, 170, 95, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#09090b";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#52525b";
    ctx.stroke();

    // Inner deep pit
    ctx.beginPath();
    ctx.ellipse(320, 230, 130, 65, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();

    // Crack lines radiating out
    ctx.strokeStyle = "#71717a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(160, 210);
    ctx.lineTo(110, 195);
    ctx.lineTo(85, 230);
    ctx.moveTo(480, 210);
    ctx.lineTo(540, 200);
    ctx.lineTo(570, 240);
    ctx.moveTo(320, 125);
    ctx.lineTo(315, 80);
    ctx.moveTo(330, 315);
    ctx.lineTo(350, 360);
    ctx.stroke();

    // Hazard Stripes Badge on Bottom
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(0, 375, canvas.width, 45);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HAZARD IDENTIFICATION: DEEP ROAD POTHOLE (DEPTH: ~25CM)", 320, 404);

    // Top Metadata Box
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(20, 20, 600, 52);
    ctx.fillStyle = "#f87171";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText("CIVIC HAZARD: CRITICAL ROAD INFRASTRUCTURE", 36, 44);
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "13px sans-serif";
    ctx.fillText("Location: 27th Main Rd, Ward 174 (HSR Layout) | Traffic Safety Danger", 36, 62);
  } else if (type === "garbage") {
    // 2. Sidewalk & Garbage Dump
    const wallGrad = ctx.createLinearGradient(0, 0, 0, 180);
    wallGrad.addColorStop(0, "#3f3f46");
    wallGrad.addColorStop(1, "#27272a");
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, canvas.width, 180);

    // Sidewalk ground
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 180, canvas.width, 240);
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.lineTo(canvas.width, 180);
    ctx.stroke();

    // Large overflowing green dumpster
    ctx.fillStyle = "#166534";
    ctx.fillRect(110, 140, 160, 120);
    ctx.fillStyle = "#14532d";
    ctx.fillRect(95, 125, 190, 20);

    // Spilling garbage bags & plastic waste pile
    ctx.fillStyle = "#09090b";
    ctx.beginPath();
    ctx.arc(310, 230, 48, 0, Math.PI * 2);
    ctx.arc(370, 240, 55, 0, Math.PI * 2);
    ctx.arc(260, 250, 40, 0, Math.PI * 2);
    ctx.arc(430, 260, 45, 0, Math.PI * 2);
    ctx.fill();

    // Scattered debris & plastic bottles
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(330, 220, 24, 10);
    ctx.fillRect(410, 250, 28, 12);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(280, 245, 30, 20);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(360, 215, 20, 15);

    // Caution flies / smell lines
    ctx.strokeStyle = "#a1a1aa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(330, 160);
    ctx.quadraticCurveTo(340, 140, 335, 120);
    ctx.moveTo(380, 165);
    ctx.quadraticCurveTo(395, 145, 385, 125);
    ctx.stroke();

    // Hazard Banner
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, 375, canvas.width, 45);
    ctx.fillStyle = "#18181b";
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HAZARD IDENTIFICATION: SOLID WASTE SPILL & BIOHAZARD", 320, 404);

    // Top Metadata Box
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(20, 20, 600, 52);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText("CIVIC HAZARD: SOLID WASTE MANAGEMENT DUMP", 36, 44);
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "13px sans-serif";
    ctx.fillText("Location: Market Cross, Ward 150 (Central Ward) | Public Health Hazard", 36, 62);
  } else {
    // 3. Streetlight / Broken Electrical Pole
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, "#0b0f19");
    skyGrad.addColorStop(0.6, "#172554");
    skyGrad.addColorStop(1, "#020617");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // City silhouettes in background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(30, 220, 70, 160);
    ctx.fillRect(115, 250, 60, 130);
    ctx.fillRect(460, 230, 80, 150);
    ctx.fillRect(550, 260, 60, 120);

    // Streetlight Pole
    ctx.fillStyle = "#64748b";
    ctx.fillRect(300, 80, 24, 300);

    // Tilted, broken arm
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#475569";
    ctx.beginPath();
    ctx.moveTo(312, 110);
    ctx.lineTo(230, 95);
    ctx.stroke();

    // Smashed fixture
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.ellipse(220, 100, 35, 18, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Dangling live wire & spark
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(215, 110);
    ctx.quadraticCurveTo(205, 150, 225, 180);
    ctx.stroke();

    // Electric Spark symbol
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(225, 185, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚡", 225, 191);

    // Hazard Banner
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(0, 375, canvas.width, 45);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 17px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HAZARD IDENTIFICATION: BROKEN STREETLIGHT & EXPOSED WIRING", 320, 404);

    // Top Metadata Box
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(20, 20, 600, 52);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText("CIVIC HAZARD: ELECTRICITY & STREETLIGHTS FAILURE", 36, 44);
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "13px sans-serif";
    ctx.fillText("Location: 4th Avenue near Metro Pillar 42, Ward 112 | Electrocution Risk", 36, 62);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

  return {
    dataUrl,
    base64,
    mimeType: "image/jpeg",
  };
}
