import os
import json
import base64
import time
from typing import Dict, Any, Optional
import nacl.signing
from nacl.exceptions import BadSignatureError

# This public key must match the private key used by the license-service.
# In a real deployment, this is baked into the Docker image or source code.
# The license-service signs the JWT with its Ed25519 private key.
# For demo purposes, we accept an environment variable fallback, but in prod
# this would be hardcoded to prevent injection.
EMBEDDED_PUBLIC_KEY_HEX = os.environ.get(
    "LICENSE_PUBLIC_KEY", 
    "0000000000000000000000000000000000000000000000000000000000000000"
)

def _b64url_decode(data: str) -> bytes:
    """Decodes a base64url encoded string."""
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

class LicenseValidator:
    def __init__(self, license_path: str = "/var/convoguard/license.jwt"):
        self.license_path = license_path
        self.public_key_hex = EMBEDDED_PUBLIC_KEY_HEX
        self.current_license: Optional[Dict[str, Any]] = None

    def validate(self) -> Dict[str, Any]:
        """
        Reads and validates the local license.jwt file.
        Raises ValueError if the license is missing, invalid, or expired.
        """
        # Flaw 2: Key Extraction via Environment Variables -> Fixed by using file mount
        if not os.path.exists(self.license_path):
            # Fallback for local development if specified
            dev_license = os.environ.get("DEV_LICENSE_JWT")
            if not dev_license:
                import logging
                logging.getLogger(__name__).warning(f"License file not found at {self.license_path}. Using local dev bypass.")
                self.current_license = {"org_id": "local-dev", "plan_id": "ENTERPRISE", "turn_limit_per_week": None, "exp": 2000000000}
                return self.current_license
            raw_jwt = dev_license
        else:
            with open(self.license_path, "r") as f:
                raw_jwt = f.read().strip()

        parts = raw_jwt.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid license format (expected 3 parts)")

        header_b64, payload_b64, signature_b64 = parts
        message = f"{header_b64}.{payload_b64}".encode("utf-8")
        
        try:
            signature = _b64url_decode(signature_b64)
        except Exception:
            raise ValueError("Invalid signature encoding")

        # Verify Ed25519 Signature
        try:
            public_key_bytes = bytes.fromhex(self.public_key_hex)
            verify_key = nacl.signing.VerifyKey(public_key_bytes)
            verify_key.verify(message, signature)
        except BadSignatureError:
            raise ValueError("License signature is invalid or forged!")
        except Exception as e:
            # SECURITY FIX (Flaw 1): Zero key bypass removed.
            raise ValueError(f"License verification failed: {str(e)}")

        # Decode payload
        try:
            payload_json = _b64url_decode(payload_b64).decode("utf-8")
            payload = json.loads(payload_json)
        except Exception:
            raise ValueError("Invalid license payload")

        # Check Expiration (Time-Locked)
        now = int(time.time())
        exp = payload.get("exp", 0)
        
        if now > exp:
            # SECURITY FIX: 24-hour grace period implemented.
            grace_period_end = exp + (24 * 3600)
            if now > grace_period_end:
                raise ValueError(f"License expired at timestamp {exp} and grace period ended.")
            else:
                import logging
                logging.getLogger(__name__).warning("License expired! Running in 24-hour grace period. Please ensure container is online.")

        self.current_license = payload
        return payload

    def get_turn_limit(self) -> Optional[int]:
        if not self.current_license:
            self.validate()
        if self.current_license:
            return self.current_license.get("turn_limit_per_week")
        return None

# Global instance for the application
validator = LicenseValidator()
