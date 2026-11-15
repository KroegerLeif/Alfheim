package httpmw

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestResolveAllowedOrigins(t *testing.T) {
	tests := []struct {
		name        string
		raw         string
		set         bool
		environment string
		want        []string
	}{
		{"unset in development keeps the dev hosts", "", false, "development", DevAllowedOrigins},
		{"unset in production allows no cross-origin access", "", false, "production", []string{}},
		{"unset in production (case and spaces)", "", false, " Production ", []string{}},
		{"set empty means none", "", true, "development", []string{}},
		{
			"operator origins are normalised",
			" https://Alfheim.Example.com/ , https://alfheim.example.com:8443", true, "production",
			[]string{"https://alfheim.example.com", "https://alfheim.example.com:8443"},
		},
	}
	for _, tc := range tests {
		got, err := ResolveAllowedOrigins(tc.raw, tc.set, tc.environment)
		if err != nil {
			t.Errorf("%s: error = %v", tc.name, err)
			continue
		}
		if !reflect.DeepEqual(got, tc.want) {
			t.Errorf("%s: got %v, want %v", tc.name, got, tc.want)
		}
	}

	// The returned dev list is a copy: changing it never changes the default.
	got, _ := ResolveAllowedOrigins("", false, "development")
	got[0] = "https://evil.example"
	if DevAllowedOrigins[0] == "https://evil.example" {
		t.Error("ResolveAllowedOrigins returned the shared default slice")
	}
}

func TestParseAllowedOriginsFailsClosed(t *testing.T) {
	for _, bad := range []string{
		"*",
		"https://*.example.com",
		"https://ok.example.com,*",
		"ftp://example.com",
		"example.com",
		"https://example.com/app",
		"https://example.com?x=1",
		"https://example.com#frag",
		"https://user@example.com",
		"https://",
		"https://exa mple.com",
	} {
		if got, err := ParseAllowedOrigins(bad); err == nil {
			t.Errorf("ParseAllowedOrigins(%q) = %v, want an error", bad, got)
		}
	}
}

// TestCORSRejectsAnUnlistedOrigin covers #921 end to end: a production
// backend configured with its own origin answers a preflight only for it.
func TestCORSRejectsAnUnlistedOrigin(t *testing.T) {
	origins, err := ResolveAllowedOrigins("https://alfheim.example.com", true, "production")
	if err != nil {
		t.Fatal(err)
	}
	handler := CORSWithOrigins(CORSConfig{AllowedOrigins: origins, AllowedMethods: []string{"GET"}})(
		http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))

	for origin, allowed := range map[string]bool{
		"https://alfheim.example.com": true,
		"https://evil.example":        false,
		"http://localhost:3000":       false,
	} {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/x", nil)
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		got := rec.Header().Get("Access-Control-Allow-Origin")
		if allowed && got != origin {
			t.Errorf("%s: Access-Control-Allow-Origin = %q, want the origin", origin, got)
		}
		if !allowed && got != "" {
			t.Errorf("%s: an unlisted origin was allowed (%q)", origin, got)
		}
	}
}
