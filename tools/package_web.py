"""Stage generated WASM assets and the capture script for the browser harness."""
import shutil
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def package():
    output = ROOT / "web/vendor"
    output.mkdir(exist_ok=True)
    for name in ("python.mjs", "python.wasm", "python3.16.zip"):
        shutil.copy2(ROOT / ".build/wasm" / name, output / name)
    shutil.copy2(ROOT / "runtime/capture.py", output / "capture.py")
    shutil.copy2(ROOT / "node_modules/@viz-js/viz/dist/viz.js", output / "viz.js")
    for name in ("three.module.js", "three.core.js"):
        shutil.copy2(ROOT / "node_modules/three/build" / name, output / name)
    shutil.copy2(ROOT / "node_modules/three/examples/jsm/controls/OrbitControls.js", output / "OrbitControls.js")
    shutil.copy2(ROOT / "node_modules/three/LICENSE", output / "three-LICENSE.txt")
    digest = hashlib.sha256()
    for name in ("python.mjs", "python.wasm", "python3.16.zip", "capture.py"):
        digest.update(name.encode())
        digest.update((output / name).read_bytes())
    manifest = output / "runtime.json.tmp"
    manifest.write_text(json.dumps({"version": digest.hexdigest()}))
    manifest.replace(output / "runtime.json")
    print("Staged runtime in web/vendor")


if __name__ == "__main__":
    package()
