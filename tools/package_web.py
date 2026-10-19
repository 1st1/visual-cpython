"""Stage generated WASM assets and the capture script for the browser harness."""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def package():
    output = ROOT / "web/vendor"
    output.mkdir(exist_ok=True)
    for name in ("python.mjs", "python.wasm", "python3.16.zip"):
        shutil.copy2(ROOT / ".build/wasm" / name, output / name)
    shutil.copy2(ROOT / "runtime/capture.py", output / "capture.py")
    print("Staged runtime in web/vendor")


if __name__ == "__main__":
    package()
