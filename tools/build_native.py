"""Build a disposable, pinned CPython with the xray observation module."""
import argparse
import io
import shutil
import subprocess
import tarfile
from pathlib import Path

from instrument_parser import instrument

ROOT = Path(__file__).resolve().parents[1]


def build(jobs=8):
    revision = (ROOT / "runtime/revision.txt").read_text().strip()
    target = ROOT / ".build/native"
    stamp = target / ".xray-revision"
    if not stamp.exists():
        if target.exists() and any(target.iterdir()):
            raise SystemExit("Unstamped build directory; move it aside before building")
        target.mkdir(parents=True, exist_ok=True)
        archive = subprocess.check_output(["git", "-C", str(ROOT / "cpython"), "archive", revision])
        with tarfile.open(fileobj=io.BytesIO(archive)) as source:
            source.extractall(target, filter="data")
        stamp.write_text(revision + "\n")
    if stamp.read_text().strip() != revision:
        raise SystemExit("Build revision differs; move .build/native aside")
    instrument(target)
    shutil.copy2(ROOT / "runtime/probe.c", target / "Modules/_xray_probe.c")
    (target / "Modules/Setup.local").write_text("*static*\n_xray_probe _xray_probe.c -DPy_BUILD_CORE\n")
    if not (target / "Makefile").exists():
        subprocess.run(["./configure", "--with-pydebug", "--without-ensurepip", "--enable-experimental-jit=no"], cwd=target, check=True)
    subprocess.run(["make", f"-j{jobs}"], cwd=target, check=True)
    print(f"Built {target / 'python.exe'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--jobs", type=int, default=8)
    build(parser.parse_args().jobs)
