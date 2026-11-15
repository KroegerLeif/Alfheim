package conversations

import "time"

// SetToolDiscoveryTimeout shortens the per-server discovery timeout for a
// test and returns a function restoring it.
func SetToolDiscoveryTimeout(d time.Duration) func() {
	prev := toolDiscoveryTimeout
	toolDiscoveryTimeout = d
	return func() { toolDiscoveryTimeout = prev }
}
