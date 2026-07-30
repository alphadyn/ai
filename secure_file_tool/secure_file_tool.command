#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ $# -eq 0 ]; then
  osascript -e 'display dialog "Drop one or more files onto this script to encrypt or decrypt them." buttons {"OK"} default button "OK" with title "Secure File Tool"' >/dev/null 2>&1 || true
  exit 0
fi

ACTION=$(osascript -e 'set result to button returned of (display dialog "Choose an action for the dropped files" buttons {"Encrypt", "Decrypt", "Cancel"} default button "Encrypt" with title "Secure File Tool")' 2>/dev/null || true)

if [ "$ACTION" = "Cancel" ] || [ -z "$ACTION" ]; then
  echo "Operation cancelled."
  exit 0
fi

PASSWORD=$(osascript -e 'set result to text returned of (display dialog "Enter password" default answer "" with hidden answer true with title "Secure File Tool")' 2>/dev/null || true)

if [ -z "$PASSWORD" ]; then
  echo "Password cannot be empty."
  exit 1
fi

for INPUT_PATH in "$@"; do
  if [ ! -e "$INPUT_PATH" ]; then
    echo "Skipping missing path: $INPUT_PATH"
    continue
  fi

  if [ -d "$INPUT_PATH" ]; then
    echo "Skipping folder: $INPUT_PATH"
    continue
  fi

  if [ "$ACTION" = "Encrypt" ]; then
    OUTPUT_PATH="$INPUT_PATH.enc"
    python3 "$ROOT_DIR/secure_file_tool/file_crypto.py" encrypt "$INPUT_PATH" "$OUTPUT_PATH" --password "$PASSWORD"
    echo "Encrypted: $INPUT_PATH -> $OUTPUT_PATH"
  else
    if [[ "$INPUT_PATH" == *.enc ]]; then
      OUTPUT_PATH="${INPUT_PATH%.enc}"
    else
      OUTPUT_PATH="$INPUT_PATH.decrypted"
    fi
    python3 "$ROOT_DIR/secure_file_tool/file_crypto.py" decrypt "$INPUT_PATH" "$OUTPUT_PATH" --password "$PASSWORD"
    echo "Decrypted: $INPUT_PATH -> $OUTPUT_PATH"
  fi
done
