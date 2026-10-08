package membership

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strings"
	"testing"

	"alfheim/household/internal/features/household"
)

// GetMembers lists the members recorded in roles for one household.
func (f *fakeReader) GetMembers(ctx context.Context, householdID string) ([]*household.Member, error) {
	if f.err != nil {
		return nil, f.err
	}
	var members []*household.Member
	for key, role := range f.roles {
		hh, user, _ := strings.Cut(key, "|")
		if hh == householdID {
			members = append(members, &household.Member{HouseholdID: hh, UserID: user, Role: role})
		}
	}
	sort.Slice(members, func(i, j int) bool { return members[i].UserID < members[j].UserID })
	return members, nil
}

func TestDeriveAppUserID(t *testing.T) {
	// Reference values from Python: uuid.uuid5(uuid.NAMESPACE_DNS, sub) and str(uuid.UUID(sub)).
	cases := map[string]string{
		"312345678901234567":                     "c998f809-fc32-5411-a17b-e71ba9c65c78",
		"{0B9F6C2E-4F5A-4C1D-9E0A-6A1C2B3D4E5F}": "0b9f6c2e-4f5a-4c1d-9e0a-6a1c2b3d4e5f",
		hhID:                                     hhID,
	}
	for sub, want := range cases {
		if got := DeriveAppUserID(sub); got != want {
			t.Errorf("DeriveAppUserID(%q) = %q, want %q", sub, got, want)
		}
	}
}

func TestListMembers(t *testing.T) {
	uuidSub := "6f1c2b3d-4e5f-4a1b-9c0d-0b9f6c2e4f5a"
	reader := &fakeReader{roles: map[string]household.HouseholdRole{
		hhID + "|312345678901234567": household.RoleOwner,
		hhID + "|" + uuidSub:         household.RoleMember,
		"other|someone":              household.RoleAdmin,
	}}
	h := newRouter(reader, token, nil)
	path := "/internal/v1/households/" + hhID + "/members"

	t.Run("200 lists subjects, derived ids and roles", func(t *testing.T) {
		rec := do(h, path, "Bearer "+token)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
		if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
			t.Errorf("content type %q", ct)
		}
		var got MembersResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		want := MembersResponse{HouseholdID: hhID, Members: []MemberEntry{
			{UserID: "312345678901234567", AppUserID: "c998f809-fc32-5411-a17b-e71ba9c65c78", Role: "OWNER"},
			{UserID: uuidSub, AppUserID: uuidSub, Role: "MEMBER"},
		}}
		if got.HouseholdID != want.HouseholdID || len(got.Members) != 2 || got.Members[0] != want.Members[0] || got.Members[1] != want.Members[1] {
			t.Errorf("unexpected body %+v", got)
		}
	})

	t.Run("404 for an unknown household", func(t *testing.T) {
		rec := do(h, "/internal/v1/households/11111111-1111-1111-1111-111111111111/members", "Bearer "+token)
		if rec.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", rec.Code)
		}
	})

	t.Run("401 before input validation", func(t *testing.T) {
		for _, p := range []string{path, "/internal/v1/households/not-a-uuid/members"} {
			if rec := do(h, p, "Bearer wrong"); rec.Code != http.StatusUnauthorized {
				t.Errorf("%s: expected 401, got %d", p, rec.Code)
			}
		}
	})

	t.Run("400 on non-UUID household id", func(t *testing.T) {
		if rec := do(h, "/internal/v1/households/not-a-uuid/members", "Bearer "+token); rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", rec.Code)
		}
	})

	t.Run("503 when the internal token is not configured", func(t *testing.T) {
		if rec := do(newRouter(reader, "", nil), path, "Bearer "+token); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("expected 503, got %d", rec.Code)
		}
	})

	t.Run("500 on repository failure", func(t *testing.T) {
		failing := newRouter(&fakeReader{err: errors.New("db down")}, token, nil)
		if rec := do(failing, path, "Bearer "+token); rec.Code != http.StatusInternalServerError {
			t.Errorf("expected 500, got %d", rec.Code)
		}
	})
}
