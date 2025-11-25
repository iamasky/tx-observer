import os
import sys
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Add server directory to path
sys.path.append(os.path.join(os.getcwd(), 'server'))

# Load env
load_dotenv(os.path.join(os.getcwd(), 'server', '.env'))

try:
    from shioaji_service import shioaji_service
    print("Successfully imported shioaji_service")
    
    # Mock API to avoid actual connection if needed, but we want to test logic
    # We will try to run the logic that doesn't require connection first if possible,
    # but _initialize_session_data requires connection.
    
    # Let's try to connect
    print("Attempting to connect...")
    success = shioaji_service.connect()
    print(f"Connection result: {success}")
    
    if success:
        print("Connected. Checking data...")
        data = shioaji_service.get_data()
        print(f"Data length: {len(data)}")
        if len(data) > 0:
            print(f"First point: {data[0]}")
            print(f"Last point: {data[-1]}")
    else:
        print("Connection failed.")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
