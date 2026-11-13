package bootstrap

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	"alfheim/installer/internal/shared/runner"
)

func TestStartAndRemoveServices(t *testing.T) {
	rec := runner.NewRecording(nil)
	o := New(rec, testLayout)
	ctx := context.Background()
	svcs := []string{"pantry-backend", "pantry-frontend"}

	if err := o.StartServices(ctx, svcs); err != nil {
		t.Fatal(err)
	}
	if err := o.RemoveServices(ctx, svcs); err != nil {
		t.Fatal(err)
	}
	want := []string{
		"docker compose -f " + composeFile + " pull pantry-backend pantry-frontend",
		"docker compose -f " + composeFile + " up -d pantry-backend pantry-frontend",
		"docker compose -f " + composeFile + " rm -s -f pantry-backend pantry-frontend",
	}
	if got := rec.CallStrings(); !reflect.DeepEqual(got, want) {
		t.Errorf("calls =\n%v\nwant\n%v", got, want)
	}
	for _, c := range rec.CallStrings() {
		if strings.Contains(c, " -v") || strings.Contains(c, "down") {
			t.Errorf("command may remove data: %s", c)
		}
	}
}

func TestServicesRejectEmptyListAndFailures(t *testing.T) {
	ctx := context.Background()
	o := New(runner.NewRecording(nil), testLayout)
	if err := o.StartServices(ctx, nil); !errors.Is(err, errNoServices) {
		t.Errorf("StartServices(nil) = %v", err)
	}
	if err := o.RemoveServices(ctx, nil); !errors.Is(err, errNoServices) {
		t.Errorf("RemoveServices(nil) = %v", err)
	}

	for _, key := range []string{
		"docker compose -f " + composeFile + " pull chat-backend",
		"docker compose -f " + composeFile + " up -d chat-backend",
		"docker compose -f " + composeFile + " rm -s -f chat-backend",
	} {
		rec := runner.NewRecording(nil)
		rec.ScriptResult(key, runner.Result{ExitCode: 1, Stderr: "boom"})
		o := New(rec, testLayout)
		var err error
		if strings.Contains(key, " rm ") {
			err = o.RemoveServices(ctx, []string{"chat-backend"})
		} else {
			err = o.StartServices(ctx, []string{"chat-backend"})
		}
		if err == nil {
			t.Errorf("%s: failure was not reported", key)
		}
	}
}
