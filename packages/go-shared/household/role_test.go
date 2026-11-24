package household

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestRequireHouseholdRole(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mw := RequireHouseholdRole(log, RoleOwner, RoleAdmin)(ok)

	tests := []struct {
		name     string
		hc       *HouseholdContext
		wantCode int
		wantErr  string
	}{
		{name: "owner passes", hc: &HouseholdContext{HouseholdID: uuid.New(), Role: RoleOwner, Subject: "u"}, wantCode: http.StatusNoContent},
		{name: "admin passes", hc: &HouseholdContext{HouseholdID: uuid.New(), Role: RoleAdmin, Subject: "u"}, wantCode: http.StatusNoContent},
		{name: "member is forbidden", hc: &HouseholdContext{HouseholdID: uuid.New(), Role: RoleMember, Subject: "u"}, wantCode: http.StatusForbidden, wantErr: CodeHouseholdRoleForbidden},
		{name: "guest is forbidden", hc: &HouseholdContext{HouseholdID: uuid.New(), Role: RoleGuest, Subject: "u"}, wantCode: http.StatusForbidden, wantErr: CodeHouseholdRoleForbidden},
		{name: "missing context fails closed", hc: nil, wantCode: http.StatusInternalServerError, wantErr: CodeHouseholdContextMissing},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", nil)
			if tc.hc != nil {
				req = req.WithContext(ContextWithHousehold(req.Context(), tc.hc))
			}
			rec := httptest.NewRecorder()
			mw.ServeHTTP(rec, req)
			if rec.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d", rec.Code, tc.wantCode)
			}
			if tc.wantErr == "" {
				return
			}
			var body errorBody
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode body: %v", err)
			}
			if body.Detail.Code != tc.wantErr {
				t.Fatalf("code = %q, want %q", body.Detail.Code, tc.wantErr)
			}
		})
	}
}

func TestRequireHouseholdRole_NoRolesAdmitsNobody(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	called := false
	mw := RequireHouseholdRole(log)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { called = true }))
	req := httptest.NewRequest(http.MethodDelete, "/", nil)
	req = req.WithContext(ContextWithHousehold(req.Context(), &HouseholdContext{HouseholdID: uuid.New(), Role: RoleOwner}))
	rec := httptest.NewRecorder()
	mw.ServeHTTP(rec, req)
	if called || rec.Code != http.StatusForbidden {
		t.Fatalf("called=%v status=%d, want handler not called and 403", called, rec.Code)
	}
}
