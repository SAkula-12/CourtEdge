import { NextResponse } from "next/server";
import crypto from "crypto";

// Mock Database map for the limit enforcement
// In a real app, this would be a Firestore collection or Supabase table `guest_email_logs`
const mockEmailLogDb = new Set<string>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, matchSummary } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required." },
        { status: 400 }
      );
    }

    // 1. Hash the email to maintain privacy in the logs while allowing deterministic lookups
    const normalizedEmail = email.toLowerCase().trim();
    const emailHash = crypto.createHash("sha256").update(normalizedEmail).digest("hex");

    // 2. Limit Enforcement (Exactly ONE time per email)
    if (mockEmailLogDb.has(emailHash)) {
      // Reject if already exists
      return NextResponse.json(
        { 
          error: "LIMIT_EXCEEDED",
          message: "This player has already received a complimentary summary. They must create a free CourtEdge account to claim this match." 
        },
        { status: 429 } // 429 Too Many Requests
      );
    }

    // 3. Mark the email as having received the teaser
    mockEmailLogDb.add(emailHash);
    
    // In production, save to DB:
    // await db.collection('guest_email_logs').doc(emailHash).set({
    //   id: emailHash,
    //   sentAt: new Date(),
    //   status: 'SENT'
    // });

    // 4. Send the Email (Mock)
    console.log(`[EMAIL DISPATCH] Sending teaser to ${normalizedEmail}...`);
    console.log(`[EMAIL CONTENT] Basic Stats: ${JSON.stringify(matchSummary)}`);
    console.log(`[EMAIL CTA] "Download CourtEdge and create a free account to unlock deep analytics and claim your full match data!"`);

    return NextResponse.json(
      { success: true, message: "Teaser email sent successfully." },
      { status: 200 }
    );

  } catch (error) {
    console.error("API Error in /share/teaser:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
