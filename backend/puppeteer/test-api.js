#!/usr/bin/env node

/**
 * Test script for the Puppeteer page capture API
 * Run with: node test-api.js
 */

const axios = require("axios");

// Configuration
const API_BASE_URL = "https://wally-puppet-523614903618.us-central1.run.app";
const TEST_PROJECT_ID = "test-project-" + Date.now();
const TEST_CAPTURE_URL =
  "https://wally-frontend-523614903618.us-central1.run.app/capture-project/" +
  TEST_PROJECT_ID; // Replace with actual URL

async function testHealthCheck() {
  console.log("\n🏥 Testing health check...");

  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    console.log("✅ Health check passed:", response.data);
    return true;
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
    return false;
  }
}

async function testStatusCheck() {
  console.log("\n📊 Testing status check...");

  try {
    const response = await axios.get(`${API_BASE_URL}/status`);
    console.log(
      "✅ Status check passed:",
      JSON.stringify(response.data, null, 2)
    );
    return true;
  } catch (error) {
    console.error("❌ Status check failed:", error.message);
    return false;
  }
}

async function testDebugEndpoint() {
  console.log("\n🔍 Testing debug endpoint...");

  try {
    const response = await axios.get(`${API_BASE_URL}/debug`);
    console.log(
      "✅ Debug endpoint passed:",
      JSON.stringify(response.data, null, 2)
    );
    return true;
  } catch (error) {
    console.error("❌ Debug endpoint failed:", error.message);
    return false;
  }
}

async function testPageCapture() {
  console.log("\n📸 Testing page capture API...");

  try {
    // Test with a simple web page since we might not have a real project
    const testUrl = "https://example.com"; // Using example.com as a simple test

    const requestBody = {
      projectId: TEST_PROJECT_ID,
      captureUrl: testUrl,
      quality: 1.0,
      waitTime: 1000,
    };

    console.log("   Request body:", JSON.stringify(requestBody, null, 2));

    const response = await axios.post(
      `${API_BASE_URL}/capture-all-pages`,
      requestBody,
      {
        timeout: 60000, // 60 seconds timeout
      }
    );

    if (response.data.success) {
      console.log("✅ Page capture passed!");
      console.log(
        "   Summary:",
        JSON.stringify(response.data.data?.summary, null, 2)
      );

      // Log first few captures (without full image data)
      if (response.data.data?.captures) {
        console.log(
          `   Captured ${response.data.data.captures.length} page views:`
        );
        response.data.data.captures.slice(0, 3).forEach((capture, index) => {
          console.log(
            `     ${index + 1}. Page ${capture.pageNumber} - ${
              capture.viewType
            } ${capture.error ? "(ERROR: " + capture.error + ")" : "(OK)"}`
          );
        });

        if (response.data.data.captures.length > 3) {
          console.log(
            `     ... and ${response.data.data.captures.length - 3} more`
          );
        }
      }

      return true;
    } else {
      console.error("❌ Page capture failed:", response.data.error);
      return false;
    }
  } catch (error) {
    console.error("❌ Page capture failed:", error.message);

    if (error.response) {
      console.error("   Response status:", error.response.status);
      console.error(
        "   Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }

    return false;
  }
}

async function testInvalidRequests() {
  console.log("\n🚫 Testing invalid requests...");

  const testCases = [
    {
      name: "Missing projectId",
      body: {
        captureUrl: "https://example.com",
      },
    },
    {
      name: "Missing captureUrl",
      body: {
        projectId: "test-project",
      },
    },
    {
      name: "Invalid URL",
      body: {
        projectId: "test-project",
        captureUrl: "not-a-valid-url",
      },
    },
  ];

  let passed = 0;

  for (const testCase of testCases) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/capture-all-pages`,
        testCase.body
      );
      console.log(`❌ ${testCase.name}: Expected error but got success`);
    } catch (error) {
      if (error.response && error.response.status >= 400) {
        console.log(
          `✅ ${testCase.name}: Correctly returned error ${error.response.status}`
        );
        passed++;
      } else {
        console.log(`❌ ${testCase.name}: Unexpected error:`, error.message);
      }
    }
  }

  console.log(`   ${passed}/${testCases.length} invalid request tests passed`);
  return passed === testCases.length;
}

async function runAllTests() {
  console.log("🚀 Starting Puppeteer API Tests");
  console.log("================================");

  const tests = [
    { name: "Health Check", fn: testHealthCheck },
    { name: "Status Check", fn: testStatusCheck },
    { name: "Debug Endpoint", fn: testDebugEndpoint },
    { name: "Invalid Requests", fn: testInvalidRequests },
    { name: "Page Capture", fn: testPageCapture },
  ];

  const results = [];

  for (const test of tests) {
    console.log(`\n🧪 Running: ${test.name}`);
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      console.error(`💥 Test "${test.name}" threw an error:`, error.message);
      results.push({ name: test.name, passed: false });
    }
  }

  // Summary
  console.log("\n📋 Test Results Summary");
  console.log("=======================");

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.passed ? "✅" : "❌";
    console.log(`${status} ${result.name}`);
  });

  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("🎉 All tests passed! The API is working correctly.");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Please check the output above.");
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Main execution
if (require.main === module) {
  console.log("⏰ Waiting 2 seconds for service to be ready...");
  setTimeout(runAllTests, 2000);
}
