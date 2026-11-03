import sys
import os

# Append project root directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine, Base
# Import models to ensure they register on Base metadata
from app.models.user import User
from app.models.wifi_sensor import SensorReading, DailyAggregate, RiskHistory
from app.models.phq9_assessment import PHQ9Assessment

def init_db():
    print("[*] Initializing SQLite database schema for WiFi telemetry system...")
    try:
        Base.metadata.create_all(bind=engine)
        print("[+] Schema built successfully! Tables initialized:")
        for table_name in Base.metadata.tables.keys():
            print(f"  - {table_name}")
    except Exception as e:
        print(f"[-] Database initialization failed: {e}")

if __name__ == "__main__":
    init_db()
