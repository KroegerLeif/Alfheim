/**
 * Helper to categorize shopping items logically based on product name or metadata.
 * Returns the category key in the "Categories" translation dictionary.
 */
export function getCategoryKeyForItem(name: string, productId?: string | null): string {
  if (productId) return "pantryStock";

  const lower = name.toLowerCase();

  if (
    /apfel|apple|banan|tomate|tomato|salat|lettuce|karotte|carrot|zitrone|lemon|obst|gemüse|fruit|veg|gurke|cucumber|zwiebel|onion|kartoffel|potato/i.test(
      lower
    )
  ) {
    return "produce";
  }

  if (
    /milch|milk|käse|cheese|joghurt|yogurt|butter|sahne|cream|quark|mozzarella|gorgonzola/i.test(
      lower
    )
  ) {
    return "dairy";
  }

  if (/brot|bread|brötchen|bun|roll|toast|croissant|baguette|kuchen|cake/i.test(lower)) {
    return "bakery";
  }

  if (
    /seife|soap|papier|paper|reiniger|cleaner|schwamm|sponge|tuch|towel|spüli|detergent|folie/i.test(
      lower
    )
  ) {
    return "household";
  }

  if (
    /fleisch|meat|hähnchen|chicken|rind|beef|schwein|pork|fisch|fish|lachs|salmon|wurst|sausage|speck|bacon/i.test(
      lower
    )
  ) {
    return "meat";
  }

  if (
    /wasser|water|saft|juice|bier|beer|wein|wine|kaffee|coffee|tee|tea|cola|limo|drink/i.test(
      lower
    )
  ) {
    return "beverages";
  }

  if (
    /nudel|pasta|reis|rice|mehl|flour|zucker|sugar|salz|salt|öl|oil|essig|vinegar|konserve|can|dose|soße|sauce/i.test(
      lower
    )
  ) {
    return "pantry";
  }

  return "other";
}
