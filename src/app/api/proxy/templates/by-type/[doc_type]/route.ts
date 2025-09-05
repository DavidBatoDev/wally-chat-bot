import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { doc_type: string } }
) {
  console.log("=== TEMPLATES BY TYPE PROXY ROUTE DEBUG ===");
  console.log("Request method:", request.method);
  console.log("Request URL:", request.url);
  console.log("Document type:", params.doc_type);

  try {
    // Forward the request to the backend
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://wally-backend-523614903618.us-central1.run.app";
    const backendEndpoint = `${backendUrl}/templates/by-type/${params.doc_type}`;

    console.log("Backend URL:", backendEndpoint);
    console.log("Sending request to backend...");

    const response = await fetch(backendEndpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Forward any auth headers if needed
        ...(request.headers.get("Authorization")
          ? {
              Authorization: request.headers.get("Authorization")!,
            }
          : {}),
      },
    });

    console.log("Backend response status:", response.status);

    if (!response.ok) {
      console.error("Backend returned error status:", response.status);
      let errorText = "";
      try {
        errorText = await response.text();
        console.error("Backend error response:", errorText);
      } catch (textError) {
        console.error("Could not read error response as text:", textError);
        errorText = "Failed to read error response";
      }

      return NextResponse.json(
        {
          error: errorText || "Failed to fetch templates by type",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      );
    }

    console.log("Parsing successful response...");
    const data = await response.json();
    console.log(
      "Response data length:",
      Array.isArray(data) ? data.length : "Not an array"
    );
    console.log("=== TEMPLATES BY TYPE PROXY ROUTE SUCCESS ===");

    return NextResponse.json(data);
  } catch (error) {
    console.error("=== TEMPLATES BY TYPE PROXY ROUTE ERROR ===");
    console.error("Error proxying templates by type request:", error);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : "Unknown error"
    );
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
