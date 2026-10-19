import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime.capture import capture


class CaptureTests(unittest.TestCase):
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

    def test_errors_are_not_successful_returns(self):
        result = capture("def f(x):\n    return 1 / x\nf(0)")
        self.assertEqual(result["status"], "error")
        self.assertIn("ZeroDivisionError", result["error"])
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

    def test_input_validation(self):
        for source in ("import os", "print.__class__", "x=0\n" * 70, "#" * 17000):
            self.assertEqual(capture(source)["status"], "error")

    def test_null_is_not_python_none(self):
        result = capture("print(None)")
        stacks = [e["stack"] for e in result["events"] if "stack" in e]
        self.assertTrue(any(v["kind"] == "null" for s in stacks for v in s))
        self.assertTrue(any(v["kind"] == "object" and v["value"]["type"] == "NoneType" for s in stacks for v in s))


if __name__ == "__main__":
    unittest.main()
