// Package system probes the host for the prerequisites an Alfheim install
// needs: a reachable Docker daemon, the Compose v2 plugin, and free ingress
// ports.
package system

import (
	"context"
	"fmt"
	"net"
	"runtime"
	"strings"

	"golang.org/x/mod/semver"

	"alfheim/installer/internal/shared/runner"
)

// minComposeVersion is the lowest Docker Compose release the staged bootstrap
// is known to work with.
const minComposeVersion = "v2.0.0"

// ingressPorts are the ports the Caddy gateway publishes.
var ingressPorts = []int{80, 443}

// PortConflict records a port that could not be bound and, when it could be
// attributed, the container holding it.
type PortConflict struct {
	Port   int
	HeldBy string
}

// Report is the outcome of a host inspection.
type Report struct {
	DockerInstalled bool
	DaemonRunning   bool
	ComposeV2       bool
	ComposeVersion  string
	Port80Free      bool
	Port443Free     bool
	PortConflicts   []PortConflict
	Arch            string
	OS              string
}

// Blocking reports the problems that make an install impossible. A port held
// by our own gateway is not blocking: that is the normal Day-2 re-run.
func (r Report) Blocking() []string {
	var problems []string
	if !r.DockerInstalled {
		problems = append(problems, "Docker is not installed or not on $PATH")
	}
	if r.DockerInstalled && !r.DaemonRunning {
		problems = append(problems, "the Docker daemon is not running")
	}
	if r.DaemonRunning && !r.ComposeV2 {
		problems = append(problems,
			fmt.Sprintf("Docker Compose %s or newer is required (found %q)",
				minComposeVersion, r.ComposeVersion))
	}
	for _, c := range r.PortConflicts {
		if isAlfheimContainer(c.HeldBy) {
			continue
		}
		problems = append(problems,
			fmt.Sprintf("port %d is already in use by %s", c.Port, c.HeldBy))
	}
	return problems
}

// OK reports whether the host is ready for an install.
func (r Report) OK() bool { return len(r.Blocking()) == 0 }

// isAlfheimContainer reports whether a port holder is part of this stack.
func isAlfheimContainer(holder string) bool {
	return strings.HasPrefix(holder, "alfheim_")
}

// Inspector reports host readiness facts.
type Inspector interface {
	Inspect(ctx context.Context) (Report, error)
}

// listenFunc binds a TCP port. It is injectable so that tests can simulate a
// busy port without actually occupying one on the build machine.
type listenFunc func(network, address string) (net.Listener, error)

// HostInspector probes the real host through a Runner.
type HostInspector struct {
	runner runner.Runner
	listen listenFunc
}

// NewInspector returns an Inspector driving the supplied Runner.
func NewInspector(r runner.Runner) *HostInspector {
	return &HostInspector{runner: r, listen: net.Listen}
}

// Inspect gathers every readiness fact. It never returns an error for a failed
// probe: a negative finding belongs in the Report so the TUI can explain it.
func (h *HostInspector) Inspect(ctx context.Context) (Report, error) {
	rep := Report{Arch: runtime.GOARCH, OS: runtime.GOOS}

	if _, err := h.runner.LookPath("docker"); err != nil {
		return rep, nil
	}
	rep.DockerInstalled = true

	res, err := h.runner.Run(ctx, runner.Command{
		Name: "docker",
		Args: []string{"info", "--format", "{{.ServerVersion}}"},
	})
	if err != nil {
		return rep, fmt.Errorf("system: probe docker daemon: %w", err)
	}
	rep.DaemonRunning = res.ExitCode == 0
	if !rep.DaemonRunning {
		return rep, nil
	}

	rep.ComposeVersion, rep.ComposeV2, err = h.composeVersion(ctx)
	if err != nil {
		return rep, err
	}

	h.probePorts(ctx, &rep)
	return rep, nil
}

// composeVersion reports the Compose plugin version and whether it satisfies
// the minimum.
func (h *HostInspector) composeVersion(ctx context.Context) (string, bool, error) {
	res, err := h.runner.Run(ctx, runner.Command{
		Name: "docker",
		Args: []string{"compose", "version", "--short"},
	})
	if err != nil {
		return "", false, fmt.Errorf("system: probe docker compose: %w", err)
	}
	if res.ExitCode != 0 {
		return "", false, nil
	}

	raw := strings.TrimSpace(res.Stdout)
	version := raw
	if !strings.HasPrefix(version, "v") {
		version = "v" + version
	}
	if !semver.IsValid(version) {
		return raw, false, nil
	}
	return raw, semver.Compare(version, minComposeVersion) >= 0, nil
}

// probePorts attempts to bind each ingress port in-process, which avoids
// depending on lsof or ss being installed on a minimal Debian host.
func (h *HostInspector) probePorts(ctx context.Context, rep *Report) {
	for _, port := range ingressPorts {
		free := h.portFree(port)
		switch port {
		case 80:
			rep.Port80Free = free
		case 443:
			rep.Port443Free = free
		}
		if free {
			continue
		}
		rep.PortConflicts = append(rep.PortConflicts, PortConflict{
			Port:   port,
			HeldBy: h.attribute(ctx, port),
		})
	}
}

// portFree reports whether a port can be bound right now.
func (h *HostInspector) portFree(port int) bool {
	ln, err := h.listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}

// attribute makes a best effort to name the container publishing a port.
func (h *HostInspector) attribute(ctx context.Context, port int) string {
	res, err := h.runner.Run(ctx, runner.Command{
		Name: "docker",
		Args: []string{
			"ps", "--filter", fmt.Sprintf("publish=%d", port),
			"--format", "{{.Names}}",
		},
	})
	if err != nil || res.ExitCode != 0 {
		return "an unknown process"
	}
	if name := strings.TrimSpace(res.Stdout); name != "" {
		return strings.Split(name, "\n")[0]
	}
	return "an unknown process"
}
