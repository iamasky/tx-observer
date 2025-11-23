import shioaji as sj
import threading
import time
import os
import os
from datetime import datetime, timedelta

class ShioajiService:
    def __init__(self):
        self.api = sj.Shioaji()
        self.is_connected = False
        self.latest_data = []
        self.lock = threading.Lock()
        self.contract = None
        # Don't load env vars here, do it in connect()

    def connect(self):
        # Load credentials here to ensure .env is loaded by app.py first
        self.api_key = os.environ.get('SHIOAJI_API_KEY')
        self.secret_key = os.environ.get('SHIOAJI_SECRET_KEY')

        if not self.api_key or not self.secret_key:
            print("Shioaji credentials not found in .env")
            return False

        try:
            self.api.login(
                api_key=self.api_key,
                secret_key=self.secret_key
            )
            print("Shioaji Login Success")
            self.is_connected = True
            self._subscribe_txf()
            return True
        except Exception as e:
            print(f"Shioaji Login Failed: {e}")
            self.is_connected = False
            return False

    def _subscribe_txf(self):
        try:
            # Get TXF contracts
            self.contract = self.api.Contracts.Futures.TXF.TXFR1
            if self.contract:
                print(f"Subscribing to {self.contract.name} ({self.contract.code})")
                self.api.quote.subscribe(
                    self.contract,
                    quote_type=sj.constant.QuoteType.Tick,
                    version=sj.constant.QuoteVersion.v1
                )
                # Updated callback method for Futures/Options
                self.api.quote.set_on_tick_fop_v1_callback(self._on_tick)
            else:
                print("Could not find TXF contract")
        except Exception as e:
            print(f"Subscription Failed: {e}")

    def _on_tick(self, exchange, tick):
        # Callback for tick data
        with self.lock:
            now = datetime.now()
            price = float(tick.close)
            
            point = {
                "time": now.isoformat(),
                "timestamp": now.timestamp() * 1000,
                "open": price,
                "high": price,
                "low": price,
                "close": price,
                "volume": int(tick.volume)
            }
            
            self.latest_data.append(point)
            
            if len(self.latest_data) > 1000:
                self.latest_data.pop(0)

    def get_data(self):
        with self.lock:
            return list(self.latest_data)

    def get_status(self):
        return {
            "connected": self.is_connected,
            "contract": self.contract.code if self.contract else None
        }

    def get_history_kbars(self, date_str, is_night=False):
        if not self.is_connected or not self.contract:
            return []

        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d")
            
            if is_night:
                # Night session: 15:00 to 05:00 (next day)
                start_dt = target_date.replace(hour=15, minute=0, second=0)
                end_dt = (target_date + timedelta(days=1)).replace(hour=5, minute=0, second=0)
            else:
                # Regular session: 08:45 to 13:45
                start_dt = target_date.replace(hour=8, minute=45, second=0)
                end_dt = target_date.replace(hour=13, minute=45, second=0)

            # Fetch K-bars (1 min)
            # Default end date for fetching
            fetch_end_date = target_date + timedelta(days=1)
            
            # Check if next day is Saturday (weekday() == 5)
            # If so, we might need to include Saturday's Day Session (08:45-13:45)
            next_day = target_date + timedelta(days=1)
            is_friday_night = (target_date.weekday() == 4) and is_night
            
            if is_friday_night:
                # Extend fetch range to cover Saturday
                fetch_end_date = target_date + timedelta(days=2)
            elif is_night:
                # Normal night session, fetch until next day
                fetch_end_date = target_date + timedelta(days=1)
            else:
                # Day session
                fetch_end_date = target_date

            kbars = self.api.kbars(
                self.contract, 
                start=start_dt.strftime("%Y-%m-%d"), 
                end=fetch_end_date.strftime("%Y-%m-%d")
            )
            
            # Convert to our format
            data = []
            if kbars.ts:
                print(f"[DEBUG] Shioaji returned {len(kbars.ts)} kbars")
                if len(kbars.ts) > 0:
                    first_dt = datetime.fromtimestamp(kbars.ts[0] / 1000000000)
                    last_dt = datetime.fromtimestamp(kbars.ts[-1] / 1000000000)
                    print(f"[DEBUG] Data range: {first_dt} ~ {last_dt}")
                    print(f"[DEBUG] Expected range: {start_dt} ~ {end_dt}")
                
                for i in range(len(kbars.ts)):
                    ts = kbars.ts[i] # Timestamp in ns
                    # Filter by time range because Shioaji might return whole day
                    # Use local time (system time)
                    dt = datetime.fromtimestamp(ts / 1000000000)
                    
                    include_point = False
                    
                    if is_night:
                        # 1. Standard Night Session: 15:00 (T) ~ 05:00 (T+1)
                        if start_dt <= dt <= end_dt:
                            include_point = True
                        
                        # 2. Extended Saturday Session: 08:45 (T+1) ~ 13:45 (T+1)
                        # Only if it is Friday Night (which spans to Saturday morning)
                        if is_friday_night:
                            sat_start = next_day.replace(hour=8, minute=45, second=0)
                            sat_end = next_day.replace(hour=13, minute=45, second=0)
                            if sat_start <= dt <= sat_end:
                                include_point = True
                    else:
                        # Regular Day Session
                        if start_dt <= dt <= end_dt:
                            include_point = True
                            
                    if include_point:
                        data.append({
                            "time": dt.isoformat(),
                            "timestamp": int(ts / 1000000), # ms
                            "open": float(kbars.Open[i]),
                            "high": float(kbars.High[i]),
                            "low": float(kbars.Low[i]),
                            "close": float(kbars.Close[i]),
                            "volume": int(kbars.Volume[i])
                        })
                
                print(f"[DEBUG] Filtered to {len(data)} data points")
                if len(data) > 0:
                    print(f"[DEBUG] First point: {data[0]['time']}")
                    print(f"[DEBUG] Last point: {data[-1]['time']}")
            
            return data

        except Exception as e:
            print(f"Failed to fetch history: {e}")
            return []


# Global instance
shioaji_service = ShioajiService()
