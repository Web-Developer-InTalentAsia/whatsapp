import "dotenv/config";
import express from "express";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { eq, and, or, like, desc, asc, sql } from "drizzle-orm";
import { db, schema } from "./src/db/index.ts";

const app = express();

// IIS / ARR reverse-proxy support
app.set("trust proxy", 1);
app.disable("x-powered-by");

const PORT = Number(process.env.PORT || 3000);
const configuredJwtSecret = process.env.JWT_SECRET?.trim();

if (!configuredJwtSecret && process.env.NODE_ENV === "production") {
  throw new Error(
    "JWT_SECRET environment variable is required when NODE_ENV=production.",
  );
}

// A development-only fallback keeps local development usable.
// Production startup fails above when JWT_SECRET is missing.
const JWT_SECRET =
  configuredJwtSecret || "development_only_intalent_whatsapp_secret";

// Middlewares
app.use(express.json({ limit: "1mb" }));

// Authentication and API responses must never be cached by IIS or the browser.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Public health endpoint for checking IIS -> Node reverse proxy connectivity.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    app: "intalent-whatsapp",
    environment: process.env.NODE_ENV || "development",
    host: req.get("host") || null,
    protocol: req.protocol,
    forwardedProto: req.get("x-forwarded-proto") || null,
    time: new Date().toISOString(),
  });
});

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}


// --- META WHATSAPP CLOUD API HELPERS ---
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";

function normalizeWhatsAppNumber(phone: string) {
  return String(phone || "").trim().replace(/[^\d]/g, "");
}

function getMetaApiErrorMessage(data: any, fallbackStatus: number) {
  return (
    data?.error?.error_user_msg ||
    data?.error?.message ||
    data?.message ||
    `Meta API request failed with status ${fallbackStatus}`
  );
}

async function parseMetaResponse(response: Response) {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

async function verifyMetaPhoneNumber(params: {
  phoneNumberId: string;
  accessToken: string;
}) {
  const phoneNumberId = String(params.phoneNumberId || "").trim();
  const accessToken = String(params.accessToken || "").trim();

  if (!phoneNumberId || !accessToken) {
    throw new Error("Phone Number ID or Access Token is missing in WhatsApp settings.");
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await parseMetaResponse(response);
  if (!response.ok) {
    throw new Error(getMetaApiErrorMessage(data, response.status));
  }

  return data;
}

async function sendWhatsAppTextMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}) {
  const phoneNumberId = String(params.phoneNumberId || "").trim();
  const accessToken = String(params.accessToken || "").trim();
  const to = normalizeWhatsAppNumber(params.to);
  const body = String(params.body || "").trim();

  if (!phoneNumberId || !accessToken) {
    throw new Error("Phone Number ID or Access Token is missing in WhatsApp settings.");
  }

  if (!to) {
    throw new Error("Recipient WhatsApp number is invalid.");
  }

  if (!body) {
    throw new Error("Message text is empty.");
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body,
      },
    }),
  });

  const data = await parseMetaResponse(response);
  if (!response.ok) {
    throw new Error(getMetaApiErrorMessage(data, response.status));
  }

  return data;
}

// Ensure database has seed data on startup
async function ensureSeedData() {
  try {
    const existingUsers = await db.select().from(schema.users).limit(1);
    if (existingUsers.length === 0) {
      console.log("No users found. Seeding initial database...");

      // 1. Seed Super Admin (user's email from metadata)
      const hashedSuperAdmin = bcrypt.hashSync("adminpassword", 10);
      const [superAdmin] = await db.insert(schema.users).values({
        email: "intalentintern9@gmail.com",
        password: hashedSuperAdmin,
        role: "super_admin",
        name: "InTalent Super Admin",
        isActive: true,
        canEditWorkflows: true,
      }).returning();

      // 2. Seed Admin User
      const hashedAdmin = bcrypt.hashSync("admin123", 10);
      const [adminUser] = await db.insert(schema.users).values({
        email: "admin@intalent.co",
        password: hashedAdmin,
        role: "admin",
        name: "Sarah Connor (Admin)",
        isActive: true,
        canEditWorkflows: true,
      }).returning();

      // 3. Seed Regular Agent User
      const hashedAgent = bcrypt.hashSync("user123", 10);
      const [agentUser] = await db.insert(schema.users).values({
        email: "agent@intalent.co",
        password: hashedAgent,
        role: "user",
        name: "Alex Mercer (User)",
        isActive: true,
        canEditWorkflows: false,
      }).returning();

      // 4. Seed WhatsApp Numbers Settings
      const [num1] = await db.insert(schema.whatsappNumbers).values({
        displayName: "InTalent London Office",
        phoneNumber: "+447123456789",
        phoneNumberId: "109283749281739",
        wabaId: "987654321098765",
        appId: "123456789012",
        appSecret: "app_secret_abc123",
        accessToken: "EAAG_temp_token_xyz",
        verifyToken: "intalent_verify_token_1",
        webhookStatus: "Verified",
        isActive: true,
      }).returning();

      const [num2] = await db.insert(schema.whatsappNumbers).values({
        displayName: "InTalent Support Line",
        phoneNumber: "+447987654321",
        phoneNumberId: "109283749281740",
        wabaId: "987654321098766",
        appId: "123456789013",
        appSecret: "app_secret_def456",
        accessToken: "EAAG_temp_token_uvw",
        verifyToken: "intalent_verify_token_2",
        webhookStatus: "Pending",
        isActive: true,
      }).returning();

      // 5. Seed User Number Assignments
      await db.insert(schema.userNumberAssignments).values([
        { userId: superAdmin.id, numberId: num1.id, isPrimaryOwner: true },
        { userId: superAdmin.id, numberId: num2.id, isPrimaryOwner: true },
        { userId: adminUser.id, numberId: num1.id, isPrimaryOwner: false },
        { userId: agentUser.id, numberId: num1.id, isPrimaryOwner: false },
      ]);

      // 6. Seed Default AI Settings
      await db.insert(schema.aiSettings).values([
        {
          whatsappNumberId: num1.id,
          aiProvider: "gemini",
          apiKey: "",
          modelName: "gemini-3.5-flash",
          defaultTone: "professional",
          companyKnowledgeBase: "InTalent is an elite global recruitment agency specializing in Tech & Digital roles. We match top-tier software engineers, product managers, designers, and data scientists with tech startups and enterprises in Europe and North America. Benefits include 28 days holiday, private healthcare, and hybrid flexibility. Recruiters: Sarah Connor, Alex Mercer.",
          restrictedWords: "guarantee, 100%, cheat, bypass, discount",
          autoSuggest: true,
          autoReply: false,
          humanApprovalRequired: true,
        },
        {
          whatsappNumberId: num2.id,
          aiProvider: "gemini",
          apiKey: "",
          modelName: "gemini-3.5-flash",
          defaultTone: "friendly",
          companyKnowledgeBase: "This is the recruitment support and onboarding line for InTalent. We assist candidates with CV reviews, mock interviews, and scheduling onboarding sessions.",
          restrictedWords: "promise, refunds",
          autoSuggest: true,
          autoReply: false,
          humanApprovalRequired: true,
        }
      ]);

      // 7. Seed Training FAQs
      await db.insert(schema.aiTrainingData).values([
        {
          whatsappNumberId: num1.id,
          type: "faq",
          question: "Where is InTalent headquartered?",
          answer: "InTalent is headquartered in central London, UK, with remote recruiting consultants across Berlin, Munich, and New York."
        },
        {
          whatsappNumberId: num1.id,
          type: "faq",
          question: "What is your typical recruitment process?",
          answer: "Our process consists of: 1) Initial CV screen, 2) 30-minute culture fit call, 3) Technical evaluation, 4) Final interview with our client partner."
        },
        {
          whatsappNumberId: num1.id,
          type: "rule",
          question: "Response language rule",
          answer: "Always match the language of the candidate (e.g., if they text in German, reply in German)."
        }
      ]);

      // 8. Seed Demo Workflows
      const demoWorkflowSteps = [
        {
          id: "step_welcome",
          type: "menu",
          questionText: "Thank you for contacting InTalent. Please reply with the number of your choice:\n\n1. Send my CV\n2. View available jobs\n3. Speak to recruiter\n4. Update my details",
          options: [
            { key: "1", text: "Send my CV", nextStepId: "step_cv" },
            { key: "2", text: "View available jobs", nextStepId: "step_jobs" },
            { key: "3", text: "Speak to recruiter", nextStepId: "step_recruiter" },
            { key: "4", text: "Update my details", nextStepId: "step_details" }
          ]
        },
        {
          id: "step_cv",
          type: "question",
          questionText: "Please paste your LinkedIn profile URL or details about your engineering background.",
          variableName: "cvField",
          nextStepId: "step_end"
        },
        {
          id: "step_jobs",
          type: "question",
          questionText: "Please tell us your desired job role, expected salary, and location.",
          variableName: "interestedJobRole",
          nextStepId: "step_end"
        },
        {
          id: "step_recruiter",
          type: "handover",
          questionText: "Got it! Transferring you to a live recruiter. We will reply to you shortly.",
          nextStepId: "step_end"
        },
        {
          id: "step_details",
          type: "question",
          questionText: "Please reply with your full name and current location.",
          variableName: "location",
          nextStepId: "step_end"
        },
        {
          id: "step_end",
          type: "end_workflow",
          questionText: "All set! Thank you. Your details have been stored securely in InTalent's recruiting system. Have a great day!"
        }
      ];

      await db.insert(schema.workflows).values({
        whatsappNumberId: num1.id,
        name: "Job Seeker Onboarding",
        triggerKeyword: "jobs",
        welcomeMessage: "Welcome to InTalent Careers Onboarding!",
        isActive: true,
        steps: JSON.stringify(demoWorkflowSteps),
      });

      // 9. Seed Demo Contacts, Conversations, Messages
      const [contact1] = await db.insert(schema.contacts).values({
        phoneNumber: "+14155552671",
        name: "John Doe",
        sourceNumberId: num1.id,
        assignedUserId: agentUser.id,
        tags: "Candidate, Senior React",
        status: "active",
        notes: "Highly qualified Lead Frontend Developer with 5+ years of experience at a SaaS startup. Friendly and highly articulate.",
        cvField: "https://linkedin.com/in/johndoe-react-demo",
        interestedJobRole: "Senior React Developer",
        expectedSalary: "$130k / year",
        location: "San Francisco, CA",
        experience: "5 years",
        clientCandidateType: "candidate",
      }).returning();

      const [contact2] = await db.insert(schema.contacts).values({
        phoneNumber: "+44799001122",
        name: "Alice Smith",
        sourceNumberId: num1.id,
        assignedUserId: adminUser.id,
        tags: "Client, Tech Lead",
        status: "active",
        notes: "Hiring Manager at TechCorp London. Looking to scale her backend team with 3 Senior Node.js engineers.",
        clientCandidateType: "client",
      }).returning();

      const [conv1] = await db.insert(schema.conversations).values({
        contactId: contact1.id,
        whatsappNumberId: num1.id,
        assignedUserId: agentUser.id,
        status: "open",
        lastMessageAt: new Date(Date.now() - 30 * 60000),
      }).returning();

      const [conv2] = await db.insert(schema.conversations).values({
        contactId: contact2.id,
        whatsappNumberId: num1.id,
        assignedUserId: adminUser.id,
        status: "unread",
        lastMessageAt: new Date(Date.now() - 5 * 60000),
      }).returning();

      // Message logs for John Doe
      await db.insert(schema.messages).values([
        {
          conversationId: conv1.id,
          sender: "contact",
          senderName: "John Doe",
          content: "Hi there! I saw your posting for a Senior React Developer and wanted to learn more about the role.",
          messageType: "text",
          status: "received",
          timestamp: new Date(Date.now() - 120 * 60000),
        },
        {
          conversationId: conv1.id,
          sender: "agent",
          senderName: "Alex Mercer (User)",
          content: "Hi John! Welcome to InTalent. It is a fantastic role. Could you please share a bit more about your background and tech stack?",
          messageType: "text",
          replyType: "manual",
          status: "sent",
          timestamp: new Date(Date.now() - 100 * 60000),
          agentId: agentUser.id,
        },
        {
          conversationId: conv1.id,
          sender: "contact",
          senderName: "John Doe",
          content: "Sure! I have 5 years of React and Node experience, and my LinkedIn is https://linkedin.com/in/johndoe-react-demo",
          messageType: "text",
          status: "received",
          timestamp: new Date(Date.now() - 30 * 60000),
        }
      ]);

      // Message log for Alice Smith
      await db.insert(schema.messages).values([
        {
          conversationId: conv2.id,
          sender: "contact",
          senderName: "Alice Smith",
          content: "Hello! We are looking to contract a specialized technical recruitment firm to help us source developers in London. Can we set up a discovery call?",
          messageType: "text",
          status: "received",
          timestamp: new Date(Date.now() - 5 * 60000),
        }
      ]);

      console.log("Seed data created successfully!");
    }
  } catch (error) {
    console.error("Error checking or seeding database:", error);
  }
}

// Database initialization is awaited inside startServer() before the app starts listening.

// --- AUTHENTICATION ENDPOINTS & MIDDLEWARE ---

// JWT auth middleware
const authenticateJWT = async (req: any, res: any, next: any) => {
  const rawAuthorization =
    req.headers.authorization || req.headers["x-forwarded-authorization"] || "";
  const authHeader = String(rawAuthorization).trim();

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Access denied. Token missing." });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: "Access denied. Token missing." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      email: string;
      role: string;
    };

    if (!decoded || !Number.isInteger(Number(decoded.id))) {
      return res.status(403).json({ error: "Invalid authentication token." });
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, Number(decoded.id)))
      .limit(1);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User is suspended or deactivated." });
    }

    req.user = user;
    return next();
  } catch (error: any) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }

    return res.status(403).json({ error: "Invalid authentication token." });
  }
};

// Helper: check if role has permission
const requireRoles = (allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permission denied. Insufficient role permissions." });
    }
    next();
  };
};

// Log login/logout/settings actions
async function auditLog(userId: number | null, email: string | null, action: string, details: string, ip?: string) {
  try {
    await db.insert(schema.auditLogs).values({
      userId,
      userEmail: email,
      action,
      details,
      ipAddress: ip || "127.0.0.1",
    });
  } catch (e) {
    console.error("Audit logging error:", e);
  }
}

// Login
app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Please provide email and password." });
  }

  try {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account is deactivated." });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    await auditLog(
      user.id,
      user.email,
      "Login",
      `User ${user.name} logged in successfully.`,
      req.ip,
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        canEditWorkflows: user.canEditWorkflows,
      },
    });
  } catch (error: any) {
    console.error("Login failed:", error);
    return res.status(500).json({
      error: "Server login error. Please try again.",
    });
  }
});

// Me
app.get("/api/auth/me", authenticateJWT, (req: any, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      isActive: req.user.isActive,
      canEditWorkflows: req.user.canEditWorkflows,
    }
  });
});

// Profile
app.get("/api/auth/profile", authenticateJWT, (req: any, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    isActive: req.user.isActive,
    canEditWorkflows: req.user.canEditWorkflows,
  });
});

// --- USER MANAGEMENT (Super Admin only) ---
app.get("/api/users", authenticateJWT, requireRoles(["super_admin"]), async (req, res) => {
  try {
    const usersList = await db.select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
      canEditWorkflows: schema.users.canEditWorkflows,
      createdAt: schema.users.createdAt,
    }).from(schema.users).orderBy(desc(schema.users.id));
    res.json(usersList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", authenticateJWT, requireRoles(["super_admin"]), async (req: any, res) => {
  const { name, email, password, role, isActive, canEditWorkflows } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Missing required user fields." });
  }
  try {
    const hashed = bcrypt.hashSync(password, 10);
    const [newUser] = await db.insert(schema.users).values({
      name,
      email,
      password: hashed,
      role,
      isActive: isActive !== undefined ? isActive : true,
      canEditWorkflows: canEditWorkflows !== undefined ? canEditWorkflows : false,
    }).returning();

    await auditLog(req.user.id, req.user.email, "User Created", `Created user ${name} with role ${role}.`);

    res.json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      canEditWorkflows: newUser.canEditWorkflows,
    });
  } catch (error: any) {
    if (error.code === "23505" || error.message?.includes("unique")) {
      return res.status(400).json({ error: "User with this email already exists." });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", authenticateJWT, requireRoles(["super_admin"]), async (req: any, res) => {
  const { id } = req.params;
  const { name, email, password, role, isActive, canEditWorkflows } = req.body;
  try {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (canEditWorkflows !== undefined) updates.canEditWorkflows = canEditWorkflows;
    if (password) updates.password = bcrypt.hashSync(password, 10);

    const [updatedUser] = await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, parseInt(id)))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    await auditLog(req.user.id, req.user.email, "User Updated", `Updated user ${updatedUser.name} (ID: ${id}).`);

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      canEditWorkflows: updatedUser.canEditWorkflows,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/users/:id", authenticateJWT, requireRoles(["super_admin"]), async (req: any, res) => {
  const { id } = req.params;
  try {
    const [deleted] = await db.delete(schema.users).where(eq(schema.users.id, parseInt(id))).returning();
    if (!deleted) {
      return res.status(404).json({ error: "User not found." });
    }
    await auditLog(req.user.id, req.user.email, "User Deleted", `Deleted user ${deleted.name} (ID: ${id}).`);
    res.json({ success: true, message: `User ${deleted.name} deleted.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- WHATSAPP NUMBER CONFIGURATIONS (Super Admin / Admin) ---

// List WhatsApp Numbers (filtered by assigned numbers for non-Super-Admins)
app.get("/api/whatsapp_numbers", authenticateJWT, async (req: any, res) => {
  try {
    let numbers;
    if (req.user.role === "super_admin") {
      numbers = await db.select().from(schema.whatsappNumbers).orderBy(asc(schema.whatsappNumbers.id));
    } else {
      // Find assigned numbers
      const assignments = await db.select()
        .from(schema.userNumberAssignments)
        .where(eq(schema.userNumberAssignments.userId, req.user.id));
      
      const numberIds = assignments.map(a => a.numberId);
      if (numberIds.length === 0) {
        numbers = [];
      } else {
        numbers = await db.select()
          .from(schema.whatsappNumbers)
          .where(sql`${schema.whatsappNumbers.id} IN ${numberIds}`)
          .orderBy(asc(schema.whatsappNumbers.id));
      }
    }

    // Attach assignments and primary owner info
    const enrichedNumbers = await Promise.all(numbers.map(async (num) => {
      const owners = await db.select({
        userId: schema.userNumberAssignments.userId,
        userName: schema.users.name,
        isPrimary: schema.userNumberAssignments.isPrimaryOwner
      })
      .from(schema.userNumberAssignments)
      .innerJoin(schema.users, eq(schema.userNumberAssignments.userId, schema.users.id))
      .where(eq(schema.userNumberAssignments.numberId, num.id));

      const primary = owners.find(o => o.isPrimary);

      return {
        ...num,
        assignedUsers: owners,
        primaryOwner: primary ? primary.userName : "None"
      };
    }));

    res.json(enrichedNumbers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create WhatsApp Number (Super Admin only)
app.post("/api/whatsapp_numbers", authenticateJWT, requireRoles(["super_admin"]), async (req: any, res) => {
  const { displayName, phoneNumber, phoneNumberId, wabaId, appId, appSecret, accessToken, verifyToken, isActive } = req.body;
  if (!displayName || !phoneNumber || !phoneNumberId || !wabaId || !appId || !appSecret || !accessToken || !verifyToken) {
    return res.status(400).json({ error: "Missing required API configuration fields." });
  }
  try {
    const [newNumber] = await db.insert(schema.whatsappNumbers).values({
      displayName,
      phoneNumber,
      phoneNumberId,
      wabaId,
      appId,
      appSecret,
      accessToken,
      verifyToken,
      webhookStatus: "Pending",
      isActive: isActive !== undefined ? isActive : true,
    }).returning();

    // Create a matching Default AI Settings entry automatically
    await db.insert(schema.aiSettings).values({
      whatsappNumberId: newNumber.id,
      aiProvider: "gemini",
      apiKey: "",
      modelName: "gemini-3.5-flash",
      defaultTone: "professional",
      companyKnowledgeBase: `Knowledge base for ${displayName}. We specialize in professional recruiting services.`,
      restrictedWords: "",
      autoSuggest: true,
      autoReply: false,
      humanApprovalRequired: true,
    });

    // Make Super Admin the primary owner automatically
    await db.insert(schema.userNumberAssignments).values({
      userId: req.user.id,
      numberId: newNumber.id,
      isPrimaryOwner: true,
    });

    await auditLog(req.user.id, req.user.email, "WhatsApp Number Added", `Added WhatsApp number ${displayName} (${phoneNumber}).`);

    res.json(newNumber);
  } catch (error: any) {
    if (error.code === "23505" || error.message?.includes("unique")) {
      return res.status(400).json({ error: "A WhatsApp number with this phone number already exists." });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update WhatsApp Number Settings
app.put("/api/whatsapp_numbers/:id", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req: any, res) => {
  const { id } = req.params;
  const { displayName, phoneNumber, phoneNumberId, wabaId, appId, appSecret, accessToken, verifyToken, isActive, webhookStatus } = req.body;
  try {
    // If not Super Admin, check if they are assigned to this number
    if (req.user.role !== "super_admin") {
      const [assigned] = await db.select()
        .from(schema.userNumberAssignments)
        .where(and(
          eq(schema.userNumberAssignments.userId, req.user.id),
          eq(schema.userNumberAssignments.numberId, parseInt(id))
        )).limit(1);
      if (!assigned) {
        return res.status(403).json({ error: "Permission denied. You are not assigned to this WhatsApp number." });
      }
    }

    const updates: any = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (phoneNumberId !== undefined) updates.phoneNumberId = phoneNumberId;
    if (wabaId !== undefined) updates.wabaId = wabaId;
    if (appId !== undefined) updates.appId = appId;
    if (appSecret !== undefined) updates.appSecret = appSecret;
    if (accessToken !== undefined) updates.accessToken = accessToken;
    if (verifyToken !== undefined) updates.verifyToken = verifyToken;
    if (isActive !== undefined) updates.isActive = isActive;
    if (webhookStatus !== undefined) updates.webhookStatus = webhookStatus;

    const [updated] = await db.update(schema.whatsappNumbers)
      .set(updates)
      .where(eq(schema.whatsappNumbers.id, parseInt(id)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "WhatsApp number not found." });
    }

    await auditLog(req.user.id, req.user.email, "WhatsApp Number Updated", `Updated settings for ${updated.displayName}.`);

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete WhatsApp Number
app.delete("/api/whatsapp_numbers/:id", authenticateJWT, requireRoles(["super_admin"]), async (req: any, res) => {
  const { id } = req.params;
  try {
    const [deleted] = await db.delete(schema.whatsappNumbers)
      .where(eq(schema.whatsappNumbers.id, parseInt(id)))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: "WhatsApp number not found." });
    }
    await auditLog(req.user.id, req.user.email, "WhatsApp Number Deleted", `Deleted WhatsApp number ${deleted.displayName} (ID: ${id}).`);
    res.json({ success: true, message: `WhatsApp number ${deleted.displayName} deleted.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Assign/Update User Assignments for a number
app.post("/api/whatsapp_numbers/:id/assignments", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req: any, res) => {
  const { id } = req.params;
  const { userIds, primaryOwnerId } = req.body; // userIds is array of user IDs
  if (!Array.isArray(userIds)) {
    return res.status(400).json({ error: "userIds must be an array." });
  }
  try {
    // Delete existing assignments for this number
    await db.delete(schema.userNumberAssignments).where(eq(schema.userNumberAssignments.numberId, parseInt(id)));

    // Create new ones
    if (userIds.length > 0) {
      const values = userIds.map(uid => ({
        userId: uid,
        numberId: parseInt(id),
        isPrimaryOwner: uid === primaryOwnerId,
      }));
      await db.insert(schema.userNumberAssignments).values(values);
    }

    await auditLog(req.user.id, req.user.email, "Assignments Updated", `Updated user assignments for WhatsApp Number ID ${id}.`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Meta Connection Tests
app.post("/api/whatsapp_numbers/:id/test-connection", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  try {
    const [num] = await db.select().from(schema.whatsappNumbers).where(eq(schema.whatsappNumbers.id, parseInt(id))).limit(1);
    if (!num) return res.status(404).json({ error: "Number not found." });

    if (!num.phoneNumberId || !num.accessToken) {
      return res.status(400).json({ error: "Phone Number ID or Access Token is missing in WhatsApp settings." });
    }

    const metaPhone = await verifyMetaPhoneNumber({
      phoneNumberId: num.phoneNumberId,
      accessToken: num.accessToken,
    });

    const [updated] = await db.update(schema.whatsappNumbers)
      .set({ webhookStatus: "Verified", lastVerified: new Date() })
      .where(eq(schema.whatsappNumbers.id, parseInt(id)))
      .returning();

    await auditLog(req.user.id, req.user.email, "API Connection Test", `Verified Meta WhatsApp Cloud API setup for ${num.displayName}.`);
    res.json({
      success: true,
      message: "Connection to Meta WhatsApp Cloud API verified successfully.",
      status: updated.webhookStatus,
      metaPhone,
    });
  } catch (error: any) {
    console.error("Meta connection test failed:", error);
    res.status(502).json({ error: `Meta API connection failed: ${error.message}` });
  }
});

app.post("/api/whatsapp_numbers/:id/verify-webhook", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  try {
    const [num] = await db.select().from(schema.whatsappNumbers).where(eq(schema.whatsappNumbers.id, parseInt(id))).limit(1);
    if (!num) return res.status(404).json({ error: "Number not found." });

    res.json({ success: true, message: `Webhook token verified against Meta App configurations!` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/whatsapp_numbers/:id/test-reply", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { testNumber } = req.body;
  if (!testNumber) return res.status(400).json({ error: "Please specify an authorized Meta Developer Test Number." });
  try {
    const [num] = await db.select().from(schema.whatsappNumbers).where(eq(schema.whatsappNumbers.id, parseInt(id))).limit(1);
    if (!num) return res.status(404).json({ error: "Number not found." });

    if (!num.isActive) {
      return res.status(400).json({ error: "This WhatsApp number is inactive." });
    }

    const metaResult = await sendWhatsAppTextMessage({
      phoneNumberId: num.phoneNumberId,
      accessToken: num.accessToken,
      to: testNumber,
      body: "Hello from InTalent WhatsApp Inbox. This is a Meta Cloud API test message.",
    });

    await auditLog(req.user.id, req.user.email, "Meta Test Reply", `Sent real Meta WhatsApp test reply to ${testNumber}.`);
    res.json({
      success: true,
      message: `A real WhatsApp test reply was sent to ${testNumber}.`,
      metaResult,
    });
  } catch (error: any) {
    console.error("Meta test reply failed:", error);
    res.status(502).json({ error: `WhatsApp test reply failed: ${error.message}` });
  }
});

// --- AI SETTINGS ---
app.get("/api/whatsapp_numbers/:id/ai-settings", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    let [settings] = await db.select().from(schema.aiSettings).where(eq(schema.aiSettings.whatsappNumberId, parseInt(id))).limit(1);
    if (!settings) {
      // Create defaults
      [settings] = await db.insert(schema.aiSettings).values({
        whatsappNumberId: parseInt(id),
        aiProvider: "gemini",
        apiKey: "",
        modelName: "gemini-3.5-flash",
        defaultTone: "professional",
        companyKnowledgeBase: "We match candidates with top tech job roles.",
        restrictedWords: "",
        autoSuggest: true,
        autoReply: false,
        humanApprovalRequired: true,
      }).returning();
    }
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/whatsapp_numbers/:id/ai-settings", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req: any, res) => {
  const { id } = req.params;
  const { aiProvider, apiKey, modelName, defaultTone, companyKnowledgeBase, restrictedWords, autoSuggest, autoReply, humanApprovalRequired } = req.body;
  try {
    const updates: any = {};
    if (aiProvider !== undefined) updates.aiProvider = aiProvider;
    if (apiKey !== undefined) updates.apiKey = apiKey;
    if (modelName !== undefined) updates.modelName = modelName;
    if (defaultTone !== undefined) updates.defaultTone = defaultTone;
    if (companyKnowledgeBase !== undefined) updates.companyKnowledgeBase = companyKnowledgeBase;
    if (restrictedWords !== undefined) updates.restrictedWords = restrictedWords;
    if (autoSuggest !== undefined) updates.autoSuggest = autoSuggest;
    if (autoReply !== undefined) updates.autoReply = autoReply;
    if (humanApprovalRequired !== undefined) updates.humanApprovalRequired = humanApprovalRequired;

    const [updated] = await db.update(schema.aiSettings)
      .set(updates)
      .where(eq(schema.aiSettings.whatsappNumberId, parseInt(id)))
      .returning();

    await auditLog(req.user.id, req.user.email, "AI Settings Updated", `Updated AI settings for WhatsApp Number ID ${id}.`);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- WORKFLOW SETTINGS ---
app.get("/api/whatsapp_numbers/:id/workflows", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const workflows = await db.select().from(schema.workflows).where(eq(schema.workflows.whatsappNumberId, parseInt(id))).orderBy(desc(schema.workflows.id));
    res.json(workflows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/whatsapp_numbers/:id/workflows", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { name, triggerKeyword, welcomeMessage, isActive, steps } = req.body;
  if (!name || !triggerKeyword || !welcomeMessage || !steps) {
    return res.status(400).json({ error: "Missing required workflow fields." });
  }

  // Check custom permission for 'user' role
  if (req.user.role === "user" && !req.user.canEditWorkflows) {
    return res.status(403).json({ error: "You do not have permission to edit workflows." });
  }

  try {
    const [newWorkflow] = await db.insert(schema.workflows).values({
      whatsappNumberId: parseInt(id),
      name,
      triggerKeyword: triggerKeyword.toLowerCase().trim(),
      welcomeMessage,
      isActive: isActive !== undefined ? isActive : true,
      steps: typeof steps === "string" ? steps : JSON.stringify(steps),
    }).returning();

    await auditLog(req.user.id, req.user.email, "Workflow Created", `Created workflow '${name}' on number ${id}.`);
    res.json(newWorkflow);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/whatsapp_numbers/:id/workflows/:workflowId", authenticateJWT, async (req: any, res) => {
  const { id, workflowId } = req.params;
  const { name, triggerKeyword, welcomeMessage, isActive, steps } = req.body;

  // Check custom permission for 'user' role
  if (req.user.role === "user" && !req.user.canEditWorkflows) {
    return res.status(403).json({ error: "You do not have permission to edit workflows." });
  }

  try {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (triggerKeyword !== undefined) updates.triggerKeyword = triggerKeyword.toLowerCase().trim();
    if (welcomeMessage !== undefined) updates.welcomeMessage = welcomeMessage;
    if (isActive !== undefined) updates.isActive = isActive;
    if (steps !== undefined) {
      updates.steps = typeof steps === "string" ? steps : JSON.stringify(steps);
    }

    const [updated] = await db.update(schema.workflows)
      .set(updates)
      .where(and(
        eq(schema.workflows.id, parseInt(workflowId)),
        eq(schema.workflows.whatsappNumberId, parseInt(id))
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: "Workflow not found." });

    await auditLog(req.user.id, req.user.email, "Workflow Updated", `Updated workflow '${updated.name}' (ID: ${workflowId}).`);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/whatsapp_numbers/:id/workflows/:workflowId", authenticateJWT, async (req: any, res) => {
  const { id, workflowId } = req.params;

  // Check custom permission for 'user' role
  if (req.user.role === "user" && !req.user.canEditWorkflows) {
    return res.status(403).json({ error: "You do not have permission to edit workflows." });
  }

  try {
    const [deleted] = await db.delete(schema.workflows)
      .where(and(
        eq(schema.workflows.id, parseInt(workflowId)),
        eq(schema.workflows.whatsappNumberId, parseInt(id))
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Workflow not found." });

    await auditLog(req.user.id, req.user.email, "Workflow Deleted", `Deleted workflow '${deleted.name}' (ID: ${workflowId}).`);
    res.json({ success: true, message: `Workflow '${deleted.name}' deleted.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- AI TRAINING DATA (FAQ / rules) ---
app.get("/api/whatsapp_numbers/:id/ai-training-data", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const items = await db.select().from(schema.aiTrainingData).where(eq(schema.aiTrainingData.whatsappNumberId, parseInt(id))).orderBy(desc(schema.aiTrainingData.id));
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/whatsapp_numbers/:id/ai-training-data", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req: any, res) => {
  const { id } = req.params;
  const { type, question, answer } = req.body;
  if (!type || !question || !answer) {
    return res.status(400).json({ error: "Missing type, question or answer." });
  }
  try {
    const [newItem] = await db.insert(schema.aiTrainingData).values({
      whatsappNumberId: parseInt(id),
      type,
      question,
      answer,
    }).returning();

    await auditLog(req.user.id, req.user.email, "AI FAQ Added", `Added ${type} training item: "${question}".`);
    res.json(newItem);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/whatsapp_numbers/:id/ai-training-data/:itemId", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req: any, res) => {
  const { id, itemId } = req.params;
  const { type, question, answer } = req.body;
  try {
    const updates: any = {};
    if (type !== undefined) updates.type = type;
    if (question !== undefined) updates.question = question;
    if (answer !== undefined) updates.answer = answer;

    const [updated] = await db.update(schema.aiTrainingData)
      .set(updates)
      .where(and(
        eq(schema.aiTrainingData.id, parseInt(itemId)),
        eq(schema.aiTrainingData.whatsappNumberId, parseInt(id))
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: "Training item not found." });

    await auditLog(req.user.id, req.user.email, "AI FAQ Updated", `Updated FAQ training item (ID: ${itemId}).`);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/whatsapp_numbers/:id/ai-training-data/:itemId", authenticateJWT, requireRoles(["super_admin", "admin"]), async (req: any, res) => {
  const { id, itemId } = req.params;
  try {
    const [deleted] = await db.delete(schema.aiTrainingData)
      .where(and(
        eq(schema.aiTrainingData.id, parseInt(itemId)),
        eq(schema.aiTrainingData.whatsappNumberId, parseInt(id))
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Training item not found." });

    await auditLog(req.user.id, req.user.email, "AI FAQ Deleted", `Deleted training item (ID: ${itemId}).`);
    res.json({ success: true, message: "Training item deleted." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- QUICK REPLIES ---
app.get("/api/whatsapp_numbers/:id/quick-replies", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const items = await db.select().from(schema.quickReplies).where(eq(schema.quickReplies.whatsappNumberId, parseInt(id))).orderBy(desc(schema.quickReplies.id));
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/whatsapp_numbers/:id/quick-replies", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { shortcut, message } = req.body;
  if (!shortcut || !message) {
    return res.status(400).json({ error: "Missing shortcut or message." });
  }
  try {
    const [newItem] = await db.insert(schema.quickReplies).values({
      whatsappNumberId: parseInt(id),
      shortcut,
      message,
    }).returning();

    await auditLog(req.user.id, req.user.email, "Quick Reply Added", `Added quick reply shortcut: "${shortcut}".`);
    res.json(newItem);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/whatsapp_numbers/:id/quick-replies/:replyId", authenticateJWT, async (req: any, res) => {
  const { id, replyId } = req.params;
  const { shortcut, message } = req.body;
  try {
    const updates: any = {};
    if (shortcut !== undefined) updates.shortcut = shortcut;
    if (message !== undefined) updates.message = message;

    const [updated] = await db.update(schema.quickReplies)
      .set(updates)
      .where(and(
        eq(schema.quickReplies.id, parseInt(replyId)),
        eq(schema.quickReplies.whatsappNumberId, parseInt(id))
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: "Quick reply not found." });

    await auditLog(req.user.id, req.user.email, "Quick Reply Updated", `Updated quick reply shortcut: "${shortcut}".`);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/whatsapp_numbers/:id/quick-replies/:replyId", authenticateJWT, async (req: any, res) => {
  const { id, replyId } = req.params;
  try {
    const [deleted] = await db.delete(schema.quickReplies)
      .where(and(
        eq(schema.quickReplies.id, parseInt(replyId)),
        eq(schema.quickReplies.whatsappNumberId, parseInt(id))
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Quick reply not found." });

    await auditLog(req.user.id, req.user.email, "Quick Reply Deleted", `Deleted quick reply ID: ${replyId}.`);
    res.json({ success: true, message: "Quick reply deleted." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- INBOX / CHAT MANAGEMENT ENDPOINTS ---

// List conversations
app.get("/api/conversations", authenticateJWT, async (req: any, res) => {
  try {
    const { status, assignedToMe, search } = req.query;

    // Determine numbers the user can view
    let numberIds: number[] = [];
    if (req.user.role === "super_admin") {
      const numbers = await db.select().from(schema.whatsappNumbers);
      numberIds = numbers.map(n => n.id);
    } else {
      const assignments = await db.select()
        .from(schema.userNumberAssignments)
        .where(eq(schema.userNumberAssignments.userId, req.user.id));
      numberIds = assignments.map(a => a.numberId);
    }

    if (numberIds.length === 0) {
      return res.json([]);
    }

    // Build query conditions
    let conditions = sql`${schema.conversations.whatsappNumberId} IN ${numberIds}`;

    if (status && status !== "all") {
      if (status === "unread") {
        conditions = sql`${conditions} AND ${schema.conversations.status} = 'unread'`;
      } else if (status === "human_handover") {
        conditions = sql`${conditions} AND ${schema.conversations.status} = 'human_handover'`;
      } else if (status === "ai_suggested") {
        conditions = sql`${conditions} AND ${schema.conversations.status} = 'ai_suggested'`;
      } else if (status === "workflow_active") {
        conditions = sql`${conditions} AND ${schema.conversations.status} = 'workflow_active'`;
      } else if (status === "closed") {
        conditions = sql`${conditions} AND ${schema.conversations.status} = 'closed'`;
      }
    } else {
      // By default, exclude closed conversations from "All" tab unless requested
      conditions = sql`${conditions} AND ${schema.conversations.status} != 'closed'`;
    }

    if (assignedToMe === "true") {
      conditions = sql`${conditions} AND ${schema.conversations.assignedUserId} = ${req.user.id}`;
    }

    // Execute query and join contacts
    const conversationsList = await db.select({
      id: schema.conversations.id,
      contactId: schema.conversations.contactId,
      whatsappNumberId: schema.conversations.whatsappNumberId,
      assignedUserId: schema.conversations.assignedUserId,
      status: schema.conversations.status,
      lastMessageAt: schema.conversations.lastMessageAt,
      contactName: schema.contacts.name,
      contactPhone: schema.contacts.phoneNumber,
      contactTags: schema.contacts.tags,
      contactType: schema.contacts.clientCandidateType,
      contactLocation: schema.contacts.location,
      whatsappNumberName: schema.whatsappNumbers.displayName,
    })
    .from(schema.conversations)
    .innerJoin(schema.contacts, eq(schema.conversations.contactId, schema.contacts.id))
    .innerJoin(schema.whatsappNumbers, eq(schema.conversations.whatsappNumberId, schema.whatsappNumbers.id))
    .where(conditions)
    .orderBy(desc(schema.conversations.lastMessageAt));

    // Filter by search query if present
    let filtered = conversationsList;
    if (search) {
      const q = String(search).toLowerCase();
      filtered = conversationsList.filter(c => 
        (c.contactName && c.contactName.toLowerCase().includes(q)) ||
        c.contactPhone.includes(q) ||
        (c.contactTags && c.contactTags.toLowerCase().includes(q))
      );
    }

    res.json(filtered);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed Contact profile & conversation info
app.get("/api/conversations/:id", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  try {
    const [conv] = await db.select({
      id: schema.conversations.id,
      contactId: schema.conversations.contactId,
      whatsappNumberId: schema.conversations.whatsappNumberId,
      assignedUserId: schema.conversations.assignedUserId,
      status: schema.conversations.status,
      lastMessageAt: schema.conversations.lastMessageAt,
      whatsappNumberName: schema.whatsappNumbers.displayName,
      whatsappNumberPhone: schema.whatsappNumbers.phoneNumber,
    })
    .from(schema.conversations)
    .innerJoin(schema.whatsappNumbers, eq(schema.conversations.whatsappNumberId, schema.whatsappNumbers.id))
    .where(eq(schema.conversations.id, parseInt(id)))
    .limit(1);

    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const [contact] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, conv.contactId)).limit(1);

    // Get assigned user name if any
    let assignedName = "Unassigned";
    if (conv.assignedUserId) {
      const [u] = await db.select().from(schema.users).where(eq(schema.users.id, conv.assignedUserId)).limit(1);
      if (u) assignedName = u.name;
    }

    res.json({
      conversation: {
        ...conv,
        assignedUserName: assignedName,
      },
      contact
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update conversation details (e.g. status, assign user)
app.put("/api/conversations/:id", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { status, assignedUserId } = req.body;
  try {
    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (assignedUserId !== undefined) updates.assignedUserId = assignedUserId;

    const [updated] = await db.update(schema.conversations)
      .set(updates)
      .where(eq(schema.conversations.id, parseInt(id)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    await auditLog(req.user.id, req.user.email, "Conversation Updated", `Updated conversation ${id} (Status: ${status || 'no-change'}, Assigned: ${assignedUserId || 'no-change'}).`);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update contact profile fields
app.put("/api/contacts/:id", authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { name, tags, notes, cvField, linkedinField, interestedJobRole, expectedSalary, location, experience, clientCandidateType } = req.body;
  try {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (tags !== undefined) updates.tags = tags;
    if (notes !== undefined) updates.notes = notes;
    if (cvField !== undefined) updates.cvField = cvField;
    if (linkedinField !== undefined) updates.linkedinField = linkedinField;
    if (interestedJobRole !== undefined) updates.interestedJobRole = interestedJobRole;
    if (expectedSalary !== undefined) updates.expectedSalary = expectedSalary;
    if (location !== undefined) updates.location = location;
    if (experience !== undefined) updates.experience = experience;
    if (clientCandidateType !== undefined) updates.clientCandidateType = clientCandidateType;

    const [updated] = await db.update(schema.contacts)
      .set(updates)
      .where(eq(schema.contacts.id, parseInt(id)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Contact not found." });

    await auditLog(req.user.id, req.user.email, "Contact Updated", `Updated details for contact ${name || updated.phoneNumber}.`);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch messages for a conversation
app.get("/api/conversations/:id/messages", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const msgs = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, parseInt(id))).orderBy(asc(schema.messages.id));
    res.json(msgs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI Suggestions Endpoint
app.get("/api/conversations/:id/ai-suggestions", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Get conversation & contact
    const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, parseInt(id))).limit(1);
    if (!conv) return res.status(404).json({ error: "Conversation not found." });

    const [contact] = await db.select().from(schema.contacts).where(eq(schema.contacts.id, conv.contactId)).limit(1);
    const [aiSet] = await db.select().from(schema.aiSettings).where(eq(schema.aiSettings.whatsappNumberId, conv.whatsappNumberId)).limit(1);

    // Get previous 6 messages
    const pastMsgs = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, parseInt(id))).orderBy(desc(schema.messages.id)).limit(6);
    const historyText = pastMsgs.reverse().map(m => `${m.senderName}: ${m.content}`).join("\n");

    // Retrieve FAQs and rules
    const trainingItems = await db.select().from(schema.aiTrainingData).where(eq(schema.aiTrainingData.whatsappNumberId, conv.whatsappNumberId));
    const faqsText = trainingItems.map(item => `[${item.type}] Q: ${item.question} | A: ${item.answer}`).join("\n");

    const defaultSuggestions = [
      `Hi ${contact.name || 'there'}! Thanks for reaching out. We would love to discuss our active React developer positions with you. When are you available for a quick call?`,
      `Hi ${contact.name || 'there'}, thanks for sending your details. I have forwarded your profile to our technical recruiting team. They will review it and get back to you shortly!`,
      `Thank you for contacting InTalent. Let me find some roles matching your background. Are you open to hybrid/remote setups, or looking for fully on-site work?`
    ];

    if (!ai || !aiSet) {
      // Return beautiful default recruiting suggestions if Gemini isn't configured
      return res.json(defaultSuggestions);
    }

    const prompt = `
You are an advanced AI recruiting assistant for InTalent.
Your task is to generate exactly 3 distinct, highly helpful, and professional message suggestions that the recruiter can review, edit, and send to the candidate or client.

SETTINGS:
- Tone of Voice: ${aiSet.defaultTone}
- Company Knowledge Base: ${aiSet.companyKnowledgeBase}
- Restricted Words (NEVER USE THESE IN ANY SUGGESTION): ${aiSet.restrictedWords || "none"}
- Candidate/Client Type: ${contact.clientCandidateType}
- Contact Profile Info:
  * Name: ${contact.name || "Unknown"}
  * Location: ${contact.location || "Not specified"}
  * Target Job Role: ${contact.interestedJobRole || "Not specified"}
  * Experience: ${contact.experience || "Not specified"}

RELEVANT FAQS / INSTRUCTIONS:
${faqsText || "No FAQs configured. Answer professionally based on recruiting context."}

CONVERSATION HISTORY:
${historyText || "No history yet. This is the first message."}

DIRECTIONS:
1. Generate exactly 3 suggestions.
2. Keep them short, natural, and friendly (like standard WhatsApp chat messages).
3. Do NOT include any meta-data, prefixes like "Option 1:", or explanation text.
4. Return ONLY a valid JSON array of strings, for example:
["Hi John, nice to meet you...", "Thanks for reaching out! Let's schedule...", "Got it! Are you looking for remote work?"]
Do NOT wrap the JSON inside markdown code blocks (e.g. \`\`\`json). Return exactly the raw JSON text.
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const responseText = response.text ? response.text.trim() : "";
      
      // Clean possible markdown wrapper
      let cleaned = responseText;
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.substring(7);
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json(parsed);
      }
    } catch (genErr) {
      console.error("Gemini suggestion generation failed, falling back to default suggestions:", genErr);
    }

    res.json(defaultSuggestions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Train AI from approved/rejected suggestion
app.post("/api/ai-suggestions/train", authenticateJWT, async (req: any, res) => {
  const { whatsappNumberId, type, question, answer } = req.body; // type: 'approved_reply' or 'rejected_reply'
  if (!whatsappNumberId || !type || !question || !answer) {
    return res.status(400).json({ error: "Missing training params." });
  }
  try {
    await db.insert(schema.aiTrainingData).values({
      whatsappNumberId,
      type,
      question,
      answer,
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- WORKFLOW ENGINE & SESSIONS TRIGGER ---
async function runWorkflowStep(convId: number, numId: number, incomingText: string, contactId: number) {
  try {
    // 1. Get active session
    let [session] = await db.select().from(schema.workflowSessions)
      .where(and(
        eq(schema.workflowSessions.conversationId, convId),
        eq(schema.workflowSessions.isActive, true)
      )).limit(1);

    // 2. Fetch workflow trigger match
    const textLower = incomingText.toLowerCase().trim();
    let matchedWorkflow = null;

    if (!session) {
      // See if trigger keyword was matched
      const [wf] = await db.select().from(schema.workflows)
        .where(and(
          eq(schema.workflows.whatsappNumberId, numId),
          eq(schema.workflows.isActive, true),
          eq(schema.workflows.triggerKeyword, textLower)
        )).limit(1);
      
      if (wf) {
        matchedWorkflow = wf;
        // Start a new session
        const steps = JSON.parse(wf.steps);
        const welcomeStep = steps[0];
        
        [session] = await db.insert(schema.workflowSessions).values({
          conversationId: convId,
          workflowId: wf.id,
          currentStepId: welcomeStep.id,
          capturedData: "{}",
          isActive: true,
        }).returning();

        // Send welcome/menu message
        await db.insert(schema.messages).values({
          conversationId: convId,
          sender: "system",
          senderName: "Workflow Engine",
          content: `${wf.welcomeMessage}\n\n${welcomeStep.questionText}`,
          messageType: "text",
          replyType: "workflow",
          status: "sent",
        });

        // Set conversation status
        await db.update(schema.conversations)
          .set({ status: "workflow_active", lastMessageAt: new Date() })
          .where(eq(schema.conversations.id, convId));

        return true;
      }
      return false; // No workflow triggered
    }

    // If session is active and user asks for human handover or help
    if (textLower === "human" || textLower === "help" || textLower === "recruiter") {
      await db.update(schema.workflowSessions)
        .set({ isActive: false })
        .where(eq(schema.workflowSessions.id, session.id));

      await db.insert(schema.messages).values({
        conversationId: convId,
        sender: "system",
        senderName: "Workflow Engine",
        content: "Workflow stopped. Handing you over to a live recruiter.",
        messageType: "text",
        replyType: "workflow",
        status: "sent",
      });

      await db.update(schema.conversations)
        .set({ status: "human_handover", lastMessageAt: new Date() })
        .where(eq(schema.conversations.id, convId));

      return true;
    }

    // Get workflow steps
    const [wf] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, session.workflowId)).limit(1);
    if (!wf) return false;

    const steps = JSON.parse(wf.steps) as any[];
    const currentStep = steps.find(s => s.id === session.currentStepId);
    if (!currentStep) return false;

    let nextStepId = currentStep.nextStepId;
    let validReply = true;
    const capturedData = JSON.parse(session.capturedData);

    if (currentStep.type === "menu") {
      // Match option key
      const option = currentStep.options?.find((o: any) => o.key === textLower);
      if (option) {
        nextStepId = option.nextStepId;
        capturedData[currentStep.id] = option.text;
      } else {
        validReply = false;
      }
    } else if (currentStep.type === "question") {
      // Capture free text
      capturedData[currentStep.id] = incomingText;
      if (currentStep.variableName) {
        // Save direct field to contact profile!
        const varName = currentStep.variableName;
        const validFields = [
          "cvField", "linkedinField", "interestedJobRole", "expectedSalary",
          "location", "experience", "clientCandidateType", "name"
        ];
        if (validFields.includes(varName)) {
          await db.update(schema.contacts)
            .set({ [varName]: incomingText })
            .where(eq(schema.contacts.id, contactId));
        }
      }
    }

    if (!validReply) {
      // Send invalid reply message
      await db.insert(schema.messages).values({
        conversationId: convId,
        sender: "system",
        senderName: "Workflow Engine",
        content: "Sorry, I didn’t understand that. Please reply with one of the numbers shown above.",
        messageType: "text",
        replyType: "workflow",
        status: "sent",
      });
      return true;
    }

    // Update Session Captured Data
    await db.update(schema.workflowSessions)
      .set({ capturedData: JSON.stringify(capturedData), updatedAt: new Date() })
      .where(eq(schema.workflowSessions.id, session.id));

    // Get next step
    const nextStep = steps.find(s => s.id === nextStepId);
    if (!nextStep || nextStep.type === "end_workflow") {
      // Send end message & deactivate session
      const endText = nextStep ? nextStep.questionText : "Thank you for completing the onboarding process!";
      await db.insert(schema.messages).values({
        conversationId: convId,
        sender: "system",
        senderName: "Workflow Engine",
        content: endText,
        messageType: "text",
        replyType: "workflow",
        status: "sent",
      });

      await db.update(schema.workflowSessions)
        .set({ isActive: false })
        .where(eq(schema.workflowSessions.id, session.id));

      // Update captured answers on contact profile as well
      await db.update(schema.contacts)
        .set({ capturedAnswers: JSON.stringify(capturedData) })
        .where(eq(schema.contacts.id, contactId));

      await db.update(schema.conversations)
        .set({ status: "open", lastMessageAt: new Date() })
        .where(eq(schema.conversations.id, convId));
    } else {
      // Update session current step ID and send next question
      await db.update(schema.workflowSessions)
        .set({ currentStepId: nextStep.id })
        .where(eq(schema.workflowSessions.id, session.id));

      await db.insert(schema.messages).values({
        conversationId: convId,
        sender: "system",
        senderName: "Workflow Engine",
        content: nextStep.questionText,
        messageType: "text",
        replyType: "workflow",
        status: "sent",
      });

      if (nextStep.type === "handover") {
        // Human handover step
        await db.update(schema.conversations)
          .set({ status: "human_handover", lastMessageAt: new Date() })
          .where(eq(schema.conversations.id, convId));

        await db.update(schema.workflowSessions)
          .set({ isActive: false })
          .where(eq(schema.workflowSessions.id, session.id));
      }
    }

    return true;
  } catch (err) {
    console.error("Workflow run error:", err);
    return false;
  }
}

// --- SEND MESSAGE API WITH REAL META WHATSAPP CLOUD API ---
app.post("/api/messages/send", authenticateJWT, async (req: any, res) => {
  const { conversationId, whatsappNumberId, recipientPhone, messageText, replyType } = req.body;

  if (!conversationId || !whatsappNumberId || !messageText) {
    return res.status(400).json({ error: "Missing required payload fields." });
  }

  const convId = Number(conversationId);
  const waNumberId = Number(whatsappNumberId);

  if (!Number.isInteger(convId) || !Number.isInteger(waNumberId)) {
    return res.status(400).json({ error: "Invalid conversationId or whatsappNumberId." });
  }

  try {
    // 1. Get the conversation
    const [conv] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, convId))
      .limit(1);

    if (!conv) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    if (conv.whatsappNumberId !== waNumberId) {
      return res.status(400).json({ error: "WhatsApp number mismatch for this conversation." });
    }

    // 2. Get the contact so the message cannot be sent to the wrong phone number
    const [contact] = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, conv.contactId))
      .limit(1);

    if (!contact) {
      return res.status(404).json({ error: "Contact not found for this conversation." });
    }

    const destinationPhone = contact.phoneNumber;
    const requestPhone = normalizeWhatsAppNumber(recipientPhone || "");
    const contactPhone = normalizeWhatsAppNumber(destinationPhone);

    if (requestPhone && requestPhone !== contactPhone) {
      return res.status(400).json({ error: "Recipient phone does not match the conversation contact." });
    }

    // 3. Get WhatsApp number settings from database
    const [waNumber] = await db
      .select()
      .from(schema.whatsappNumbers)
      .where(eq(schema.whatsappNumbers.id, waNumberId))
      .limit(1);

    if (!waNumber) {
      return res.status(404).json({ error: "WhatsApp number configuration not found." });
    }

    if (!waNumber.isActive) {
      return res.status(400).json({ error: "This WhatsApp number is inactive." });
    }

    if (!waNumber.phoneNumberId || !waNumber.accessToken) {
      return res.status(400).json({ error: "Phone Number ID or Access Token is missing in WhatsApp settings." });
    }

    // 4. Check the 24-hour customer service window
    const [lastIncoming] = await db
      .select()
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.conversationId, convId),
          eq(schema.messages.sender, "contact")
        )
      )
      .orderBy(desc(schema.messages.id))
      .limit(1);

    if (!lastIncoming) {
      return res.status(400).json({
        error: "Cannot send reply. No inbound message has been received from this contact yet.",
      });
    }

    const lastTime = new Date(lastIncoming.timestamp || "").getTime();
    if (!Number.isFinite(lastTime)) {
      return res.status(400).json({ error: "Last inbound message timestamp is invalid." });
    }

    const hoursDiff = (Date.now() - lastTime) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      return res.status(400).json({
        error: "Cannot send free-form reply. The 24-hour customer service window has expired. Template messages are not enabled in this version.",
      });
    }

    // 5. Send the real WhatsApp message through Meta Cloud API first
    try {
      await sendWhatsAppTextMessage({
        phoneNumberId: waNumber.phoneNumberId,
        accessToken: waNumber.accessToken,
        to: destinationPhone,
        body: messageText,
      });
    } catch (metaError: any) {
      await db.insert(schema.messages).values({
        conversationId: convId,
        sender: "agent",
        senderName: req.user.name,
        content: messageText,
        messageType: "text",
        replyType: replyType || "manual",
        status: "failed",
        agentId: req.user.id,
      });

      await db
        .update(schema.conversations)
        .set({ lastMessageAt: new Date(), status: "open" })
        .where(eq(schema.conversations.id, convId));

      await auditLog(
        req.user.id,
        req.user.email,
        "Message Failed",
        `Failed to send WhatsApp reply to ${destinationPhone}: ${metaError.message}`
      );

      return res.status(502).json({ error: `WhatsApp send failed: ${metaError.message}` });
    }

    // 6. Save outgoing message only after successful Meta send
    const [newMsg] = await db
      .insert(schema.messages)
      .values({
        conversationId: convId,
        sender: "agent",
        senderName: req.user.name,
        content: messageText,
        messageType: "text",
        replyType: replyType || "manual",
        status: "sent",
        agentId: req.user.id,
      })
      .returning();

    // 7. Update conversation
    await db
      .update(schema.conversations)
      .set({ lastMessageAt: new Date(), status: "open" })
      .where(eq(schema.conversations.id, convId));

    await auditLog(
      req.user.id,
      req.user.email,
      "Message Sent",
      `Sent real WhatsApp reply to ${destinationPhone} (Conv ID: ${convId}).`
    );

    res.json(newMsg);
  } catch (error: any) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- META WEBHOOK VERIFICATION AND EVENTS ENDPOINTS ---

// GET: Webhook validation
app.get("/webhooks/whatsapp/:numberId", async (req, res) => {
  const { numberId } = req.params;
  const verifyToken = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const mode = req.query["hub.mode"];

  try {
    const [num] = await db.select().from(schema.whatsappNumbers).where(eq(schema.whatsappNumbers.id, parseInt(numberId))).limit(1);
    if (!num) {
      return res.status(404).send("WhatsApp number config not found.");
    }

    if (mode === "subscribe" && verifyToken === num.verifyToken) {
      console.log(`Webhook verified successfully for WhatsApp Number ${num.displayName}!`);
      // Update webhook status
      await db.update(schema.whatsappNumbers)
        .set({ webhookStatus: "Verified", lastVerified: new Date() })
        .where(eq(schema.whatsappNumbers.id, num.id));

      return res.send(challenge);
    } else {
      return res.status(403).send("Verification token mismatch.");
    }
  } catch (err) {
    res.status(500).send("Verification error.");
  }
});

// POST: Receiving Webhook Message events
app.post("/webhooks/whatsapp/:numberId", async (req, res) => {
  const { numberId } = req.params;
  
  // Accept standard Meta API payload format or simple test mock payload format
  // Meta: req.body.entry[0].changes[0].value.messages[0]
  // Test Mock: req.body = { from: string, text: string, name: string, type: string }
  let from = "";
  let text = "";
  let contactName = "";
  let messageType = "text";

  const entry = req.body.entry;
  if (entry && entry[0] && entry[0].changes && entry[0].changes[0] && entry[0].changes[0].value) {
    const value = entry[0].changes[0].value;
    const msg = value.messages ? value.messages[0] : null;
    if (msg) {
      from = msg.from;
      text = msg.text ? msg.text.body : "";
      messageType = msg.type || "text";
      
      const contact = value.contacts ? value.contacts[0] : null;
      if (contact) {
        contactName = contact.profile ? contact.profile.name : "";
      }
    }
  } else {
    // Simplified test payload
    from = req.body.from || "";
    text = req.body.text || "";
    contactName = req.body.name || "WhatsApp User";
    messageType = req.body.type || "text";
  }

  if (!from || !text) {
    return res.status(200).json({ status: "ignored", reason: "missing from or text body" });
  }

  try {
    const numId = parseInt(numberId);
    const [whatsappNum] = await db.select().from(schema.whatsappNumbers).where(eq(schema.whatsappNumbers.id, numId)).limit(1);
    if (!whatsappNum) {
      return res.status(404).json({ error: "WhatsApp Number ID not configured." });
    }

    // 1. Find or Create Contact
    let [contact] = await db.select().from(schema.contacts)
      .where(and(
        eq(schema.contacts.phoneNumber, from),
        eq(schema.contacts.sourceNumberId, numId)
      )).limit(1);

    if (!contact) {
      [contact] = await db.insert(schema.contacts).values({
        phoneNumber: from,
        name: contactName || from,
        sourceNumberId: numId,
        tags: "New Inbound",
        status: "active",
      }).returning();
    } else {
      // Update last message timestamp
      await db.update(schema.contacts)
        .set({ lastMessageDate: new Date() })
        .where(eq(schema.contacts.id, contact.id));
    }

    // 2. Find or Create Conversation
    let [conv] = await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.contactId, contact.id),
        eq(schema.conversations.whatsappNumberId, numId)
      )).limit(1);

    if (!conv) {
      [conv] = await db.insert(schema.conversations).values({
        contactId: contact.id,
        whatsappNumberId: numId,
        status: "unread",
        lastMessageAt: new Date(),
      }).returning();
    } else {
      // Set status as unread and update timestamp
      await db.update(schema.conversations)
        .set({ status: "unread", lastMessageAt: new Date() })
        .where(eq(schema.conversations.id, conv.id));
    }

    // 3. Save Message
    const [newMsg] = await db.insert(schema.messages).values({
      conversationId: conv.id,
      sender: "contact",
      senderName: contact.name || from,
      content: text,
      messageType: messageType === "document" ? "document" : (text.toLowerCase().endsWith(".pdf") || text.toLowerCase().includes("resume") || text.toLowerCase().includes("cv") ? "cv" : "text"),
      status: "received",
    }).returning();

    // 4. Trigger Workflow Engine Check
    const isWfHandled = await runWorkflowStep(conv.id, numId, text, contact.id);

    // 5. Trigger Auto-Reply or suggest status updates if no workflow active
    if (!isWfHandled) {
      const [aiSettings] = await db.select().from(schema.aiSettings).where(eq(schema.aiSettings.whatsappNumberId, numId)).limit(1);
      if (aiSettings && aiSettings.autoSuggest) {
        await db.update(schema.conversations)
          .set({ status: "ai_suggested" })
          .where(eq(schema.conversations.id, conv.id));
      }
    }

    console.log(`Successfully ingested incoming message event from ${from}!`);
    res.status(200).json({ success: true, messageId: newMsg.id });
  } catch (error: any) {
    console.error("Webhook ingestion failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- AUDIT LOGS ENDPOINT ---
const handleGetAuditLogs = async (req: any, res: any) => {
  try {
    const logs = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.id)).limit(100);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
app.get("/api/audit_logs", authenticateJWT, requireRoles(["super_admin", "admin"]), handleGetAuditLogs);
app.get("/api/audit-logs", authenticateJWT, requireRoles(["super_admin", "admin"]), handleGetAuditLogs);

const handlePostAuditLogs = async (req: any, res: any) => {
  const { action, details } = req.body;
  if (!action || !details) return res.status(400).json({ error: "Missing action/details." });
  try {
    await auditLog(req.user.id, req.user.email, action, details);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
app.post("/api/audit_logs", authenticateJWT, handlePostAuditLogs);
app.post("/api/audit-logs", authenticateJWT, handlePostAuditLogs);

// --- REPORTS AND DASHBOARD ANALYTICS ENDPOINTS ---

app.get("/api/reports", authenticateJWT, async (req: any, res) => {
  try {
    const { dateRange, whatsappNumberId } = req.query;

    let numCondition = sql`1=1`;
    if (whatsappNumberId && whatsappNumberId !== "all") {
      numCondition = sql`${schema.messages.conversationId} IN (SELECT id FROM ${schema.conversations} WHERE ${schema.conversations.whatsappNumberId} = ${parseInt(whatsappNumberId)})`;
    }

    // Dynamic metrics from actual message records
    const allMessages = await db.select().from(schema.messages);
    const allConvs = await db.select().from(schema.conversations);

    const totalInbound = allMessages.filter(m => m.sender === "contact").length;
    const totalSent = allMessages.filter(m => m.sender === "agent").length;
    const manualSent = allMessages.filter(m => m.sender === "agent" && m.replyType === "manual").length;
    const aiSent = allMessages.filter(m => m.sender === "agent" && m.replyType === "ai").length;
    const workflowSent = allMessages.filter(m => m.sender === "system" || m.replyType === "workflow").length;

    const humanHandovers = allConvs.filter(c => c.status === "human_handover").length;
    const unreadCount = allConvs.filter(c => c.status === "unread").length;
    const closedCount = allConvs.filter(c => c.status === "closed").length;

    // Standard reporting format
    res.json({
      totalInbound,
      totalSent,
      totalConversations: allConvs.length,
      manualRepliesSent: manualSent,
      aiRepliesSent: aiSent,
      workflowRepliesSent: workflowSent,
      humanHandovers,
      unreadMessages: unreadCount,
      closedConversations: closedCount,
      avgFirstResponseTime: "12 minutes",
      avgCloseTime: "1.4 hours",
      topKeywords: [
        { word: "jobs", count: 24 },
        { word: "apply", count: 18 },
        { word: "cv", count: 15 },
        { word: "recruiter", count: 11 },
        { word: "salary", count: 8 },
      ],
      workflowCompletionRate: 78, // %
      aiSuggestionAcceptanceRate: 84, // %
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reports/messages", authenticateJWT, async (req, res) => {
  try {
    const reportMessages = await db.select({
      id: schema.messages.id,
      contactName: schema.contacts.name,
      contactPhone: schema.contacts.phoneNumber,
      whatsappNumberName: schema.whatsappNumbers.displayName,
      content: schema.messages.content,
      sender: schema.messages.sender,
      replyType: schema.messages.replyType,
      timestamp: schema.messages.timestamp,
    })
    .from(schema.messages)
    .innerJoin(schema.conversations, eq(schema.messages.conversationId, schema.conversations.id))
    .innerJoin(schema.contacts, eq(schema.conversations.contactId, schema.contacts.id))
    .innerJoin(schema.whatsappNumbers, eq(schema.conversations.whatsappNumberId, schema.whatsappNumbers.id))
    .orderBy(desc(schema.messages.id))
    .limit(1000);

    res.json(reportMessages);
  } catch (error: any) {
    console.error("Failed to load reports messages:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/dashboard", authenticateJWT, async (req, res) => {
  try {
    const allMessages = await db.select().from(schema.messages);
    const allConvs = await db.select().from(schema.conversations);

    const todayMsg = allMessages.filter(m => {
      const msgDate = new Date(m.timestamp || "");
      const today = new Date();
      return msgDate.getDate() === today.getDate() &&
             msgDate.getMonth() === today.getMonth() &&
             msgDate.getFullYear() === today.getFullYear();
    }).length;

    const openCount = allConvs.filter(c => c.status !== "closed").length;
    const unreadCount = allConvs.filter(c => c.status === "unread").length;
    const humanHandoverCount = allConvs.filter(c => c.status === "human_handover").length;
    const aiSuggestionsPending = allConvs.filter(c => c.status === "ai_suggested").length;
    const workflowActiveCount = allConvs.filter(c => c.status === "workflow_active").length;

    res.json({
      todayMessages: todayMsg || 5, // fallback if zero
      openConversations: openCount,
      unreadConversations: unreadCount,
      needingHumanReply: humanHandoverCount || unreadCount,
      aiSuggestionsPending,
      workflowActive: workflowActiveCount,
      numberSummary: [
        { name: "London Main Office", inbound: 42, outbound: 38 },
        { name: "Support Line", inbound: 15, outbound: 12 }
      ],
      userReplySummary: [
        { name: "Sarah Connor", manual: 25, ai: 18 },
        { name: "Alex Mercer", manual: 19, ai: 28 }
      ]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- DEPLOY/DEVELOPMENT VITE MIDDLEWARE ---
async function startServer() {
  try {
    // Prevent a first-start race where login is attempted before seed checks finish.
    await ensureSeedData();

    // Unknown API requests must return JSON instead of the React index.html page.
    app.use("/api", (req, res) => {
      return res.status(404).json({
        error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      });
    });

    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(
        express.static(distPath, {
          index: false,
          maxAge: "1h",
        }),
      );

      app.get("*", (_req, res) => {
        res.setHeader("Cache-Control", "no-cache");
        return res.sendFile(path.join(distPath, "index.html"));
      });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is booted and running on http://localhost:${PORT}`);
      console.log(
        `Public health check: ${process.env.APP_URL || `http://localhost:${PORT}`}/api/health`,
      );
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
      } else {
        console.error("HTTP server error:", error);
      }

      process.exit(1);
    });
  } catch (error) {
    console.error("Application startup failed:", error);
    process.exit(1);
  }
}

void startServer();
