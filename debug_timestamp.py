import os
import sys
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import shioaji as sj

# Add server directory to path
sys.path.append(os.path.join(os.getcwd(), 'server'))

# Load env
load_dotenv(os.path.join(os.getcwd(), 'server', '.env'))

api = sj.Shioaji()
api_key = os.environ.get('SHIOAJI_API_KEY')
secret_key = os.environ.get('SHIOAJI_SECRET_KEY')

if not api_key or not secret_key:
    print("No credentials")
    sys.exit(1)

api.login(api_key, secret_key)
print("Login success")

contract = api.Contracts.Futures.TXF.TXFR1
print(f"Contract: {contract.code}")

# Define Taiwan Timezone
tz = timezone(timedelta(hours=8))
now = datetime.now(tz)
print(f"Current Time (TPE): {now}")

# Determine session parameters for tonight (Monday Night)
# We want to see what '2025-11-24' returns
target_date_str = now.strftime("%Y-%m-%d")
print(f"Requesting kbars for start={target_date_str}")

kbars = api.kbars(contract, start=target_date_str, end=target_date_str)

if kbars.ts:
    print(f"Returned {len(kbars.ts)} bars")
    if len(kbars.ts) > 0:
        # Check first and last
        first_ts = kbars.ts[0]
        last_ts = kbars.ts[-1]
        
        first_dt_utc = datetime.fromtimestamp(first_ts / 1e9, timezone.utc)
        first_dt_tpe = datetime.fromtimestamp(first_ts / 1e9, tz)
        
        last_dt_utc = datetime.fromtimestamp(last_ts / 1e9, timezone.utc)
        last_dt_tpe = datetime.fromtimestamp(last_ts / 1e9, tz)
        
        print(f"First TS: {first_ts}")
        print(f"  UTC: {first_dt_utc}")
        print(f"  TPE: {first_dt_tpe}")
        
        print(f"Last TS: {last_ts}")
        print(f"  UTC: {last_dt_utc}")
        print(f"  TPE: {last_dt_tpe}")
        
        # Check if last_dt_tpe matches current time
        diff = now - last_dt_tpe
        print(f"Time difference (Now - Last Data): {diff}")
else:
    print("No data returned")
