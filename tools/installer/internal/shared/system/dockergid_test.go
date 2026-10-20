package system

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

// fakeInfo is an os.FileInfo whose owner is set explicitly.
type fakeInfo struct{ sys any }

func (fakeInfo) Name() string       { return "docker.sock" }
func (fakeInfo) Size() int64        { return 0 }
func (fakeInfo) Mode() fs.FileMode  { return 0o660 }
func (fakeInfo) ModTime() time.Time { return time.Time{} }
func (fakeInfo) IsDir() bool        { return false }
func (f fakeInfo) Sys() any         { return f.sys }

func writeGroupFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "group")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestDockerSocketGID(t *testing.T) {
	groups := writeGroupFile(t, "root:x:0:\nstaff:x:20:\ndocker:x:998:alice\n")
	missing := errors.New("no such file")

	tests := []struct {
		name    string
		stat    StatFunc
		group   string
		want    string
		wantErr bool
	}{
		{"socket owner wins", func(string) (os.FileInfo, error) {
			return fakeInfo{sys: &syscall.Stat_t{Gid: 133}}, nil
		}, groups, "133", false},
		{"missing socket falls back to docker group", func(string) (os.FileInfo, error) {
			return nil, missing
		}, groups, "998", false},
		{"owner unavailable falls back to docker group", func(string) (os.FileInfo, error) {
			return fakeInfo{sys: nil}, nil
		}, groups, "998", false},
		{"nothing available", func(string) (os.FileInfo, error) {
			return nil, missing
		}, writeGroupFile(t, "root:x:0:\n"), "", true},
		{"no group file", func(string) (os.FileInfo, error) {
			return nil, missing
		}, filepath.Join(t.TempDir(), "absent"), "", true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := DockerSocketGID(tc.stat, DockerSocketPath, tc.group)
			if (err != nil) != tc.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tc.wantErr)
			}
			if got != tc.want {
				t.Errorf("gid = %q, want %q", got, tc.want)
			}
		})
	}
}
