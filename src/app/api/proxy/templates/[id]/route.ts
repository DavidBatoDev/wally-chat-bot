import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log("=== TEMPLATE BY ID PROXY ROUTE DEBUG ===");
  console.log("Request method:", request.method);
  console.log("Request URL:", request.url);
  console.log("Template ID:", params.id);

  try {
    // Forward the request to the backend
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://wally-backend-523614903618.us-central1.run.app";
    const backendEndpoint = `${backendUrl}/templates/${params.id}`;

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
          error: errorText || "Failed to fetch template",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      );
    }

    console.log("Parsing successful response...");
    const data = await response.json();
    console.log("Response data keys:", Object.keys(data));
    console.log("=== TEMPLATE BY ID PROXY ROUTE SUCCESS ===");

    return NextResponse.json(data);
  } catch (error) {
    console.error("=== TEMPLATE BY ID PROXY ROUTE ERROR ===");
    console.error("Error proxying template by ID request:", error);
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
