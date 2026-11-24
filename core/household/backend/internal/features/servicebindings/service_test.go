package servicebindings

import (
	"context"
	"errors"
	"strings"
	"testing"

	"alfheim/household/internal/features/household"
)

func TestService_CreateListRevoke(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc, _ := newTestService(repo)
	req := CreateRequest{PrincipalID: principal, Scopes: []string{scope}}

	b, created, err := svc.Create(ctx, admin, strings.ToUpper(hhID), req)
	if err != nil || !created || b.HouseholdID != hhID || b.CreatedBy != admin {
		t.Fatalf("create: %+v created=%v err=%v", b, created, err)
	}
	_, created, err = svc.Create(ctx, "owner-sub", hhID, CreateRequest{PrincipalID: principal, Scopes: []string{scope, "pantry:add_item"}})
	if err != nil || created {
		t.Fatalf("update: created=%v err=%v", created, err)
	}

	list, err := svc.List(ctx, admin, hhID)
	if err != nil || len(list) != 1 || len(list[0].Scopes) != 2 || list[0].CreatedBy != admin {
		t.Fatalf("list: %+v err=%v", list, err)
	}
	if got, err := svc.Resolve(ctx, hhID, principal); err != nil || got.PrincipalID != principal {
		t.Fatalf("resolve: %+v err=%v", got, err)
	}

	if err := svc.Revoke(ctx, admin, hhID, principal); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	if _, err := svc.Resolve(ctx, hhID, principal); !errors.Is(err, ErrNotFound) {
		t.Fatalf("resolve after revoke: %v", err)
	}
	if err := svc.Revoke(ctx, admin, hhID, principal); !errors.Is(err, ErrNotFound) {
		t.Fatalf("second revoke: %v", err)
	}
}

func TestService_Rejections(t *testing.T) {
	ctx := context.Background()
	svc, _ := newTestService(newFakeRepo())
	ok := CreateRequest{PrincipalID: principal, Scopes: []string{scope}}

	cases := []struct {
		name   string
		caller string
		hh     string
		req    CreateRequest
		want   error
	}{
		{"member may not bind", "member-sub", hhID, ok, ErrForbidden},
		{"stranger may not bind", "stranger", hhID, ok, ErrForbidden},
		{"malformed household", admin, "not-a-uuid", ok, ErrForbidden},
		{"unknown principal", admin, hhID, CreateRequest{PrincipalID: "someone", Scopes: []string{scope}}, ErrUnknownPrincipal},
		{"no scopes", admin, hhID, CreateRequest{PrincipalID: principal}, ErrInvalidScopes},
		{"bad scope", admin, hhID, CreateRequest{PrincipalID: principal, Scopes: []string{"Chores:*"}}, ErrInvalidScopes},
		{"duplicate scope", admin, hhID, CreateRequest{PrincipalID: principal, Scopes: []string{scope, scope}}, ErrInvalidScopes},
		{"too many scopes", admin, hhID, CreateRequest{PrincipalID: principal, Scopes: make([]string, maxScopes+1)}, ErrInvalidScopes},
		{"member cannot be bound", admin, hhID, CreateRequest{PrincipalID: "member-machine", Scopes: []string{scope}}, ErrPrincipalIsMember},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, _, err := svc.Create(ctx, tc.caller, tc.hh, tc.req); !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
	if _, err := svc.List(ctx, "member-sub", hhID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("list by member: %v", err)
	}
	if err := svc.Revoke(ctx, "member-sub", hhID, principal); !errors.Is(err, ErrForbidden) {
		t.Fatalf("revoke by member: %v", err)
	}
	if _, err := svc.Resolve(ctx, hhID, "someone"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("resolve unconfigured principal: %v", err)
	}
}

func TestService_Errors(t *testing.T) {
	ctx := context.Background()
	ok := CreateRequest{PrincipalID: principal, Scopes: []string{scope}}

	svc, roles := newTestService(newFakeRepo())
	roles.err = errDB
	if _, _, err := svc.Create(ctx, admin, hhID, ok); !errors.Is(err, errDB) {
		t.Fatalf("role lookup failure: %v", err)
	}

	failing := &fakeRepo{rows: map[string]Binding{}, err: errDB}
	svc, _ = newTestService(failing)
	if _, _, err := svc.Create(ctx, admin, hhID, ok); !errors.Is(err, errDB) {
		t.Fatalf("upsert failure: %v", err)
	}
	if err := svc.Revoke(ctx, admin, hhID, principal); !errors.Is(err, errDB) {
		t.Fatalf("delete failure: %v", err)
	}

	// A failing principal membership check must not be mistaken for "not a member".
	svc, roles = newTestService(newFakeRepo())
	svc.roles = &principalLookupFails{fakeRoles: roles}
	if _, _, err := svc.Create(ctx, admin, hhID, ok); !errors.Is(err, errDB) {
		t.Fatalf("principal membership check failure: %v", err)
	}
}

type principalLookupFails struct{ *fakeRoles }

func (p *principalLookupFails) GetMemberRole(ctx context.Context, householdID, userID string) (household.HouseholdRole, error) {
	if userID == principal {
		return "", errDB
	}
	return p.fakeRoles.GetMemberRole(ctx, householdID, userID)
}
