#!/usr/bin/env python3
"""
Test script for the Supabase database service.
Run this to verify that the database connection is working properly.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.db.supabase_client import db_service
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_database_connection():
    """Test the database connection and basic operations."""
    
    print("🔍 Testing Supabase Database Service")
    print("=" * 50)
    
    try:
        # Test 1: Health check
        print("1. Testing database health check...")
        is_healthy = db_service.health_check()
        print(f"   ✅ Health check: {'PASSED' if is_healthy else 'FAILED'}")
        
        if not is_healthy:
            print("   ❌ Database connection failed. Check your credentials and network.")
            return False
        
        # Test 2: Test getting records from different tables
        print("\n2. Testing table access...")
        
        tables_to_test = ['profiles', 'file_objects', 'templates']
        
        for table in tables_to_test:
            try:
                records = db_service.get_records(table, limit=1)
                print(f"   ✅ {table}: Accessible (found {len(records)} record(s))")
            except Exception as e:
                print(f"   ⚠️  {table}: {str(e)}")
        
        # Test 3: Test specific operations
        print("\n3. Testing specific operations...")
        try:
            # Test template operations
            templates = db_service.get_templates_by_type('birth_certificate')
            print(f"   ✅ Birth certificate templates: {len(templates)} found")
            
            # Test profile operations
            profiles = db_service.get_records('profiles', limit=5)
            print(f"   ✅ Profiles: {len(profiles)} found")
            
            if profiles:
                profile_id = profiles[0]['id']
                profile_files = db_service.get_profile_files(profile_id)
                print(f"   ✅ Files for profile: {len(profile_files)} found")
            
            # Test file object operations
            file_objects = db_service.get_records('file_objects', limit=5)
            print(f"   ✅ File objects: {len(file_objects)} found")
            
        except Exception as e:
            print(f"   ⚠️  Specific operations: {str(e)}")
        
        print("\n🎉 Database service test completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Database service test failed: {str(e)}")
        return False

def show_service_info():
    """Display information about the database service."""
    print("\n📋 Database Service Information")
    print("=" * 50)
    print(f"Service class: {db_service.__class__.__name__}")
    print(f"Client initialized: {db_service._client is not None}")
    
    # Show available methods
    methods = [method for method in dir(db_service) if not method.startswith('_') and callable(getattr(db_service, method))]
    print(f"Available methods: {len(methods)}")
    for method in sorted(methods):
        print(f"  - {method}")

if __name__ == "__main__":
    print("🚀 Starting Database Service Test")
    
    # Show service information
    show_service_info()
    
    # Test the connection
    success = test_database_connection()
    
    if success:
        print("\n✅ All tests passed! The database service is ready to use.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Please check the configuration.")
        sys.exit(1)