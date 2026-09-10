import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import QRCode from "qrcode";

dotenv.config();

// Simple file-backed persistent database for Gmail user accounts with Cloud Run read-only filesystem resilience
let inMemoryUserDb: Record<string, any> = {};

function resolveDbFile(): string {
  try {
    const localPath = path.join(process.cwd(), "user_data_store.json");
    const testFile = path.join(process.cwd(), `.write_test_${Date.now()}`);
    fs.writeFileSync(testFile, "test", "utf-8");
    fs.unlinkSync(testFile);
    return localPath;
  } catch {
    return path.join("/tmp", "user_data_store.json");
  }
}

const DB_FILE = resolveDbFile();

function readUserDb(): Record<string, any> {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(content);
      inMemoryUserDb = { ...inMemoryUserDb, ...parsed };
      return inMemoryUserDb;
    }
  } catch (err) {
    console.error("Error reading user DB:", err);
  }
  return inMemoryUserDb;
}

function writeUserDb(db: Record<string, any>) {
  inMemoryUserDb = { ...inMemoryUserDb, ...db };
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryUserDb, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing user DB:", err);
  }
}

async function startServer() {
  const app = express();
  
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (typeof __filename !== "undefined" && (__filename.includes("server.cjs") || __filename.includes("dist")));

  // In production (Cloud Run), listen on the port provided by Cloud Run via process.env.PORT, defaulting to 3000.
  // In development, strictly listen on 3000 to match the dev container reverse proxy.
  const PORT = isProduction && process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check endpoints for deployment probes, Cloud Run, and load balancers
  app.get(["/api/health", "/healthz", "/health", "/_health"], (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Strict Hex Color Normalizer for server-side responses
  const cleanHex = (inputHex?: string | null, defaultColor: string = "#10b981"): string => {
    if (!inputHex || typeof inputHex !== "string") return defaultColor;
    let trimmed = inputHex.trim();
    if (!trimmed.startsWith("#")) trimmed = "#" + trimmed;
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      const r = trimmed[1], g = trimmed[2], b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) return trimmed.slice(0, 7);
    if (/^#[0-9a-fA-F]{5}$/.test(trimmed)) return trimmed + "0";
    if (/^#[0-9a-fA-F]{4}$/.test(trimmed)) {
      const r = trimmed[1], g = trimmed[2], b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return defaultColor;
  };

  // Initialize Gemini AI client server-side
  const getAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // API Route: AI Event & Pass Content Generation
  app.post("/api/gemini/generate-event-details", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      let parsedResult: any = null;

      try {
        const ai = getAi();
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: `You are an event management expert. Based on this event idea: "${prompt}", generate JSON with:
          - "title": catchy official event title
          - "tagline": inspiring short pass subtitle (max 10 words)
          - "description": 2-sentence description for the pass back
          - "suggestedCategories": array of 3 pass tiers (e.g. ["VIP Gold", "General Delegate", "Speaker"])
          - "themeColor": hex color suitable for event pass (e.g. #4f46e5 or #059669)
          - "dressCode": recommended dress code (e.g. "Business Casual" or "Cocktail Attire")`,
          config: {
            responseMimeType: "application/json",
          },
        });

        const text = response.text || "{}";
        parsedResult = JSON.parse(text);
      } catch (aiErr: any) {
        // Procedural intelligent fallback
        const p = prompt.toLowerCase();
        if (p.includes("hackathon") || p.includes("coding") || p.includes("ai")) {
          parsedResult = {
            title: "Global AI & Web3 Hackathon 2026",
            tagline: "Build the Future of Decentralized Intelligence",
            description: "A 48-hour global sprint bringing together world-class developers, designers, and innovators to push the boundaries of AI.",
            suggestedCategories: ["Hacker Pass", "Mentor & Judge", "VIP Delegate"],
            themeColor: "#6366f1",
            dressCode: "Comfortable Casual / Tech Hoodies"
          };
        } else if (p.includes("concert") || p.includes("fest") || p.includes("music") || p.includes("dj")) {
          parsedResult = {
            title: "Horizon Echo Music & Arts Festival 2026",
            tagline: "3 Stages • 48 Hours of Nonstop Live Sound",
            description: "Join thousands of music enthusiasts under the open sky with live headline sets, interactive art installations, and culinary experiences.",
            suggestedCategories: ["VIP All-Access", "Early Bird Festival Pass", "Backstage Crew"],
            themeColor: "#ec4899",
            dressCode: "Festival Casual / Neon Party Wear"
          };
        } else if (p.includes("vip") || p.includes("gala") || p.includes("royal") || p.includes("summit")) {
          parsedResult = {
            title: "Global Executive Leadership Summit 2026",
            tagline: "Shaping the Next Decade of Industry Innovation",
            description: "An exclusive gathering of C-level executives, founders, and keynote strategists discussing macroeconomic trends and future ventures.",
            suggestedCategories: ["Executive VIP", "Keynote Speaker", "General Delegate"],
            themeColor: "#f59e0b",
            dressCode: "Black Tie / Formal Business"
          };
        } else {
          parsedResult = {
            title: prompt.length > 5 ? prompt : "University Tech & Innovation Fest 2026",
            tagline: "Empowering Next-Generation Creators and Builders",
            description: "The premier multi-day campus celebration of technology, design, and innovation with live workshops and competitions.",
            suggestedCategories: ["Student Pass", "VIP Guest Pass", "General Delegate"],
            themeColor: "#10b981",
            dressCode: "Smart Casual / Festive"
          };
        }
      }

      if (parsedResult) {
        parsedResult.themeColor = cleanHex(parsedResult.themeColor, "#10b981");
      }

      res.json({ success: true, data: parsedResult });
    } catch (error: any) {
      console.error("Error in generate-event-details:", error);
      res.status(500).json({ error: error.message || "Failed to generate event details." });
    }
  });

  // API Route: AI Full Pass Design & Theme Generator
  app.post("/api/gemini/design-pass-theme", async (req, res) => {
    try {
      const { prompt, currentEvent, dimensions } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      const dimInfo = dimensions 
        ? `Target Badge Dimensions: ${dimensions.width}${dimensions.unit || 'mm'} x ${dimensions.height}${dimensions.unit || 'mm'} (Orientation: ${dimensions.width > dimensions.height ? 'Landscape' : dimensions.width === dimensions.height ? 'Square' : 'Portrait'}).` 
        : 'Target Badge Dimensions: Standard Lanyard Badge.';

      let parsedResult: any = null;

      try {
        const ai = getAi();
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: `You are a graphic design and event badge aesthetic specialist. Create a complete pass visual theme and size-tailored layout specification based on this request: "${prompt}". Current event context: "${currentEvent || 'General Event'}". ${dimInfo}
          
          Return JSON with:
          - "themeName": short name for this design preset (e.g. "Cyberpunk Neon", "Royal Gold Executive", "Minimalist Pitch Black")
          - "backgroundColor": hex color for card background (e.g. #000000, #0a0a0a, #0d1117)
          - "accentColor": primary accent hex color (e.g. #10b981, #f59e0b, #6366f1)
          - "secondaryColor": secondary highlight hex color
          - "textColor": hex color for main text (e.g. #ffffff)
          - "headerTitle": uppercase catchy event title
          - "subHeader": pass tier subtitle (e.g. "GENERAL DELEGATE ACCESS PASS" or "VIP ALL-ACCESS BADGE")
          - "tagline": inspiring short phrase for header banner
          - "termsAndConditions": 2-line security notice for pass footer
          - "layoutOrientation": "portrait" | "landscape" | "square" | "compact-horizontal"
          - "qrSizePx": recommended QR image width/height in px (between 80 and 220)
          - "titleFontSizePx": recommended title font size in px (between 14 and 36)
          - "codeFontSizePx": recommended code font size in px (between 11 and 24)
          - "badgeStyle": one of ["dark-futuristic", "classic-black", "gold-luxury", "minimalist-border"]`,
          config: {
            responseMimeType: "application/json",
          },
        });

        const text = response.text || "{}";
        parsedResult = JSON.parse(text);
      } catch (aiErr: any) {
        // Procedural intelligent fallback based on keywords
        const p = (prompt || "").toLowerCase();
        if (p.includes("neon") || p.includes("cyber") || p.includes("rave") || p.includes("future")) {
          parsedResult = {
            themeName: "Cyberpunk Neon 2026",
            backgroundColor: "#090914",
            accentColor: "#22d3ee",
            secondaryColor: "#a855f7",
            textColor: "#f8fafc",
            headerTitle: currentEvent ? currentEvent.toUpperCase() : "CYBERPUNK NEON FEST 2026",
            subHeader: "VIP ALL-ACCESS DIGITAL CREDENTIAL",
            tagline: "OFFICIAL 256-BIT CRYPTOGRAPHIC ADMISSION PASS",
            termsAndConditions: "Non-transferable once scanned at gate. Present QR code or 16-digit code for instant turnstile verification.",
            layoutOrientation: "portrait",
            qrSizePx: 160,
            titleFontSizePx: 22,
            codeFontSizePx: 14,
            badgeStyle: "dark-futuristic"
          };
        } else if (p.includes("gold") || p.includes("royal") || p.includes("luxury") || p.includes("vip") || p.includes("gala")) {
          parsedResult = {
            themeName: "Royal Gold Executive",
            backgroundColor: "#0f0f12",
            accentColor: "#fbbf24",
            secondaryColor: "#fef08a",
            textColor: "#ffffff",
            headerTitle: currentEvent ? currentEvent.toUpperCase() : "ROYAL GALA & LEADERSHIP SUMMIT",
            subHeader: "DISTINGUISHED VIP ALL-ACCESS PASS",
            tagline: "HONORED GUEST & EXECUTIVE DELEGATE",
            termsAndConditions: "Admission subject to venue rules and verified credentials. Valid across all executive keynote halls.",
            layoutOrientation: "portrait",
            qrSizePx: 160,
            titleFontSizePx: 20,
            codeFontSizePx: 14,
            badgeStyle: "gold-luxury"
          };
        } else if (p.includes("emerald") || p.includes("green") || p.includes("nature") || p.includes("eco")) {
          parsedResult = {
            themeName: "Emerald Executive Pass",
            backgroundColor: "#051610",
            accentColor: "#10b981",
            secondaryColor: "#34d399",
            textColor: "#f0fdf4",
            headerTitle: currentEvent ? currentEvent.toUpperCase() : "GLOBAL SUSTAINABILITY SUMMIT",
            subHeader: "OFFICIAL VERIFIED ATTENDEE BADGE",
            tagline: "EMPOWERING A GREEN & SUSTAINABLE FUTURE",
            termsAndConditions: "Strict 1-Ticket 1-Entry verification. Badge must remain visible within the venue at all times.",
            layoutOrientation: "portrait",
            qrSizePx: 160,
            titleFontSizePx: 22,
            codeFontSizePx: 14,
            badgeStyle: "dark-futuristic"
          };
        } else {
          parsedResult = {
            themeName: "Obsidian Modern Pass",
            backgroundColor: "#09090b",
            accentColor: "#6366f1",
            secondaryColor: "#818cf8",
            textColor: "#ffffff",
            headerTitle: currentEvent ? currentEvent.toUpperCase() : "UNIVERSITY TECH & INNOVATION FEST",
            subHeader: "GENERAL DELEGATE ACCESS BADGE",
            tagline: "OFFICIAL EVENT ACCESS CREDENTIAL",
            termsAndConditions: "One-time entry per session. Duplicate badge scanning triggers security alert.",
            layoutOrientation: "portrait",
            qrSizePx: 160,
            titleFontSizePx: 22,
            codeFontSizePx: 14,
            badgeStyle: "classic-black"
          };
        }
      }

      if (parsedResult) {
        parsedResult.backgroundColor = cleanHex(parsedResult.backgroundColor, "#09090b");
        parsedResult.accentColor = cleanHex(parsedResult.accentColor, "#10b981");
        parsedResult.secondaryColor = cleanHex(parsedResult.secondaryColor, "#34d399");
        parsedResult.textColor = cleanHex(parsedResult.textColor, "#ffffff");
      }

      res.json({ success: true, data: parsedResult });
    } catch (error: any) {
      console.error("Error in design-pass-theme:", error);
      res.status(500).json({ error: error.message || "Failed to design pass theme." });
    }
  });

  // API Route: AI Canvas Pass Graphic Design Directives Generator
  app.post("/api/gemini/design-canvas-pass", async (req, res) => {
    try {
      const { prompt, currentEvent } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      let parsedResult: any = null;

      try {
        const ai = getAi();
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: `You are an expert graphic artist and event badge designer. Convert this design prompt into canvas drawing parameters: "${prompt}". Current event context: "${currentEvent || 'Featured Event'}".
          
          Return JSON with:
          - "themeTitle": catchy creative theme name (e.g. "Cyberpunk Neon VIP", "Royal Gold Foil Crest", "Synthwave 1984 Access")
          - "backgroundColor": background hex color (e.g. #0a0a0c, #050b14, #120024)
          - "backgroundType": one of ["gradient", "dark-grid", "circuit", "neon-glow", "metallic", "glassmorphism"]
          - "gradientColors": array of 2 or 3 hex colors for background gradient
          - "borderColor": border frame hex color (e.g. #10b981, #f59e0b, #ec4899)
          - "borderStyle": one of ["double-gold", "neon-frame", "corner-notches", "subtle-hairline", "solid-thick"]
          - "headerTitle": main event header title
          - "subHeader": pass tier subtitle (e.g. "VIP ALL-ACCESS PASS" or "EXECUTIVE DELEGATE")
          - "tagline": short banner tagline
          - "badgeShape": shape for badge crest graphic, one of ["crest", "shield", "hexagon", "ribbon", "pill"]
          - "badgeText": short badge emblem text (e.g. "VIP 2026", "OFFICIAL", "ALL ACCESS", "STAFF")
          - "accentColor": primary bright accent hex color
          - "textColor": text color hex (e.g. #ffffff)
          - "secondaryTextColor": secondary text color hex (e.g. #94a3b8)
          - "showWatermark": boolean (true/false)
          - "customStickers": array of 2 short sticker badges (e.g. ["256-BIT SECURE", "QR AUTHENTICATED"])
          - "layoutPreset": "lanyard-portrait" | "horizontal" | "square"`,
          config: {
            responseMimeType: "application/json",
          },
        });

        const text = response.text || "{}";
        parsedResult = JSON.parse(text);
      } catch (aiErr: any) {
        // Procedural fallback
        parsedResult = {
          themeTitle: "Executive Dark Hologram",
          backgroundColor: "#09090b",
          backgroundType: "dark-grid",
          gradientColors: ["#09090b", "#18181b"],
          borderColor: "#10b981",
          borderStyle: "corner-notches",
          headerTitle: currentEvent || "UNIVERSITY TECH FEST 2026",
          subHeader: "OFFICIAL VIP ACCESS CREDENTIAL",
          tagline: "256-BIT QR AUTHENTICATED ENTRY",
          badgeShape: "shield",
          badgeText: "VIP ACCESS",
          accentColor: "#10b981",
          textColor: "#ffffff",
          secondaryTextColor: "#94a3b8",
          showWatermark: true,
          customStickers: ["OFFICIAL PASS", "QR VERIFIED"],
          layoutPreset: "lanyard-portrait"
        };
      }

      if (parsedResult) {
        parsedResult.backgroundColor = cleanHex(parsedResult.backgroundColor, "#09090b");
        parsedResult.borderColor = cleanHex(parsedResult.borderColor, "#10b981");
        parsedResult.accentColor = cleanHex(parsedResult.accentColor, "#10b981");
        parsedResult.textColor = cleanHex(parsedResult.textColor, "#ffffff");
        parsedResult.secondaryTextColor = cleanHex(parsedResult.secondaryTextColor, "#94a3b8");
        if (Array.isArray(parsedResult.gradientColors)) {
          parsedResult.gradientColors = parsedResult.gradientColors.map((c: string) => cleanHex(c, "#09090b"));
        }
      }

      res.json({ success: true, data: parsedResult });
    } catch (error: any) {
      console.error("Error in design-canvas-pass:", error);
      res.status(500).json({ error: error.message || "Failed to generate canvas design." });
    }
  });

  // API Route: Google Sheets AI Smart Analysis & Formula Generation
  app.post("/api/gemini/sheets-smart-analysis", async (req, res) => {
    try {
      const { passes, eventTitle, customGoal } = req.body;
      const passList = Array.isArray(passes) ? passes.slice(0, 50) : [];
      const totalCount = Array.isArray(passes) ? passes.length : 0;
      const assignedCount = Array.isArray(passes) ? passes.filter((p: any) => p.status === "assigned" || p.status === "checked_in").length : 0;
      const checkedInCount = Array.isArray(passes) ? passes.filter((p: any) => p.status === "checked_in").length : 0;
      const unassignedCount = totalCount - assignedCount;

      let aiResult: any = null;

      try {
        const ai = getAi();
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `You are a Google Sheets & Data Architect expert for Event Operations.
Analyze this PassCraft ticket/pass dataset for event "${eventTitle || 'All Events'}":
Total Passes: ${totalCount}, Assigned: ${assignedCount}, Checked-in at Gates: ${checkedInCount}, Unassigned Queue: ${unassignedCount}.
User's specific goal/preference: "${customGoal || 'Optimize sheet layout with formulas for live gate monitoring, attendee lookups, and revenue summary'}".
Sample pass records: ${JSON.stringify(passList.slice(0, 5))}

Generate a JSON response with:
1. "columnSchema": Array of column definitions for the Google Sheet, each object with:
   - "key": string (e.g. "code16", "qrImage", "attendeeName", "email", "phone", "eventName", "category", "price", "status", "checkedInAt", "gateName")
   - "header": string (e.g. "16-Digit Code", "Live QR Code", "Attendee Name", "Email Address", "Phone Number", "Event", "Pass Tier", "Price ($)", "Status", "Checked-in Time", "Gate")
   - "type": string ("text" | "number" | "date" | "formula" | "status")
   - "formulaTemplate": string or null (e.g. '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" & A{row})')
   - "width": number (approx column width in px e.g. 160)
2. "formulas": Object containing ready-to-paste Google Sheets summary KPI formulas (assuming standard columns A to K):
   - "totalRegistered": formula string (e.g. '=COUNTA(C2:C)')
   - "totalCheckedIn": formula string (e.g. '=COUNTIF(I2:I, "checked_in")')
   - "attendanceRate": formula string (e.g. '=IFERROR(TEXT(COUNTIF(I2:I, "checked_in")/MAX(1, COUNTA(C2:C)), "0.0%"), "0.0%")')
   - "totalRevenue": formula string (e.g. '=SUM(H2:H)')
   - "vipAttendance": formula string (e.g. '=COUNTIFS(G2:G, "VIP", I2:I, "checked_in")')
3. "executiveSummary": string (2-3 concise sentences summarizing event attendance velocity, ticket distribution, and key recommendations for the gate operations team)
4. "dataInsights": Array of 3 short bullet strings highlighting insights (e.g. VIP percentage, check-in rate, unassigned inventory)
5. "suggestedTabNames": Array of recommended Google Sheet tab names (e.g. ["Active Attendees", "Gate Check-in Desk", "Executive Dashboard", "Unassigned Inventory"])`,
          config: {
            responseMimeType: "application/json",
          },
        });

        const text = response.text || "{}";
        aiResult = JSON.parse(text);
      } catch (aiErr: any) {
        console.warn("Gemini sheets analysis fallback:", aiErr);
        // Robust fallback
        aiResult = {
          columnSchema: [
            { key: "code16", header: "16-Digit Pass Code", type: "text", width: 170 },
            { key: "qrImage", header: "Live QR Formula", type: "formula", formulaTemplate: '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" & A{row})', width: 140 },
            { key: "attendeeName", header: "Attendee Name", type: "text", width: 180 },
            { key: "email", header: "Email Address", type: "text", width: 200 },
            { key: "phone", header: "Phone Number", type: "text", width: 150 },
            { key: "eventName", header: "Event Title", type: "text", width: 180 },
            { key: "category", header: "Category / Tier", type: "text", width: 130 },
            { key: "price", header: "Ticket Price ($)", type: "number", width: 120 },
            { key: "status", header: "Pass Status", type: "status", width: 130 },
            { key: "checkedInAt", header: "Check-in Timestamp", type: "date", width: 180 },
            { key: "gateName", header: "Admitted Gate", type: "text", width: 140 }
          ],
          formulas: {
            totalRegistered: '=COUNTA(C2:C)',
            totalCheckedIn: '=COUNTIF(I2:I, "checked_in")',
            attendanceRate: '=IFERROR(TEXT(COUNTIF(I2:I, "checked_in")/MAX(1, COUNTA(C2:C)), "0.0%"), "0.0%")',
            totalRevenue: '=SUM(H2:H)',
            vipAttendance: '=COUNTIFS(G2:G, "*VIP*", I2:I, "checked_in")'
          },
          executiveSummary: `Event ${eventTitle || 'PassCraft Roster'} currently has ${totalCount} total passes issued with ${assignedCount} assigned attendees and ${checkedInCount} verified turnstile admissions. Live check-in flow is active.`,
          dataInsights: [
            `${totalCount} passes active in the central PassCraft database`,
            `${checkedInCount} attendees successfully scanned and checked-in at gates`,
            `${unassignedCount} passes remain in the unassigned inventory queue ready for distribution`
          ],
          suggestedTabNames: ["Live Roster", "Gate Admissions", "KPI Dashboard", "VIP Guestlist"]
        };
      }

      res.json({ success: true, data: aiResult });
    } catch (error: any) {
      console.error("Error in sheets-smart-analysis:", error);
      res.status(500).json({ error: error.message || "Failed to analyze sheet data with AI." });
    }
  });

  // API Route: Google Apps Script Webhook Relay / Direct Push
  app.post("/api/sheets/push-webhook", async (req, res) => {
    try {
      const { webhookUrl, payload } = req.body;
      if (!webhookUrl || typeof webhookUrl !== "string" || !webhookUrl.startsWith("http")) {
        return res.status(400).json({ error: "Valid Google Apps Script Webhook URL (starts with https://) is required." });
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { text: responseText };
      }

      res.json({
        success: response.ok,
        status: response.status,
        response: responseJson,
        syncedRowsCount: Array.isArray(payload?.rows) ? payload.rows.length : 0,
        syncedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error in sheets push-webhook:", error);
      res.status(500).json({ error: error.message || "Failed to communicate with Google Sheets Apps Script Webhook." });
    }
  });

  // API Route: AI Smart Scan / Pass Image Parsing
  app.post("/api/gemini/parse-pass-image", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required." });
      }

      const ai = getAi();
      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
        },
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: {
          parts: [
            imagePart,
            {
              text: "Examine this image of an event pass or QR code ticket. Extract any 16-digit code (numbers or formatted with dashes like XXXX-XXXX-XXXX-XXXX), any attendee name, and event title. Respond in JSON format with fields: 'code16' (string of 16 digits without dashes if found, else null), 'formattedCode' (string formatted XXXX-XXXX-XXXX-XXXX or null), 'attendeeName' (string or null), 'eventName' (string or null).",
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      const json = JSON.parse(text);
      res.json({ success: true, data: json });
    } catch (error: any) {
      console.error("Error in parse-pass-image:", error);
      res.status(500).json({ error: error.message || "Failed to parse pass image." });
    }
  });

  // API Route: AI Email Ticket & Theme Designer
  app.post("/api/gemini/design-email-template", async (req, res) => {
    try {
      const { prompt, eventContext } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt or event theme description is required." });
      }

      let parsedResult: any = null;

      try {
        const ai = getAi();
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: `You are an elite event designer and email marketing director. Create a stunning email ticket template and aesthetic color palette for an event pass based on this prompt: "${prompt}".
Event details: Title: "${eventContext?.title || 'Featured Event'}", Date: "${eventContext?.date || 'Upcoming'}", Venue: "${eventContext?.location || 'Main Convention Center'}".

Respond ONLY with a valid JSON object matching these exact fields:
{
  "themeName": "catchy aesthetic name (e.g. Neon Cyberpunk, Royal Gold Gala, Emerald Executive)",
  "subject": "catchy email subject line with emojis and placeholders: 🎟️ YOUR PASS: {{EVENT_NAME}} — {{ATTENDEE_NAME}}",
  "bodyText": "engaging email body with details and placeholders: {{ATTENDEE_NAME}}, {{EVENT_NAME}}, {{EVENT_DATE}}, {{EVENT_TIME}}, {{VENUE}}, {{PASS_CATEGORY}}, {{CODE_16}}",
  "cardBackground": "card background hex color e.g. #18181b or #0f172a or #ffffff",
  "outerBackground": "outer background hex color e.g. #09090b or #020617 or #f1f5f9",
  "headerGradientStart": "header gradient start hex e.g. #059669 or #6366f1 or #b45309",
  "headerGradientEnd": "header gradient end hex e.g. #10b981 or #a855f7 or #fbbf24",
  "headerTextColor": "#ffffff or #000000",
  "accentColor": "primary border/highlight accent hex e.g. #10b981 or #818cf8 or #fbbf24",
  "highlightColor": "secondary highlight hex e.g. #34d399 or #38bdf8 or #fef08a",
  "codeBoxBackground": "code box background hex e.g. #000000 or #020617",
  "textColor": "main content text hex e.g. #f8fafc or #0f172a",
  "subtextColor": "meta text hex e.g. #94a3b8 or #64748b"
}`,
          config: {
            responseMimeType: "application/json",
          },
        });

        const text = response.text || "{}";
        parsedResult = JSON.parse(text);
      } catch (aiErr: any) {
        console.warn("Gemini API call fell back to procedural theme generator:", aiErr.message);
        
        // Procedural intelligent fallback based on keywords in prompt
        const p = prompt.toLowerCase();
        if (p.includes("gold") || p.includes("royal") || p.includes("luxury") || p.includes("gala") || p.includes("vip")) {
          parsedResult = {
            themeName: "Royal Gold Gala",
            subject: "👑 VIP INVITATION & PASS: {{EVENT_NAME}} — {{ATTENDEE_NAME}}",
            bodyText: "Dear {{ATTENDEE_NAME}},\n\nYou are cordially invited to {{EVENT_NAME}}. Your official VIP delegate pass has been confirmed.\n\n📍 VENUE: {{VENUE}}\n📅 DATE: {{EVENT_DATE}} at {{EVENT_TIME}}\n🎟️ TIER: {{PASS_CATEGORY}}\n\nPlease present this verified pass or the 16-digit code at the entrance.",
            cardBackground: "#18181b",
            outerBackground: "#09090b",
            headerGradientStart: "#b45309",
            headerGradientEnd: "#fbbf24",
            headerTextColor: "#000000",
            accentColor: "#fbbf24",
            highlightColor: "#fef08a",
            codeBoxBackground: "#000000",
            textColor: "#ffffff",
            subtextColor: "#a1a1aa"
          };
        } else if (p.includes("neon") || p.includes("cyber") || p.includes("dj") || p.includes("rave") || p.includes("festival")) {
          parsedResult = {
            themeName: "Neon Cyber Rave",
            subject: "⚡ OFFICIAL FESTIVAL ACCESS: {{EVENT_NAME}} — {{ATTENDEE_NAME}}",
            bodyText: "Hey {{ATTENDEE_NAME}}!\n\nGet ready for {{EVENT_NAME}}! Your live ticket and security barcode are ready below.\n\n📍 LOCATION: {{VENUE}}\n📅 DATE: {{EVENT_DATE}} @ {{EVENT_TIME}}\n🎟️ ACCESS LEVEL: {{PASS_CATEGORY}}\n\nHave your QR barcode or 16-digit code ready at the gate for rapid scan.",
            cardBackground: "#090914",
            outerBackground: "#030209",
            headerGradientStart: "#7c3aed",
            headerGradientEnd: "#06b6d4",
            headerTextColor: "#ffffff",
            accentColor: "#22d3ee",
            highlightColor: "#a855f7",
            codeBoxBackground: "#000000",
            textColor: "#f8fafc",
            subtextColor: "#a5f3fc"
          };
        } else if (p.includes("tech") || p.includes("keynote") || p.includes("summit") || p.includes("conference") || p.includes("hackathon")) {
          parsedResult = {
            themeName: "Silicon Tech Summit",
            subject: "🚀 ACCESS CONFIRMED: {{EVENT_NAME}} — {{ATTENDEE_NAME}}",
            bodyText: "Hello {{ATTENDEE_NAME}},\n\nWelcome to {{EVENT_NAME}}. Below is your official delegate pass and fast-track credential.\n\n📍 VENUE: {{VENUE}}\n📅 DATE: {{EVENT_DATE}} at {{EVENT_TIME}}\n🎟️ BADGE: {{PASS_CATEGORY}}\n\nPresent your digital pass or 16-digit code at the registration desk for badge printing.",
            cardBackground: "#0f172a",
            outerBackground: "#020617",
            headerGradientStart: "#1d4ed8",
            headerGradientEnd: "#38bdf8",
            headerTextColor: "#ffffff",
            accentColor: "#38bdf8",
            highlightColor: "#60a5fa",
            codeBoxBackground: "#020617",
            textColor: "#f1f5f9",
            subtextColor: "#94a3b8"
          };
        } else if (p.includes("sunset") || p.includes("beach") || p.includes("summer") || p.includes("party") || p.includes("prom")) {
          parsedResult = {
            themeName: "Sunset Glow & Prom",
            subject: "🌅 YOUR PASS IS READY: {{EVENT_NAME}} — {{ATTENDEE_NAME}}",
            bodyText: "Dear {{ATTENDEE_NAME}},\n\nWe cannot wait to celebrate with you at {{EVENT_NAME}}! Here is your entry pass.\n\n📍 VENUE: {{VENUE}}\n📅 DATE: {{EVENT_DATE}} at {{EVENT_TIME}}\n🎟️ TIER: {{PASS_CATEGORY}}\n\nShow this pass on your phone upon arrival.",
            cardBackground: "#1a0f18",
            outerBackground: "#0d050c",
            headerGradientStart: "#e11d48",
            headerGradientEnd: "#fb923c",
            headerTextColor: "#ffffff",
            accentColor: "#fb7185",
            highlightColor: "#fbbf24",
            codeBoxBackground: "#000000",
            textColor: "#fff1f2",
            subtextColor: "#fca5a5"
          };
        } else {
          parsedResult = {
            themeName: "Emerald Executive Pass",
            subject: "🎟️ OFFICIAL ACCESS PASS: {{EVENT_NAME}} — {{ATTENDEE_NAME}}",
            bodyText: "Dear {{ATTENDEE_NAME}},\n\nThank you for registering for {{EVENT_NAME}}. Your digital pass and entry credentials have been issued.\n\n📍 VENUE: {{VENUE}}\n📅 DATE: {{EVENT_DATE}} at {{EVENT_TIME}}\n🎟️ CATEGORY: {{PASS_CATEGORY}}\n\nPresent this digital pass or your 16-digit code at check-in for instant verification.",
            cardBackground: "#0f172a",
            outerBackground: "#030712",
            headerGradientStart: "#059669",
            headerGradientEnd: "#10b981",
            headerTextColor: "#ffffff",
            accentColor: "#10b981",
            highlightColor: "#34d399",
            codeBoxBackground: "#050b14",
            textColor: "#f8fafc",
            subtextColor: "#94a3b8"
          };
        }
      }

      // Format clean unified payload with 100% valid hex colors
      const normalizedData = {
        themeName: parsedResult.themeName || "Custom Theme",
        presetThemeName: parsedResult.themeName || "Custom Theme",
        subject: parsedResult.subject || "🎟️ YOUR EVENT ACCESS PASS: {{EVENT_NAME}} — {{ATTENDEE_NAME}}",
        bodyText: parsedResult.bodyText || "",
        cardBackground: cleanHex(parsedResult.cardBackground || parsedResult.cardBgColor, "#18181b"),
        outerBackground: cleanHex(parsedResult.outerBackground || parsedResult.outerBgColor, "#09090b"),
        headerGradientStart: cleanHex(parsedResult.headerGradientStart, "#059669"),
        headerGradientEnd: cleanHex(parsedResult.headerGradientEnd, "#10b981"),
        headerTextColor: cleanHex(parsedResult.headerTextColor, "#ffffff"),
        accentColor: cleanHex(parsedResult.accentColor, "#10b981"),
        highlightColor: cleanHex(parsedResult.highlightColor, "#fbbf24"),
        codeBoxBackground: cleanHex(parsedResult.codeBoxBackground || parsedResult.codeBgColor, "#000000"),
        textColor: cleanHex(parsedResult.textColor, "#f8fafc"),
        subtextColor: cleanHex(parsedResult.subtextColor, "#94a3b8"),
        bannerUrl: parsedResult.bannerUrl || "",
      };

      res.json({ success: true, data: normalizedData });
    } catch (error: any) {
      console.error("Error in design-email-template:", error);
      res.status(500).json({ error: error.message || "Failed to design email template." });
    }
  });

  // API Route: AI Event Rules & Guidelines Generator
  app.post("/api/gemini/generate-event-rules", async (req, res) => {
    try {
      const { prompt, eventContext } = req.body;
      if (!prompt && !eventContext?.title) {
        return res.status(400).json({ error: "Prompt or event title is required." });
      }

      let parsedResult: any = null;

      try {
        const ai = getAi();
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: `You are an event operations director and attendee experience manager. Create comprehensive, crystal-clear Event Rules, Dress Code, Guidelines, and Do's/Don'ts for an event based on this description: "${prompt || eventContext?.title}".
Event Title: "${eventContext?.title || 'Featured Event'}", Date: "${eventContext?.date || 'Upcoming'}", Venue: "${eventContext?.location || 'Main Convention Center'}".

Respond ONLY with a valid JSON object matching these exact fields:
{
  "dressCode": "specific dress code recommendation (e.g. Semi-Casual, Smart Casual, Business Formal, Black Tie, Festive / Ethnic, Athletic)",
  "dressCodeDetails": "short 1-2 sentence description explaining appropriate attire",
  "gatePolicy": "clear gate entry, timing, and re-entry guidelines (e.g. Gates open 45 minutes prior. Entry closes strictly at 10:30 AM. Re-entry requires wristband verification.)",
  "allowedItems": ["item 1 to bring (e.g. Government Photo ID)", "item 2 (e.g. Digital QR Pass)", "item 3 (e.g. Laptop & Charger)", "item 4 (e.g. Reusable Metal Water Bottle)"],
  "prohibitedItems": ["item 1 not to bring (e.g. Single-use Plastic Bottles)", "item 2 (e.g. Outside Food & Alcoholic Beverages)", "item 3 (e.g. Weapons, Sharp Objects & Flammables)", "item 4 (e.g. Professional Cameras without Media Pass)"],
  "dos": ["Arrive at least 30 minutes before commencement", "Wear your event badge/wristband at all times inside the venue", "Keep your belongings safe and respect fellow delegates"],
  "donts": ["Do not bring single-use plastic bottles into the auditorium", "Do not engage in unapproved commercial promotion or solicitations", "Do not record keynote speeches without prior accreditation"],
  "importantNotice": "Safety and security briefing or zero tolerance policy note"
}`,
          config: {
            responseMimeType: "application/json",
          },
        });

        const text = response.text || "{}";
        parsedResult = JSON.parse(text);
      } catch (aiErr: any) {
        console.warn("Gemini API call fell back to procedural rules generator:", aiErr.message);
        
        // Procedural intelligent fallback
        const p = (prompt || eventContext?.title || "").toLowerCase();
        if (p.includes("hackathon") || p.includes("tech") || p.includes("coding")) {
          parsedResult = {
            dressCode: "Comfortable Casual / Hoodies & T-Shirts",
            dressCodeDetails: "Casual, comfortable clothing suitable for extended coding and collaboration sessions.",
            gatePolicy: "Check-in desk opens at 8:30 AM. 24/7 security badge scanning required for entering and leaving the hacking arena.",
            allowedItems: ["Valid Government / Student Photo ID", "Laptop, Charger & Extension Cords", "Reusable Water Bottle", "Personal Toiletries & Blanket/Jacket"],
            prohibitedItems: ["Single-use plastic bottles & cups", "Outside hot food in the coding lab", "Sharp objects / weapons / fireworks", "Any unauthorized hacking/penetration hardware"],
            dos: ["Bring your verified QR pass on your phone", "Keep your badge visible around your neck at all times", "Follow open source sportsmanship and respect mentor guidance"],
            donts: ["Do not push copyrighted code written prior to hackathon start", "Do not leave unattended valuables on public tables", "Do not consume alcohol or illicit substances on premises"],
            importantNotice: "High-speed campus Wi-Fi credentials will be distributed at registration. Medical team available on ground 24/7."
          };
        } else if (p.includes("concert") || p.includes("music") || p.includes("fest") || p.includes("dj") || p.includes("rave")) {
          parsedResult = {
            dressCode: "Festival Casual / Neon & Party Wear",
            dressCodeDetails: "Comfortable festival apparel and flat closed-toe shoes recommended for standing and dancing.",
            gatePolicy: "Gates open 2 hours before headline performance. Box office check-in closes 1 hour before finale. No re-entry once exited.",
            allowedItems: ["Digital Entry Pass on Smartphone", "Physical Photo ID (18+ for specific zones)", "Empty Reusable Water Bottle (Free refill stations inside)", "Small waist bag or purse under 15cm x 20cm"],
            prohibitedItems: ["Single-use plastic bottles & glass containers", "Outside food, alcoholic beverages & drugs", "Professional DSLR cameras, tripods & selfie sticks", "Laser pointers, whistles, horns & weapons of any kind"],
            dos: ["Stay hydrated using the free on-site water stations", "Report any suspicious behavior immediately to security", "Follow designated emergency exit markers"],
            donts: ["Do not stage dive or crowd surf", "Do not litter across the venue grounds", "Do not attempt to enter VIP / Backstage zones without designated passes"],
            importantNotice: "Zero tolerance policy for harassment or disorderly conduct. Strict bag inspection at entry gates."
          };
        } else if (p.includes("gala") || p.includes("dinner") || p.includes("award") || p.includes("formal")) {
          parsedResult = {
            dressCode: "Formal Black Tie / Elegant Evening Attire",
            dressCodeDetails: "Suits, tuxedos, formal evening gowns, or traditional formal wear required.",
            gatePolicy: "Red carpet arrivals begin at 6:00 PM. Seated dinner commences promptly at 7:30 PM. Late arrivals seated during program intervals.",
            allowedItems: ["Digital VIP Pass / Invitation Code", "Government ID", "Small evening clutch / purse", "Business cards for networking"],
            prohibitedItems: ["Casual sneakers, flip-flops & athletic sportswear", "Outside food and beverage", "Bulky backpacks & luggage", "Uninvited guests without prior registration"],
            dos: ["Adhere strictly to assigned table and banquet seating", "Silence mobile devices during keynote addresses and awards", "Engage politely with VIP guests and keynote speakers"],
            donts: ["Do not smoke or vape in banquet halls", "Do not leave seats during award presentations", "Do not bring unaccredited media equipment"],
            importantNotice: "Complimentary valet parking available at the main portico entrance. Please display your digital parking pass."
          };
        } else {
          parsedResult = {
            dressCode: "Semi-Casual / Smart Casual",
            dressCodeDetails: "Collared shirts, chinos, smart jeans, dresses, or neat professional wear.",
            gatePolicy: "Registration counters open 45 minutes prior to scheduled start. Verification requires digital pass scan at the security barrier.",
            allowedItems: ["Government Photo ID / Work ID", "Digital QR Pass or 16-Digit Code", "Notebook, Pen & Smartphone", "Reusable Water Bottle"],
            prohibitedItems: ["Single-use disposable plastic bottles", "Outside food & beverages", "Flammables, weapons & hazardous items", "Unauthorized promotional banners or flyers"],
            dos: ["Keep your event pass/badge accessible for re-entry", "Be on time for scheduled keynote sessions", "Keep the venue clean and utilize recycling bins"],
            donts: ["Do not block aisle passages or emergency exits", "Do not use loudspeakers or disruptive devices", "Do not transfer badges without organizer approval"],
            importantNotice: "Security staff reserve the right to inspect bags at all entry gates. Lost & Found desk is located at Hall 1 reception."
          };
        }
      }

      res.json({
        success: true,
        data: {
          dressCode: parsedResult.dressCode || "Semi-Casual",
          dressCodeDetails: parsedResult.dressCodeDetails || "Comfortable semi-casual or smart casual attire.",
          gatePolicy: parsedResult.gatePolicy || "Gates open 45 minutes prior to commencement.",
          allowedItems: Array.isArray(parsedResult.allowedItems) ? parsedResult.allowedItems : [
            "Government Photo ID",
            "Digital QR Ticket or 16-Digit Code",
            "Reusable Metal/BPA-free Water Bottle",
            "Notepad & Pen / Laptop"
          ],
          prohibitedItems: Array.isArray(parsedResult.prohibitedItems) ? parsedResult.prohibitedItems : [
            "Single-use plastic bottles & packaging",
            "Outside food & beverages",
            "Weapons, sharp objects & fireworks",
            "Disruptive noise makers & laser pointers"
          ],
          dos: Array.isArray(parsedResult.dos) ? parsedResult.dos : [
            "Arrive 30 minutes early for smooth badge collection",
            "Keep your digital pass ready on your screen",
            "Respect event staff and fellow attendees"
          ],
          donts: Array.isArray(parsedResult.donts) ? parsedResult.donts : [
            "Do not bring prohibited single-use plastics",
            "Do not litter or leave belongings unattended",
            "Do not enter restricted stage/backstage areas"
          ],
          importantNotice: parsedResult.importantNotice || "Zero tolerance policy for misconduct. Strict security screening at entrance."
        }
      });
    } catch (error: any) {
      console.error("Error in generate-event-rules:", error);
      res.status(500).json({ error: error.message || "Failed to generate event rules." });
    }
  });

  // API Route: AI-Powered Thank You Email Generator
  app.post("/api/gemini/generate-thank-you", async (req, res) => {
    try {
      const { 
        eventType = "Event", 
        eventName = "Special Event", 
        highlights = "", 
        organizerName = "Event Organizing Committee",
        tone = "heartfelt & inspiring" 
      } = req.body;

      let parsedResult: any = null;

      try {
        const ai = getAi();
        const prompt = `You are a world-class executive event communications director.
Create a stunning, high-converting, deeply engaging Post-Event Thank You & Recap Email for attendees who participated in:
- Event Name: ${eventName}
- Event Category / Type: ${eventType}
- Organizer / Host: ${organizerName}
- Specific Details / Key Highlights / Theme provided by user: ${highlights || "Unforgettable celebration, vibrant attendance, wonderful memories, inspiring moments"}
- Tone: ${tone}

Return ONLY a strict valid JSON object with the following fields:
{
  "subject": "❤️ Thank You for Attending {{EVENT_NAME}}! | Highlights, Photos & Feedback",
  "headline": "THANK YOU FOR AN UNFORGETTABLE EXPERIENCE!",
  "thankYouMessage": "2-3 paragraphs expressing genuine gratitude, celebrating the specific theme (${highlights || 'the event'}), collective energy, community impact, and participation that made {{EVENT_NAME}} a triumph.",
  "eventHighlights": [
    "High energy and vibrant traditional or themed celebration",
    "Wonderful community participation and joyful moments together",
    "Unrivaled memories and lasting connections forged"
  ],
  "galleryTitle": "Official Event Photo Gallery & Highlights",
  "surveyTitle": "Share Your Thoughts — 2-Minute Feedback Survey",
  "certificateTitle": "Download Your Official Delegate / Attendee Certificate",
  "recordingTitle": "Access Event Highlights & Replays",
  "futureEventTitle": "Next Edition: Early Access & Priority Invitation",
  "futureEventDetails": "We are already preparing for our next major gathering. Keep your eyes open for upcoming announcements.",
  "closingNote": "With deepest gratitude and warmest wishes,\\n${organizerName}",
  "presetTheme": "Rose Warmth"
}
Do NOT include markdown backticks. Output pure JSON only.`;

        let response: any = null;
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.7-flash",
            contents: prompt,
            config: {
              temperature: 0.7,
              responseMimeType: "application/json"
            }
          });
        } catch (mErr) {
          console.warn("Retrying with gemini-flash-latest...", mErr);
          response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: prompt,
            config: {
              temperature: 0.7,
              responseMimeType: "application/json"
            }
          });
        }

        const rawText = response.text ? response.text.trim() : "";
        let cleanedText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
        }
        parsedResult = JSON.parse(cleanedText);
      } catch (geminiError: any) {
        console.warn("Gemini thank you generation fallback:", geminiError?.message || geminiError);
      }

      if (!parsedResult) {
        const customThemeDesc = highlights ? highlights.trim() : "extraordinary gathering";
        parsedResult = {
          subject: `❤️ Thank You for Celebrating with Us at {{EVENT_NAME}}!`,
          headline: `THANK YOU FOR AN UNFORGETTABLE CELEBRATION!`,
          thankYouMessage: `Dear {{ATTENDEE_NAME}},\n\nOn behalf of our entire team, we want to express our heartfelt gratitude for joining us at {{EVENT_NAME}} at {{VENUE}}.\n\nYour vibrant presence and enthusiasm made this event truly special. From the joyful dances and traditional attire to the unforgettable memories shared, you brought our community together in the most wonderful way.\n\nThank you for being part of such a memorable milestone!`,
          eventHighlights: [
            highlights ? `Celebration: ${customThemeDesc}` : "Full-house attendance with vibrant community participation",
            "Joyful atmosphere, music, and unforgettable shared moments",
            "Memorable connections and lasting celebration memories"
          ],
          galleryTitle: "Official Event Photo Gallery",
          surveyTitle: "2-Minute Attendee Experience Survey",
          certificateTitle: "Download Your Certificate / Souvenir",
          recordingTitle: "Watch Celebration Highlights & Replays",
          futureEventTitle: "Save the Date for Our Upcoming Gatherings",
          futureEventDetails: "Stay tuned for exclusive updates for our next festive gathering.",
          closingNote: `With deepest appreciation,\n${organizerName || "The Organizing Committee"}`
        };
      }

      res.json({
        success: true,
        data: parsedResult
      });
    } catch (error: any) {
      console.error("Error in generate-thank-you:", error);
      res.status(500).json({ error: error.message || "Failed to generate thank you email." });
    }
  });

  // API Route: Intelligent AI App Assistant & Knowledge Bot
  app.post("/api/gemini/app-assistant", async (req, res) => {
    try {
      const { question, history } = req.body;
      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "Question is required." });
      }

      const systemPrompt = `You are the official Intelligent AI Support Assistant for PassCraft (FLAP Desk, QR Gate Scanner, Event Management & Pass Generation Platform).
You provide clear, friendly, actionable, step-by-step guidance to event organizers and attendees.

Core Capabilities & Knowledge Base:
1. Event Setup & Directory (Events tab):
   - Create multi-day or single-day events (1 Day, 2 Days, 3+ Days).
   - Multi-day events automatically generate Day 1, Day 2, etc. entry sessions.
   - Choose from curated color presets or pick any custom hex accent color.
   - Configure ticket types, pricing, and color codes in the dedicated "Ticket Types" tab.

2. Connecting Gmail & Cloud Protection:
   - Click the "Connect Gmail" button in the top navigation header.
   - Enter your Gmail address (e.g. yourname@gmail.com).
   - Enter your Google 16-character App Password (generated from Google Account > Security > 2-Step Verification > App Passwords).
   - Benefits: Real-time cloud sync across devices and browsers, automated live email pass dispatching directly to attendee inboxes, and post-event Thank You email broadcasts.

3. Pass Generation & Registry:
   - Generate high-security 16-digit unique QR passes with custom colors and tier pricing.
   - Bulk assign passes to attendees by CSV upload or manual name/email/phone input.
   - Fast Search & Filter by tier, assignment state, checked-in status, or event.

4. Gate Scanner (Turnstile & QR Verification):
   - Fast camera scanning with live visual frame and audio feedback.
   - 1-Ticket 1-Entry Policy: The 1st scan confirms admission with a soothing harmonic chime.
   - Duplicate Scan Detection: If the same pass is scanned again, a full-screen red "ENTRY DONE" alert triggers, blocking duplicate gate entry.
   - Multi-Day Events: Dynamic Day 1, Day 2 selector lets gate staff filter the active admission session.

5. Direct Email Pass Dispatching:
   - Dispatch official QR digital passes with branded HTML email templates directly to attendees' email inboxes using your connected Gmail SMTP.

6. Event Rules & Guidelines Bomber:
   - Broadcast official event rules, dress code, entry timings, and security notices to all attendees.

7. Post-Event Thank You & Recap Dispatcher:
   - Send gratitude notes, photo gallery links, and feedback surveys after the event concludes.

8. FLAP Desk (Financials, Ledger & Accounts):
   - Real-time ticket revenue tracking, vendor expense logs, profit margin breakdown, and exportable Google Doc reports.

Always give concise, direct, helpful, and friendly answers with formatting like bullet points or bold steps where helpful. If asked about Gmail connection, emphasize the 16-character App Password steps clearly.`;

      let answer = "";

      try {
        const ai = getAi();
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: `${systemPrompt}\n\nUser Question: "${question}"\n\nHelpful Answer:`,
          config: {
            temperature: 0.6,
          },
        });
        answer = response.text || "";
      } catch (geminiErr: any) {
        console.warn("AI Assistant fallback triggered:", geminiErr?.message);
        const q = question.toLowerCase();
        if (q.includes("gmail") || q.includes("email") || q.includes("connect") || q.includes("password")) {
          answer = `### 📧 How to Connect Gmail in PassCraft:
1. Click **"Connect Gmail"** (or the Cloud icon) in the top header.
2. Enter your **Gmail address** (e.g. \`youremail@gmail.com\`).
3. Create a Google **16-character App Password**:
   - Go to your Google Account > **Security** > **2-Step Verification**.
   - Scroll to the bottom and click **App Passwords**.
   - Create a name (e.g., "PassCraft") and copy the 16-letter code.
4. Paste the 16-character code into PassCraft and click **Verify & Connect**.
5. Once connected, your event data syncs securely to the cloud, and you can email tickets directly to attendees!`;
        } else if (q.includes("scan") || q.includes("gate") || q.includes("entry") || q.includes("duplicate")) {
          answer = `### 🚪 Using the Gate Entry Scanner:
- **Starting Scanner**: Navigate to **Gate Scanner** tab and click **Start Camera**.
- **1-Ticket 1-Entry**: When a pass is scanned the first time, a green checkmark appears and a soothing chime plays.
- **Duplicate Prevention**: If scanned a second time, a full-screen **RED "ENTRY DONE"** alert displays, rejecting duplicate entry.
- **Multi-Day Events**: For events with 2+ days, choose **Day 1**, **Day 2**, etc., from the Day Selector dropdown.`;
        } else if (q.includes("color") || q.includes("event") || q.includes("create")) {
          answer = `### 🎨 Creating Events & Choosing Colors:
1. Go to the **Event Directory** tab.
2. Fill in Event Name, Date, Start/End time, and Venue.
3. Choose the **Event Duration (No. of Days)** (1 Day, 2 Days, 3 Days, etc.).
4. Under **Event Accent Color**, choose from 12 curated color presets or click the color picker square to choose any custom hex color.
5. Click **Create & Activate Event**.`;
        } else {
          answer = `### 💡 PassCraft Quick Guide:
- **Events**: Create events with duration and custom colors.
- **Ticket Types**: Manage pricing, capacity, and badges.
- **Pass Registry**: Generate & assign passes with unique QR codes.
- **Gate Scanner**: Fast check-in with duplicate scan alerts.
- **Email Dispatcher**: Send passes and thank-you notes via connected Gmail.
- **FLAP Desk**: Track ticket revenues, vendor expenses, and net profit.`;
        }
      }

      res.json({
        success: true,
        answer: answer.trim()
      });
    } catch (error: any) {
      console.error("Error in app-assistant:", error);
      res.status(500).json({ error: error.message || "Failed to generate answer." });
    }
  });

  // API Route: Send Post-Event Thank You & Recap Emails
  app.post("/api/email/dispatch-thank-you", async (req, res) => {
    try {
      const { smtpConfig, recipients, thankYouConfig } = req.body;

      if (!smtpConfig || !smtpConfig.senderEmail || !smtpConfig.appPassword) {
        return res.status(400).json({ error: "Sender Gmail address and 16-character Gmail App Password are required." });
      }

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "At least one recipient is required." });
      }

      const sanitizedAppPassword = smtpConfig.appPassword.replace(/\s+/g, "");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpConfig.senderEmail.trim(),
          pass: sanitizedAppPassword,
        },
      });

      await transporter.verify();

      const st = thankYouConfig?.style || {};
      const cardBg = st.cardBackground || "#111827";
      const outerBg = st.outerBackground || "#030712";
      const gradStart = st.headerGradientStart || "#e11d48";
      const gradEnd = st.headerGradientEnd || "#f43f5e";
      const headerTextCol = st.headerTextColor || "#ffffff";
      const accentCol = st.accentColor || "#fb7185";
      const highlightCol = st.highlightColor || "#fda4af";
      const textCol = st.textColor || "#f9fafb";
      const subtextCol = st.subtextColor || "#9ca3af";
      const senderDisplayName = (smtpConfig.senderName || thankYouConfig?.senderName || "Event Organizing Committee").trim();

      const headline = (thankYouConfig?.headline || "THANK YOU FOR AN UNFORGETTABLE EXPERIENCE!").trim();
      const thankYouMessage = (thankYouConfig?.thankYouMessage || "").trim();
      const eventHighlights: string[] = (thankYouConfig?.eventHighlights || []).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      
      const futureEventSectionHeading = (thankYouConfig?.futureEventSectionHeading || "🚀 WHAT'S NEXT").trim();
      const highlightsSectionHeading = (thankYouConfig?.highlightsSectionHeading || "🏆 EVENT HIGHLIGHTS & KEY MILESTONES").trim();
      const resourcesSectionHeading = (thankYouConfig?.resourcesSectionHeading || "📦 YOUR EVENT RESOURCES & MEDIA").trim();
      const surveySectionHeading = (thankYouConfig?.surveySectionHeading || "💬 Help Us Improve for Next Time!").trim();
      const topBadgeHeading = (thankYouConfig?.topBadgeHeading || "🌟 POST-EVENT RECAP & APPRECIATION").trim();

      const galleryLink = (thankYouConfig?.galleryLink || "").trim();
      const galleryTitle = (thankYouConfig?.galleryTitle || "Official Event Photo Gallery").trim();
      
      const surveyLink = (thankYouConfig?.surveyLink || "").trim();
      const surveyTitle = (thankYouConfig?.surveyTitle || "Attendee Experience Feedback Survey").trim();
      
      const certificateLink = (thankYouConfig?.certificateLink || "").trim();
      const certificateTitle = (thankYouConfig?.certificateTitle || "Certificate of Attendance").trim();

      const recordingLink = (thankYouConfig?.recordingLink || "").trim();
      const recordingTitle = (thankYouConfig?.recordingTitle || "Session Recordings & Slides").trim();

      const futureEventTitle = (thankYouConfig?.futureEventTitle || "").trim();
      const futureEventDetails = (thankYouConfig?.futureEventDetails || "").trim();
      const futureEventLink = (thankYouConfig?.futureEventLink || "").trim();
      
      const closingNote = (thankYouConfig?.closingNote || "").trim();

      const results = [];

      for (const recipient of recipients) {
        try {
          const attendeeName = recipient.attendeeName || "Valued Attendee";
          const eventName = recipient.eventName || "Event";
          const eventDate = recipient.eventDate || "Recent Event";
          const venue = recipient.venue || "Main Venue";

          let sub = (thankYouConfig?.subject || "❤️ Thank you for attending {{EVENT_NAME}}!")
            .replace(/\{\{ATTENDEE_NAME\}\}/g, attendeeName)
            .replace(/\{\{EVENT_NAME\}\}/g, eventName)
            .replace(/\{\{EVENT_DATE\}\}/g, eventDate)
            .replace(/\{\{VENUE\}\}/g, venue);

          let renderedMessage = thankYouMessage
            .replace(/\{\{ATTENDEE_NAME\}\}/g, attendeeName)
            .replace(/\{\{EVENT_NAME\}\}/g, eventName)
            .replace(/\{\{EVENT_DATE\}\}/g, eventDate)
            .replace(/\{\{VENUE\}\}/g, venue)
            .replace(/\n\n/g, "<br/><br/>")
            .replace(/\n/g, "<br/>");

          // Build Clean Responsive HTML Email
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${sub}</title>
            </head>
            <body style="margin: 0; padding: 20px 10px; background-color: ${outerBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${textCol};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${outerBg}; width: 100%; margin: 0; padding: 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: ${cardBg}; border: 2px solid ${accentCol}; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.6); text-align: left;">
                      
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%); padding: 28px 20px; text-align: center; color: ${headerTextCol};">
                          <div style="font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; color: ${headerTextCol}; opacity: 0.95;">
                            🌟 POST-EVENT RECAP & APPRECIATION
                          </div>
                          <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; color: ${headerTextCol}; line-height: 1.2;">
                            ${headline}
                          </div>
                          <div style="font-size: 12px; font-weight: 700; margin-top: 6px; color: ${headerTextCol}; opacity: 0.9;">
                            📍 ${venue} • 📅 ${eventDate}
                          </div>
                        </td>
                      </tr>

                      <!-- Body Content -->
                      <tr>
                        <td style="padding: 24px;">
                          
                          <!-- Attendee Greeting -->
                          <div style="font-size: 16px; font-weight: 800; color: ${textCol}; margin-bottom: 12px;">
                            Dear ${attendeeName},
                          </div>

                          <!-- Main Thank You Message -->
                          ${renderedMessage ? `
                            <div style="font-size: 13px; line-height: 1.65; color: ${textCol}; margin-bottom: 22px;">
                              ${renderedMessage}
                            </div>
                          ` : ''}

                          <!-- Event Highlights (Conditionally rendered) -->
                          ${eventHighlights.length > 0 ? `
                            <div style="background-color: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.1); border-left: 4px solid ${accentCol}; border-radius: 12px; padding: 16px 18px; margin-bottom: 22px;">
                              <div style="font-size: 11px; font-weight: 900; color: ${highlightCol}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                                ${highlightsSectionHeading}
                              </div>
                              <ul style="margin: 0; padding-left: 16px; font-size: 12px; line-height: 1.6; color: ${textCol};">
                                ${eventHighlights.map(h => `<li style="margin-bottom: 4px;">${h}</li>`).join('')}
                              </ul>
                            </div>
                          ` : ''}

                          <!-- Action Resource Buttons (Photo Gallery / Certificate / Survey / Recording) -->
                          ${(galleryLink || certificateLink || recordingLink) ? `
                            <div style="margin-bottom: 22px;">
                              <div style="font-size: 11px; font-weight: 900; color: ${accentCol}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                                ${resourcesSectionHeading}
                              </div>
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                ${galleryLink ? `
                                  <tr>
                                    <td style="padding-bottom: 8px;">
                                      <a href="${galleryLink}" target="_blank" style="display: block; background-color: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 12px 16px; text-decoration: none; color: ${textCol}; font-size: 13px; font-weight: 700;">
                                        📸 ${galleryTitle} &rarr;
                                      </a>
                                    </td>
                                  </tr>
                                ` : ''}
                                ${certificateLink ? `
                                  <tr>
                                    <td style="padding-bottom: 8px;">
                                      <a href="${certificateLink}" target="_blank" style="display: block; background-color: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 12px 16px; text-decoration: none; color: ${textCol}; font-size: 13px; font-weight: 700;">
                                        📜 ${certificateTitle} &rarr;
                                      </a>
                                    </td>
                                  </tr>
                                ` : ''}
                                ${recordingLink ? `
                                  <tr>
                                    <td style="padding-bottom: 8px;">
                                      <a href="${recordingLink}" target="_blank" style="display: block; background-color: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 12px 16px; text-decoration: none; color: ${textCol}; font-size: 13px; font-weight: 700;">
                                        🎥 ${recordingTitle} &rarr;
                                      </a>
                                    </td>
                                  </tr>
                                ` : ''}
                              </table>
                            </div>
                          ` : ''}

                          <!-- Feedback Survey CTA (Conditionally rendered) -->
                          ${surveyLink ? `
                            <div style="background-color: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 22px; text-align: center;">
                              <div style="font-size: 13px; font-weight: 800; color: ${highlightCol}; margin-bottom: 6px;">
                                ${surveySectionHeading}
                              </div>
                              <div style="font-size: 12px; color: ${subtextCol}; margin-bottom: 12px;">
                                Your thoughts shape our future events. Please take 2 minutes to let us know your experience.
                              </div>
                              <a href="${surveyLink}" target="_blank" style="display: inline-block; background-color: ${accentCol}; color: #000000; font-weight: 900; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
                                ${surveyTitle}
                              </a>
                            </div>
                          ` : ''}

                          <!-- Future Event Announcement (Conditionally rendered) -->
                          ${futureEventTitle ? `
                            <div style="background-color: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                              <div style="font-size: 10px; font-weight: 900; color: ${highlightCol}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                                ${futureEventSectionHeading}
                              </div>
                              <div style="font-size: 14px; font-weight: 800; color: ${textCol}; margin-bottom: 4px;">
                                ${futureEventTitle}
                              </div>
                              ${futureEventDetails ? `
                                <div style="font-size: 12px; color: ${subtextCol}; line-height: 1.5; margin-bottom: 8px;">
                                  ${futureEventDetails}
                                </div>
                              ` : ''}
                              ${futureEventLink ? `
                                <a href="${futureEventLink}" target="_blank" style="font-size: 12px; font-weight: 700; color: ${accentCol}; text-decoration: underline;">
                                  View upcoming event details &rarr;
                                </a>
                              ` : ''}
                            </div>
                          ` : ''}

                          <!-- Closing Note -->
                          ${closingNote ? `
                            <div style="font-size: 13px; line-height: 1.6; color: ${subtextCol}; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 14px; margin-top: 14px; white-space: pre-line;">
                              ${closingNote}
                            </div>
                          ` : ''}

                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="text-align: center; padding: 16px 20px; font-size: 11px; color: ${subtextCol}; border-top: 1px solid rgba(255, 255, 255, 0.08); background-color: rgba(0, 0, 0, 0.35);">
                          ${senderDisplayName} • Post-Event Appreciation & Community Updates
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;

          await transporter.sendMail({
            from: `"${senderDisplayName}" <${smtpConfig.senderEmail.trim()}>`,
            to: recipient.email.trim(),
            subject: sub,
            html: htmlContent,
          });

          results.push({
            email: recipient.email,
            status: "sent",
          });
        } catch (err: any) {
          console.error(`Failed to send thank you email to ${recipient.email}:`, err);
          results.push({
            email: recipient.email,
            status: "failed",
            error: err.message || "Failed to dispatch email",
          });
        }
      }

      res.json({
        success: true,
        total: recipients.length,
        results,
      });
    } catch (error: any) {
      console.error("Error in dispatch-thank-you:", error);
      res.status(500).json({ error: error.message || "Failed to dispatch thank you email." });
    }
  });

  // API Route: Send Event Rules & Guidelines Email to Attendees
  app.post("/api/email/dispatch-rules", async (req, res) => {
    try {
      const { smtpConfig, recipients, rulesConfig } = req.body;

      if (!smtpConfig || !smtpConfig.senderEmail || !smtpConfig.appPassword) {
        return res.status(400).json({ error: "Sender Gmail address and 16-character Gmail App Password are required." });
      }

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "At least one recipient is required." });
      }

      const sanitizedAppPassword = smtpConfig.appPassword.replace(/\s+/g, "");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpConfig.senderEmail.trim(),
          pass: sanitizedAppPassword,
        },
      });

      await transporter.verify();

      const st = rulesConfig?.style || {};
      const cardBg = st.cardBackground || "#0f172a";
      const outerBg = st.outerBackground || "#020617";
      const gradStart = st.headerGradientStart || "#d97706";
      const gradEnd = st.headerGradientEnd || "#f59e0b";
      const headerTextCol = st.headerTextColor || "#000000";
      const accentCol = st.accentColor || "#f59e0b";
      const highlightCol = st.highlightColor || "#fbbf24";
      const textCol = st.textColor || "#f8fafc";
      const subtextCol = st.subtextColor || "#94a3b8";
      const senderDisplayName = (smtpConfig.senderName || rulesConfig?.senderName || "Event Operations Team").trim();

      const topBadgeHeading = (rulesConfig?.topBadgeHeading || "📋 ATTENDEE BRIEFING & PROTOCOL").trim();
      const dressCodeHeading = (rulesConfig?.dressCodeHeading || "👔 DRESS CODE SPECIFICATION").trim();
      const gatePolicyHeading = (rulesConfig?.gatePolicyHeading || "⏰ TIMINGS & GATE ACCESS POLICY").trim();
      const allowedHeading = (rulesConfig?.allowedHeading || "✅ WHAT TO BRING (ALLOWED)").trim();
      const prohibitedHeading = (rulesConfig?.prohibitedHeading || "🚫 DO NOT BRING (PROHIBITED)").trim();
      const dosHeading = (rulesConfig?.dosHeading || "✅ DO'S (EVENT ETIQUETTE)").trim();
      const dontsHeading = (rulesConfig?.dontsHeading || "❌ DON'TS (ZERO TOLERANCE)").trim();
      const advisoryHeading = (rulesConfig?.advisoryHeading || "⚠️ IMPORTANT EVENT ADVISORY").trim();

      const dressCode = (rulesConfig?.dressCode || "").trim();
      const dressCodeDetails = (rulesConfig?.dressCodeDetails || "").trim();
      const gatePolicy = (rulesConfig?.gatePolicy || "").trim();
      const allowedItems: string[] = (rulesConfig?.allowedItems || []).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      const prohibitedItems: string[] = (rulesConfig?.prohibitedItems || []).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      const dos: string[] = (rulesConfig?.dos || []).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      const donts: string[] = (rulesConfig?.donts || []).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      const importantNotice = (rulesConfig?.importantNotice || "").trim();
      const introMessage = (rulesConfig?.introMessage || "Please review the official guidelines, dress code, and venue policies prior to arrival.").trim();

      const results = [];

      for (const recipient of recipients) {
        try {
          let sub = (rulesConfig?.subject || "📋 IMPORTANT: Event Guidelines, Rules & Dress Code — {{EVENT_NAME}}")
            .replace(/\{\{ATTENDEE_NAME\}\}/g, recipient.attendeeName || "Valued Attendee")
            .replace(/\{\{EVENT_NAME\}\}/g, recipient.eventName || "Event")
            .replace(/\{\{EVENT_DATE\}\}/g, recipient.eventDate || "Upcoming")
            .replace(/\{\{VENUE\}\}/g, recipient.venue || "Main Venue");

          // Build HTML email with clean, high-contrast inline tables for Gmail
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${sub}</title>
            </head>
            <body style="margin: 0; padding: 20px 10px; background-color: ${outerBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${textCol};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${outerBg}; width: 100%; margin: 0; padding: 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: ${cardBg}; border: 2px solid ${accentCol}; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.6); text-align: left;">
                      
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%); padding: 26px 20px; text-align: center; color: ${headerTextCol};">
                          <div style="font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; color: ${headerTextCol}; opacity: 0.95;">
                            ${topBadgeHeading}
                          </div>
                          <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; color: ${headerTextCol}; line-height: 1.2;">
                            ${recipient.eventName || "EVENT GUIDELINES"}
                          </div>
                          <div style="font-size: 12px; font-weight: 700; margin-top: 6px; color: ${headerTextCol}; opacity: 0.9;">
                            📍 ${recipient.venue || "Venue"} • 📅 ${recipient.eventDate || "Event Day"}
                          </div>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding: 24px;">
                          
                          <!-- Attendee Greeting -->
                          <div style="font-size: 16px; font-weight: 800; color: ${textCol}; margin-bottom: 8px;">
                            Dear ${recipient.attendeeName || "Attendee"},
                          </div>
                          ${introMessage ? `
                            <div style="font-size: 13px; line-height: 1.6; color: ${subtextCol}; margin-bottom: 20px;">
                              ${introMessage}
                            </div>
                          ` : ''}

                          <!-- 1. Dress Code Card (Only if specified) -->
                          ${dressCode ? `
                            <div style="background-color: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.12); border-left: 5px solid ${accentCol}; border-radius: 12px; padding: 16px 18px; margin-bottom: 18px;">
                              <div style="font-size: 10px; color: ${accentCol}; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
                                ${dressCodeHeading}
                              </div>
                              <div style="font-size: 18px; font-weight: 900; color: ${highlightCol}; text-transform: uppercase;">
                                ${dressCode}
                              </div>
                              ${dressCodeDetails ? `
                                <div style="font-size: 12px; color: ${subtextCol}; margin-top: 4px; line-height: 1.4;">
                                  ${dressCodeDetails}
                                </div>
                              ` : ''}
                            </div>
                          ` : ''}

                          <!-- 2. Gate & Timing Policy (Only if specified) -->
                          ${gatePolicy ? `
                            <div style="background-color: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
                              <div style="font-size: 10px; color: ${subtextCol}; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                                ${gatePolicyHeading}
                              </div>
                              <div style="font-size: 13px; font-weight: 700; color: ${textCol}; line-height: 1.4;">
                                ${gatePolicy}
                              </div>
                            </div>
                          ` : ''}

                          <!-- 3. What to Bring vs What NOT to Bring (Flexibly Rendered) -->
                          ${(allowedItems.length > 0 && prohibitedItems.length > 0) ? `
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                              <tr>
                                <td width="48%" style="background-color: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 14px 16px; vertical-align: top;">
                                  <div style="color: #34d399; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                                    ${allowedHeading}
                                  </div>
                                  <ul style="margin: 0; padding-left: 16px; font-size: 12px; line-height: 1.6; color: ${textCol};">
                                    ${allowedItems.map(item => `<li style="margin-bottom: 4px;">${item}</li>`).join('')}
                                  </ul>
                                </td>
                                <td width="4%"></td>
                                <td width="48%" style="background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 14px 16px; vertical-align: top;">
                                  <div style="color: #f87171; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                                    ${prohibitedHeading}
                                  </div>
                                  <ul style="margin: 0; padding-left: 16px; font-size: 12px; line-height: 1.6; color: ${textCol};">
                                    ${prohibitedItems.map(item => `<li style="margin-bottom: 4px; color: #fca5a5;">${item}</li>`).join('')}
                                  </ul>
                                </td>
                              </tr>
                            </table>
                          ` : (allowedItems.length > 0) ? `
                            <div style="background-color: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
                              <div style="color: #34d399; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                                ${allowedHeading}
                              </div>
                              <ul style="margin: 0; padding-left: 16px; font-size: 12px; line-height: 1.6; color: ${textCol};">
                                ${allowedItems.map(item => `<li style="margin-bottom: 4px;">${item}</li>`).join('')}
                              </ul>
                            </div>
                          ` : (prohibitedItems.length > 0) ? `
                            <div style="background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
                              <div style="color: #f87171; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                                ${prohibitedHeading}
                              </div>
                              <ul style="margin: 0; padding-left: 16px; font-size: 12px; line-height: 1.6; color: ${textCol};">
                                ${prohibitedItems.map(item => `<li style="margin-bottom: 4px; color: #fca5a5;">${item}</li>`).join('')}
                              </ul>
                            </div>
                          ` : ''}

                          <!-- 4. Do's & Don'ts Grid (Flexibly Rendered) -->
                          ${(dos.length > 0 && donts.length > 0) ? `
                            <div style="background-color: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                              <div style="font-size: 11px; font-weight: 900; color: ${highlightCol}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                                📌 GENERAL CODE OF CONDUCT (DO'S & DON'TS)
                              </div>
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td width="48%" style="vertical-align: top;">
                                    <div style="font-size: 10px; font-weight: 800; color: #34d399; margin-bottom: 6px; text-transform: uppercase;">${dosHeading}</div>
                                    <ul style="margin: 0; padding-left: 14px; font-size: 11px; line-height: 1.5; color: ${textCol};">
                                      ${dos.map(d => `<li style="margin-bottom: 4px;">${d}</li>`).join('')}
                                    </ul>
                                  </td>
                                  <td width="4%"></td>
                                  <td width="48%" style="vertical-align: top;">
                                    <div style="font-size: 10px; font-weight: 800; color: #f87171; margin-bottom: 6px; text-transform: uppercase;">${dontsHeading}</div>
                                    <ul style="margin: 0; padding-left: 14px; font-size: 11px; line-height: 1.5; color: #fca5a5;">
                                      ${donts.map(d => `<li style="margin-bottom: 4px;">${d}</li>`).join('')}
                                    </ul>
                                  </td>
                                </tr>
                              </table>
                            </div>
                          ` : (dos.length > 0) ? `
                            <div style="background-color: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                              <div style="font-size: 10px; font-weight: 800; color: #34d399; margin-bottom: 8px; text-transform: uppercase;">${dosHeading}</div>
                              <ul style="margin: 0; padding-left: 16px; font-size: 11px; line-height: 1.5; color: ${textCol};">
                                ${dos.map(d => `<li style="margin-bottom: 4px;">${d}</li>`).join('')}
                              </ul>
                            </div>
                          ` : (donts.length > 0) ? `
                            <div style="background-color: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                              <div style="font-size: 10px; font-weight: 800; color: #f87171; margin-bottom: 8px; text-transform: uppercase;">${dontsHeading}</div>
                              <ul style="margin: 0; padding-left: 16px; font-size: 11px; line-height: 1.5; color: #fca5a5;">
                                ${donts.map(d => `<li style="margin-bottom: 4px;">${d}</li>`).join('')}
                              </ul>
                            </div>
                          ` : ''}

                          <!-- 5. Important Notice -->
                          ${importantNotice ? `
                            <div style="background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 10px; padding: 14px; font-size: 12px; line-height: 1.5; color: #fef3c7; margin-bottom: 16px;">
                              <div style="font-weight: 900; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #fbbf24; margin-bottom: 4px;">
                                ${advisoryHeading}
                              </div>
                              ${importantNotice}
                            </div>
                          ` : ''}

                          <div style="font-size: 12px; color: ${subtextCol}; margin-top: 16px; text-align: center;">
                            Have your official digital pass / QR code ready on arrival for fast gate entry.
                          </div>

                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="text-align: center; padding: 16px 20px; font-size: 11px; color: ${subtextCol}; border-top: 1px solid rgba(255, 255, 255, 0.08); background-color: rgba(0, 0, 0, 0.35);">
                          ${senderDisplayName} • Official Event Guidelines & Regulations Dispatch
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;

          await transporter.sendMail({
            from: `"${senderDisplayName}" <${smtpConfig.senderEmail.trim()}>`,
            to: recipient.email.trim(),
            subject: sub,
            html: htmlContent,
          });

          results.push({
            email: recipient.email,
            status: "sent",
          });
        } catch (err: any) {
          console.error(`Failed to send rules email to ${recipient.email}:`, err);
          results.push({
            email: recipient.email,
            status: "failed",
            error: err.message || "Failed to dispatch email",
          });
        }
      }

      res.json({
        success: true,
        total: recipients.length,
        results,
      });
    } catch (error: any) {
      console.error("Error in dispatch-rules:", error);
      res.status(500).json({ error: error.message || "Failed to dispatch rules email." });
    }
  });

  // API Route: Send Individual Event Tickets via Gmail App Password (SMTP)
  app.post("/api/email/dispatch-passes", async (req, res) => {
    try {
      const { smtpConfig, recipients, template } = req.body;

      if (!smtpConfig || !smtpConfig.senderEmail || !smtpConfig.appPassword) {
        return res.status(400).json({ error: "Sender Gmail address and 16-character Gmail App Password are required." });
      }

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "At least one recipient is required." });
      }

      // Sanitize Gmail App Password (remove spaces if user copied like 'abcd efgh ijkl mnop')
      const sanitizedAppPassword = smtpConfig.appPassword.replace(/\s+/g, "");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpConfig.senderEmail.trim(),
          pass: sanitizedAppPassword,
        },
      });

      // Verify connection
      await transporter.verify();

      const results = [];

      // Custom Color & Styling options with full deep unpacking
      const st = template?.style || template || {};
      const cardBg = st.cardBackground || st.cardBgColor || template?.cardBackground || template?.cardBgColor || "#0d131f";
      const outerBg = st.outerBackground || st.outerBgColor || template?.outerBackground || template?.outerBgColor || "#030712";
      const gradStart = st.headerGradientStart || template?.headerGradientStart || "#059669";
      const gradEnd = st.headerGradientEnd || template?.headerGradientEnd || "#10b981";
      const headerTextCol = st.headerTextColor || template?.headerTextColor || "#ffffff";
      const accentCol = st.accentColor || template?.accentColor || "#10b981";
      const highlightCol = st.highlightColor || template?.highlightColor || "#f59e0b";
      const codeBg = st.codeBoxBackground || st.codeBgColor || template?.codeBoxBackground || template?.codeBgColor || "#050b14";
      const textCol = st.textColor || template?.textColor || "#f8fafc";
      const subtextCol = st.subtextColor || template?.subtextColor || "#94a3b8";
      const bannerImg = (st.bannerUrl || st.bannerImageUrl || template?.bannerUrl || template?.bannerImageUrl || "").trim();
      const senderDisplayName = (smtpConfig.senderName || template?.senderName || template?.senderBrand || "PassCraft Event Desk").trim();

      for (const recipient of recipients) {
        try {
          const displayMode = template?.displayMode || "both"; // 'both', 'qr_only', 'code_only'

          const showCode = displayMode === "both" || displayMode === "code_only";
          const showQr = displayMode === "both" || displayMode === "qr_only";

          // Replace placeholders
          let sub = (template?.subject || "🎟️ Entry Ticket for {{EVENT_NAME}} - {{ATTENDEE_NAME}}")
            .replace(/\{\{ATTENDEE_NAME\}\}/g, recipient.attendeeName || "Valued Guest")
            .replace(/\{\{EVENT_NAME\}\}/g, recipient.eventName || "Event")
            .replace(/\{\{EVENT_DATE\}\}/g, recipient.eventDate || "TBA")
            .replace(/\{\{EVENT_TIME\}\}/g, recipient.eventTime || "Doors Open 6:00 PM")
            .replace(/\{\{VENUE\}\}/g, recipient.venue || "Main Convention Center")
            .replace(/\{\{PASS_CATEGORY\}\}/g, recipient.category || "VIP Pass");

          let bodyTxt = (template?.bodyText || "Hello {{ATTENDEE_NAME}},\n\nHere is your official pass for {{EVENT_NAME}}.\nDate: {{EVENT_DATE}} | Category: {{PASS_CATEGORY}}\n16-Digit Code: {{CODE_16}}\n\nPlease show this ticket at entry.")
            .replace(/\{\{ATTENDEE_NAME\}\}/g, recipient.attendeeName || "Valued Guest")
            .replace(/\{\{EVENT_NAME\}\}/g, recipient.eventName || "Event")
            .replace(/\{\{EVENT_DATE\}\}/g, recipient.eventDate || "TBA")
            .replace(/\{\{EVENT_TIME\}\}/g, recipient.eventTime || "Doors Open 6:00 PM")
            .replace(/\{\{VENUE\}\}/g, recipient.venue || "Main Convention Center")
            .replace(/\{\{PASS_CATEGORY\}\}/g, recipient.category || "VIP Pass");

          if (showCode) {
            sub = sub.replace(/\{\{CODE_16\}\}/g, recipient.formattedCode || recipient.code16 || "");
            bodyTxt = bodyTxt.replace(/\{\{CODE_16\}\}/g, recipient.formattedCode || recipient.code16 || "");
          } else {
            // Strict QR only: strip any 16 digit code references
            sub = sub.replace(/\{\{CODE_16\}\}/g, "").replace(/\s*-\s*$/, "").trim();
            bodyTxt = bodyTxt.replace(/16-Digit Code:\s*\{\{CODE_16\}\}/gi, "").replace(/\{\{CODE_16\}\}/g, "").trim();
          }

          // Inline QR Code CID attachment
          const attachments = [];
          let qrCidImg = "";

          if (showQr) {
            try {
              const qrTextPayload = recipient.formattedCode || recipient.code16 || 'PASSCRAFT_EVENT_TICKET';
              const qrBuffer = await QRCode.toBuffer(qrTextPayload, {
                width: 300,
                margin: 2,
                errorCorrectionLevel: 'H',
                color: {
                  dark: '#000000',
                  light: '#ffffff'
                }
              });

              const cidName = `qr_${recipient.code16 || Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              attachments.push({
                filename: "pass_qr.png",
                content: qrBuffer,
                cid: cidName,
              });

              qrCidImg = `<div style="text-align: center; margin: 22px 0;"><div style="display: inline-block; background-color: #ffffff; padding: 12px; border-radius: 16px; border: 3px solid ${accentCol}; box-shadow: 0 10px 20px rgba(0,0,0,0.4);"><img src="cid:${cidName}" alt="Ticket QR Code" style="width: 200px; height: 200px; display: block; margin: 0 auto;" /></div></div>`;
            } catch (qrErr) {
              console.error("Error generating inline QR code buffer:", qrErr);
            }
          }

          // Build Dynamic Designer / Canva Grade Cross-Client HTML Email Template (100% Inline CSS for Gmail)
          const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${sub}</title>
            </head>
            <body style="margin: 0; padding: 20px 10px; background-color: ${outerBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${textCol};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${outerBg}; width: 100%; margin: 0; padding: 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; width: 100%; background-color: ${cardBg}; border: 2px solid ${accentCol}; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.6); text-align: left;">
                      
                      ${bannerImg ? `
                        <tr>
                          <td style="padding: 0; margin: 0;">
                            <img src="${bannerImg}" alt="Event Banner" style="width: 100%; max-height: 200px; object-fit: cover; display: block; border-bottom: 2px solid ${accentCol};" />
                          </td>
                        </tr>
                      ` : ''}

                      <!-- Ticket Header with Custom Gradient & Colors -->
                      <tr>
                        <td style="background-color: ${gradStart}; background: linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%); padding: 26px 20px; text-align: center; color: ${headerTextCol};">
                          <div style="font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; color: ${headerTextCol}; opacity: 0.95;">
                            🎟️ OFFICIAL EVENT ACCESS PASS
                          </div>
                          <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; color: ${headerTextCol}; line-height: 1.2;">
                            ${recipient.eventName || "OFFICIAL EVENT"}
                          </div>
                        </td>
                      </tr>

                      <!-- Ticket Main Body -->
                      <tr>
                        <td style="padding: 24px;">
                          
                          <!-- Attendee Delegate Box -->
                          <div style="background-color: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.12); border-left: 4px solid ${accentCol}; border-radius: 12px; padding: 16px 18px; margin-bottom: 18px;">
                            <div style="font-size: 10px; color: ${accentCol}; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
                              PASS HOLDER DELEGATE
                            </div>
                            <div style="font-size: 20px; font-weight: 900; color: ${textCol}; text-transform: uppercase; line-height: 1.2;">
                              ${recipient.attendeeName || "Valued Delegate"}
                            </div>
                            <div style="font-size: 12px; color: ${highlightCol}; font-weight: 800; margin-top: 4px;">
                              TIER: ${recipient.category || "GENERAL"}
                            </div>
                          </div>

                          <!-- 2-Column Metadata Table -->
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 18px;">
                            <tr>
                              <td width="48%" style="background-color: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px 14px; vertical-align: top;">
                                <div style="color: ${subtextCol}; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">📅 DATE & TIME</div>
                                <div style="color: ${textCol}; font-size: 13px; font-weight: 900; margin-top: 2px;">${recipient.eventDate || "TBA"}</div>
                                <div style="color: ${subtextCol}; font-size: 11px; font-weight: 600; margin-top: 2px;">${recipient.eventTime || "Doors Open 6:00 PM"}</div>
                              </td>
                              <td width="4%"></td>
                              <td width="48%" style="background-color: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px 14px; vertical-align: top;">
                                <div style="color: ${subtextCol}; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">📍 VENUE LOCATION</div>
                                <div style="color: ${textCol}; font-size: 13px; font-weight: 900; margin-top: 2px;">${recipient.venue || "Main Convention Center"}</div>
                              </td>
                            </tr>
                          </table>

                          <!-- Custom Message / Instructions -->
                          <div style="background-color: ${codeBg}; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 16px; font-size: 13px; line-height: 1.6; color: ${textCol}; white-space: pre-wrap; margin-bottom: 18px;">
${bodyTxt}
                          </div>

                          <!-- QR Code Image -->
                          ${showQr ? qrCidImg : ""}

                          <!-- 16-Digit Code Box -->
                          ${showCode ? `
                            <div style="background-color: ${codeBg}; border: 2px dashed ${accentCol}; border-radius: 12px; padding: 16px; text-align: center; margin: 18px 0;">
                              <div style="font-size: 10px; color: ${subtextCol}; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px;">
                                16-DIGIT ENTRY VERIFICATION CODE
                              </div>
                              <div style="font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: 900; color: ${highlightCol}; letter-spacing: 3px;">
                                ${recipient.formattedCode || recipient.code16}
                              </div>
                            </div>
                          ` : ""}

                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="text-align: center; padding: 16px 20px; font-size: 11px; color: ${subtextCol}; border-top: 1px solid rgba(255, 255, 255, 0.08); background-color: rgba(0, 0, 0, 0.25);">
                          ${senderDisplayName} Verified Event Pass • Present this digital pass or QR barcode at the entrance gate.
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `;

          const mailOptions: any = {
            from: `"${senderDisplayName}" <${smtpConfig.senderEmail.trim()}>`,
            to: recipient.email.trim(),
            subject: sub,
            text: bodyTxt,
            html: htmlContent,
            attachments,
          };

          await transporter.sendMail(mailOptions);

          results.push({
            email: recipient.email,
            attendeeName: recipient.attendeeName,
            status: "sent",
          });
        } catch (err: any) {
          console.error(`Error sending email to ${recipient.email}:`, err);
          results.push({
            email: recipient.email,
            attendeeName: recipient.attendeeName,
            status: "failed",
            error: err.message || "Sending failed",
          });
        }
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error("Error in dispatch-passes:", error);
      res.status(500).json({ error: error.message || "Failed to connect to Gmail SMTP. Check your Gmail address and 16-character App Password." });
    }
  });

  // API Route: Save user account data (Persistent Gmail Backup)
  app.post("/api/user/save-data", (req, res) => {
    try {
      const { email, events, passes, financials, forms, docs } = req.body;
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Valid Gmail/email address required." });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const db = readUserDb();
      const existing = db[normalizedEmail] || {};

      db[normalizedEmail] = {
        events: events !== undefined ? events : (existing.events || []),
        passes: passes !== undefined ? passes : (existing.passes || []),
        financials: financials !== undefined ? financials : (existing.financials || []),
        forms: forms !== undefined ? forms : (existing.forms || []),
        docs: docs !== undefined ? docs : (existing.docs || []),
        lastSaved: new Date().toISOString(),
      };

      writeUserDb(db);
      res.json({ success: true, message: `PassCraft data backed up for ${normalizedEmail}`, lastSaved: db[normalizedEmail].lastSaved });
    } catch (error: any) {
      console.error("Error saving user data:", error);
      res.status(500).json({ error: "Failed to save user data." });
    }
  });

  // API Route: Load user account data (Persistent Gmail Restore)
  app.get("/api/user/load-data", (req, res) => {
    try {
      const email = (req.query.email as string || "").trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "Email query param required." });
      }

      const db = readUserDb();
      const userData = db[email];

      if (userData) {
        res.json({ success: true, data: userData });
      } else {
        res.json({ success: false, message: "No previous cloud backup found for this account." });
      }
    } catch (error: any) {
      console.error("Error loading user data:", error);
      res.status(500).json({ error: "Failed to load user data." });
    }
  });

  // API Route: Save / Register 1-Time Quick Access Code
  app.post("/api/quick-codes/save", (req, res) => {
    try {
      const { codeItem, ownerEmail } = req.body;
      if (!ownerEmail || !ownerEmail.includes("@")) {
        return res.status(403).json({ error: "Only logged-in Gmail accounts can create 1-time access codes." });
      }
      if (!codeItem || !codeItem.code) {
        return res.status(400).json({ error: "Valid quick access code item required." });
      }

      const cleanCode = String(codeItem.code).trim().toUpperCase();
      const normalizedOwner = ownerEmail.trim().toLowerCase();
      const db = readUserDb();

      if (!db._quick_codes) {
        db._quick_codes = {};
      }

      db._quick_codes[cleanCode] = {
        ...codeItem,
        code: cleanCode,
        createdByEmail: normalizedOwner,
        updatedAt: new Date().toISOString(),
      };

      writeUserDb(db);
      res.json({ success: true, codeItem: db._quick_codes[cleanCode] });
    } catch (error: any) {
      console.error("Error saving quick code:", error);
      res.status(500).json({ error: "Failed to save quick code." });
    }
  });

  // API Route: Verify 1-Time Quick Access Code across devices
  app.get("/api/quick-codes/verify", (req, res) => {
    try {
      const code = (req.query.code as string || "").trim().toUpperCase();
      const ownerEmail = (req.query.ownerEmail as string || "").trim().toLowerCase();

      if (!code) {
        return res.status(400).json({ error: "Access code parameter is required." });
      }

      const db = readUserDb();
      const allCodes = db._quick_codes || {};
      const found = allCodes[code];

      if (found) {
        if (ownerEmail && found.createdByEmail && found.createdByEmail.toLowerCase() !== ownerEmail) {
          // If specific owner provided and mismatch
          return res.status(404).json({ success: false, error: `Code is not registered under workspace ${ownerEmail}.` });
        }
        if (found.isActive === false) {
          return res.status(403).json({ success: false, error: "This 1-time quick code has been disabled." });
        }
        return res.json({ success: true, codeItem: found });
      }

      res.status(404).json({ success: false, error: "Quick code not found on server." });
    } catch (error: any) {
      console.error("Error verifying quick code:", error);
      res.status(500).json({ error: "Failed to verify quick code." });
    }
  });

  // API Route: List 1-Time Quick Codes for Owner
  app.get("/api/quick-codes/list", (req, res) => {
    try {
      const ownerEmail = (req.query.ownerEmail as string || "").trim().toLowerCase();
      if (!ownerEmail) {
        return res.status(400).json({ error: "Owner email is required." });
      }

      const db = readUserDb();
      const allCodes = db._quick_codes || {};
      const list = Object.values(allCodes).filter((c: any) => c.createdByEmail?.toLowerCase() === ownerEmail);

      res.json({ success: true, codes: list });
    } catch (error: any) {
      console.error("Error listing quick codes:", error);
      res.status(500).json({ error: "Failed to list quick codes." });
    }
  });

  // API Route: Delete 1-Time Quick Access Code
  app.post("/api/quick-codes/delete", (req, res) => {
    try {
      const { codeId, code, ownerEmail } = req.body;
      const cleanCode = code ? String(code).trim().toUpperCase() : null;
      const cleanCodeId = codeId ? String(codeId).trim() : null;
      const db = readUserDb();
      if (db._quick_codes) {
        if (cleanCode) {
          delete db._quick_codes[cleanCode];
          delete db._quick_codes[cleanCode.toLowerCase()];
        }
        for (const [key, val] of Object.entries(db._quick_codes)) {
          const item = val as any;
          if (
            (cleanCodeId && item?.id === cleanCodeId) ||
            (cleanCode && (item?.code?.toUpperCase() === cleanCode || key.toUpperCase() === cleanCode))
          ) {
            delete db._quick_codes[key];
          }
        }
        writeUserDb(db);
      }
      res.json({ success: true, message: "Quick code deleted from server backup." });
    } catch (error: any) {
      console.error("Error deleting quick code:", error);
      res.status(500).json({ error: "Failed to delete quick code." });
    }
  });

  // API Route: Toggle 1-Time Quick Access Code active status
  app.post("/api/quick-codes/toggle", (req, res) => {
    try {
      const { codeId, code, isActive } = req.body;
      const cleanCode = code ? String(code).trim().toUpperCase() : null;
      const db = readUserDb();
      if (db._quick_codes) {
        for (const [key, val] of Object.entries(db._quick_codes)) {
          const item = val as any;
          if (item?.id === codeId || (cleanCode && (item?.code?.toUpperCase() === cleanCode || key === cleanCode))) {
            item.isActive = Boolean(isActive);
            item.updatedAt = new Date().toISOString();
          }
        }
        writeUserDb(db);
      }
      res.json({ success: true, message: "Quick code status updated." });
    } catch (error: any) {
      console.error("Error toggling quick code:", error);
      res.status(500).json({ error: "Failed to toggle quick code." });
    }
  });

  // 404 JSON Handler for unmatched /api/* routes (prevents Vite serving HTML for broken API requests)
  app.all("/api/*", (req, res) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global Error Handler for Express
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled server error:", err);
    if (req.path.startsWith("/api/")) {
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || "An unexpected internal server error occurred.",
      });
    }
    next(err);
  });

  // Vite middleware for development vs static files for production
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? "production" : "development"})`);
  });

  // In production, if Cloud Run assigned a port other than 3000 (e.g. 8080),
  // also listen on port 3000 as a secondary listener if available
  if (isProduction && PORT !== 3000) {
    try {
      const secondaryServer = app.listen(3000, "0.0.0.0", () => {
        console.log("Secondary server also listening on http://0.0.0.0:3000");
      });
      secondaryServer.on("error", (err: any) => {
        if (err.code !== "EADDRINUSE") {
          console.warn("Secondary server notice:", err.message);
        }
      });
    } catch {
      // Ignore if secondary port is unavailable
    }
  }

  process.on("SIGTERM", () => {
    console.log("SIGTERM received, closing HTTP server...");
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received, closing HTTP server...");
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  });
}

startServer();
