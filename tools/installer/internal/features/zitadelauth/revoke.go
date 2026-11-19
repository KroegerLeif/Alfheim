package zitadelauth

import (
	"context"
	"fmt"
	"time"
)

// revokeOthers deletes every machine key except keep and every PAT, which
// retires the first-instance PAT and any recovery PAT an operator created.
func (m Manager) revokeOthers(ctx context.Context, admin Admin, userID, keep string) []string {
	var warnings []string
	warn := func(what string, err error) {
		warnings = append(warnings, fmt.Sprintf(
			"Could not delete %s of the Zitadel provisioning machine user (it stays valid until it expires; "+
				"the next alfheim-setup run retries): %v", what, err))
	}
	keys, err := admin.ListMachineKeys(ctx, userID)
	if err != nil {
		warn("old machine keys", err)
	}
	for _, id := range keys {
		if id == keep {
			continue
		}
		if err := admin.RemoveMachineKey(ctx, userID, id); err != nil {
			warn("machine key "+id, err)
		}
	}
	pats, err := admin.ListPersonalAccessTokens(ctx, userID)
	if err != nil {
		warn("personal access tokens", err)
	}
	for _, id := range pats {
		if err := admin.RemovePersonalAccessToken(ctx, userID, id); err != nil {
			warn("personal access token "+id, err)
		}
	}
	return warnings
}

func (m Manager) keyLifetime() time.Duration {
	if m.KeyLifetime > 0 {
		return m.KeyLifetime
	}
	return DefaultKeyLifetime
}

func (m Manager) now() time.Time {
	if m.Now != nil {
		return m.Now()
	}
	return time.Now()
}

func (m Manager) sleep(ctx context.Context, d time.Duration) error {
	if m.Sleep != nil {
		return m.Sleep(ctx, d)
	}
	return realSleep(ctx, d)
}
