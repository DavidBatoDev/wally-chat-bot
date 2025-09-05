import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  console.log("=== PROXY ROUTE DEBUG ===");
  console.log("Request method:", request.method);
  console.log("Request URL:", request.url);
  console.log(
    "Request headers:",
    Object.fromEntries(request.headers.entries())
  );

  try {
    // Get the form data from the request
    console.log("Parsing form data...");
    const formData = await request.formData();

    console.log(
      "FormData entries:",
      Array.from(formData.entries()).map(([key, value]) => ({
        key,
        valueType: typeof value,
        valueSize: value instanceof Blob ? value.size : "N/A",
      }))
    );

    // Forward the request to the backend
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://wally-backend-523614903618.us-central1.run.app";
    const backendEndpoint = `${backendUrl}/projects/process-file`;

    console.log("Backend URL:", backendEndpoint);
    console.log("Sending request to backend...");

    const response = await fetch(backendEndpoint, {
      method: "POST",
      body: formData,
      // Forward any auth headers if needed
      headers: {
        ...(request.headers.get("Authorization")
          ? {
              Authorization: request.headers.get("Authorization")!,
            }
          : {}),
      },
    });

    console.log("Backend response status:", response.status);
    console.log(
      "Backend response headers:",
      Object.fromEntries(response.headers.entries())
    );

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
          error: errorText || "Failed to process file",
          status: response.status,
          statusText: response.statusText,
        },
        { status: response.status }
      );
    }

    console.log("Parsing successful response...");
    const data = await response.json();
    console.log("Response data keys:", Object.keys(data));
    console.log("=== PROXY ROUTE SUCCESS ===");

    return NextResponse.json(data);
  } catch (error) {
    console.error("=== PROXY ROUTE ERROR ===");
    console.error("Error proxying process-file request:", error);
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
