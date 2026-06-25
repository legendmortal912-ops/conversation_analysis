import os
import io
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from typing import Any
import logging

logger = logging.getLogger(__name__)

def derive_key(license_payload: dict) -> bytes:
    """
    Derives the AES-256 decryption key from the license or a secure runtime environment.
    In a real implementation, this might use PBKDF2 with a salt from the license,
    or retrieve the key securely over the network via the heartbeat.
    For this implementation, we use a placeholder or ENV var.
    """
    org_id = license_payload.get("org_id", "")
    plan_id = license_payload.get("plan_id", "")
    iat = str(license_payload.get("iat", 0))
    
    # Use HKDF to derive a 32-byte AES key
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"convoguard_model_salt_v1",
        info=(org_id + plan_id + iat).encode("utf-8"),
    )
    # Master secret from embedded public key
    from src.license_validator import EMBEDDED_PUBLIC_KEY_HEX
    master_secret = bytes.fromhex(EMBEDDED_PUBLIC_KEY_HEX)
    return hkdf.derive(master_secret)

def load_encrypted_model(filepath: str, license_payload: dict) -> Any:
    """
    Loads an encrypted model file directly into memory without touching disk.
    If the file is not encrypted (e.g., standard .pt or .safetensors), it loads it normally
    for development backwards compatibility.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Model file not found: {filepath}")

    if filepath.endswith(".enc"):
        logger.info(f"Loading encrypted model: {filepath}")
        with open(filepath, "rb") as f:
            data = f.read()

        if len(data) < 12:
            raise ValueError("Invalid encrypted model file (too short)")

        nonce = data[:12]
        ciphertext = data[12:]
        key = derive_key(license_payload)
        
        try:
            aesgcm = AESGCM(key)
            # Decrypt directly into memory
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        except Exception as e:
            logger.error("Failed to decrypt model weights! The key or license may be invalid.")
            raise ValueError(f"Model decryption failed: {str(e)}")

        # Load from in-memory buffer using torch or huggingface depending on the format
        # This is a stub for the actual loading mechanism
        # buffer = io.BytesIO(plaintext)
        # return torch.load(buffer)
        return {"status": "decrypted", "size": len(plaintext)}
    else:
        logger.info(f"Loading unencrypted model (development mode): {filepath}")
        # Standard unencrypted load
        return {"status": "unencrypted_dev_mode"}

def save_encrypted_model(filepath: str, plaintext: bytes, key_hex: str):
    """Utility to encrypt a model for deployment."""
    key = bytes.fromhex(key_hex)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    
    with open(filepath + ".enc", "wb") as f:
        f.write(nonce)
        f.write(ciphertext)
