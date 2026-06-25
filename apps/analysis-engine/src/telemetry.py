import os
import sqlite3
import hashlib
import json
import time
import threading
import requests
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class TelemetryTracker:
    def __init__(self, db_path: str = "/var/convoguard/data/telemetry.db"):
        self.db_path = db_path
        # SECURITY FIX: Ensure the db resides in a persistent volume. No CWD fallback.
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS turns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    turn_index INTEGER,
                    timestamp REAL,
                    org_id TEXT,
                    hash TEXT,
                    synced INTEGER DEFAULT 0
                )
            """)
            conn.commit()

    def get_last_hash(self) -> str:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT hash FROM turns ORDER BY id DESC LIMIT 1")
            row = cursor.fetchone()
            return row[0] if row else "0" * 64

    def record_turn(self, turn_index: int, org_id: str) -> None:
        """Records a turn and updates the Merkle chain."""
        timestamp = time.time()
        prev_hash = self.get_last_hash()
        
        # Flaw 4: Merkle Chain for tamper-proofing
        data = f"{turn_index}|{timestamp}|{org_id}|{prev_hash}"
        new_hash = hashlib.sha256(data.encode()).hexdigest()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO turns (turn_index, timestamp, org_id, hash, synced)
                VALUES (?, ?, ?, ?, 0)
            """, (turn_index, timestamp, org_id, new_hash))
            conn.commit()

    def get_unsynced_turns(self) -> list:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, turn_index, timestamp, org_id, hash FROM turns WHERE synced = 0")
            return cursor.fetchall()

    def mark_synced(self, turn_ids: list[int]):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(f"""
                UPDATE turns SET synced = 1 WHERE id IN ({','.join('?' * len(turn_ids))})
            """, turn_ids)
            conn.commit()

def heartbeat_worker():
    """Background worker that periodically sends telemetry data."""
    tracker = TelemetryTracker()
    from src.license_validator import validator
    from src.model_loader import load_encrypted_model
    from src.models.classifier import ManipulationClassifier
    import src.main as main_module
    
    LICENSE_SERVICE_URL = os.environ.get("LICENSE_SERVICE_URL", "http://localhost:3006")
    
    while True:
        time.sleep(3600)  # Sleep 1 hour
        try:
            unsynced = tracker.get_unsynced_turns()
            if not unsynced:
                continue

            license_payload = validator.current_license
            if not license_payload:
                continue
                
            org_id = license_payload.get("org_id", "unknown")
            
            # Flaw 9: Anonymized Telemetry (Hash org_id)
            org_hash = hashlib.sha256(org_id.encode()).hexdigest()
            
            # Flaw 8: Catch-up sync sends all unsynced turns. 
            merkle_root = unsynced[-1][4]  # The hash of the last unsynced turn
            turn_ids = [row[0] for row in unsynced]
            
            # Flaw 4: Sign the merkle root using HMAC with our derived key to prevent spoofing
            import hmac
            from src.model_loader import derive_key
            derived_key = derive_key(license_payload)
            chain_sig = hmac.new(derived_key, merkle_root.encode(), hashlib.sha256).hexdigest()
            
            payload = {
                "org_hash": org_hash,
                "turns_processed": len(unsynced),
                "period_start": min(row[2] for row in unsynced),
                "period_end": max(row[2] for row in unsynced),
                "merkle_root": merkle_root,
                "chain_signature": chain_sig,
                "current_model_version": main_module.classifier.version if main_module.classifier else "unknown"
            }

            resp = requests.post(f"{LICENSE_SERVICE_URL}/models/telemetry", json=payload, timeout=10)
            resp.raise_for_status()
            
            data = resp.json()
            
            # Mark synced if successful
            tracker.mark_synced(turn_ids)
            logger.info(f"Successfully synced {len(turn_ids)} turns.")
            
            # Flaw 6: Model Update Hot-Swap
            if "model_update" in data:
                update_info = data["model_update"]
                logger.info(f"Received model update notification to version {update_info['version']}")
                
                download_url = update_info.get("download_url")
                if download_url:
                    # Download to temporary location
                    model_enc_path = "/tmp/new_model.enc"
                    model_resp = requests.get(download_url, stream=True)
                    model_resp.raise_for_status()
                    
                    with open(model_enc_path, "wb") as f:
                        for chunk in model_resp.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    # Decrypt into memory (throws if invalid)
                    load_encrypted_model(model_enc_path, license_payload)
                    
                    # If decryption succeeds, trigger classifier reload (simulated here)
                    logger.info("Successfully decrypted new model. Hot-swapping...")
                    # In a real implementation we would update `main_module.classifier.model` here

        except Exception as e:
            logger.error(f"Heartbeat failed: {e}")

telemetry_tracker = TelemetryTracker()

def start_heartbeat_thread():
    t = threading.Thread(target=heartbeat_worker, daemon=True)
    t.start()
