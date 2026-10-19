"""Run the native capture experiment with a parent-enforced wall-clock timeout."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(path, timeout=5):
    interpreter = ROOT / ".build/native/python.exe"
    if not interpreter.exists():
        interpreter = ROOT / ".build/native/python"
    try:
        completed = subprocess.run([str(interpreter), "-I", str(ROOT / "runtime/capture.py"), str(path.resolve())],
                                   capture_output=True, text=True, timeout=timeout, check=True)
        return json.loads(completed.stdout)
    except subprocess.TimeoutExpired:
        return {"schema": 1, "status": "timeout", "events": [], "error": "capture worker exceeded wall-clock budget"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--timeout", type=float, default=5)
    args = parser.parse_args()
    content = json.dumps(run(args.source, args.timeout), indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content + "\n")
    else:
        print(content)
