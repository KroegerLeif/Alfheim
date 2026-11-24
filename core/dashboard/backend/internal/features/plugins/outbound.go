package plugins

import (
	"context"
	"errors"
	"net"
	"net/http"
	"sort"
	"strings"
	"time"

	"alfheim/go-shared/netguard"
)

// DefaultTimeout bounds every health check and every outbound plugin request.
const DefaultTimeout = 5 * time.Second

// maxDetailLength caps a stored health detail (the column is VARCHAR(500)).
const maxDetailLength = 500

// redacted replaces a credential value found in a health detail.
const redacted = "[redacted]"

// URLGuard validates an outbound destination before any request is made;
// *netguard.Guard satisfies it.
type URLGuard interface {
	ValidateURL(ctx context.Context, rawURL string) error
}

// NewHTTPClient returns the client every plugin makes its requests with: it
// dials through guard (so the resolved address is checked again at connect
// time), never follows redirects, ignores proxy variables and gives up after
// timeout. main constructs it once and passes it to each plugin constructor.
func NewHTTPClient(guard *netguard.Guard, timeout time.Duration) *http.Client {
	client := guard.NewHTTPClient()
	client.Timeout = timeout
	return client
}

// HealthFromError maps a transport error of a health check request to a
// Health. The detail is a fixed text, never err.Error(): request errors embed
// the URL, which may carry a token in its query.
func HealthFromError(err error) Health {
	var netErr net.Error
	switch {
	case errors.Is(err, netguard.ErrBlocked):
		return Health{Status: StatusHostNotAllowed, Detail: "the address is not in INTEGRATIONS_ALLOWED_HOSTS"}
	case errors.Is(err, context.DeadlineExceeded), errors.As(err, &netErr) && netErr.Timeout():
		return Health{Status: StatusTimeout, Detail: "the target did not answer in time"}
	default:
		return Health{Status: StatusUnreachable, Detail: "the target could not be reached"}
	}
}

// SanitizeDetail removes every credential value from detail, replaces line
// breaks and caps the length, so a health detail can be stored and shown.
func SanitizeDetail(detail string, creds Credentials) string {
	values := make([]string, 0, len(creds))
	for _, v := range creds {
		if v != "" {
			values = append(values, v)
		}
	}
	// Longest first, so a secret that contains another is redacted whole.
	sort.Slice(values, func(i, j int) bool { return len(values[i]) > len(values[j]) })
	for _, v := range values {
		detail = strings.ReplaceAll(detail, v, redacted)
	}
	detail = strings.Join(strings.Fields(detail), " ")
	if r := []rune(detail); len(r) > maxDetailLength {
		detail = string(r[:maxDetailLength])
	}
	return detail
}
