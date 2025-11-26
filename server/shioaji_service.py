import shioaji as sj
import threading
import time
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
        print(f"[DEBUG] get_history_kbars called with date={date_str}, is_night={is_night}", flush=True)
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
                # Night session: Fetch extra day to ensure we get the "Trading Day" data
                # which might be timestamped as T+1
                fetch_end_date = target_date + timedelta(days=2)
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
                # Calculate threshold for night session data (Trading Day T+1)
                night_shift_threshold = start_dt + timedelta(days=1)

                for i in range(len(kbars.ts)):
                    ts = kbars.ts[i] # Timestamp in ns
                    dt = datetime.fromtimestamp(ts / 1000000000)
                    
                    # Handle Night Session Timestamp Shift from KBARS API
                    if is_night:
                        if dt >= night_shift_threshold:
                            # Shift back to Real Time
                            dt = dt - timedelta(days=1)
                        else:
                            # This is likely Yesterday's Night Session (Trading Day T)
                            # timestamped as T.
                            # We want to skip this.
                            continue
                    
                    # Filter out future data (Shioaji might return full session placeholders)
                    if dt > datetime.now():
                        continue

                    include_point = False
                    
                    if is_night:
                        # 1. Standard Night Session: 15:00 (T) ~ 05:00 (T+1)
                        if start_dt <= dt <= end_dt:
                            include_point = True
                        
                        # 2. Extended Saturday Session: 08:45 (T+1) ~ 13:45 (T+1)
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
                            "timestamp": int(dt.timestamp() * 1000),
                            "open": float(kbars.Open[i]),
                            "high": float(kbars.High[i]),
                            "low": float(kbars.Low[i]),
                            "close": float(kbars.Close[i]),
                            "volume": int(kbars.Volume[i])
                        })

            # If Night Session, also fetch TICKS to get the REAL-TIME current session data
            # because KBARS API often fails to return the current incomplete night session.
            if is_night:
                # Shioaji Ticks for Night Session are stored under T+1 date
                # e.g. Night Session starting 11/25 15:00 is part of 11/26 Trading Day.
                ticks_date = target_date + timedelta(days=1)
                ticks_date_str = ticks_date.strftime("%Y-%m-%d")
                
                print(f"[DEBUG] Fetching ticks for current night session: {ticks_date_str} (Target: {date_str})", flush=True)
                try:
                    ticks = self.api.ticks(self.contract, ticks_date_str)
                    if ticks.ts:
                        print(f"[DEBUG] Got {len(ticks.ts)} ticks", flush=True)
                        tick_kbars = self._aggregate_ticks_to_kbars(ticks, start_dt, end_dt)
                        print(f"[DEBUG] Aggregated to {len(tick_kbars)} kbars", flush=True)
                        
                        # Merge tick_kbars into data
                        # Avoid duplicates based on timestamp
                        existing_timestamps = set(d['timestamp'] for d in data)
                        for k in tick_kbars:
                            if k['timestamp'] not in existing_timestamps:
                                data.append(k)
                        
                        # Sort by timestamp
                        data.sort(key=lambda x: x['timestamp'])
                except Exception as e:
                    print(f"[ERROR] Failed to fetch/aggregate ticks: {e}", flush=True)

            return data

        except Exception as e:
            print(f"Failed to fetch history: {e}", flush=True)
            return []

    def _aggregate_ticks_to_kbars(self, ticks, start_dt, end_dt):
        kbars_map = {}
        
        for i in range(len(ticks.ts)):
            ts = ticks.ts[i]
            dt = datetime.fromtimestamp(ts / 1000000000)
            
            # FIX: Shioaji Ticks timestamp appears to be shifted by +8 hours (likely treated Local as UTC)
            # Detected: At 00:28, timestamp was 08:28. Subtracting 8 hours to fix.
            dt = dt - timedelta(hours=8)
            
            if i == 0 or i == len(ticks.ts) - 1:
                print(f"[DEBUG] Tick[{i}]: {dt} (Range: {start_dt} - {end_dt})", flush=True)

            # Filter by time range
            if not (start_dt <= dt <= end_dt):
                continue
                
            # Round down to minute
            minute_dt = dt.replace(second=0, microsecond=0)
            timestamp = int(minute_dt.timestamp() * 1000)
            
            price = float(ticks.close[i])
            volume = int(ticks.volume[i])
            
            if timestamp not in kbars_map:
                kbars_map[timestamp] = {
                    "time": minute_dt.isoformat(),
                    "timestamp": timestamp,
                    "open": price,
                    "high": price,
                    "low": price,
                    "close": price,
                    "volume": volume
                }
            else:
                k = kbars_map[timestamp]
                k["high"] = max(k["high"], price)
                k["low"] = min(k["low"], price)
                k["close"] = price
                k["volume"] += volume
                
        return sorted(kbars_map.values(), key=lambda x: x['timestamp'])

# Global instance
shioaji_service = ShioajiService()
