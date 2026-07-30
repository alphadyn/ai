import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

try:
    from secure_file_tool.file_crypto import decrypt_file, encrypt_file
except ImportError:  # pragma: no cover - supports direct script execution
    from file_crypto import decrypt_file, encrypt_file


class SecureFileApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Secure File Tool")
        self.geometry("540x320")
        self.minsize(500, 300)

        self.mode_var = tk.StringVar(value="encrypt")
        self.input_path_var = tk.StringVar()
        self.output_path_var = tk.StringVar()
        self.password_var = tk.StringVar()

        self._build_ui()

    def _build_ui(self) -> None:
        container = ttk.Frame(self, padding=16)
        container.pack(fill="both", expand=True)

        ttk.Label(container, text="Choose action:").grid(row=0, column=0, sticky="w", pady=(0, 8))
        mode_frame = ttk.Frame(container)
        mode_frame.grid(row=1, column=0, columnspan=3, sticky="w", pady=(0, 12))

        ttk.Radiobutton(mode_frame, text="Encrypt", variable=self.mode_var, value="encrypt").pack(side="left")
        ttk.Radiobutton(mode_frame, text="Decrypt", variable=self.mode_var, value="decrypt").pack(side="left", padx=(12, 0))

        ttk.Label(container, text="Input file:").grid(row=2, column=0, sticky="w", pady=(0, 4))
        ttk.Entry(container, textvariable=self.input_path_var, width=50).grid(row=3, column=0, columnspan=2, sticky="ew")
        ttk.Button(container, text="Browse", command=self._browse_input).grid(row=3, column=2, padx=(8, 0), sticky="ew")

        ttk.Label(container, text="Output file:").grid(row=4, column=0, sticky="w", pady=(12, 4))
        ttk.Entry(container, textvariable=self.output_path_var, width=50).grid(row=5, column=0, columnspan=2, sticky="ew")
        ttk.Button(container, text="Browse", command=self._browse_output).grid(row=5, column=2, padx=(8, 0), sticky="ew")

        ttk.Label(container, text="Password:").grid(row=6, column=0, sticky="w", pady=(12, 4))
        ttk.Entry(container, textvariable=self.password_var, show="*", width=50).grid(row=7, column=0, columnspan=2, sticky="ew")

        ttk.Button(container, text="Run", command=self._run_operation).grid(row=8, column=0, columnspan=3, pady=(16, 8), sticky="ew")

        self.status_var = tk.StringVar(value="")
        ttk.Label(container, textvariable=self.status_var, wraplength=500, foreground="#1565c0").grid(row=9, column=0, columnspan=3, sticky="w")

        container.columnconfigure(0, weight=1)
        container.columnconfigure(1, weight=1)
        container.columnconfigure(2, weight=0)

    def _browse_input(self) -> None:
        path = filedialog.askopenfilename(title="Select file")
        if path:
            self.input_path_var.set(path)
            if not self.output_path_var.get():
                self.output_path_var.set(self._suggest_output_path(path))

    def _browse_output(self) -> None:
        initial = self.output_path_var.get() or self._suggest_output_path(self.input_path_var.get())
        path = filedialog.asksaveasfilename(title="Choose output file", initialfile=os.path.basename(initial), initialdir=os.path.dirname(initial) or None)
        if path:
            self.output_path_var.set(path)

    def _suggest_output_path(self, input_path: str) -> str:
        if not input_path:
            return ""
        if self.mode_var.get() == "encrypt":
            return f"{input_path}.enc"
        if input_path.endswith(".enc"):
            return input_path[:-4]
        return f"{input_path}.decrypted"

    def _run_operation(self) -> None:
        input_path = self.input_path_var.get().strip()
        output_path = self.output_path_var.get().strip()
        password = self.password_var.get()

        if not input_path or not output_path:
            messagebox.showerror("Missing paths", "Please choose an input file and an output file.")
            return

        if not password:
            messagebox.showerror("Missing password", "Please enter a password.")
            return

        try:
            if self.mode_var.get() == "encrypt":
                encrypt_file(input_path, output_path, password)
                self.status_var.set(f"Encrypted and saved to {output_path}")
            else:
                decrypt_file(input_path, output_path, password)
                self.status_var.set(f"Decrypted and saved to {output_path}")
        except Exception as exc:  # pragma: no cover - GUI error handling
            messagebox.showerror("Operation failed", str(exc))
            self.status_var.set("Operation failed")


if __name__ == "__main__":
    app = SecureFileApp()
    app.mainloop()
