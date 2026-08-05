# Secure File Tool

This folder contains a small Python utility for encrypting and decrypting any file with strong authenticated encryption.

## What it uses
- AES-GCM for encryption
- PBKDF2-HMAC-SHA256 with 600,000 iterations for key derivation
- A random salt and nonce per file

## Usage

Install dependencies:

```bash
python3 -m pip install -r secure_file_tool/requirements.txt
```

### Graphical interface

Launch the simple desktop app:

```bash
python3 secure_file_tool/gui_app.py
```

It lets you choose an input file, an output file, and a password, then encrypt or decrypt the file with a single click.

### Command line

Encrypt a file:

```bash
python3 secure_file_tool/file_crypto.py encrypt /path/to/input.txt /path/to/output.bin --password "your-strong-password"
```

Decrypt a file:

```bash
python3 secure_file_tool/file_crypto.py decrypt /path/to/output.bin /path/to/restored.txt --password "your-strong-password"
```

If you omit the password flag, the program will prompt for it securely.

## Test the project
Run the repository-wide test suite from the project root:

```bash
./run_tests.sh
```

## Generate the report
Run the generator script to create a simple HTML artifact for this project:

```bash
python3 generate_report.py
```

This writes [generated_report.html](generated_report.html) in the same folder.
