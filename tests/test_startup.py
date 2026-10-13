"""Startup contract checks without requiring a Docker daemon."""
import os
from pathlib import Path
import shutil
import time
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[1]


class StartupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for filename in ('run.sh', '.env.example'):
            shutil.copy(REPO / filename, self.root / filename)
        bindir = self.root / 'bin'
        bindir.mkdir()
        self.docker = bindir / 'docker'
        self.docker.write_text('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$MOCK_LOG"
case "$*" in
  'compose watch --help') echo --no-up;;
  'compose up '*) exit "${MOCK_START_EXIT:-0}";;
  'compose cp '*) touch "${@: -1}";;
  'compose watch --no-up') if [[ ${MOCK_LONG_WATCH:-0} == 1 ]]; then exec sleep 30; fi; exit 0;;
esac
''')
        self.docker.chmod(0o755)
        self.environment = {
            **os.environ,
            'PATH': str(bindir) + ':' + os.environ['PATH'],
            'MOCK_LOG': str(self.root / 'calls'),
        }

    def run_script(self):
        return subprocess.run(['bash', str(self.root / 'run.sh')], cwd='/tmp',
                              env=self.environment, capture_output=True, text=True, timeout=10)

    def test_fresh_start_and_existing_configuration(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        content = (self.root / '.env').read_text()
        self.assertNotIn('REPLACE_WITH_LOCAL_PASSWORD', content)
        values = dict(line.split('=', 1) for line in content.splitlines())
        self.assertIn(values['POSTGRES_PASSWORD'], values['API_DATABASE_URL'])
        self.assertEqual((self.root / '.env').stat().st_mode & 0o777, 0o600)
        self.assertTrue((self.root / '.local/certs/root.crt').exists())
        calls = (self.root / 'calls').read_text()
        self.assertIn('compose up --build --wait --wait-timeout 180', calls)
        self.assertTrue(calls.rstrip().endswith('compose stop'))
        self.assertEqual(self.run_script().returncode, 0)
        self.assertEqual((self.root / '.env').read_text(), content)

    def test_failed_start_stops_partial_stack(self):
        self.environment['MOCK_START_EXIT'] = '1'
        self.assertNotEqual(self.run_script().returncode, 0)
        self.assertTrue((self.root / 'calls').read_text().rstrip().endswith('compose stop'))
        self.assertFalse((self.root / '.local/certs/root.crt').exists())

    def test_termination_stops_watcher_and_services(self):
        self.environment['MOCK_LONG_WATCH'] = '1'
        process = subprocess.Popen(['bash', str(self.root / 'run.sh')], cwd='/tmp',
                                   env=self.environment, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL)
        try:
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                calls = self.root / 'calls'
                if calls.exists() and 'compose watch --no-up' in calls.read_text():
                    break
                time.sleep(0.05)
            else:
                self.fail('watcher did not start')
            process.terminate()
            self.assertEqual(process.wait(timeout=5), 143)
            self.assertTrue((self.root / 'calls').read_text().rstrip().endswith('compose stop'))
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()

    def test_missing_compose_explains_failure_before_configuration(self):
        self.docker.write_text('#!/usr/bin/env bash\nexit 1\n')
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Docker Compose is required', result.stderr)
        self.assertFalse((self.root / '.env').exists())


if __name__ == '__main__':
    unittest.main()
