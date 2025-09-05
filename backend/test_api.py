#!/usr/bin/env python3
"""
Test the FastAPI endpoints directly.
"""

import requests
import json

def test_templates_endpoint():
    """Test the templates endpoint."""
    
    print("🔍 Testing Templates API Endpoint")
    print("=" * 50)
    
    try:
        # Test the templates endpoint
        url = "https://wally-backend-523614903618.us-central1.run.app/templates/"
        
        print(f"📡 Making request to: {url}")
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Retrieved {len(data)} templates")
            
            if data:
                print(f"\n📋 Sample template:")
                sample = data[0]
                for key, value in sample.items():
                    value_str = str(value)[:100] + "..." if len(str(value)) > 100 else str(value)
                    print(f"  {key}: {value_str}")
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed. Is the server running on https://wally-backend-523614903618.us-central1.run.app?")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_health_endpoint():
    """Test the health endpoint."""
    
    print("\n🔍 Testing Health Endpoint")
    print("=" * 30)
    
    try:
        url = "https://wally-backend-523614903618.us-central1.run.app/health"
        response = requests.get(url, timeout=5)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed!")
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed. Is the server running?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🚀 Testing FastAPI Backend")
    print("=" * 60)
    
    test_health_endpoint()
    test_templates_endpoint()
    
    print("\n🎉 API testing complete!")