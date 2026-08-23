export type FilterableHeroOption = {
  id: string;
  name_en: string;
  name_ru: string;
};

export function filterHeroOptions<T extends FilterableHeroOption>(
  heroes: T[],
  query: string,
  excludeIds: string[],
  value: string | null,
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  const excludedIds = new Set(excludeIds);

  return heroes
    .filter((hero) => !excludedIds.has(hero.id) || hero.id === value)
    .filter((hero) => {
      if (!normalizedQuery) return true;
      return (
        hero.name_ru.toLowerCase().includes(normalizedQuery) ||
        hero.name_en.toLowerCase().includes(normalizedQuery)
      );
    });
}
