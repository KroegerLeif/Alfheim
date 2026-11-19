// Package signup decides who may create a household on an instance that
// restricts sign-ups (ADR 0009, #923). With ALFHEIM_SIGNUP_ALLOWLIST set, a
// caller who is not a member of any household yet may create one only when
// their verified e-mail address, or its domain, is listed. Joining through an
// invite is never restricted.
package signup

import (
	"errors"
	"fmt"
	"net/mail"
	"strings"
)

// ErrNotAllowed reports a caller the allowlist does not admit.
var ErrNotAllowed = errors.New("sign-up is restricted on this instance")

// Allowlist holds exact e-mail addresses and whole domains. The zero value is
// disabled: everyone may create a household (ADR 0008 behaviour).
type Allowlist struct {
	emails  map[string]bool
	domains map[string]bool
}

// ParseAllowlist parses ALFHEIM_SIGNUP_ALLOWLIST: comma-separated entries,
// each either an e-mail address (alice@example.com) or a domain written as
// @example.com or example.com. Matching ignores case. A malformed entry
// rejects the whole list, so a typo never opens the instance.
func ParseAllowlist(raw string) (Allowlist, error) {
	list := Allowlist{emails: map[string]bool{}, domains: map[string]bool{}}
	for _, entry := range strings.Split(raw, ",") {
		entry = strings.ToLower(strings.TrimSpace(entry))
		if entry == "" {
			continue
		}
		if domain, ok := strings.CutPrefix(entry, "@"); ok {
			if !validDomain(domain) {
				return Allowlist{}, fmt.Errorf("signup allowlist: %q is not a valid domain", entry)
			}
			list.domains[domain] = true
			continue
		}
		if strings.Contains(entry, "@") {
			addr, err := mail.ParseAddress(entry)
			if err != nil || addr.Address != entry || !validDomain(domainOf(entry)) {
				return Allowlist{}, fmt.Errorf("signup allowlist: %q is not a valid e-mail address", entry)
			}
			list.emails[entry] = true
			continue
		}
		if !validDomain(entry) {
			return Allowlist{}, fmt.Errorf("signup allowlist: %q is neither an e-mail address nor a domain", entry)
		}
		list.domains[entry] = true
	}
	return list, nil
}

// Enabled reports whether the allowlist restricts sign-ups.
func (l Allowlist) Enabled() bool {
	return len(l.emails) > 0 || len(l.domains) > 0
}

// Allows reports whether email is listed, directly or through its domain.
// Callers must only pass a verified address.
func (l Allowlist) Allows(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || !strings.Contains(email, "@") {
		return false
	}
	return l.emails[email] || l.domains[domainOf(email)]
}

func domainOf(email string) string {
	return email[strings.LastIndex(email, "@")+1:]
}

// validDomain accepts host names with at least one dot and DNS-safe labels.
func validDomain(d string) bool {
	if len(d) > 253 || !strings.Contains(d, ".") {
		return false
	}
	for _, label := range strings.Split(d, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, r := range label {
			if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-') {
				return false
			}
		}
	}
	return true
}
