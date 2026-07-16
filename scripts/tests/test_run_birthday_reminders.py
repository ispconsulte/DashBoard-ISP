import importlib.util
import io
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError


SCRIPT = Path(__file__).resolve().parents[1] / "run_birthday_reminders.py"
SPEC = importlib.util.spec_from_file_location("run_birthday_reminders", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


class BirthdaySchedulerTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {"SUPABASE_SERVICE_ROLE_KEY": "test-only"})
        self.environment.start()

    def tearDown(self):
        self.environment.stop()

    @patch.object(MODULE.time, "sleep")
    @patch.object(MODULE, "urlopen")
    def test_retries_transient_failure_without_changing_payload(self, urlopen, _sleep):
        urlopen.side_effect = [
            URLError("temporário"),
            FakeResponse({"ok": True, "status": "noop"}),
        ]
        result = MODULE.invoke({"action": "scheduled"})
        self.assertTrue(result["ok"])
        self.assertEqual(urlopen.call_count, 2)
        request = urlopen.call_args_list[-1].args[0]
        self.assertEqual(json.loads(request.data.decode("utf-8")), {"action": "scheduled"})

    @patch.object(MODULE.time, "sleep")
    @patch.object(MODULE, "urlopen")
    def test_does_not_retry_permission_failure(self, urlopen, _sleep):
        urlopen.side_effect = HTTPError("url", 403, "Forbidden", {}, io.BytesIO(b'{"error":"Forbidden"}'))
        with self.assertRaises(RuntimeError):
            MODULE.invoke({"action": "scheduled"})
        self.assertEqual(urlopen.call_count, 1)


if __name__ == "__main__":
    unittest.main()
