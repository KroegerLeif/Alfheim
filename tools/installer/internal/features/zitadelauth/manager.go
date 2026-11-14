package zitadelauth

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// DefaultKeyLifetime is how long a freshly rotated machine key stays valid.
// Every run replaces the key, so the window only matters for an install that
// is left alone: it then needs a one-off recovery PAT (see the installer
// reference) after this long without a run.
const DefaultKeyLifetime = 90 * 24 * time.Hour

// Admin is the slice of the Zitadel Management API key rotation needs, called
// as the machine user itself.
type Admin interface {
	// CurrentUserID returns the id of the user the bearer token belongs to.
	CurrentUserID(ctx context.Context) (string, error)
	// AddMachineKey registers a JSON machine key expiring at expires and
	// returns its id and the key file's JSON, private key included.
	AddMachineKey(ctx context.Context, userID string, expires time.Time) (keyID string, keyJSON []byte, err error)
	// ListMachineKeys returns the ids of every machine key the user holds.
	ListMachineKeys(ctx context.Context, userID string) ([]string, error)
	// RemoveMachineKey deletes one machine key.
	RemoveMachineKey(ctx context.Context, userID, keyID string) error
	// ListPersonalAccessTokens returns the ids of every PAT the user holds.
	ListPersonalAccessTokens(ctx context.Context, userID string) ([]string, error)
	// RemovePersonalAccessToken revokes one PAT.
	RemovePersonalAccessToken(ctx context.Context, userID, tokenID string) error
}

// TokenExchanger trades a machine key for an access token. Exchanger is the
// production implementation.
type TokenExchanger interface {
	Exchange(ctx context.Context, key Key) (string, error)
}

// BootstrapFunc returns a personal access token for the machine user, used
// only when no working machine key is stored: on first install, when an
// existing install migrates, or for recovery after the key expired.
type BootstrapFunc func(ctx context.Context) (string, error)

// Session is the outcome of Acquire.
type Session struct {
	// Token is a short-lived access token for this run. Never log it.
	Token string
	// UsedBootstrap reports that a PAT was needed, so the caller retires
	// every local copy of it.
	UsedBootstrap bool
	// Warnings are non-fatal findings, such as a key or PAT that could not
	// be deleted and stays valid until it expires.
	Warnings []string
}

// Manager obtains a run's access token and rotates the stored machine key.
type Manager struct {
	// KeyFile is where the current machine key is stored (mode 0600).
	KeyFile string
	// Exchanger turns a machine key into an access token.
	Exchanger TokenExchanger
	// Admin returns a Management API client authenticated with token.
	Admin func(token string) Admin
	// KeyLifetime is the expiry given to each new key. Defaults to
	// DefaultKeyLifetime.
	KeyLifetime time.Duration
	// Now is injectable for tests. Defaults to time.Now.
	Now func() time.Time
	// Sleep waits while a new key propagates. Defaults to a real sleep.
	Sleep func(ctx context.Context, d time.Duration) error
}

// Acquire authenticates with the stored key, or with bootstrap's PAT when no
// key works, then rotates: it registers a new key, verifies and stores it,
// and deletes every other key and every PAT the machine user holds. The
// returned token belongs to the new key.
func (m Manager) Acquire(ctx context.Context, bootstrap BootstrapFunc) (Session, error) {
	token, usedBootstrap, warnings, err := m.authenticate(ctx, bootstrap)
	if err != nil {
		return Session{}, err
	}
	fresh, rotateWarnings, err := m.rotate(ctx, token)
	if err != nil {
		return Session{}, err
	}
	return Session{Token: fresh, UsedBootstrap: usedBootstrap, Warnings: append(warnings, rotateWarnings...)}, nil
}

// authenticate returns a token from the stored key when it still works, and
// falls back to the bootstrap PAT when there is no key or Zitadel rejects it
// (expired, or left over from a previous installation).
func (m Manager) authenticate(ctx context.Context, bootstrap BootstrapFunc) (string, bool, []string, error) {
	var warnings []string
	key, found, err := LoadKey(m.KeyFile)
	if err != nil {
		return "", false, nil, err
	}
	if found {
		token, err := m.Exchanger.Exchange(ctx, key)
		if err == nil {
			return token, false, nil, nil
		}
		if !errors.Is(err, ErrRejected) {
			return "", false, nil, err
		}
		warnings = append(warnings, fmt.Sprintf(
			"Zitadel rejected the stored machine key %s (expired, or from an earlier installation); "+
				"falling back to a bootstrap personal access token.", m.KeyFile))
	}
	pat, err := bootstrap(ctx)
	if err != nil {
		if found {
			return "", false, nil, fmt.Errorf("zitadelauth: the stored machine key %s was rejected and no "+
				"bootstrap PAT is available: %w", m.KeyFile, err)
		}
		return "", false, nil, err
	}
	return pat, true, warnings, nil
}

// rotate registers and stores a new key, then deletes every other credential
// of the machine user. Cleanup failures are warnings: the new key is already
// in place, and the next run retries the cleanup.
func (m Manager) rotate(ctx context.Context, token string) (string, []string, error) {
	admin := m.Admin(token)
	userID, err := admin.CurrentUserID(ctx)
	if err != nil {
		return "", nil, fmt.Errorf("zitadelauth: identify the provisioning machine user: %w", err)
	}
	keyID, keyJSON, err := admin.AddMachineKey(ctx, userID, m.now().Add(m.keyLifetime()))
	if err != nil {
		return "", nil, fmt.Errorf("zitadelauth: register a new machine key: %w", err)
	}
	fresh, err := m.verify(ctx, keyJSON)
	if err == nil {
		err = WriteKey(m.KeyFile, keyJSON)
	}
	if err != nil {
		// Do not leave an orphaned, valid key behind in Zitadel.
		if rmErr := admin.RemoveMachineKey(ctx, userID, keyID); rmErr != nil {
			err = errors.Join(err, fmt.Errorf("zitadelauth: delete the unused key %s: %w", keyID, rmErr))
		}
		return "", nil, err
	}
	return fresh, m.revokeOthers(ctx, m.Admin(fresh), userID, keyID), nil
}

// verify proves the new key works before it replaces the stored one. Zitadel
// can take a moment to accept a key it just created, so a rejection is
// retried a few times.
func (m Manager) verify(ctx context.Context, keyJSON []byte) (string, error) {
	key, err := ParseKey(keyJSON)
	if err != nil {
		return "", err
	}
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		if attempt > 0 {
			if err := m.sleep(ctx, time.Second); err != nil {
				return "", err
			}
		}
		token, err := m.Exchanger.Exchange(ctx, key)
		if err == nil {
			return token, nil
		}
		if !errors.Is(err, ErrRejected) {
			return "", fmt.Errorf("zitadelauth: verify the new machine key: %w", err)
		}
		lastErr = err
	}
	return "", fmt.Errorf("zitadelauth: verify the new machine key: %w", lastErr)
}
