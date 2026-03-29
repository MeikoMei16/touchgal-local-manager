import sqlite3
import os

# Path to the database
DB_PATH = os.path.join(os.environ['APPDATA'], 'TouchGal-Local-Manager', 'touchgal.db')
# Fallback
if not os.path.exists(DB_PATH):
    DB_PATH = os.path.expanduser("~/AppData/Roaming/TouchGal-Local-Manager/touchgal.db")

def reset_stats():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("Clearing local game statistics to force fresh sync from API...")
        # Reset counts to 0 so the next load will definitely see them as 'changed' if needed
        # Or just delete everything to be sure
        cursor.execute("DELETE FROM games")
        conn.commit()
        print("Successfully cleared the 'games' table. Please restart the app or refresh the Home page.")
        
    except Exception as e:
        print(f"Error resetting database: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    reset_stats()
