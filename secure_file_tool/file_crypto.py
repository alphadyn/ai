import argparse
import getpass
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=600_000,
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt_file(input_path: str, output_path: str, password: str) -> None:
    input_path = Path(input_path)
    output_path = Path(output_path)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    data = input_path.read_bytes()
    salt = os.urandom(16)
    key = _derive_key(password, salt)
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, data, None)

    payload = salt + nonce + ciphertext
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(payload)


def decrypt_file(input_path: str, output_path: str, password: str) -> None:
    input_path = Path(input_path)
    output_path = Path(output_path)

    if not input_path.exists():
        raise FileNotFoundError(f"Encrypted file not found: {input_path}")

    payload = input_path.read_bytes()
    if len(payload) < 28:
        raise ValueError("Encrypted file is too short")

    salt = payload[:16]
    nonce = payload[16:28]
    ciphertext = payload[28:]
    key = _derive_key(password, salt)
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(plaintext)


def _prompt_password(prompt: str) -> str:
    return getpass.getpass(prompt)


def main() -> None:
    parser = argparse.ArgumentParser(description="Encrypt or decrypt a file with AES-GCM")
    parser.add_argument("mode", choices=["encrypt", "decrypt"], help="Operation to perform")
    parser.add_argument("input_file", help="Path to the input file")
    parser.add_argument("output_file", help="Path to write the encrypted/decrypted file")
    parser.add_argument("--password", help="Password for encryption/decryption")
    args = parser.parse_args()

    password = args.password or _prompt_password("Enter password: ")
    if args.mode == "encrypt":
        encrypt_file(args.input_file, args.output_file, password)
        print(f"Encrypted file written to {args.output_file}")
    else:
        decrypt_file(args.input_file, args.output_file, password)
        print(f"Decrypted file written to {args.output_file}")


if __name__ == "__main__":
    sys.exit(main())
