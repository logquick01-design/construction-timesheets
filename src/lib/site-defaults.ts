export const DEFAULT_CATEGORY_NAMES = [
  "Instructed Works",
  "Contra Charge Works",
  "Provisional Sum Works",
  "Other",
] as const;

export async function seedDefaultCategories(
  siteId: string,
  create: (args: { data: { name: string; sortOrder: number; siteId: string } }) => Promise<unknown>
) {
  await Promise.all(
    DEFAULT_CATEGORY_NAMES.map((name, i) =>
      create({ data: { name, sortOrder: i, siteId } })
    )
  );
}
