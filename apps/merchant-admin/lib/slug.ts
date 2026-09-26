/** Turns free text into a storefront URL slug: "Classic Oxford Shirt!" -> "classic-oxford-shirt". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
