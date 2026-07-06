"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { 
  useProducts, 
  useSearchProducts, 
  useCreateProduct 
} from "../services/productService";
import { useCategories } from "@/features/categories/services/categoryService";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  Loader2, 
  Check, 
  AlertCircle, 
  Barcode 
} from "lucide-react";

/**
 * ProductCatalogView Component
 * Renders the master database control panel for Product Blueprints (Stammdaten).
 * Left Panel: Searchable list of global templates and custom items.
 * Right Panel: High-contrast validation form for creating new blueprints.
 */
export function ProductCatalogView() {
  const t = useTranslations("Products");

  // Form states
  const [name, setName] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [barcode, setBarcode] = React.useState("");
  const [baseUnit, setBaseUnit] = React.useState("piece");
  const [minimumStock, setMinimumStock] = React.useState<number>(0);
  const [categoryId, setCategoryId] = React.useState("");
  
  // Feedback states
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Search state & debounce
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Queries & Mutations
  const { data: allProducts = [], isLoading: isLoadingAll } = useProducts();
  const { data: searchResults = [], isLoading: isSearching } = useSearchProducts(debouncedQuery);
  const { data: categories = [] } = useCategories();
  const createProductMut = useCreateProduct();

  // Determine active product list based on whether a search query is active
  const isSearchActive = debouncedQuery.trim().length > 0;
  const products = isSearchActive ? searchResults : allProducts;
  const isLoadingList = isSearchActive ? isSearching : isLoadingAll;

  // Clear messages helper
  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Form submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!name.trim()) {
      setErrorMessage("Product name is required.");
      return;
    }

    createProductMut.mutate(
      {
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: barcode.trim() || null,
        base_unit: baseUnit,
        minimum_stock: Number(minimumStock) || 0,
        category_id: categoryId || null,
        nutrition: null,
      },
      {
        onSuccess: () => {
          setSuccessMessage(t("success"));
          // Reset form fields
          setName("");
          setBrand("");
          setBarcode("");
          setBaseUnit("piece");
          setMinimumStock(0);
          setCategoryId("");
          
          // Clear success message after 4 seconds
          setTimeout(() => {
            setSuccessMessage(null);
          }, 4000);
        },
        onError: (error: any) => {
          setErrorMessage(error.message || "Failed to create product blueprint.");
        }
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background text-foreground font-mono">
      {/* Header Banner */}
      <div className="p-8 border-b border-border bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-wide leading-none select-none">
            {t("title")}
          </h1>
          <p className="uppercase tracking-widest text-[10px] text-muted-foreground mt-2 font-mono">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
        
        {/* Left Side: Product List Search & Feed (2 Cols) */}
        <div className="lg:col-span-2 p-8 flex flex-col min-h-0">
          
          {/* Search bar input container */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-12 pr-4 py-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase"
            />
          </div>

          {/* List Feed Scrollpane */}
          <div className="flex-1 overflow-y-auto space-y-4 max-h-[calc(100vh-270px)] pr-2">
            {isLoadingList ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
                  SYNCING BLUEPRINTS...
                </span>
              </div>
            ) : products.length === 0 ? (
              <div className="border border-dashed border-neutral-300 p-8 text-center text-xs text-muted-foreground uppercase tracking-widest">
                {t("noProducts")}
              </div>
            ) : (
              products.map((product) => {
                const category = categories.find(cat => cat.id === product.category_id);
                return (
                  <div 
                    key={product.id} 
                    className="border border-border p-4 bg-white hover:border-black transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading text-lg font-bold uppercase truncate tracking-wide text-foreground">
                          {product.name}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 uppercase ${
                          product.is_global 
                            ? "bg-black text-white" 
                            : "border border-black text-black"
                        }`}>
                          {product.is_global ? t("global") : t("custom")}
                        </span>
                      </div>
                      
                      {/* Technical specifications grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px] text-muted-foreground uppercase">
                        <div>
                          <span className="font-bold text-foreground">{t("brandLabel")}:</span>{" "}
                          <span className="truncate block font-mono">{product.brand || "—"}</span>
                        </div>
                        <div>
                          <span className="font-bold text-foreground">{t("category")}:</span>{" "}
                          <span className="truncate block font-mono">
                            {category ? category.name : t("allCategories")}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-foreground">{t("barcodeLabel")}:</span>{" "}
                          <span className="truncate block font-mono">{product.barcode || "—"}</span>
                        </div>
                        <div>
                          <span className="font-bold text-foreground">{t("minStockLabel")}:</span>{" "}
                          <span className="truncate block font-mono">
                            {product.minimum_stock} {product.base_unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Create New Product Blueprint Form (1 Col) */}
        <div className="lg:col-span-1 p-8 bg-neutral-50 flex flex-col">
          <div className="border border-border bg-white p-6 space-y-6">
            <h2 className="text-2xl font-heading font-black tracking-wide border-b border-border pb-3">
              {t("createTitle")}
            </h2>

            {/* Error or Success notification cards */}
            {errorMessage && (
              <div className="border border-destructive bg-red-50 text-destructive p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="border border-emerald-600 bg-emerald-50 text-emerald-950 p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal">
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Product Name Input */}
              <div className="space-y-1.5">
                <label htmlFor="product-name" className="text-xs font-bold uppercase tracking-wider block">
                  {t("name")} *
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearMessages();
                  }}
                  placeholder="e.g. Potatoes"
                  required
                  className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase font-mono"
                />
              </div>

              {/* Brand Input */}
              <div className="space-y-1.5">
                <label htmlFor="product-brand" className="text-xs font-bold uppercase tracking-wider block">
                  {t("brand")}
                </label>
                <input
                  id="product-brand"
                  type="text"
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    clearMessages();
                  }}
                  placeholder="e.g. Bauernhof"
                  className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase font-mono"
                />
              </div>

              {/* Barcode/EAN Input */}
              <div className="space-y-1.5">
                <label htmlFor="product-barcode" className="text-xs font-bold uppercase tracking-wider block flex items-center gap-1.5">
                  <Barcode className="h-3.5 w-3.5 text-neutral-500" />
                  {t("barcode")}
                </label>
                <input
                  id="product-barcode"
                  type="text"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    clearMessages();
                  }}
                  placeholder="e.g. 40082345 (Leave empty for fresh food)"
                  className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase font-mono"
                />
              </div>

              {/* Category selector */}
              <div className="space-y-1.5">
                <label htmlFor="product-category" className="text-xs font-bold uppercase tracking-wider block">
                  {t("category")}
                </label>
                <select
                  id="product-category"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    clearMessages();
                  }}
                  className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase"
                >
                  <option value="">{t("allCategories")}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Base Unit selector */}
                <div className="space-y-1.5">
                  <label htmlFor="product-base-unit" className="text-xs font-bold uppercase tracking-wider block">
                    {t("baseUnit")}
                  </label>
                  <select
                    id="product-base-unit"
                    value={baseUnit}
                    onChange={(e) => {
                      setBaseUnit(e.target.value);
                      clearMessages();
                    }}
                    className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase"
                  >
                    <option value="piece">PIECE</option>
                    <option value="g">GRAMS (G)</option>
                    <option value="ml">MILLILITERS (ML)</option>
                    <option value="m">METERS (M)</option>
                  </select>
                </div>

                {/* Minimum Stock Threshold Input */}
                <div className="space-y-1.5">
                  <label htmlFor="product-minimum-stock" className="text-xs font-bold uppercase tracking-wider block text-nowrap truncate">
                    {t("minStockLabel")}
                  </label>
                  <input
                    id="product-minimum-stock"
                    type="number"
                    step="any"
                    min="0"
                    value={minimumStock}
                    onChange={(e) => {
                      setMinimumStock(Math.max(0, parseFloat(e.target.value) || 0));
                      clearMessages();
                    }}
                    className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={createProductMut.isPending}
                  className="w-full py-6 text-xs font-black tracking-widest border-2 border-black hover:bg-black hover:text-white cursor-pointer select-none transition-all flex items-center justify-center gap-2"
                >
                  {createProductMut.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("creating")}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      {t("submit")}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
