import os
import tempfile
import unittest

from secure_file_tool.file_crypto import decrypt_file, encrypt_file


class FileCryptoTests(unittest.TestCase):
    def test_round_trip_encrypts_and_decrypts(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = os.path.join(tmp_dir, "secret.bin")
            encrypted_path = os.path.join(tmp_dir, "secret.bin.enc")
            decrypted_path = os.path.join(tmp_dir, "secret.out")
            original = b"This is a secret payload with binary\x00bytes!"

            with open(input_path, "wb") as handle:
                handle.write(original)

            encrypt_file(input_path, encrypted_path, "strong-password")
            self.assertTrue(os.path.exists(encrypted_path))
            with open(encrypted_path, "rb") as handle:
                self.assertNotEqual(handle.read(16), original[:16])

            decrypt_file(encrypted_path, decrypted_path, "strong-password")
            with open(decrypted_path, "rb") as handle:
                self.assertEqual(handle.read(), original)


if __name__ == "__main__":
    unittest.main()
