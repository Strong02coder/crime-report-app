import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { ReportStatus, ReportType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as ReportStatus | null;
    const type = searchParams.get("type") as ReportType | null;

    // Build the where clause based on filters
    const where = {
      ...(status && { status }), // Only include status if it's not null
      ...(type && { type }), // Only include type if it's not null
    };

    // Add timeout and retry logic
    const reports = await Promise.race([
      prisma.report.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          reportId: true,
          type: true,
          title: true,
          description: true,
          location: true,
          latitude: true,
          longitude: true,
          image: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        }, // Only select the fields we need
      }), // Fetch reports
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database timeout")), 15000)
      ), // Timeout after 15 seconds
    ]);

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error("Failed to fetch reports:", error);

    // More specific error messages
    if (error.code === "P1001") {
      return NextResponse.json(
        { error: "Cannot connect to database. Please try again later." },
        { status: 503 }
      ); // Service Unavailable
    } 

    if (error.code === "P2024") {
      return NextResponse.json(
        { error: "Database connection timeout. Please try again." },
        { status: 504 }
      ); // Gateway Timeout
    }

    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    ); // Internal Server Error
  } finally {
    // Optional: Disconnect for serverless environments
    if (process.env.VERCEL) {
      await prisma.$disconnect();
    }
  }
}
