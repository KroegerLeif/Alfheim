package httpjson

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteError(t *testing.T) {
	rec := httptest.NewRecorder()
	WriteError(rec, http.StatusConflict, "conflict", "already a member")

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content type = %q", ct)
	}
	var body ErrorBody
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body != (ErrorBody{Error: "conflict", Message: "already a member"}) {
		t.Fatalf("body = %+v", body)
	}
}

func TestWriteUnauthorized(t *testing.T) {
	rec := httptest.NewRecorder()
	WriteUnauthorized(rec)
	var body ErrorBody
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusUnauthorized || body.Error != "unauthorized" || body.Message == "" {
		t.Fatalf("unexpected response %d %+v", rec.Code, body)
	}
}

func TestWrite(t *testing.T) {
	rec := httptest.NewRecorder()
	Write(rec, http.StatusCreated, map[string]int{"n": 1})
	if rec.Code != http.StatusCreated || rec.Body.String() != "{\"n\":1}\n" {
		t.Fatalf("unexpected response %d %q", rec.Code, rec.Body.String())
	}
}
