package runner

import (
	"bytes"
	"context"
	"runtime"
	"strings"
	"testing"
)

func TestExecRunner_StreamOnlySkipsBuffering(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX shell utilities are unavailable")
	}
	var sink bytes.Buffer
	res, err := NewExec().Run(context.Background(), Command{
		Name: "echo", Args: []string{"payload"}, Stdout: &sink, StreamOnly: true,
	})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if sink.String() != "payload\n" {
		t.Errorf("sink = %q, want the streamed output", sink.String())
	}
	if res.Stdout != "" {
		t.Errorf("Result.Stdout = %q, want it empty when StreamOnly is set", res.Stdout)
	}
}

func TestExecRunner_ForwardsStdin(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("POSIX shell utilities are unavailable")
	}
	res, err := NewExec().Run(context.Background(), Command{
		Name: "cat", Stdin: strings.NewReader("from stdin"),
	})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if res.Stdout != "from stdin" {
		t.Errorf("Stdout = %q, want the forwarded stdin", res.Stdout)
	}
}
