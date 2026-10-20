"""Bounded opcode-trace experiment for the pinned instrumented CPython.

This observes actual stacks but tracing alters specialization. It is not an
untrusted-code sandbox, nor a trace of the uninstrumented evaluator.
"""
import ast
import builtins
import contextlib
import dis
import io
import itertools
import json
import sys
import tokenize
import token
import types
import time
from pathlib import Path

FILENAME = "<factory-program>"
ALLOWED = {
    "Module", "Expr", "Constant", "Name", "Load", "Store", "Assign", "AugAssign",
    "FunctionDef", "arguments", "arg", "Return", "Call", "keyword", "If", "For",
    "While", "Break", "Continue", "Pass", "BinOp", "UnaryOp", "BoolOp", "Compare",
    "Add", "Sub", "Mult", "Div", "FloorDiv", "Mod", "USub", "UAdd", "Not", "And",
    "Or", "Eq", "NotEq", "Lt", "LtE", "Gt", "GtE", "Is", "IsNot", "In", "NotIn",
    "List", "Tuple", "Dict", "Subscript", "Slice", "IfExp",
    "Import", "ImportFrom", "alias", "Attribute", "AsyncFunctionDef", "Await",
}
BUILTINS = {name: getattr(builtins, name) for name in ("print", "range", "len", "abs", "min", "max", "int", "float", "str", "bool")}


def import_module(name, globals=None, locals=None, fromlist=(), level=0):
    if name != "asyncio" or level:
        raise ImportError("Only asyncio imports are supported")
    module = builtins.__import__(name, globals, locals, fromlist, level)
    # The worker has no sockets/threads to wake the loop. Keep real asyncio
    # Tasks, Futures and timer scheduling, without the socketpair self-pipe.
    class WorkerLoop(module.SelectorEventLoop):
        def _make_self_pipe(self):
            pass

        def _close_self_pipe(self):
            pass

        def _write_to_self(self):
            pass

    facade = types.ModuleType("asyncio")
    for attr in ("sleep", "gather", "create_task", "wait_for", "current_task",
                 "get_running_loop", "CancelledError", "Task", "Future"):
        setattr(facade, attr, getattr(module, attr))
    def run(coro, *, debug=None):
        return module.run(coro, debug=debug, loop_factory=WorkerLoop if sys.platform == "emscripten" else None)
    facade.run = run
    return facade


BUILTINS["__import__"] = import_module


class CaptureLimit(BaseException):
    pass


class Output(io.StringIO):
    def write(self, value):
        if self.tell() + len(value) > 4096:
            raise CaptureLimit("output limit exceeded")
        return super().write(value)


class Observer:
    def __init__(self, limit, progress=False):
        self.progress = progress
        self.last_progress = -1.0
        self.limit = limit
        self.events = []
        self.objects = {}  # Bounded strong refs prevent object-ID reuse in a run.
        self.frames = {}
        self.pending_exceptions = set()
        self.codes = {}
        self.artifacts = []
        self.output = Output()

    def value(self, obj, depth=0, seen=frozenset()):
        address = id(obj)
        if address not in self.objects:
            if len(self.objects) >= 4096:
                raise CaptureLimit("object identity budget exceeded")
            self.objects[address] = (f"o{len(self.objects)}", obj)
        identity = self.objects[address][0]
        kind = type(obj)
        result = {"id": identity, "type": kind.__name__}
        if obj is None or kind is bool:
            result["value"] = obj
        elif kind is int:
            result["value"] = str(obj) if obj.bit_length() <= 256 else "<large integer>"
        elif kind is float:
            result["value"] = repr(obj)
        elif kind is str:
            result.update(value=obj[:160], length=len(obj))
        elif kind in (list, tuple, dict):
            result["length"] = len(obj)
            if address in seen:
                result["cycle"] = True
            elif depth < 2:
                visited = seen | {address}
                if kind is dict:
                    result["items"] = [[self.value(k, depth + 1, visited), self.value(v, depth + 1, visited)] for k, v in itertools.islice(obj.items(), 8)]
                else:
                    result["items"] = [self.value(v, depth + 1, visited) for v in obj[:8]]
        elif kind is types.FunctionType:
            result["name"] = obj.__name__
        return result

    def code(self, code):
        if code in self.codes:
            return self.codes[code]
        identity = f"c{len(self.codes)}"
        self.codes[code] = identity
        instructions = []
        decoded = list(dis.get_instructions(code, adaptive=False))
        for ins in decoded:
            target = ins.argval if ins.opcode in dis.hasjump else None
            # This revision's evaluator skips END_FOR on iterator exhaustion.
            # Retain dis's encoded target separately for inspection.
            if ins.opname == "FOR_ITER":
                target += 2
            flow = "next"
            if target is not None:
                flow = "jump" if ins.opname in {"JUMP_FORWARD", "JUMP_BACKWARD", "JUMP_BACKWARD_NO_INTERRUPT"} else "branch"
            elif ins.opname in {"RETURN_VALUE", "RETURN_CONST", "RAISE_VARARGS", "RERAISE"}:
                flow = "exit"
            elif ins.opname.startswith("CALL"):
                flow = "call"
            instructions.append({"offset": ins.offset, "opname": ins.opname, "arg": ins.arg,
                                 "argrepr": (f"<code {ins.argval.co_name}>" if type(ins.argval) is types.CodeType else ins.argrepr)[:100],
                                 "target": target, "encoded_target": ins.argval if ins.opcode in dis.hasjump else None,
                                 "flow": flow,
                                 "line": ins.positions.lineno, "column": ins.positions.col_offset,
                                 "end_line": ins.positions.end_lineno, "end_column": ins.positions.end_col_offset})
        self.artifacts.append({"id": identity, "name": code.co_name, "first_line": code.co_firstlineno,
                               "locals": list(code.co_varnames), "instructions": instructions})
        for value in code.co_consts:
            if type(value) is types.CodeType:
                self.code(value)
        return identity

    def trace(self, frame, event, arg):
        if frame.f_code.co_filename != FILENAME:
            return None
        # At the initial call f_trace is not installed yet; setting this again
        # at the first line event enables instruction monitoring in 3.16.
        if self.progress and event == "line":
            now = time.monotonic()
            if now - self.last_progress >= 1 / 30:
                self.last_progress = now
                print("@factory-line:" + str(frame.f_lineno), file=sys.__stderr__, flush=True)
        frame.f_trace_opcodes = True
        if event == "call":
            # This revision enables opcode instrumentation at the next legacy
            # event. Keep line events enabled, but omit them from the recording.
            frame.f_trace_lines = True
            resumed = frame in self.frames
            if not resumed and len(self.frames) >= 256:
                raise CaptureLimit("activation budget exceeded")
            if not resumed:
                self.frames[frame] = f"f{len(self.frames)}"
        if event not in ("call", "opcode", "return", "exception"):
            return self.trace
        if len(self.events) >= self.limit:
            raise CaptureLimit("event budget exceeded")
        from _factory_probe import snapshot
        record = {"seq": len(self.events), "kind": event, "frame": self.frames[frame],
                  "parent": self.frames.get(frame.f_back), "code": self.codes[frame.f_code],
                  "offset": frame.f_lasti, "line": frame.f_lineno,
                  "locals": {name: self.value(value) for name, value in frame.f_locals.items() if name != "__builtins__"},
                  "stdout": self.output.getvalue()}
        if event == "opcode":
            self.pending_exceptions.discard(frame)
            record["stack"] = [{"kind": kind, "value": self.value(value) if kind == "object" else value}
                               for kind, value in snapshot(frame)]
        if event == "call" and resumed:
            record["kind"] = "resume"
        if event == "return":
            opname = next((i["opname"] for c in self.artifacts if c["id"] == record["code"]
                           for i in c["instructions"] if i["offset"] == frame.f_lasti), "")
            if opname == "YIELD_VALUE":
                record["kind"] = "suspend"
                record["result"] = self.value(arg)
            elif frame in self.pending_exceptions:
                record["kind"] = "unwind"
            else:
                record["result"] = self.value(arg)
        elif event == "exception":
            self.pending_exceptions.add(frame)
            record["exception"] = arg[0].__name__
        self.events.append(record)
        return self.trace


def capture(source, max_events=2000, progress=False, compile_only=False):
    if not 1 <= max_events <= 10000:
        raise ValueError("max_events must be between 1 and 10000")
    observer = Observer(max_events, progress)
    result = {"schema": 2, "source": source, "events": observer.events, "codes": observer.artifacts,
              "provenance": {"python": sys.version, "revision": "036d309cf542986a39eeba5ca805b2ec7619731d",
                             "mode": "opcode-tracing", "specialization": "perturbed", "stack": "observed-pre-instruction"}}
    try:
        if len(source.encode("utf-8")) > 16384:
            raise ValueError("source exceeds 16 KiB")
        ignored = {tokenize.ENCODING, tokenize.ENDMARKER, tokenize.COMMENT, tokenize.NL,
                   tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT}
        try:
            tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
        except (tokenize.TokenError, IndentationError):
            # Let the real parser produce its diagnostic and observable failure.
            tokens = []
        if sum(t.type not in ignored for t in tokens) > 200:
            raise ValueError("source exceeds 200 Python tokens")
        from _factory_probe import parse_begin, parse_end, ast_id
        parse_begin()
        try:
            tree = ast.parse(source, FILENAME)
        finally:
            parsing = parse_end()
            for event in parsing["events"]:
                if event["kind"] == 2:
                    event["token"] = token.tok_name.get(event["end"], str(event["end"]))
            result["parsing"] = parsing
        nodes = []
        def record_ast(node, parent=None):
            if isinstance(node, (ast.operator, ast.unaryop, ast.boolop, ast.cmpop, ast.expr_context)):
                return
            identity = len(nodes)
            nodes.append({"id": identity, "parent": parent, "kind": type(node).__name__,
                          "line": getattr(node, "lineno", None), "created": ast_id(node),
                          "operator": type(node.op).__name__ if hasattr(node, "op") else "",
                          "label": str(getattr(node, "id", getattr(node, "name", getattr(node, "value", ""))))[:80]})
            for child in ast.iter_child_nodes(node):
                record_ast(child, identity)
        record_ast(tree)
        parsing["ast"] = nodes
        retained = {node["created"]: node["id"] for node in nodes if node["created"] is not None}
        for seq, event in enumerate(parsing["events"]):
            if event["kind"] == 3:
                event["node"] = retained.get(seq)
                event["retained"] = seq in retained
        for node in ast.walk(tree):
            if type(node).__name__ not in ALLOWED:
                raise ValueError(f"unsupported construct: {type(node).__name__}")
            if isinstance(node, ast.Name) and node.id.startswith("__"):
                raise ValueError("dunder names are not supported")
            if isinstance(node, ast.Import) and any(alias.name != "asyncio" for alias in node.names):
                raise ValueError("Only asyncio imports are supported")
            if isinstance(node, ast.ImportFrom) and (node.module != "asyncio" or node.level or any(alias.name.startswith("_") for alias in node.names)):
                raise ValueError("Only public asyncio imports are supported")
            if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
                raise ValueError("private attributes are not supported")
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and (node.decorator_list or node.returns):
                raise ValueError("decorators and annotations are not supported")
            if isinstance(node, ast.arg) and node.annotation:
                raise ValueError("annotations are not supported")
        code = compile(tree, FILENAME, "exec")
        observer.code(code)
        if compile_only:
            result["status"] = "compiled"
        else:
            previous = sys.gettrace()
            try:
                with contextlib.redirect_stdout(observer.output):
                    sys.settrace(observer.trace)
                    exec(code, {"__builtins__": dict(BUILTINS)})
            finally:
                sys.settrace(previous)
            result["status"] = "completed"
    except CaptureLimit as exc:
        result.update(status="limited", error=str(exc))
    except Exception as exc:
        result.update(status="error", error=f"{type(exc).__name__}: {exc}")
    result["stdout"] = observer.output.getvalue()
    # Release retained frames/objects after serialization; never keep them between runs.
    observer.frames.clear()
    observer.pending_exceptions.clear()
    observer.objects.clear()
    return result


if __name__ == "__main__":
    source = Path(sys.argv[1]).read_text() if len(sys.argv) > 1 else sys.stdin.read(16385)
    print(json.dumps(capture(source, progress="--progress" in sys.argv[2:], compile_only="--compile-only" in sys.argv[2:]), ensure_ascii=True))
