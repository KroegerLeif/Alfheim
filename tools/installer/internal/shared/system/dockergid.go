package system

import (
	"bufio"
	"errors"
	"os"
	"strconv"
	"strings"
	"syscall"
)

const (
	// DockerSocketPath is where the Docker daemon listens on the host.
	DockerSocketPath = "/var/run/docker.sock"
	// GroupFilePath is the host's group database.
	GroupFilePath = "/etc/group"
)

// StatFunc is os.Stat, injectable for tests.
type StatFunc func(path string) (os.FileInfo, error)

// DockerSocketGID returns the numeric id of the group that owns the Docker
// socket, which containers joined through group_add need to read it. It
// stats socketPath and, when the owner cannot be read from the file info,
// falls back to the `docker` group in groupFile. An error means neither
// source produced a group id.
func DockerSocketGID(stat StatFunc, socketPath, groupFile string) (string, error) {
	info, statErr := stat(socketPath)
	if statErr == nil {
		if sys, ok := info.Sys().(*syscall.Stat_t); ok {
			return strconv.FormatUint(uint64(sys.Gid), 10), nil
		}
		statErr = errors.New("file owner is not available on this platform")
	}

	gid, groupErr := dockerGroupGID(groupFile)
	if groupErr == nil {
		return gid, nil
	}
	return "", errors.Join(statErr, groupErr)
}

// dockerGroupGID reads the gid of the `docker` group from a group(5) file.
func dockerGroupGID(groupFile string) (string, error) {
	f, err := os.Open(groupFile)
	if err != nil {
		return "", err
	}
	defer func() { _ = f.Close() }()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Split(scanner.Text(), ":")
		if len(fields) >= 3 && fields[0] == "docker" {
			if _, err := strconv.ParseUint(fields[2], 10, 32); err != nil {
				return "", err
			}
			return fields[2], nil
		}
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	return "", errors.New("no docker group in " + groupFile)
}
