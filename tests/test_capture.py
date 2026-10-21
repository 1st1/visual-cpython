import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime.capture import capture


class CaptureTests(unittest.TestCase):
    def test_compile_only_does_not_execute(self):
        source = "def f():\n    return 3\nprint(f())\nwhile True:\n    pass"
        result = capture(source, compile_only=True)
        self.assertEqual(result["status"], "compiled")
        self.assertEqual(result["events"], [])
        self.assertEqual(result["stdout"], "")
        self.assertEqual([c["name"] for c in result["codes"]], ["<module>", "f"])
        self.assertTrue(result["parsing"]["ast"])
        self.assertTrue(all(c["instructions"] for c in result["codes"]))
        self.assertEqual(capture("print(3)", compile_only=True)["stdout"], "")
        self.assertEqual(capture("print(3)")["stdout"], "3\n")
        self.assertEqual(capture("x = (", compile_only=True)["status"], "error")

    def test_parser_budget_keeps_compilation_working(self):
        import ast
        from _xray_probe import parse_begin, parse_end
        parse_begin()
        try:
            tree = ast.parse("\n".join("x=1" for _ in range(300)))
        finally:
            trace = parse_end()
        self.assertEqual(len(tree.body), 300)
        self.assertEqual(len(trace["events"]), 24000)
        self.assertGreater(trace["dropped"], 0)
        self.assertEqual(capture("print(7)")["stdout"], "7\n")

    def test_ast_constructor_identity_and_order(self):
        result = capture("x = 1 + 2\nprint(x)")
        parsing = result["parsing"]
        nodes, events = parsing["ast"], parsing["events"]
        self.assertTrue(all(n["created"] is not None for n in nodes))
        for node in nodes:
            event = events[node["created"]]
            self.assertEqual(event["kind"], 3)
            self.assertEqual(event["node"], node["id"])
            self.assertEqual(event["text"], node["kind"])
            self.assertTrue(event["retained"])
            if node["parent"] is not None:
                self.assertLess(node["created"], nodes[node["parent"]]["created"])
        binary = next(n for n in nodes if n["kind"] == "BinOp")
        event = events[binary["created"]]
        self.assertEqual((event["line"], event["column"], event["end_column"]), (1, 4, 9))
        self.assertTrue(any(e["kind"] == 3 and not e["retained"] for e in events))

    def test_real_parser_observation(self):
        result = capture("def f(x):\n    return x+1\nprint(f(2))")
        parsing = result["parsing"]
        events = parsing["events"]
        tokens = [e for e in events if e["kind"] == 2]
        self.assertEqual([e["cursor"] for e in tokens], list(range(len(tokens))))
        self.assertIn("INDENT", [e["token"] for e in tokens])
        self.assertIn("DEDENT", [e["token"] for e in tokens])
        self.assertTrue(any(e["kind"] == 1 and e["cursor"] > e["end"] for e in events))
        self.assertTrue(any(e["kind"] == 0 and "succeeded" in e["text"] for e in events))
        self.assertEqual(parsing["ast"][0]["kind"], "Module")
        self.assertEqual(parsing["dropped"], 0)
        failure = capture("x = (")
        self.assertEqual(failure["status"], "error")
        self.assertTrue(failure["parsing"]["events"])
        self.assertNotIn("ast", failure["parsing"])
        fresh = capture("x=1")["parsing"]
        self.assertEqual(fresh["events"][0]["cursor"], 0)
        self.assertLess(len(fresh["events"]), len(events))


    def test_observed_addition_stack(self):
        result = capture("a = 2\nb = 3\nc = a + b\nprint(c)")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["stdout"], "5\n")
        ops = {i["offset"]: i["opname"] for i in result["codes"][0]["instructions"]}
        additions = [e for e in result["events"] if e["kind"] == "opcode" and ops[e["offset"]] == "BINARY_OP"]
        self.assertEqual(len(additions), 1)
        self.assertEqual([v["value"]["value"] for v in additions[0]["stack"]], ["2", "3"])
        next_event = result["events"][additions[0]["seq"] + 1]
        self.assertEqual(next_event["stack"][-1]["value"]["value"], "5")

    def test_calls_have_distinct_activations_shared_code(self):
        result = capture("def f(x):\n    return x + 1\nprint(f(1), f(2))")
        self.assertEqual(result["stdout"], "2 3\n")
        calls = [e for e in result["events"] if e["kind"] == "call" and e["parent"]]
        self.assertEqual(len(calls), 2)
        self.assertNotEqual(calls[0]["frame"], calls[1]["frame"])
        self.assertEqual(calls[0]["code"], calls[1]["code"])

    def test_alias_and_cycle_preview(self):
        result = capture("a = [None]\nb = a\na[0] = a\nprint(len(b))")
        event = result["events"][-1]
        self.assertEqual(event["locals"]["a"]["id"], event["locals"]["b"]["id"])
        self.assertTrue(event["locals"]["a"]["items"][0]["cycle"])

    def test_loop_has_repeated_offsets(self):
        result = capture("s = 0\nfor i in range(4):\n    s = s + i\nprint(s)")
        self.assertEqual(result["stdout"], "6\n")
        offsets = [e["offset"] for e in result["events"] if e["kind"] == "opcode"]
        self.assertGreater(len(offsets), len(set(offsets)))

    # @lat: [[runtime#Capture runtime#Shared program limits]]
    def test_shared_program_limits(self):
        source = "x=1\n" * 85 + "pass\n"
        result = capture(source, validate_only=True)
        self.assertEqual(result, {"status": "validated", "tokens": 256})
        self.assertEqual(capture(source, compile_only=True)["status"], "compiled")
        for suffix in ("pass\n", "pass\n("):
            for options in ({"validate_only": True}, {"compile_only": True}):
                self.assertIn("256 Python tokens", capture(source + suffix, **options)["error"])
        self.assertIn("16 KiB", capture("#" * 16385, validate_only=True)["error"])
        self.assertEqual(capture("while True: pass", validate_only=True)["status"], "validated")

    def test_errors_are_not_successful_returns(self):
        result = capture("def f(x):\n    return 1 / x\nprint(7)\nf(0)")
        self.assertEqual(result["status"], "error")
        self.assertIn("ZeroDivisionError", result["error"])
        self.assertEqual(result["stdout"], "7\n")
        self.assertIn("ZeroDivisionError", result["stderr"])
        self.assertEqual(result["events"][-1]["stderr"], "")
        self.assertTrue(any(e["kind"] == "exception" for e in result["events"]))
        self.assertEqual(result["events"][-1]["kind"], "unwind")
        syntax = capture("if")
        self.assertEqual(syntax["events"], [])
        self.assertIn("SyntaxError", syntax["error"])

    def test_limits_and_fresh_runs(self):
        result = capture("while True:\n    pass", max_events=30)
        self.assertEqual(result["status"], "limited")
        self.assertEqual(len(result["events"]), 30)
        self.assertEqual(capture("print(7)")["stdout"], "7\n")
        self.assertIsNone(sys.gettrace())
        self.assertEqual(capture("print('a' * 5000)")["status"], "limited")

    def test_asyncio_suspend_resume(self):
        result = capture("import asyncio\nasync def foo():\n await asyncio.sleep(0.01)\n await asyncio.sleep(0)\n print(1)\nasyncio.run(foo())")
        self.assertEqual(result["status"], "completed", result.get("error"))
        self.assertEqual(result["stdout"], "1\n")
        suspended = [e for e in result["events"] if e["kind"] == "suspend"]
        resumed = [e for e in result["events"] if e["kind"] == "resume"]
        self.assertEqual(len(suspended), 2)
        self.assertEqual([e["frame"] for e in suspended], [e["frame"] for e in resumed])
        self.assertEqual(len(set(e["frame"] for e in suspended)), 1)
        self.assertIsNone(sys.gettrace())

    def test_standard_library_and_diagnostics(self):
        source = 'import time, math, json, sys\nfrom collections import Counter\ntime.sleep(.001)\nprint(math.sqrt(9), json.dumps([1]), Counter("aba")["a"])\nprint("err", file=sys.stderr)'
        result = capture(source)
        self.assertEqual(result["status"], "completed", result.get("error"))
        self.assertEqual(result["stdout"], "3.0 [1] 2\n")
        self.assertEqual(result["stderr"], "err\n")
        for source in ("if", "import third_party_module", "x=1\nprint.__class__"):
            result = capture(source, compile_only=True)
            self.assertEqual(result["status"], "error")
            self.assertGreater(result["error_location"]["line"], 0)
            self.assertEqual(result["stderr"], "")

    def test_input_validation(self):
        for source in ("import third_party_module", "print.__class__", "x=0\n" * 86, "#" * 17000):
            self.assertEqual(capture(source)["status"], "error")

    def test_null_is_not_python_none(self):
        result = capture("print(None)")
        stacks = [e["stack"] for e in result["events"] if "stack" in e]
        self.assertTrue(any(v["kind"] == "null" for s in stacks for v in s))
        self.assertTrue(any(v["kind"] == "object" and v["value"]["type"] == "NoneType" for s in stacks for v in s))


if __name__ == "__main__":
    unittest.main()
