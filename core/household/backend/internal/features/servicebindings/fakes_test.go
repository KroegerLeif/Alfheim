package servicebindings

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"time"

	"alfheim/household/internal/features/household"
)

const (
	hhID      = "0b9f6c2e-4f5a-4c1d-9e0a-6a1c2b3d4e5f"
	principal = "integrations-sub"
	admin     = "admin-sub"
	scope     = "chores:create_instance"
)

var errDB = errors.New("db down")

type fakeRoles struct {
	roles map[string]household.HouseholdRole // key: household|user
	err   error
}

func (f *fakeRoles) GetMemberRole(_ context.Context, householdID, userID string) (household.HouseholdRole, error) {
	if f.err != nil {
		return "", f.err
	}
	role, ok := f.roles[householdID+"|"+userID]
	if !ok {
		return "", household.ErrUnauthorizedHouseholdAccess
	}
	return role, nil
}

type fakeRepo struct {
	rows map[string]Binding // key: household|principal
	err  error
}

func newFakeRepo() *fakeRepo { return &fakeRepo{rows: map[string]Binding{}} }

func (f *fakeRepo) Upsert(_ context.Context, b *Binding) (bool, error) {
	if f.err != nil {
		return false, f.err
	}
	key := b.HouseholdID + "|" + b.PrincipalID
	existing, ok := f.rows[key]
	if ok {
		b.CreatedBy, b.CreatedAt = existing.CreatedBy, existing.CreatedAt
	} else {
		b.CreatedAt = time.Unix(1_700_000_000, 0).UTC()
	}
	f.rows[key] = *b
	return !ok, nil
}

func (f *fakeRepo) List(_ context.Context, householdID string) ([]Binding, error) {
	if f.err != nil {
		return nil, f.err
	}
	out := []Binding{}
	for _, b := range f.rows {
		if b.HouseholdID == householdID {
			out = append(out, b)
		}
	}
	return out, nil
}

func (f *fakeRepo) Find(_ context.Context, householdID, principalID string) (Binding, error) {
	if f.err != nil {
		return Binding{}, f.err
	}
	b, ok := f.rows[householdID+"|"+principalID]
	if !ok {
		return Binding{}, ErrNotFound
	}
	return b, nil
}

func (f *fakeRepo) Delete(_ context.Context, householdID, principalID string) error {
	if f.err != nil {
		return f.err
	}
	key := householdID + "|" + principalID
	if _, ok := f.rows[key]; !ok {
		return ErrNotFound
	}
	delete(f.rows, key)
	return nil
}

func discardLog() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// newTestService has admin as ADMIN, "member-sub" as MEMBER and "owner-sub"
// as OWNER of hhID, and principal as the only configured service principal.
func newTestService(repo Repository) (*Service, *fakeRoles) {
	roles := &fakeRoles{roles: map[string]household.HouseholdRole{
		hhID + "|" + admin:       household.RoleAdmin,
		hhID + "|owner-sub":      household.RoleOwner,
		hhID + "|member-sub":     household.RoleMember,
		hhID + "|member-machine": household.RoleMember,
	}}
	return NewService(repo, roles, NewPrincipals([]string{principal, " ", principal, "member-machine"}), discardLog()), roles
}
