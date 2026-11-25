package actions

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"alfheim/go-shared/household"
)

func rulesRouter(svc *Service) http.Handler {
	r := chi.NewRouter()
	NewHandler(svc, "homeassistant", discardLog()).Mount(r, "/ha")
	return r
}

func call(h http.Handler, method, path string, hh *uuid.UUID, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if hh != nil {
		req = req.WithContext(household.ContextWithHousehold(req.Context(),
			&household.HouseholdContext{HouseholdID: *hh, Role: household.RoleAdmin, Subject: "admin"}))
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHandler_RulesAndEvents(t *testing.T) {
	repo := newMemRepo()
	h := rulesRouter(newTestService(repo, &countingExecutor{}))
	a := hhA
	body := `{"event_type":"washer_finished","action":"chores.create_instance","params":{"template_id":"` + template + `"}}`
	rec := call(h, http.MethodPost, "/ha/rules", &a, body)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"washer_finished"`) {
		t.Fatalf("save: %d %s", rec.Code, rec.Body.String())
	}
	var id uuid.UUID
	for k := range repo.rules {
		id = k
	}
	if rec = call(h, http.MethodGet, "/ha/rules", &a, ""); !strings.Contains(rec.Body.String(), id.String()) {
		t.Fatalf("list: %s", rec.Body.String())
	}
	if rec = call(h, http.MethodGet, "/ha/events", &a, ""); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"items":[]`) {
		t.Fatalf("events: %d %s", rec.Code, rec.Body.String())
	}
	b := hhB
	if rec = call(h, http.MethodDelete, "/ha/rules/"+id.String(), &b, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("B deletes A's rule: %d", rec.Code)
	}
	if rec = call(h, http.MethodDelete, "/ha/rules/not-a-uuid", &a, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("bad id: %d", rec.Code)
	}
	if rec = call(h, http.MethodDelete, "/ha/rules/"+id.String(), &a, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("delete: %d", rec.Code)
	}
	if rec = call(h, http.MethodPost, "/ha/rules", &a, `{"event_type":"x","household_id":"y"}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown field: %d", rec.Code)
	}
	if rec = call(h, http.MethodPost, "/ha/rules", &a, `{"event_type":"x","action":"nope"}`); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("validation: %d", rec.Code)
	}
}

func TestHandler_Failures(t *testing.T) {
	repo := newMemRepo()
	h := rulesRouter(newTestService(repo, &countingExecutor{}))
	a := hhA
	for _, path := range []string{"/ha/rules", "/ha/events"} {
		if rec := call(h, http.MethodGet, path, nil, ""); rec.Code != http.StatusInternalServerError {
			t.Errorf("%s without household: %d", path, rec.Code)
		}
	}
	for _, tc := range []struct{ method, path string }{{http.MethodPost, "/ha/rules"}, {http.MethodDelete, "/ha/rules/" + uuid.NewString()}} {
		if rec := call(h, tc.method, tc.path, nil, "{}"); rec.Code != http.StatusInternalServerError {
			t.Errorf("%s without household: %d", tc.path, rec.Code)
		}
	}
	repo.err = errors.New("db down")
	body := `{"event_type":"x","action":"chores.create_instance","params":{"template_id":"` + template + `"}}`
	if rec := call(h, http.MethodPost, "/ha/rules", &a, body); rec.Code != http.StatusInternalServerError {
		t.Errorf("save failure: %d", rec.Code)
	}
	for _, path := range []string{"/ha/rules", "/ha/events"} {
		if rec := call(h, http.MethodGet, path, &a, ""); rec.Code != http.StatusInternalServerError {
			t.Errorf("%s failure: %d", path, rec.Code)
		}
	}
	id := uuid.New()
	repo.rules[id] = Rule{ID: id, HouseholdID: hhA, PluginType: "homeassistant"}
	if rec := call(h, http.MethodDelete, "/ha/rules/"+id.String(), &a, ""); rec.Code != http.StatusInternalServerError {
		t.Errorf("delete failure: %d", rec.Code)
	}
}
