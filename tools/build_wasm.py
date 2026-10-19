"""Build the pinned observation runtime with the CPython-pinned Emscripten SDK."""
import io
import shutil
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build():
    sdk = ROOT / ".build/emsdk/6.0.10/emsdk"
    if not (sdk / "emsdk_env.sh").exists():
        raise SystemExit("Install SDK: python3 cpython/Platforms/emscripten install-emscripten --emsdk-cache .build/emsdk")
    env_text = subprocess.check_output(["bash", "-c", 'source "$1" >/dev/null 2>&1 && env -0', "bash", str(sdk / "emsdk_env.sh")])
    env = dict(part.decode().split("=", 1) for part in env_text.split(b"\0") if part)
    source = ROOT / ".build/wasm-source"
    revision = (ROOT / "runtime/revision.txt").read_text().strip()
    if not source.exists():
        source.mkdir(parents=True)
        archive = subprocess.check_output(["git", "-C", str(ROOT / "cpython"), "archive", revision])
        with tarfile.open(fileobj=io.BytesIO(archive)) as files:
            files.extractall(source, filter="data")
        (source / ".factory-revision").write_text(revision)
    if (source / ".factory-revision").read_text() != revision:
        raise SystemExit("WASM source revision mismatch")
    shutil.copy2(ROOT / "runtime/probe.c", source / "Modules/_factory_probe.c")
    output = ROOT / ".build/wasm"
    output.mkdir(exist_ok=True)
    (output / "Modules").mkdir(exist_ok=True)
    (output / "Modules/Setup.local").write_text("*static*\n_factory_probe _factory_probe.c -DPy_BUILD_CORE\n")
    native = ROOT / ".build/native/python.exe"
    if not native.exists():
        native = ROOT / ".build/native/python"
    env.update(CONFIG_SITE=str(source / "Platforms/emscripten/config.site-wasm32-emscripten"),
               HOSTRUNNER=shutil.which("node"), PKG_CONFIG_LIBDIR="")
    if not (output / "Makefile").exists():
        machine = subprocess.check_output([str(source / "config.guess")], text=True).strip()
        subprocess.run(["emconfigure", str(source / "configure"), "--host=wasm32-emscripten", f"--build={machine}",
                        f"--with-build-python={native}", "--with-pydebug", "--without-ensurepip",
                        "--disable-shared", "--enable-wasm-dynamic-linking", "--without-pymalloc",
                        "--disable-test-modules", "--enable-experimental-jit=no",
                        "CFLAGS=-DPY_CALL_TRAMPOLINE -sUSE_ZLIB", "LDFLAGS=-sMAXIMUM_MEMORY=268435456"],
                       env=env, cwd=output, check=True)
    subprocess.run(["make", "-j8", "all"], cwd=output, env=env, check=True)
    print(f"Built browser runtime in {output}")


if __name__ == "__main__":
    build()
