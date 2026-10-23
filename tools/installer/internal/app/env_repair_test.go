package app

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"alfheim/installer/internal/shared/envfile"
	"alfheim/installer/internal/shared/paths"
)

func TestPlanEnvRepairs(t *testing.T) {
	with := func(kv map[string]string) map[string]string {
		out := map[string]string{"S3_ROOT_USER": "alfheim", "S3_ROOT_PASSWORD": "rootpw", "DOCKER_SOCKET_GID": "133"}
		for k, v := range kv {
			out[k] = v
		}
		return out
	}
	tests := []struct {
		name         string
		env          map[string]string
		wantRepairs  map[string]string
		wantWarnings int
	}{
		{"already correct", with(map[string]string{
			"S3_ENDPOINT": "http://rustfs:9000", "S3_ENDPOINT_URL": "http://rustfs:9000",
			"S3_ACCESS_KEY": "alfheim", "S3_SECRET_KEY": "rootpw"}), nil, 0},
		{"legacy endpoints", with(map[string]string{
			"S3_ENDPOINT": "http://minio:9000", "S3_ENDPOINT_URL": "http://minio:9000",
			"S3_ACCESS_KEY": "alfheim", "S3_SECRET_KEY": "rootpw"}),
			map[string]string{"S3_ENDPOINT": "http://rustfs:9000", "S3_ENDPOINT_URL": "http://rustfs:9000"}, 0},
		{"custom endpoint untouched", with(map[string]string{
			"S3_ENDPOINT": "https://s3.example.com", "S3_ACCESS_KEY": "alfheim", "S3_SECRET_KEY": "rootpw"}), nil, 0},
		{"empty credentials filled", with(nil),
			map[string]string{"S3_ACCESS_KEY": "alfheim", "S3_SECRET_KEY": "rootpw"}, 0},
		{"custom credentials kept with warning", with(map[string]string{
			"S3_ACCESS_KEY": "svc", "S3_SECRET_KEY": "other"}), nil, 2},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repairs, warnings := planEnvRepairs(tc.env, func() (string, error) { return "998", nil })
			got := map[string]string{}
			for _, r := range repairs {
				got[r.key] = r.to
			}
			if len(got) != len(tc.wantRepairs) {
				t.Fatalf("repairs = %v, want %v", got, tc.wantRepairs)
			}
			for k, v := range tc.wantRepairs {
				if got[k] != v {
					t.Errorf("%s = %q, want %q", k, got[k], v)
				}
			}
			if len(warnings) != tc.wantWarnings {
				t.Errorf("warnings = %v, want %d", warnings, tc.wantWarnings)
			}
		})
	}
}

func TestPlanEnvRepairs_DockerSocketGID(t *testing.T) {
	found := func() (string, error) { return "998", nil }
	failing := func() (string, error) { return "", errors.New("no socket") }

	repairs, warnings := planEnvRepairs(map[string]string{}, found)
	if len(repairs) != 1 || repairs[0].key != "DOCKER_SOCKET_GID" || repairs[0].to != "998" || len(warnings) != 0 {
		t.Errorf("missing value: repairs=%v warnings=%v", repairs, warnings)
	}

	repairs, _ = planEnvRepairs(map[string]string{"DOCKER_SOCKET_GID": ""}, found)
	if len(repairs) != 1 {
		t.Errorf("empty value must be filled, got %v", repairs)
	}

	repairs, warnings = planEnvRepairs(map[string]string{"DOCKER_SOCKET_GID": "133"}, failing)
	if len(repairs) != 0 || len(warnings) != 0 {
		t.Errorf("an existing value must be left alone: repairs=%v warnings=%v", repairs, warnings)
	}

	repairs, warnings = planEnvRepairs(map[string]string{}, failing)
	if len(repairs) != 0 || len(warnings) != 1 {
		t.Errorf("failed detection: repairs=%v warnings=%v, want one warning", repairs, warnings)
	}
}

func TestRepairEnvFile(t *testing.T) {
	dir := t.TempDir()
	layout, err := paths.New(dir)
	if err != nil {
		t.Fatal(err)
	}
	content := "S3_ROOT_USER=alfheim\nS3_ROOT_PASSWORD=rootpw\nS3_ACCESS_KEY=alfheim\nS3_SECRET_KEY=rootpw\n" +
		"S3_ENDPOINT_URL=http://minio:9000\nS3_ENDPOINT=http://minio:9000\nOTHER=keep\nDOCKER_SOCKET_GID=133\n"
	if err := os.WriteFile(layout.EnvFile(), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	env, _ := envfile.ParseFile(layout.EnvFile())
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	detect := func() (string, error) { return "998", nil }

	var out bytes.Buffer
	if _, err := repairEnvFile(&out, layout, env, now, detect); err != nil {
		t.Fatal(err)
	}

	after, _ := envfile.ParseFile(layout.EnvFile())
	if after["S3_ENDPOINT_URL"] != "http://rustfs:9000" || after["S3_ENDPOINT"] != "http://rustfs:9000" ||
		after["OTHER"] != "keep" {
		t.Errorf("env after repair = %v", after)
	}
	info, _ := os.Stat(layout.EnvFile())
	if info.Mode().Perm() != 0o600 {
		t.Errorf("mode = %v, want 0600", info.Mode().Perm())
	}
	backup, err := os.ReadFile(filepath.Join(layout.Root, ".alfheim-backups", "20260102T030405Z", ".env"))
	if err != nil || string(backup) != content {
		t.Errorf("backup missing or different: %v", err)
	}
	if !strings.Contains(out.String(), "S3_ENDPOINT_URL") {
		t.Errorf("repair was not logged: %q", out.String())
	}

	// Second run: nothing to do, no new backup.
	out.Reset()
	again, _ := envfile.ParseFile(layout.EnvFile())
	if _, err := repairEnvFile(&out, layout, again, now.Add(time.Hour), detect); err != nil {
		t.Fatal(err)
	}
	if out.Len() != 0 {
		t.Errorf("second run logged %q", out.String())
	}
	if _, err := os.Stat(filepath.Join(layout.Root, ".alfheim-backups", "20260102T040405Z")); err == nil {
		t.Error("an idempotent run must not create a backup")
	}
}
