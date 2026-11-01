"""Startup contract checks without requiring a Docker daemon."""
import os
import pty
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
        for filename in ('run.sh', 'clean', '.env.example'):
            shutil.copy(REPO / filename, self.root / filename)
        bindir = self.root / 'bin'
        bindir.mkdir()
        self.docker = bindir / 'docker'
        self.docker.write_text('''#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$MOCK_LOG"
case "$*" in
  'compose version --short') echo "${MOCK_COMPOSE_VERSION:-v5.6.0}";;
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

    def run_script(self, *arguments, script='run.sh'):
        return subprocess.run(['bash', str(self.root / script), *arguments], cwd='/tmp',
                              env=self.environment, capture_output=True, text=True, timeout=10)

    def test_detached_start_keeps_services_running_without_watcher(self):
        result = self.run_script('--detach')
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = (self.root / 'calls').read_text()
        self.assertIn('compose up --build --wait', calls)
        self.assertNotIn('compose stop', calls)
        self.assertNotIn('compose watch', calls)
        self.assertTrue((self.root / '.local/certs/root.crt').exists())

    def test_default_returns_from_terminal_without_input(self):
        self.environment['MOCK_LONG_WATCH'] = '1'
        terminal, slave = pty.openpty()
        process = subprocess.Popen(['bash', str(self.root / 'run.sh')], cwd='/tmp',
                                   env=self.environment, stdin=slave,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.close(slave)
        try:
            self.assertEqual(process.wait(timeout=5), 0)
            calls = (self.root / 'calls').read_text()
            self.assertNotIn('compose stop', calls)
            self.assertNotIn('compose watch', calls)
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
            os.close(terminal)

    def test_help_and_invalid_options_do_not_touch_docker(self):
        for script in ('run.sh', 'clean'):
            self.assertEqual(self.run_script('--help', script=script).returncode, 0)
            self.assertEqual(self.run_script('--invalid', script=script).returncode, 2)
        self.assertFalse((self.root / 'calls').exists())

    def test_clean_removes_artifacts_and_preserves_source_and_configuration(self):
        (self.root / '.env').write_text('preserved')
        artifacts = ('apps/api/node_modules', 'apps/web/dist',
                     'apps/api/src/generated/prisma', '.local/certs')
        for artifact in artifacts:
            directory = self.root / artifact
            directory.mkdir(parents=True)
            (directory / 'artifact').touch()
        source = self.root / 'apps/api/src/main.ts'
        source.write_text('source')
        result = self.run_script(script='clean')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('compose down --remove-orphans --rmi all --volumes',
                      (self.root / 'calls').read_text())
        for artifact in artifacts:
            self.assertFalse((self.root / artifact).exists())
        self.assertEqual(source.read_text(), 'source')
        self.assertEqual((self.root / '.env').read_text(), 'preserved')
        self.assertNotIn('builder prune', (self.root / 'calls').read_text())

    def test_clean_keep_data_and_explicit_cache_cleanup(self):
        (self.root / 'apps/api').mkdir(parents=True)
        (self.root / 'apps/web').mkdir(parents=True)
        certificate = self.root / '.local/certs/root.crt'
        certificate.parent.mkdir(parents=True)
        certificate.touch()
        result = self.run_script('--keep-data', '--docker-cache', script='clean')
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = (self.root / 'calls').read_text()
        self.assertNotIn('--volumes', calls)
        self.assertIn('builder prune --all --force', calls)
        self.assertTrue(certificate.exists())

    def test_fresh_start_and_existing_configuration(self):
        result = self.run_script('--watch')
        self.assertEqual(result.returncode, 0, result.stderr)
        content = (self.root / '.env').read_text()
        self.assertNotIn('REPLACE_WITH_LOCAL_PASSWORD', content)
        values = dict(line.split('=', 1) for line in content.splitlines() if '=' in line and not line.lstrip().startswith('#'))
        self.assertIn(values['POSTGRES_PASSWORD'], values['API_DATABASE_URL'])
        self.assertEqual(len(values['JWT_SECRET']), 96)
        self.assertNotIn('REPLACE_WITH', values['JWT_SECRET'])
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
        process = subprocess.Popen(['bash', str(self.root / 'run.sh'), '--watch'], cwd='/tmp',
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

    def test_rejects_compose_versions_without_initial_sync(self):
        for version in ('v1.29.2', 'v2.29.7', 'v2.31.0'):
            with self.subTest(version=version):
                self.environment['MOCK_COMPOSE_VERSION'] = version
                result = self.run_script()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('2.32 or newer is required', result.stderr)
                self.assertFalse((self.root / '.env').exists())
                self.assertNotIn('compose up ', (self.root / 'calls').read_text())

    def test_accepts_minimum_and_newer_compose_versions(self):
        for version in ('v2.32.0', '2.40.0', 'v5.6.0'):
            with self.subTest(version=version):
                self.environment['MOCK_COMPOSE_VERSION'] = version
                result = self.run_script()
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_compose_explains_failure_before_configuration(self):
        self.docker.write_text('#!/usr/bin/env bash\nexit 1\n')
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Docker Compose is required', result.stderr)
        self.assertFalse((self.root / '.env').exists())


if __name__ == '__main__':
    unittest.main()
