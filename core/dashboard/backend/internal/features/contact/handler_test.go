package contact

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"alfheim/dashboard/internal/features/household"
	"alfheim/dashboard/internal/shared/middleware"
	"github.com/go-chi/chi/v5"
)

type mockService struct {
	createCategoryFn func(ctx context.Context, requesterID, householdID string, req CreateCategoryRequest) (*ContactCategory, error)
	getCategoriesFn  func(ctx context.Context, requesterID, householdID string) ([]*ContactCategory, error)
	updateCategoryFn func(ctx context.Context, requesterID, householdID, catID string, req CreateCategoryRequest) (*ContactCategory, error)
	deleteCategoryFn func(ctx context.Context, requesterID, householdID, catID string) error

	createContactFn func(ctx context.Context, requesterID, householdID string, req CreateContactRequest) (*Contact, error)
	getContactsFn   func(ctx context.Context, requesterID, householdID string) ([]*Contact, error)
	updateContactFn func(ctx context.Context, requesterID, householdID, contactID string, req CreateContactRequest) (*Contact, error)
	deleteContactFn func(ctx context.Context, requesterID, householdID, contactID string) error
}

func (m *mockService) CreateCategory(ctx context.Context, requesterID, householdID string, req CreateCategoryRequest) (*ContactCategory, error) {
	if m.createCategoryFn != nil {
		return m.createCategoryFn(ctx, requesterID, householdID, req)
	}
	return nil, nil
}

func (m *mockService) GetCategories(ctx context.Context, requesterID, householdID string) ([]*ContactCategory, error) {
	if m.getCategoriesFn != nil {
		return m.getCategoriesFn(ctx, requesterID, householdID)
	}
	return nil, nil
}

func (m *mockService) UpdateCategory(ctx context.Context, requesterID, householdID, catID string, req CreateCategoryRequest) (*ContactCategory, error) {
	if m.updateCategoryFn != nil {
		return m.updateCategoryFn(ctx, requesterID, householdID, catID, req)
	}
	return nil, nil
}

func (m *mockService) DeleteCategory(ctx context.Context, requesterID, householdID, catID string) error {
	if m.deleteCategoryFn != nil {
		return m.deleteCategoryFn(ctx, requesterID, householdID, catID)
	}
	return nil
}

func (m *mockService) CreateContact(ctx context.Context, requesterID, householdID string, req CreateContactRequest) (*Contact, error) {
	if m.createContactFn != nil {
		return m.createContactFn(ctx, requesterID, householdID, req)
	}
	return nil, nil
}

func (m *mockService) GetContacts(ctx context.Context, requesterID, householdID string) ([]*Contact, error) {
	if m.getContactsFn != nil {
		return m.getContactsFn(ctx, requesterID, householdID)
	}
	return nil, nil
}

func (m *mockService) UpdateContact(ctx context.Context, requesterID, householdID, contactID string, req CreateContactRequest) (*Contact, error) {
	if m.updateContactFn != nil {
		return m.updateContactFn(ctx, requesterID, householdID, contactID, req)
	}
	return nil, nil
}

func (m *mockService) DeleteContact(ctx context.Context, requesterID, householdID, contactID string) error {
	if m.deleteContactFn != nil {
		return m.deleteContactFn(ctx, requesterID, householdID, contactID)
	}
	return nil
}

func withUserClaims(req *http.Request, claims *middleware.UserClaims) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserContextKey, claims)
	return req.WithContext(ctx)
}

func TestContactHandler_CreateCategory(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		body           string
		mockFn         func(ctx context.Context, requesterID, householdID string, req CreateCategoryRequest) (*ContactCategory, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			body:           `{"name":"Family"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:           "bad request on invalid json payload",
			claims:         &middleware.UserClaims{Subject: "user-1"},
			hhID:           "hh-1",
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invalid json payload",
		},
		{
			name:   "forbidden when user is unauthorized in household",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			body:   `{"name":"Family"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req CreateCategoryRequest) (*ContactCategory, error) {
				return nil, household.ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "only owners and admins can create categories",
		},
		{
			name:   "internal error on generic service failure",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			body:   `{"name":"Family"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req CreateCategoryRequest) (*ContactCategory, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to create category",
		},
		{
			name:   "success creating category",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			body:   `{"name":"Family","icon":"users","color":"blue"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req CreateCategoryRequest) (*ContactCategory, error) {
				return &ContactCategory{ID: "cat-1", HouseholdID: householdID, Name: req.Name}, nil
			},
			expectedStatus: http.StatusCreated,
			expectedSubstr: "Family",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{createCategoryFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Post("/api/v1/households/{id}/contact-categories", handler.CreateCategory)

			url := "/api/v1/households/" + tt.hhID + "/contact-categories"
			req := httptest.NewRequest(http.MethodPost, url, bytes.NewBufferString(tt.body))
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestContactHandler_GetCategories(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		mockFn         func(ctx context.Context, requesterID, householdID string) ([]*ContactCategory, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:   "forbidden when unauthorized access to household",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			mockFn: func(ctx context.Context, requesterID, householdID string) ([]*ContactCategory, error) {
				return nil, household.ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized access to household",
		},
		{
			name:   "internal error on generic service error",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			mockFn: func(ctx context.Context, requesterID, householdID string) ([]*ContactCategory, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to fetch categories",
		},
		{
			name:   "success getting categories",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			mockFn: func(ctx context.Context, requesterID, householdID string) ([]*ContactCategory, error) {
				return []*ContactCategory{{ID: "cat-1", Name: "Neighbors"}}, nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "Neighbors",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{getCategoriesFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Get("/api/v1/households/{id}/contact-categories", handler.GetCategories)

			url := "/api/v1/households/" + tt.hhID + "/contact-categories"
			req := httptest.NewRequest(http.MethodGet, url, nil)
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestContactHandler_UpdateCategory(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		catID          string
		body           string
		mockFn         func(ctx context.Context, requesterID, householdID, catID string, req CreateCategoryRequest) (*ContactCategory, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			catID:          "cat-1",
			body:           `{"name":"Updated"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:           "bad request on invalid json",
			claims:         &middleware.UserClaims{Subject: "user-1"},
			hhID:           "hh-1",
			catID:          "cat-1",
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invalid json payload",
		},
		{
			name:   "not found when category does not exist",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			catID:  "cat-missing",
			body:   `{"name":"Updated"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, catID string, req CreateCategoryRequest) (*ContactCategory, error) {
				return nil, ErrCategoryNotFound
			},
			expectedStatus: http.StatusNotFound,
			expectedSubstr: "category not found",
		},
		{
			name:   "forbidden when unauthorized to update category",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			catID:  "cat-1",
			body:   `{"name":"Updated"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, catID string, req CreateCategoryRequest) (*ContactCategory, error) {
				return nil, household.ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized access to category",
		},
		{
			name:   "internal error on generic service failure",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			catID:  "cat-1",
			body:   `{"name":"Updated"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, catID string, req CreateCategoryRequest) (*ContactCategory, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to update category",
		},
		{
			name:   "success updating category",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			catID:  "cat-1",
			body:   `{"name":"Updated Category"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, catID string, req CreateCategoryRequest) (*ContactCategory, error) {
				return &ContactCategory{ID: catID, HouseholdID: householdID, Name: req.Name}, nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "Updated Category",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{updateCategoryFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Put("/api/v1/households/{id}/contact-categories/{catId}", handler.UpdateCategory)

			url := "/api/v1/households/" + tt.hhID + "/contact-categories/" + tt.catID
			req := httptest.NewRequest(http.MethodPut, url, bytes.NewBufferString(tt.body))
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestContactHandler_DeleteCategory(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		catID          string
		mockFn         func(ctx context.Context, requesterID, householdID, catID string) error
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			catID:          "cat-1",
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:   "not found when category missing",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			catID:  "cat-missing",
			mockFn: func(ctx context.Context, requesterID, householdID, catID string) error {
				return ErrCategoryNotFound
			},
			expectedStatus: http.StatusNotFound,
			expectedSubstr: "category not found",
		},
		{
			name:   "forbidden when unauthorized",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			catID:  "cat-1",
			mockFn: func(ctx context.Context, requesterID, householdID, catID string) error {
				return household.ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized access to category",
		},
		{
			name:   "internal error on generic error",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			catID:  "cat-1",
			mockFn: func(ctx context.Context, requesterID, householdID, catID string) error {
				return errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to delete category",
		},
		{
			name:   "success deleting category",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			catID:  "cat-1",
			mockFn: func(ctx context.Context, requesterID, householdID, catID string) error {
				return nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "category deleted successfully",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{deleteCategoryFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Delete("/api/v1/households/{id}/contact-categories/{catId}", handler.DeleteCategory)

			url := "/api/v1/households/" + tt.hhID + "/contact-categories/" + tt.catID
			req := httptest.NewRequest(http.MethodDelete, url, nil)
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestContactHandler_CreateContact(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		body           string
		mockFn         func(ctx context.Context, requesterID, householdID string, req CreateContactRequest) (*Contact, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			body:           `{"name":"John Doe"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:           "bad request on invalid json payload",
			claims:         &middleware.UserClaims{Subject: "user-1"},
			hhID:           "hh-1",
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invalid json payload",
		},
		{
			name:   "forbidden when unauthorized in household",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			body:   `{"name":"John Doe"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req CreateContactRequest) (*Contact, error) {
				return nil, household.ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "only owners, admins, and members can create contacts",
		},
		{
			name:   "internal error on generic failure",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			body:   `{"name":"John Doe"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req CreateContactRequest) (*Contact, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to create contact",
		},
		{
			name:   "success creating contact",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			body:   `{"name":"John Doe","email":"john@example.com"}`,
			mockFn: func(ctx context.Context, requesterID, householdID string, req CreateContactRequest) (*Contact, error) {
				return &Contact{ID: "cnt-1", HouseholdID: householdID, Name: req.Name, Email: req.Email}, nil
			},
			expectedStatus: http.StatusCreated,
			expectedSubstr: "John Doe",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{createContactFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Post("/api/v1/households/{id}/contacts", handler.CreateContact)

			url := "/api/v1/households/" + tt.hhID + "/contacts"
			req := httptest.NewRequest(http.MethodPost, url, bytes.NewBufferString(tt.body))
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestContactHandler_GetContacts(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		mockFn         func(ctx context.Context, requesterID, householdID string) ([]*Contact, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:   "forbidden when unauthorized access to household",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			mockFn: func(ctx context.Context, requesterID, householdID string) ([]*Contact, error) {
				return nil, household.ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized access to household",
		},
		{
			name:   "internal error on generic service failure",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			mockFn: func(ctx context.Context, requesterID, householdID string) ([]*Contact, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to fetch contacts",
		},
		{
			name:   "success getting contacts",
			claims: &middleware.UserClaims{Subject: "user-1"},
			hhID:   "hh-1",
			mockFn: func(ctx context.Context, requesterID, householdID string) ([]*Contact, error) {
				return []*Contact{{ID: "cnt-1", Name: "Jane Smith"}}, nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "Jane Smith",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{getContactsFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Get("/api/v1/households/{id}/contacts", handler.GetContacts)

			url := "/api/v1/households/" + tt.hhID + "/contacts"
			req := httptest.NewRequest(http.MethodGet, url, nil)
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestContactHandler_UpdateContact(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		contactID      string
		body           string
		mockFn         func(ctx context.Context, requesterID, householdID, contactID string, req CreateContactRequest) (*Contact, error)
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			contactID:      "cnt-1",
			body:           `{"name":"Jane Doe"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:           "bad request on invalid json payload",
			claims:         &middleware.UserClaims{Subject: "user-1"},
			hhID:           "hh-1",
			contactID:      "cnt-1",
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedSubstr: "invalid json payload",
		},
		{
			name:      "not found when contact missing",
			claims:    &middleware.UserClaims{Subject: "user-1"},
			hhID:      "hh-1",
			contactID: "cnt-missing",
			body:      `{"name":"Jane Doe"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, contactID string, req CreateContactRequest) (*Contact, error) {
				return nil, ErrContactNotFound
			},
			expectedStatus: http.StatusNotFound,
			expectedSubstr: "contact not found",
		},
		{
			name:      "forbidden when unauthorized access",
			claims:    &middleware.UserClaims{Subject: "user-1"},
			hhID:      "hh-1",
			contactID: "cnt-1",
			body:      `{"name":"Jane Doe"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, contactID string, req CreateContactRequest) (*Contact, error) {
				return nil, household.ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized access to contact",
		},
		{
			name:      "internal error on generic failure",
			claims:    &middleware.UserClaims{Subject: "user-1"},
			hhID:      "hh-1",
			contactID: "cnt-1",
			body:      `{"name":"Jane Doe"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, contactID string, req CreateContactRequest) (*Contact, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to update contact",
		},
		{
			name:      "success updating contact",
			claims:    &middleware.UserClaims{Subject: "user-1"},
			hhID:      "hh-1",
			contactID: "cnt-1",
			body:      `{"name":"Jane Updated"}`,
			mockFn: func(ctx context.Context, requesterID, householdID, contactID string, req CreateContactRequest) (*Contact, error) {
				return &Contact{ID: contactID, HouseholdID: householdID, Name: req.Name}, nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "Jane Updated",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{updateContactFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Put("/api/v1/households/{id}/contacts/{contactId}", handler.UpdateContact)

			url := "/api/v1/households/" + tt.hhID + "/contacts/" + tt.contactID
			req := httptest.NewRequest(http.MethodPut, url, bytes.NewBufferString(tt.body))
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestContactHandler_DeleteContact(t *testing.T) {
	tests := []struct {
		name           string
		claims         *middleware.UserClaims
		hhID           string
		contactID      string
		mockFn         func(ctx context.Context, requesterID, householdID, contactID string) error
		expectedStatus int
		expectedSubstr string
	}{
		{
			name:           "unauthorized when claims missing",
			claims:         nil,
			hhID:           "hh-1",
			contactID:      "cnt-1",
			expectedStatus: http.StatusUnauthorized,
			expectedSubstr: "unauthorized",
		},
		{
			name:      "not found when contact missing",
			claims:    &middleware.UserClaims{Subject: "user-1"},
			hhID:      "hh-1",
			contactID: "cnt-missing",
			mockFn: func(ctx context.Context, requesterID, householdID, contactID string) error {
				return ErrContactNotFound
			},
			expectedStatus: http.StatusNotFound,
			expectedSubstr: "contact not found",
		},
		{
			name:      "forbidden when unauthorized access",
			claims:    &middleware.UserClaims{Subject: "user-1"},
			hhID:      "hh-1",
			contactID: "cnt-1",
			mockFn: func(ctx context.Context, requesterID, householdID, contactID string) error {
				return household.ErrUnauthorizedHouseholdAccess
			},
			expectedStatus: http.StatusForbidden,
			expectedSubstr: "unauthorized access to contact",
		},
		{
			name:      "internal error on generic failure",
			claims:    &middleware.UserClaims{Subject: "user-1"},
			hhID:      "hh-1",
			contactID: "cnt-1",
			mockFn: func(ctx context.Context, requesterID, householdID, contactID string) error {
				return errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedSubstr: "failed to delete contact",
		},
		{
			name:      "success deleting contact",
			claims:    &middleware.UserClaims{Subject: "user-1"},
			hhID:      "hh-1",
			contactID: "cnt-1",
			mockFn: func(ctx context.Context, requesterID, householdID, contactID string) error {
				return nil
			},
			expectedStatus: http.StatusOK,
			expectedSubstr: "contact deleted successfully",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockService{deleteContactFn: tt.mockFn}
			handler := NewHandler(svc)

			r := chi.NewRouter()
			r.Delete("/api/v1/households/{id}/contacts/{contactId}", handler.DeleteContact)

			url := "/api/v1/households/" + tt.hhID + "/contacts/" + tt.contactID
			req := httptest.NewRequest(http.MethodDelete, url, nil)
			if tt.claims != nil {
				req = withUserClaims(req, tt.claims)
			}
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.expectedSubstr) {
				t.Errorf("expected body to contain %q, got %q", tt.expectedSubstr, rec.Body.String())
			}
		})
	}
}

func TestContactHandler_RegisterRoutes(t *testing.T) {
	svc := &mockService{
		getContactsFn: func(ctx context.Context, requesterID, householdID string) ([]*Contact, error) {
			return []*Contact{}, nil
		},
	}
	handler := NewHandler(svc)

	r := chi.NewRouter()
	authMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, &middleware.UserClaims{Subject: "user-1"})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	handler.RegisterRoutes(r, authMiddleware)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/households/hh-1/contacts", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200 from registered contact route, got %d", rec.Code)
	}
}
